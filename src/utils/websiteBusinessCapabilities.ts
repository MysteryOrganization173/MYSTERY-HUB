import type {WebsiteSiteRecord} from '../types/index.js';
/** Existence flags, never a balance calculation or permission to change prices/finance. */
export function websiteBusinessCapabilities(site:WebsiteSiteRecord,hasOrders:boolean,operations:Array<{kind:string;payload:Record<string,any>}>,hasStoreLedger:boolean) {
  return {draftManaged:site.template_id==='tmpl-data-reseller',liveManaged:site.status==='published'&&(site.published_snapshot_json?.templateId||site.template_id)==='tmpl-data-reseller',hasStoreHistory:hasOrders||operations.some(o=>o.payload.siteId===site.id),hasStoreFundsOrWithdrawals:hasStoreLedger||operations.some(o=>o.kind==='store_sale'||o.payload.source==='store'),earningsScope:'owner' as const,ordersScope:'site' as const};
}
