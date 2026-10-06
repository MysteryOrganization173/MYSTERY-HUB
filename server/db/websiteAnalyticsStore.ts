import { randomUUID } from 'node:crypto';
import { getPool } from './connection.js';
import { WebsiteStore } from './websiteStore.js';
import { WebsiteAssetStore } from './websiteAssetStore.js';
import { AuthStore } from './authStore.js';
import { WEBSITE_CLIENT_EVENTS, type WebsiteAnalyticsInput, type WebsiteAdminSummary, type AdminWebsiteRow } from '../../src/config/websiteAnalytics.js';
import { isValidTemplateId } from '../types/website.js';
import { cloudinaryConfigured, websiteMediaLimits, WebsiteOperationError } from '../services/websiteCloudinary.js';
import type { WebsiteSiteRecord } from '../types/website.js';
interface EventRecord { id: string; event_name: string; user_id: string | null; visitor_id: string | null; session_id: string | null; entity_type: string | null; entity_id: string | null; metadata_json: Record<string,string>; created_at: string; }
const memory: EventRecord[] = [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateWebsiteAnalytics(value: unknown): WebsiteAnalyticsInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 800) throw new WebsiteOperationError('Invalid analytics event.');
  const input = value as Record<string, any>;
  if (Object.keys(input).some(key => !['event','visitorId','sessionId','metadata'].includes(key)) || !WEBSITE_CLIENT_EVENTS.includes(input.event) || typeof input.visitorId !== 'string' || typeof input.sessionId !== 'string' || !uuid.test(input.visitorId) || !uuid.test(input.sessionId)) throw new WebsiteOperationError('Invalid analytics event.');
  const metadata = input.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || Object.keys(metadata).some(key => !['templateId','siteId','source'].includes(key))) throw new WebsiteOperationError('Invalid analytics metadata.');
  if (metadata.templateId !== undefined && !isValidTemplateId(metadata.templateId)) throw new WebsiteOperationError('Invalid template.');
  if (metadata.siteId !== undefined && (typeof metadata.siteId !== 'string' || !/^site_[a-zA-Z0-9_-]{1,59}$/.test(metadata.siteId))) throw new WebsiteOperationError('Invalid website.');
  if (metadata.source !== undefined && !['builder','editor','settings'].includes(metadata.source)) throw new WebsiteOperationError('Invalid analytics source.');
  return input as WebsiteAnalyticsInput;
}
export class WebsiteAnalyticsStore {
  static async ingestPublic(siteId:string,value:unknown) {
    const events=['site_view','whatsapp_click','call_click','email_click','primary_cta_click','product_view','checkout_started'];
    const input=value as Record<string,any>;
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['event','visitorId','sessionId'].includes(k))||!events.includes(input.event)||!uuid.test(input.visitorId)||!uuid.test(input.sessionId))throw new WebsiteOperationError('Invalid public event.');
    const site=await WebsiteStore.findSiteById(siteId);if(!site||site.status!=='published')throw new WebsiteOperationError('Website unavailable.',404);
    const event=`website_public_${input.event}`,since=new Date(Date.now()-(input.event==='site_view'?86400000:60000)).toISOString();
    const db=getPool();const row:EventRecord={id:`evt_${randomUUID()}`,event_name:event,user_id:null,visitor_id:input.visitorId,session_id:input.sessionId,entity_type:'website',entity_id:siteId,metadata_json:{},created_at:new Date().toISOString()};
    if(!db){if(!memory.some(e=>e.entity_id===siteId&&e.event_name===event&&e.session_id===input.sessionId&&e.visitor_id===input.visitorId&&e.created_at>=since))memory.push(row);return;}
    const client=await db.connect();
    try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${siteId}:${input.visitorId}:${input.sessionId}:${event}`]);
      const duplicate=await client.query('SELECT id FROM analytics_events WHERE entity_id=$1 AND event_name=$2 AND visitor_id=$3 AND session_id=$4 AND created_at >= $5 LIMIT 1',[siteId,event,input.visitorId,input.sessionId,since]);
      if(!duplicate.rows.length)await client.query('INSERT INTO analytics_events(id,event_name,visitor_id,session_id,entity_type,entity_id,metadata_json,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[row.id,event,row.visitor_id,row.session_id,'website',siteId,'{}',row.created_at]);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  static async ownerAnalytics(siteId:string,userId:string,range='30') {
    await WebsiteAssetStore.ownedSite(siteId,userId);
    if(!['7','30','90','all'].includes(range))throw new WebsiteOperationError('Invalid analytics period.');
    const since=range==='all'?null:new Date(Date.now()-Number(range)*86400000).toISOString(),db=getPool();
    const rows:EventRecord[]=db?(await db.query('SELECT * FROM analytics_events WHERE entity_id=$1 AND ($2::timestamptz IS NULL OR created_at >= $2)',[siteId,since])).rows.map(e=>({...e,created_at:new Date(e.created_at).toISOString()})):memory.filter(e=>e.entity_id===siteId&&(!since||e.created_at>=since));
    const count=(name:string)=>rows.filter(e=>e.event_name===`website_public_${name}`).length;
    const orderRows=db?(await db.query("SELECT payment_status,status,amount FROM orders WHERE store_context->>'siteId'=$1 AND ($2::timestamptz IS NULL OR created_at >= $2)",[siteId,since])).rows:(await import('./ordersStore.js')).OrdersStore.adminDevOrders().filter(o=>o.store_context?.siteId===siteId&&(!since||o.created_at>=since));
    const paid=orderRows.filter(o=>o.payment_status==='success'),delivered=paid.filter(o=>o.status==='delivered');
    const days=new Map<string,number>();for(const e of rows.filter(e=>e.event_name==='website_public_site_view')){const day=e.created_at.slice(0,10);days.set(day,(days.get(day)||0)+1);}
    return {range,views:count('site_view'),uniqueVisitors:new Set(rows.filter(e=>e.event_name==='website_public_site_view').map(e=>e.visitor_id)).size,whatsappClicks:count('whatsapp_click'),callClicks:count('call_click'),emailClicks:count('email_click'),primaryCtaClicks:count('primary_cta_click'),productViews:count('product_view'),checkoutStarts:count('checkout_started'),paidOrders:paid.length,deliveredOrders:delivered.length,salesMinor:paid.filter(o=>o.status!=='refunded').reduce((total,o)=>total+Number(o.amount),0),conversion:count('checkout_started')?paid.length/count('checkout_started')*100:null,trend:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([day,views])=>({day,views})),activity:rows.filter(e=>!e.event_name.startsWith('website_public_')).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,15).map(e=>({event:e.event_name,createdAt:e.created_at}))};
  }
  static clearDevStore() { memory.length = 0; }
  private static async insert(row: EventRecord) {
    const db = getPool();
    if (!db) { memory.push(structuredClone(row)); return; }
    await db.query(`INSERT INTO analytics_events (id,event_name,user_id,visitor_id,session_id,entity_type,entity_id,metadata_json,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [row.id,row.event_name,row.user_id,row.visitor_id,row.session_id,row.entity_type,row.entity_id,JSON.stringify(row.metadata_json),row.created_at]);
  }
  static async ingest(value: unknown, userId?: string) {
    const input = validateWebsiteAnalytics(value);
    if (input.metadata.siteId) {
      if (!userId) throw new WebsiteOperationError('Sign in to record editor activity.',401);
      await WebsiteAssetStore.ownedSite(input.metadata.siteId,userId);
    }
    if (input.event === 'website_editor_opened' && !input.metadata.siteId) throw new WebsiteOperationError('Website is required for editor activity.');
    await this.insert({ id:`evt_${randomUUID()}`,event_name:input.event,user_id:userId || null,visitor_id:input.visitorId,session_id:input.sessionId,entity_type:'website',entity_id:input.metadata.siteId || null,metadata_json:input.metadata as Record<string,string>,created_at:new Date(Date.now()).toISOString() });
  }
  /** Only server routes call this. Analytics availability never controls the customer action. */
  static async action(event: 'website_created' | 'website_published' | 'website_unpublished' | 'website_deleted' | 'website_template_changed' | 'website_asset_uploaded', userId: string, siteId: string, templateId: string) {
    try { await this.insert({ id:`evt_${randomUUID()}`,event_name:event,user_id:userId,visitor_id:null,session_id:null,entity_type:'website',entity_id:siteId,metadata_json:{templateId},created_at:new Date(Date.now()).toISOString() }); }
    catch { console.warn('[Website analytics] Event persistence unavailable', { event }); }
  }
  static async events(since: string | null): Promise<EventRecord[]> {
    const db=getPool();
    if (!db) return memory.filter(e => !since || e.created_at >= since).map(e => structuredClone(e));
    return (await db.query(`SELECT * FROM analytics_events WHERE event_name LIKE 'website_%' ${since ? 'AND created_at >= $1' : ''}`,since ? [since] : [])).rows.map(row => ({...row,created_at:new Date(row.created_at).toISOString(),metadata_json:typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json}));
  }
  static async siteDetails(site: WebsiteSiteRecord, assets?: Awaited<ReturnType<typeof WebsiteAssetStore.all>>): Promise<AdminWebsiteRow> {
    const owner=await AuthStore.findUserById(site.user_id);
    const siteAssets=assets || await WebsiteAssetStore.list(site.id,site.user_id);
    return { id:site.id,name:site.name,businessName:site.content_json.businessName,slug:site.slug,user_id:site.user_id,ownerName:owner?.name || 'Customer',template_id:site.template_id,status:site.status,created_at:site.created_at,updated_at:site.updated_at,published_at:site.published_at || null,assetCount:siteAssets.filter(a=>a.website_id===site.id && a.status==='ready').length,publicUrl:site.status==='published' ? `/sites/${encodeURIComponent(site.slug)}` : null };
  }
  static async summary(query: Record<string, unknown>): Promise<WebsiteAdminSummary> {
    const range=String(query.range || '30'), status=String(query.status || ''), template=String(query.template || ''), search=String(query.search || '').trim();
    const limit=Number(query.limit || 25), offset=Number(query.offset || 0);
    if (!['7','30','90','all'].includes(range) || !['','draft','published'].includes(status) || (template && !isValidTemplateId(template)) || search.length > 100 || !Number.isInteger(limit) || limit<1 || limit>100 || !Number.isInteger(offset) || offset<0 || offset>100000) throw new WebsiteOperationError('Invalid website filters.');
    const since=range==='all' ? null : new Date(Date.now()-Number(range)*86400_000).toISOString();
    const [sites,assets,events]=await Promise.all([WebsiteStore.allSites(),WebsiteAssetStore.all(),this.events(since)]);
    const rows: AdminWebsiteRow[]=await Promise.all(sites.map(site => this.siteDetails(site,assets)));
    const periodRows=rows.filter(row=>!since || row.created_at>=since);
    const filtered=periodRows.filter(row=>(!status || row.status===status) && (!template || row.template_id===template) && (!search || [row.name,row.businessName,row.ownerName,row.id,row.slug].some(value=>value.toLowerCase().includes(search.toLowerCase())))).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const linkedVisitors=new Map(events.filter(e=>e.visitor_id && e.user_id).map(e=>[e.visitor_id!,e.user_id!]));
    const identities=(name:string)=>new Set(events.filter(e=>e.event_name===name).map(e=>e.user_id || (e.visitor_id ? linkedVisitors.get(e.visitor_id) || e.visitor_id : null)).filter(Boolean));
    const starters=identities('website_build_started'),creators=identities('website_created');
    // Conversion uses observed ordered actions by the same user, never unrelated totals.
    const createdAfterStart=new Set(events.filter(e=>e.event_name==='website_created' && e.user_id && events.some(start=>start.event_name==='website_build_started' && (start.user_id===e.user_id || linkedVisitors.get(start.visitor_id || '')===e.user_id) && start.created_at<=e.created_at)).map(e=>e.user_id));
    const createdSites=new Set(events.filter(e=>e.event_name==='website_created').map(e=>e.entity_id));
    const publishedCreatedSites=new Set(events.filter(e=>e.event_name==='website_published' && createdSites.has(e.entity_id) && events.some(created=>created.event_name==='website_created' && created.entity_id===e.entity_id && created.created_at<=e.created_at)).map(e=>e.entity_id));
    const count=(name:string)=>events.filter(e=>e.event_name===name).length;
    const templateIds=new Set([...rows.map(r=>r.template_id),...events.map(e=>e.metadata_json.templateId).filter(Boolean)]);
    return { sites:filtered.slice(offset,offset+limit),total:filtered.length,limit,offset,
      metrics:{total:periodRows.length,draft:periodRows.filter(s=>s.status==='draft').length,published:periodRows.filter(s=>s.status==='published').length,free:periodRows.length},
      recentCreated:[...periodRows].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,5),recentPublished:rows.filter(s=>s.status==='published' && s.published_at && (!since || s.published_at>=since)).sort((a,b)=>b.published_at!.localeCompare(a.published_at!)).slice(0,5),
      templates:[...templateIds].map(templateId=>({templateId,projects:periodRows.filter(s=>s.template_id===templateId).length,published:periodRows.filter(s=>s.template_id===templateId && s.status==='published').length,previews:events.filter(e=>e.event_name==='website_template_previewed' && e.metadata_json.templateId===templateId).length,created:events.filter(e=>e.event_name==='website_created' && e.metadata_json.templateId===templateId).length})),
      funnel:{uniqueVisitors:identities('website_builder_viewed').size,previews:count('website_template_previewed'),buildStarts:count('website_build_started'),created:count('website_created'),published:count('website_published'),uniqueBuildStarters:starters.size,uniqueCreators:creators.size,startToCreate:starters.size ? createdAfterStart.size/starters.size*100 : null,createToPublish:createdSites.size ? publishedCreatedSites.size/createdSites.size*100 : null},
      media:{configured:cloudinaryConfigured(),...websiteMediaLimits(),tracked:assets.length,ready:assets.filter(a=>a.status==='ready').length,cleanupPending:assets.filter(a=>['deleting','failed'].includes(a.status) || (a.status==='pending' && Date.now()>Date.parse(a.expires_at))).length},
    };
  }
}
