import {GROWTH_EVENTS,GROWTH_PAGES,GROWTH_SOURCES,GROWTH_MEDIA,campaignSlug,type GrowthInput} from '../../shared/growthAnalytics.js';
export class GrowthError extends Error {constructor(message:string,public status=400){super(message);}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateGrowth(value:unknown):GrowthInput {
 if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>1000)throw new GrowthError('Invalid analytics event.');
 const v=value as any,m=v.metadata;
 if(Object.keys(v).some(k=>!['event','visitorId','sessionId','metadata'].includes(k))||!GROWTH_EVENTS.includes(v.event)||typeof v.visitorId!=='string'||typeof v.sessionId!=='string'||!uuid.test(v.visitorId)||!uuid.test(v.sessionId))throw new GrowthError('Invalid analytics event.');
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['page','source','medium','campaign','display','promptSupport','productId'].includes(k))||!GROWTH_PAGES.includes(m.page))throw new GrowthError('Invalid analytics metadata.');
 if(m.source!==undefined&&!GROWTH_SOURCES.includes(m.source)||m.medium!==undefined&&!GROWTH_MEDIA.includes(m.medium)||m.campaign!==undefined&&campaignSlug(m.campaign)!==m.campaign||m.display!==undefined&&!['web','standalone'].includes(m.display)||m.promptSupport!==undefined&&!['yes','no'].includes(m.promptSupport))throw new GrowthError('Invalid analytics classification.');
 if(m.productId!==undefined&&(typeof m.productId!=='string'||! /^[a-zA-Z0-9_-]{1,64}$/.test(m.productId)||!['marketplace_product','marketplace_inquiry','checkout_opened'].includes(v.event)||m.page!=='marketplace'))throw new GrowthError('Invalid product event.');
 if(['marketplace_product','marketplace_inquiry'].includes(v.event)&&(!m.productId||m.page!=='marketplace'))throw new GrowthError('Product is required.');
 if(v.event==='standalone_launch'&&m.display!=='standalone')throw new GrowthError('Invalid app launch.');
 return {event:v.event,visitorId:v.visitorId,sessionId:v.sessionId,metadata:{...m}};
}
