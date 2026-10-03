import type { ReferralAttributionRecord, ReferralProfileRecord, RewardLedgerRecord } from '../types/referral.js';
import type { OrderRecord } from '../types/orders.js';
import type { AuditLogRecord } from '../db/adminAuditStore.js';

export interface ReferralRecoverySnapshot {
  users: Array<{ id: string }>;
  profiles: ReferralProfileRecord[];
  attributions: ReferralAttributionRecord[];
  orders: OrderRecord[];
  ledger: RewardLedgerRecord[];
  audits: AuditLogRecord[];
  storedClickCount: number;
}
export interface AttributionRepair {
  referredUserId: string;
  referrerUserId: string;
  sourceCode: string;
  evidenceAt: string;
  evidenceIds: string[];
}
export interface RewardRepair {
  orderId: string;
  ledgerId: string;
  referrerUserId: string;
  referredUserId: string;
  amountMinor: number;
  approvedAt: string;
  serviceType: OrderRecord['service_type'];
  auditId: string;
}

const timestamp = (value: string | null | undefined) => value ? new Date(value).getTime() : NaN;
function metadata(audit: AuditLogRecord): Record<string, unknown> {
  try { return typeof audit.metadata_safe_json === 'string' ? JSON.parse(audit.metadata_safe_json) : audit.metadata_safe_json || {}; }
  catch { return {}; }
}

/** Pure, conservative planning: never reads today's mutable reward values as history. */
export function planReferralRecovery(snapshot: ReferralRecoverySnapshot) {
  const attributionRepairs: AttributionRepair[] = [];
  const rewardRepairs: RewardRepair[] = [];
  const manualReview: Array<{ entityId: string; reason: string }> = [];
  const users = new Set(snapshot.users.map(user => user.id));
  const profiles = new Map(snapshot.profiles.map(profile => [profile.user_id, profile]));
  const canonical = new Map(snapshot.attributions.filter(attr => attr.referred_user_id)
    .map(attr => [attr.referred_user_id!, attr]));
  const candidates = new Map<string, AttributionRepair[]>();
  const add = (user: string, referrer: string, code: string, at: string, evidenceId: string) => {
    if (!users.has(user) || !users.has(referrer) || user === referrer
      || profiles.get(referrer)?.referral_code !== code || !Number.isFinite(timestamp(at))) {
      manualReview.push({ entityId: evidenceId, reason: 'invalid_or_incomplete_relationship_evidence' }); return;
    }
    const list = candidates.get(user) || [];
    list.push({ referredUserId: user, referrerUserId: referrer, sourceCode: code, evidenceAt: at, evidenceIds: [evidenceId] });
    candidates.set(user, list);
  };
  for (const order of snapshot.orders) {
    if (!order.user_id) continue; // A phone/email/visitor is not proof of account ownership.
    const linked = snapshot.attributions.find(attr => attr.id === order.referral_attribution_id);
    if (linked && linked.referred_user_id && linked.referred_user_id !== order.user_id) {
      manualReview.push({ entityId: order.id, reason: 'order_attribution_customer_conflict' }); continue;
    }
    const referrer = order.referrer_user_id || linked?.referrer_user_id;
    if (!referrer) continue;
    if (linked && order.referrer_user_id && linked.referrer_user_id !== order.referrer_user_id) {
      manualReview.push({ entityId: order.id, reason: 'order_attribution_referrer_conflict' }); continue;
    }
    add(order.user_id, referrer, order.referral_code || linked?.source_code || profiles.get(referrer)?.referral_code || '',
      linked?.first_seen_at || order.created_at, order.id);
  }
  for (const audit of snapshot.audits.filter(a => a.action === 'referral_bound' && a.entity_type === 'referral_attribution')) {
    const data = metadata(audit);
    if (typeof data.referred_user_id === 'string' && typeof data.referrer_user_id === 'string'
      && typeof data.source_code === 'string') {
      add(data.referred_user_id, data.referrer_user_id, data.source_code, audit.created_at, audit.id);
    }
  }
  for (const entry of snapshot.ledger) {
    const order = snapshot.orders.find(item => item.id === entry.order_id);
    if (!entry.referred_user_id || !order || order.user_id !== entry.referred_user_id
      || (entry.network_level || 1) !== 1 || entry.reversal_of_id) continue;
    add(entry.referred_user_id, entry.referrer_user_id, profiles.get(entry.referrer_user_id)?.referral_code || '',
      entry.created_at, entry.id);
  }
  for (const audit of snapshot.audits.filter(item => item.action === 'reward_approved' && item.entity_type === 'reward_ledger')) {
    const data = metadata(audit);
    const order = snapshot.orders.find(item => item.id === data.order_id);
    if (order?.user_id && typeof data.referrer_user_id === 'string' && data.service_type === (order.service_type || 'data')) {
      add(order.user_id, data.referrer_user_id, profiles.get(data.referrer_user_id)?.referral_code || '', audit.created_at, audit.id);
    }
  }
  const graph = new Map([...canonical].map(([user, attr]) => [user, attr.referrer_user_id]));
  const pending: AttributionRepair[] = [];
  for (const [user, list] of candidates) {
    const refs = new Set(list.map(item => item.referrerUserId));
    const existing = canonical.get(user);
    if (existing) {
      if ([...refs].some(ref => ref !== existing.referrer_user_id)) manualReview.push({ entityId: user, reason: 'existing_first_touch_preserved_conflicting_evidence' });
      continue;
    }
    if (refs.size !== 1) { manualReview.push({ entityId: user, reason: 'conflicting_relationship_evidence' }); continue; }
    list.sort((a, b) => timestamp(a.evidenceAt) - timestamp(b.evidenceAt));
    const repair = { ...list[0], evidenceIds: list.flatMap(item => item.evidenceIds) };
    graph.set(user, repair.referrerUserId);
    pending.push(repair);
  }
  // Evaluate the whole proposed graph before applying any member of a cycle.
  for (const repair of pending.sort((a, b) => a.referredUserId.localeCompare(b.referredUserId))) {
    const visited = new Set<string>([repair.referredUserId]);
    let current: string | undefined = repair.referrerUserId;
    let cycle = false;
    while (current) {
      if (visited.has(current)) { cycle = true; break; }
      visited.add(current); current = graph.get(current);
    }
    if (cycle) manualReview.push({ entityId: repair.referredUserId, reason: 'circular_relationship' });
    else attributionRepairs.push(repair);
  }

  for (const order of snapshot.orders) {
    // Reversed, rejected and pending ledger rows also block an automatic second reward.
    if (snapshot.ledger.some(entry => entry.order_id === order.id)) continue;
    if (order.status !== 'delivered' || order.payment_status !== 'success'
      || (order.service_type === 'marketplace' && order.marketplace_status !== 'completed')) continue;
    const approvals = snapshot.audits.filter(a => {
      const data = metadata(a);
      return a.action === 'reward_approved' && a.entity_type === 'reward_ledger' && data.order_id === order.id;
    });
    const audit = approvals[0];
    const data = audit ? metadata(audit) : {};
    const canonicalAttr = canonical.get(order.user_id || '');
    const repaired = attributionRepairs.find(attr => attr.referredUserId === order.user_id);
    const linked = snapshot.attributions.find(attr => attr.id === order.referral_attribution_id);
    const referrer = order.referrer_user_id || linked?.referrer_user_id
      || (canonicalAttr && timestamp(canonicalAttr.first_seen_at) <= timestamp(order.created_at) ? canonicalAttr.referrer_user_id : null)
      || (repaired && timestamp(repaired.evidenceAt) <= timestamp(order.created_at) ? repaired.referrerUserId : null)
      || (approvals.length === 1 && typeof data.referrer_user_id === 'string' ? data.referrer_user_id : null);
    if (!referrer) continue;
    if (!order.user_id || !users.has(order.user_id) || !users.has(referrer) || referrer === order.user_id
      || (canonicalAttr && canonicalAttr.referrer_user_id !== referrer)
      || (linked && (linked.referrer_user_id !== referrer || (linked.referred_user_id && linked.referred_user_id !== order.user_id)))
      || manualReview.some(item => item.entityId === order.id || item.entityId === order.user_id)) {
      manualReview.push({ entityId: order.id, reason: 'reward_relationship_requires_review' }); continue;
    }
    const service = order.service_type || 'data';
    const reversed = snapshot.audits.some(a => a.action === 'reward_reversed'
      && (metadata(a).order_id === order.id || a.entity_id === audit?.entity_id));
    if (order.currency !== 'GHS' || approvals.length !== 1 || !audit || reversed || data.referrer_user_id !== referrer
      || data.service_type !== service || !Number.isSafeInteger(data.amount_minor) || Number(data.amount_minor) <= 0
      || Number(data.amount_minor) > 2_147_483_647 || (data.network_level != null && data.network_level !== 1)
      || !audit.entity_id || audit.entity_id.length > 64
      || !Number.isFinite(timestamp(order.delivered_at)) || timestamp(audit.created_at) < timestamp(order.delivered_at)
      || timestamp(order.delivered_at) < timestamp(order.created_at)
      || snapshot.ledger.some(entry => entry.id === audit.entity_id)) {
      manualReview.push({ entityId: order.id, reason: 'historical_reward_amount_or_approval_unproven' }); continue;
    }
    rewardRepairs.push({ orderId: order.id, ledgerId: audit.entity_id, referrerUserId: referrer,
      referredUserId: order.user_id, amountMinor: Number(data.amount_minor), approvedAt: audit.created_at,
      serviceType: service, auditId: audit.id });
  }
  return {
    attributionRepairs, rewardRepairs, manualReview,
    clicks: { storedEvents: snapshot.storedClickCount, backfills: 0,
      missingHistory: 'Not recoverable: requests that never persisted cannot be reconstructed or counted.' },
  };
}
