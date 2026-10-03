import { getPool } from './connection.js';
import { ReferralStore } from './referralStore.js';
import { OrdersStore } from './ordersStore.js';
import { AuthStore } from './authStore.js';
import { inEarnPeriod, earnSignals, type EarnQuery } from '../services/adminEarnQuery.js';
import type { EarnMetrics, EarnReferrer, EarnOverview, EarnPage, EarnLedgerRow, EarnDetail, EarnCustomerSummary } from '../types/adminEarn.js';

const metricKeys = ['rawClicks','uniqueVisitors','referredCustomers','lifetimeReferredCustomers','firstConversions','repeatConversions','qualifyingOrders',
  'convertedCustomers','paidRevenueMinor','deliveredRevenueMinor','pendingRewardsMinor','approvedRewardsMinor','reversedRewardsMinor','rewardExpenseMinor','grossMarginMinor','costKnownOrders'] as const;
const emptyMetrics = (): EarnMetrics => Object.fromEntries(metricKeys.map(key => [key, 0])) as unknown as EarnMetrics;
function numeric(value: unknown): number { const result = Number(value || 0); if (!Number.isSafeInteger(result)) throw new Error('Earn metric exceeds safe integer range.'); return result; }
function decorate(row: any): EarnReferrer {
  for (const key of metricKeys) row[key] = numeric(row[key]);
  const rate = row.uniqueVisitors ? Number((100 * row.convertedCustomers / row.uniqueVisitors).toFixed(2)) : 0;
  return { ...row, conversionRate: rate, signals: earnSignals(row.rawClicks, row.uniqueVisitors, row.qualifyingOrders, row.enabled) };
}
const periodSql = (column: string) => `($1::timestamptz IS NULL OR ${column} >= $1::timestamptz) AND ($2::timestamptz IS NULL OR ${column} < $2::timestamptz)`;
// Aggregate each fact table independently before joining: no click/order/ledger multiplication.
const earnCte = `WITH contextual_orders AS (
  SELECT o.*, COALESCE(o.referrer_user_id, ua.referrer_user_id, ga.referrer_user_id) AS owner,
    COALESCE('attribution:' || ua.id, 'attribution:' || ga.id, 'user:' || o.user_id) AS identity
  FROM orders o LEFT JOIN referral_attributions ua ON ua.referred_user_id = o.user_id
    AND (o.referrer_user_id = ua.referrer_user_id OR o.referral_attribution_id = ua.id OR o.created_at >= ua.first_seen_at)
    LEFT JOIN referral_attributions ga ON ga.id = o.referral_attribution_id
  WHERE o.currency = 'GHS' AND (o.user_id IS NULL OR o.user_id <> COALESCE(o.referrer_user_id, ua.referrer_user_id, ga.referrer_user_id))
    AND (ua.id IS NULL OR COALESCE(o.referrer_user_id, ua.referrer_user_id, ga.referrer_user_id) = ua.referrer_user_id)
    AND (ga.id IS NULL OR COALESCE(o.referrer_user_id, ua.referrer_user_id, ga.referrer_user_id) = ga.referrer_user_id)
    AND (ga.referred_user_id IS NULL OR o.user_id IS NULL OR ga.referred_user_id = o.user_id)
), qualifying AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY owner, identity, COALESCE(service_type,'data') ORDER BY COALESCE(delivered_at,updated_at,created_at), id) AS purchase_number
  FROM contextual_orders WHERE owner IS NOT NULL AND payment_status = 'success' AND status = 'delivered'
    AND (service_type IS DISTINCT FROM 'marketplace' OR marketplace_status = 'completed')
), traffic AS (
  SELECT referrer_user_id, COUNT(*) AS raw,
    COUNT(DISTINCT visitor_key) FILTER (WHERE visitor_key IS NOT NULL AND BTRIM(visitor_key) <> '' AND LEFT(visitor_key,13) <> 'vk_transient_') AS visitors
  FROM referral_clicks WHERE ${periodSql('created_at')} GROUP BY referrer_user_id
), network AS (
  SELECT referrer_user_id, COUNT(DISTINCT referred_user_id) FILTER (WHERE ${periodSql('bound_at')}) AS people,
    COUNT(DISTINCT referred_user_id) AS lifetime_people FROM referral_attributions WHERE referred_user_id IS NOT NULL GROUP BY referrer_user_id
), paid AS (
  SELECT owner, SUM(amount) AS revenue FROM contextual_orders WHERE owner IS NOT NULL AND payment_status = 'success'
    AND status NOT IN ('refunded','refund_pending','cancelled','failed','expired') AND ${periodSql('COALESCE(paid_at,created_at)')} GROUP BY owner
), commerce AS (
  SELECT owner, COUNT(*) AS orders, COUNT(*) FILTER (WHERE identity IS NOT NULL AND purchase_number = 1) AS firsts,
    COUNT(*) FILTER (WHERE identity IS NOT NULL AND purchase_number > 1) AS repeats, COUNT(DISTINCT identity) AS customers,
    SUM(amount) AS revenue, SUM(amount - supplier_cost_minor) FILTER (WHERE supplier_cost_minor IS NOT NULL) AS margin,
    COUNT(*) FILTER (WHERE supplier_cost_minor IS NOT NULL) AS cost_known
  FROM qualifying WHERE ${periodSql('COALESCE(delivered_at,updated_at,created_at)')} GROUP BY owner
), rewards AS (
  SELECT referrer_user_id, SUM(amount_minor) FILTER (WHERE status = 'pending') AS pending,
    SUM(amount_minor) FILTER (WHERE status = 'approved') AS approved, SUM(amount_minor) FILTER (WHERE status = 'reversed') AS reversed
  FROM reward_ledger WHERE currency = 'GHS' AND network_level = 1 AND reversal_of_id IS NULL AND ${periodSql('created_at')} GROUP BY referrer_user_id
), metrics AS (
  SELECT p.user_id AS "userId", COALESCE(u.name,'Deleted customer') AS name, u.email, u.phone, COALESCE(u.status,'disabled') AS "accountStatus",
    p.id AS "profileId", p.referral_code AS code, p.is_enabled AS enabled,
    COALESCE(t.raw,0) AS "rawClicks", COALESCE(t.visitors,0) AS "uniqueVisitors", COALESCE(n.people,0) AS "referredCustomers",
    COALESCE(n.lifetime_people,0) AS "lifetimeReferredCustomers", COALESCE(c.firsts,0) AS "firstConversions",
    COALESCE(c.repeats,0) AS "repeatConversions", COALESCE(c.orders,0) AS "qualifyingOrders", COALESCE(c.customers,0) AS "convertedCustomers",
    COALESCE(pd.revenue,0) AS "paidRevenueMinor", COALESCE(c.revenue,0) AS "deliveredRevenueMinor",
    COALESCE(r.pending,0) AS "pendingRewardsMinor", COALESCE(r.approved,0) AS "approvedRewardsMinor", COALESCE(r.reversed,0) AS "reversedRewardsMinor",
    COALESCE(r.approved,0) AS "rewardExpenseMinor", COALESCE(c.margin,0) AS "grossMarginMinor", COALESCE(c.cost_known,0) AS "costKnownOrders"
  FROM referral_profiles p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN traffic t ON t.referrer_user_id = p.user_id
    LEFT JOIN network n ON n.referrer_user_id = p.user_id LEFT JOIN paid pd ON pd.owner = p.user_id
    LEFT JOIN commerce c ON c.owner = p.user_id LEFT JOIN rewards r ON r.referrer_user_id = p.user_id
)`;
const sortColumns: Record<string, string> = { conversions: '"qualifyingOrders"', firstConversions: '"firstConversions"', convertedCustomers: '"convertedCustomers"',
  deliveredRevenueMinor: '"deliveredRevenueMinor"', approvedRewardsMinor: '"approvedRewardsMinor"', referredCustomers: '"referredCustomers"', uniqueVisitors: '"uniqueVisitors"' };

function devRows(query: EarnQuery): EarnReferrer[] {
  const data = ReferralStore.adminDevSnapshot(); const users = AuthStore.adminDevUsers(); const orders = OrdersStore.adminDevOrders();
  const contextual = orders.map(order => {
    const lifetime = data.attributions.find(a => a.referred_user_id && a.referred_user_id === order.user_id
      && (order.referrer_user_id === a.referrer_user_id || order.referral_attribution_id === a.id || Date.parse(order.created_at) >= Date.parse(a.first_seen_at)));
    const linked = data.attributions.find(a => a.id === order.referral_attribution_id);
    const owner = order.referrer_user_id || lifetime?.referrer_user_id || linked?.referrer_user_id;
    const identity = lifetime ? `attribution:${lifetime.id}` : linked ? `attribution:${linked.id}` : order.user_id ? `user:${order.user_id}` : null;
    if (!owner || order.user_id === owner || (lifetime && lifetime.referrer_user_id !== owner)
      || (linked && (linked.referrer_user_id !== owner || (linked.referred_user_id && order.user_id && linked.referred_user_id !== order.user_id)))) return null;
    return { ...order, owner, identity };
  }).filter((o): o is NonNullable<typeof o> => !!o);
  const qualified = contextual.filter(o => o.payment_status === 'success' && o.status === 'delivered' && o.currency === 'GHS'
    && (o.service_type !== 'marketplace' || o.marketplace_status === 'completed'))
    .sort((a,b) => Date.parse(a.delivered_at || a.updated_at || a.created_at) - Date.parse(b.delivered_at || b.updated_at || b.created_at) || a.id.localeCompare(b.id));
  const seen = new Set<string>(); const stages = new Map<string, boolean>();
  for (const item of qualified) { const key = `${item.owner}:${item.identity}:${item.service_type || 'data'}`; stages.set(item.id, !seen.has(key)); seen.add(key); }
  return data.profiles.map(profile => {
    const user = users.find(u => u.id === profile.user_id); const metrics = emptyMetrics();
    const traffic = data.clicks.filter(c => c.referrer_user_id === profile.user_id && inEarnPeriod(c.created_at, query.range));
    metrics.rawClicks = traffic.length; metrics.uniqueVisitors = new Set(traffic.filter(c => c.visitor_key?.trim() && !c.visitor_key.startsWith('vk_transient_')).map(c => c.visitor_key)).size;
    const attrs = data.attributions.filter(a => a.referrer_user_id === profile.user_id && a.referred_user_id);
    metrics.lifetimeReferredCustomers = new Set(attrs.map(a => a.referred_user_id)).size;
    metrics.referredCustomers = new Set(attrs.filter(a => inEarnPeriod(a.bound_at, query.range)).map(a => a.referred_user_id)).size;
    for (const o of contextual.filter(o => o.owner === profile.user_id && o.currency === 'GHS' && o.payment_status === 'success'
      && !['refunded','refund_pending','cancelled','failed','expired'].includes(o.status) && inEarnPeriod(o.paid_at || o.created_at, query.range))) metrics.paidRevenueMinor += o.amount;
    const conversions = qualified.filter(o => o.owner === profile.user_id && inEarnPeriod(o.delivered_at || o.updated_at || o.created_at, query.range));
    metrics.qualifyingOrders = conversions.length; metrics.convertedCustomers = new Set(conversions.filter(o => o.identity).map(o => o.identity)).size;
    for (const o of conversions) { if (o.identity) { if (stages.get(o.id)) metrics.firstConversions++; else metrics.repeatConversions++; }
      metrics.deliveredRevenueMinor += o.amount; if (o.supplier_cost_minor != null) { metrics.grossMarginMinor += o.amount - o.supplier_cost_minor; metrics.costKnownOrders++; } }
    for (const entry of data.ledger.filter(e => e.referrer_user_id === profile.user_id && e.currency === 'GHS' && (e.network_level || 1) === 1 && !e.reversal_of_id && inEarnPeriod(e.created_at, query.range))) {
      if (entry.status === 'pending') metrics.pendingRewardsMinor += entry.amount_minor;
      if (entry.status === 'approved') metrics.approvedRewardsMinor += entry.amount_minor;
      if (entry.status === 'reversed') metrics.reversedRewardsMinor += entry.amount_minor;
    }
    metrics.rewardExpenseMinor = metrics.approvedRewardsMinor;
    return decorate({ ...metrics, userId: profile.user_id, profileId: profile.id, name: user?.name || 'Deleted customer', email: user?.email || null,
      phone: user?.phone || null, accountStatus: user?.status || 'disabled', code: profile.referral_code, enabled: profile.is_enabled, rank: 0 });
  });
}
export class AdminEarnStore {
  static async overview(query: EarnQuery): Promise<EarnOverview> {
    const db = getPool(); let metrics = emptyMetrics(); let lifetimeProfiles = 0; let lifetimeEnabledProfiles = 0;
    if (db) {
      const totals = (await db.query(`${earnCte} SELECT COUNT(*) AS profiles, COUNT(*) FILTER (WHERE enabled) AS enabled,
        ${metricKeys.map(key => `COALESCE(SUM("${key}"),0) AS "${key}"`).join(',')},
        (SELECT COUNT(DISTINCT visitor_key) FROM referral_clicks WHERE visitor_key IS NOT NULL AND BTRIM(visitor_key) <> ''
          AND LEFT(visitor_key,13) <> 'vk_transient_' AND ${periodSql('created_at')}) AS visitors FROM metrics;`, [query.range.start, query.range.end])).rows[0];
      for (const key of metricKeys) metrics[key] = numeric(totals[key]); metrics.uniqueVisitors = numeric(totals.visitors);
      lifetimeProfiles = numeric(totals.profiles); lifetimeEnabledProfiles = numeric(totals.enabled);
    } else {
      const rows = devRows(query); for (const row of rows) for (const key of metricKeys) metrics[key] += row[key];
      metrics.uniqueVisitors = new Set(ReferralStore.adminDevSnapshot().clicks.filter(c => inEarnPeriod(c.created_at, query.range)
        && c.visitor_key?.trim() && !c.visitor_key.startsWith('vk_transient_')).map(c => c.visitor_key)).size;
      lifetimeProfiles = rows.length; lifetimeEnabledProfiles = rows.filter(r => r.enabled).length;
    }
    for (const key of metricKeys) metrics[key] = numeric(metrics[key]);
    return { period: query.range, lifetimeProfiles, lifetimeEnabledProfiles, metrics };
  }
  static async leaderboard(query: EarnQuery): Promise<EarnPage<EarnReferrer>> {
    const db = getPool(); const offset = (query.page - 1) * query.limit;
    if (db) {
      const conditions = `($3 = '' OR STRPOS(LOWER(CONCAT_WS(' ',name,email,phone,code)),LOWER($3)) > 0)
        AND (NOT $4::boolean OR "accountStatus" = 'active') AND (NOT $5::boolean OR enabled) AND (NOT $6::boolean OR "qualifyingOrders" > 0)`;
      const result = await db.query(`${earnCte}, filtered AS (SELECT * FROM metrics WHERE ${conditions}),
        ranked AS (SELECT *, ROW_NUMBER() OVER (ORDER BY ${sortColumns[query.sort]} DESC, "userId") AS rank FROM filtered),
        page AS (SELECT * FROM ranked ORDER BY rank LIMIT $7 OFFSET $8)
        SELECT (SELECT COUNT(*) FROM filtered) AS total, COALESCE(JSON_AGG(page ORDER BY page.rank) FILTER (WHERE page."userId" IS NOT NULL),'[]') AS items FROM page;`,
        [query.range.start, query.range.end, query.q, query.excludeDisabled, query.excludeSuspended, query.excludeZero, query.limit, offset]);
      return { items: result.rows[0].items.map((row: any) => decorate({ ...row, rank: numeric(row.rank) })), total: numeric(result.rows[0].total), page: query.page, limit: query.limit };
    }
    const rows = devRows(query).filter(row => (!query.q || `${row.name} ${row.email || ''} ${row.phone || ''} ${row.code}`.toLowerCase().includes(query.q.toLowerCase()))
      && (!query.excludeDisabled || row.accountStatus === 'active') && (!query.excludeSuspended || row.enabled) && (!query.excludeZero || row.qualifyingOrders > 0));
    const key = query.sort === 'conversions' ? 'qualifyingOrders' : query.sort as keyof EarnMetrics;
    rows.sort((a,b) => b[key] - a[key] || a.userId.localeCompare(b.userId)); rows.forEach((row,i) => { row.rank = i+1; });
    return { items: rows.slice(offset, offset + query.limit), total: rows.length, page: query.page, limit: query.limit };
  }
  static async ledger(query: EarnQuery): Promise<EarnPage<EarnLedgerRow>> {
    const db = getPool(); const offset = (query.page - 1) * query.limit;
    if (db) {
      const result = await db.query(`WITH filtered AS (SELECT l.id, l.referrer_user_id AS "referrerId", COALESCE(u.name,'Deleted customer') AS "referrerName",
        o.public_reference AS "orderReference", l.service_type AS service, l.reward_stage AS stage, l.amount_minor AS "amountMinor", l.status,
        l.created_at AS "createdAt", l.approved_at AS "approvedAt", l.reversed_at AS "reversedAt", l.reason
        FROM reward_ledger l LEFT JOIN users u ON u.id=l.referrer_user_id LEFT JOIN orders o ON o.id=l.order_id
        WHERE ${periodSql('l.created_at')} AND ($3 = '' OR l.status=$3) AND ($4 = '' OR l.service_type=$4)
          AND ($5 = '' OR l.reward_stage=$5) AND ($6 = '' OR l.referrer_user_id=$6) AND ($7 = '' OR STRPOS(LOWER(COALESCE(o.public_reference,'')),LOWER($7))>0)),
        page AS (SELECT * FROM filtered ORDER BY "createdAt" DESC,id LIMIT $8 OFFSET $9)
        SELECT (SELECT COUNT(*) FROM filtered) AS total, COALESCE(JSON_AGG(page ORDER BY page."createdAt" DESC,page.id) FILTER (WHERE page.id IS NOT NULL),'[]') AS items FROM page;`,
        [query.range.start,query.range.end,query.status,query.service,query.stage,query.referrer,query.order,query.limit,offset]);
      return { items: result.rows[0].items.map((row: any) => ({ ...row, amountMinor: numeric(row.amountMinor) })), total: numeric(result.rows[0].total), page: query.page, limit: query.limit };
    }
    const users = AuthStore.adminDevUsers(); const orders = OrdersStore.adminDevOrders();
    const rows = ReferralStore.adminDevSnapshot().ledger.map(e => ({ id:e.id, referrerId:e.referrer_user_id, referrerName:users.find(u=>u.id===e.referrer_user_id)?.name || 'Deleted customer',
      orderReference:orders.find(o=>o.id===e.order_id)?.public_reference || null, service:e.service_type, stage:e.reward_stage || 'standard', amountMinor:e.amount_minor,
      status:e.status, createdAt:e.created_at, approvedAt:e.approved_at, reversedAt:e.reversed_at, reason:e.reason }))
      .filter(e=>inEarnPeriod(e.createdAt,query.range) && (!query.status || e.status===query.status) && (!query.service || e.service===query.service)
        && (!query.stage || e.stage===query.stage) && (!query.referrer || e.referrerId===query.referrer) && (!query.order || e.orderReference?.toLowerCase().includes(query.order.toLowerCase())))
      .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
    return { items:rows.slice(offset,offset+query.limit),total:rows.length,page:query.page,limit:query.limit };
  }
  static async detail(userId: string, query: EarnQuery): Promise<EarnDetail | null> {
    const db = getPool(); let referrer: EarnReferrer | undefined;
    if (db) referrer = (await db.query(`${earnCte} SELECT * FROM metrics WHERE "userId"=$3;`, [query.range.start,query.range.end,userId])).rows[0];
    else referrer = devRows(query).find(row=>row.userId===userId);
    if (!referrer) return null; referrer = decorate(referrer);
    const ledger = await this.ledger({ ...query,referrer:userId,page:1,limit:10,status:'',service:'',stage:'',order:'' });
    const offset = (query.page-1)*query.limit; let items: any[]; let total: number;
    if (db) {
      const result = await db.query(`${earnCte}, customers AS (SELECT a.referred_user_id AS id, COALESCE(u.name,'Deleted customer') AS name,u.email,u.phone,a.bound_at AS "boundAt",
        (ARRAY_AGG(q.public_reference ORDER BY COALESCE(q.delivered_at,q.updated_at,q.created_at),q.id) FILTER (WHERE q.id IS NOT NULL))[1] AS "firstOrder",
        (ARRAY_AGG(q.public_reference ORDER BY COALESCE(q.delivered_at,q.updated_at,q.created_at) DESC,q.id DESC) FILTER (WHERE q.id IS NOT NULL))[1] AS "latestOrder"
        FROM referral_attributions a LEFT JOIN users u ON u.id=a.referred_user_id
        LEFT JOIN qualifying q ON q.owner=a.referrer_user_id AND (q.user_id=a.referred_user_id OR q.referral_attribution_id=a.id)
        WHERE a.referrer_user_id=$3 AND a.referred_user_id IS NOT NULL GROUP BY a.id,u.id),
        page AS (SELECT * FROM customers ORDER BY "boundAt" DESC NULLS LAST,id LIMIT $4 OFFSET $5)
        SELECT (SELECT COUNT(*) FROM customers) AS total,COALESCE(JSON_AGG(page ORDER BY page."boundAt" DESC,page.id) FILTER (WHERE page.id IS NOT NULL),'[]') AS items FROM page;`,
        [query.range.start,query.range.end,userId,query.limit,offset]);
      items=result.rows[0].items;total=numeric(result.rows[0].total);
    } else {
      const users=AuthStore.adminDevUsers(); const orders=OrdersStore.adminDevOrders();
      const all=ReferralStore.adminDevSnapshot().attributions.filter(a=>a.referrer_user_id===userId&&a.referred_user_id).map(a=>{
        const u=users.find(u=>u.id===a.referred_user_id); const qs=orders.filter(o=>(o.user_id===a.referred_user_id||o.referral_attribution_id===a.id)
          && (o.referrer_user_id===userId||o.referral_attribution_id===a.id||Date.parse(o.created_at)>=Date.parse(a.first_seen_at))
          && (!o.referrer_user_id||o.referrer_user_id===userId) && o.payment_status==='success'&&o.status==='delivered'&&o.currency==='GHS'
          &&(o.service_type!=='marketplace'||o.marketplace_status==='completed')).sort((x,y)=>Date.parse(x.delivered_at||x.updated_at)-Date.parse(y.delivered_at||y.updated_at)||x.id.localeCompare(y.id));
        return {id:a.referred_user_id!,name:u?.name||'Deleted customer',email:u?.email||null,phone:u?.phone||null,boundAt:a.bound_at,
          firstOrder:qs[0]?.public_reference||null,latestOrder:qs.at(-1)?.public_reference||null};
      }).sort((a,b)=>Date.parse(b.boundAt||'')-Date.parse(a.boundAt||'')); total=all.length;items=all.slice(offset,offset+query.limit);
    }
    return {period:query.range,referrer,ledger,customers:{items,total,page:query.page,limit:query.limit}};
  }
  static async customerSummary(userId: string): Promise<EarnCustomerSummary | null> {
    const profile = await ReferralStore.findProfileByUserId(userId); if (!profile) return null;
    const [uniqueVisitors, peopleReferred, rewards] = await Promise.all([ReferralStore.countUniqueVisitorsByReferrer(userId),
      ReferralStore.countReferredCustomers(userId),ReferralStore.getReferralSummary(userId)]);
    return {code:profile.referral_code,enabled:profile.is_enabled,uniqueVisitors,peopleReferred,approvedRewardsMinor:rewards.approvedRewardsMinor};
  }
}
