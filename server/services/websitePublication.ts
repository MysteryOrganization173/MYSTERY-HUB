import type {SiteContent,SiteSettings,WebsiteSiteRecord,WebsitePublishedSnapshot} from '../types/website.js';
const object=(value:unknown):Record<string,any>=>value && typeof value==='object' && !Array.isArray(value)?value as Record<string,any>:{};
const pick=(value:unknown,keys:readonly string[])=>{const input=object(value);return Object.fromEntries(keys.filter(key=>Object.hasOwn(input,key)).map(key=>[key,structuredClone(input[key])]));};
const items=(value:unknown,keys:readonly string[])=>Array.isArray(value)?value.map(item=>pick(item,keys)):[];
/** Public field projection also removes historical unknown/editor-only nested keys. */
export function publicWebsiteContent(value:unknown):SiteContent {
 const input=object(value),result=pick(input,['starterVersion','layoutMode','businessName','tagline','aboutText','location','phone','whatsapp','email','heroImage','logoUrl','ctaLabel','ctaTarget','features','copy','gallery','pinnedBundles']);
 // V5 additive fields: exact nested whitelists, so a draft-only or unknown key can never go live.
 if(Object.hasOwn(input,'hours')&&input.hours){const h=object(input.hours);result.hours={days:items(h.days,['closed','open','close']),...(typeof h.note==='string'?{note:h.note}:{})};}
 if(Object.hasOwn(input,'policies'))result.policies=pick(input.policies,['delivery','payment','returns']);
 if(Object.hasOwn(input,'sections'))result.sections=pick(input.sections,['order','hidden']);
 if(Object.hasOwn(input,'imageMeta')){const m=object(input.imageMeta);result.imageMeta={...(m.heroImage?{heroImage:pick(m.heroImage,['x','y','alt'])}:{}),...(m.logoUrl?{logoUrl:pick(m.logoUrl,['alt'])}:{})};}
 if(Object.hasOwn(input,'items'))result.items=items(Array.isArray(input.items)?input.items.filter(item=>object(item).isExample!==true):[],['id','name','price','category','tag','desc','image','images','label','pinned','alt','focal','options']);
 if(Object.hasOwn(input,'stats'))result.stats=items(input.stats,['label','value']);
 if(Object.hasOwn(input,'social'))result.social=pick(input.social,['instagram','facebook','tiktok']);
 if(input.composition && input.layoutMode!=='template'){const c=object(input.composition);result.composition={version:c.version,sections:items(c.sections,['id','type','enabled','variant','order','data']).map(section=>{const data=pick(section.data,['heading','body','image','alt','ctaLabel','ctaUrl']);if(Object.hasOwn(object(section.data),'items'))data.items=items(section.data.items,['title','text','image','price']);return {...section,data};})};}
 if(input.layoutMode==='sections' && result.composition){
   const sections=result.composition.sections.filter((s:any)=>s.enabled);
   // Public validation still requires contiguous order after private disabled sections are removed.
   result.composition.sections=sections.map((section:any,order:number)=>({...section,order}));
   if(!sections.some((s:any)=>['products','services','pricing'].includes(s.type)&&!Object.hasOwn(s.data,'items')))delete result.items;
   if(!sections.some((s:any)=>s.type==='trust'&&!Object.hasOwn(s.data,'items')))delete result.stats;
   delete result.features;
 }
 return result as SiteContent;
}
export function publicWebsiteSettings(value:unknown):SiteSettings{return pick(value,['primaryColor','accentColor','backgroundColor','fontFamily','borderRadius']) as SiteSettings;}
export function createPublishedSnapshot(site:WebsiteSiteRecord,publishedAt:string|null=site.published_at||null):WebsitePublishedSnapshot {
 return {version:1,templateId:site.template_id,name:site.name,content:publicWebsiteContent(site.content_json),settings:publicWebsiteSettings(site.settings_json),draftUpdatedAt:site.updated_at,publishedAt};
}
export function legacyPublishedSnapshot(site:WebsiteSiteRecord):WebsitePublishedSnapshot|null {
 return site.published_snapshot_json || (site.status==='published'?createPublishedSnapshot(site):null);
}
export function publishedWebsiteRecord(site:WebsiteSiteRecord):WebsiteSiteRecord {
 const snapshot=legacyPublishedSnapshot(site);
 if(!snapshot || snapshot.version!==1)throw new Error('Published website snapshot is unavailable.');
 return {...site,template_id:snapshot.templateId,name:snapshot.name,content_json:publicWebsiteContent(snapshot.content),settings_json:publicWebsiteSettings(snapshot.settings),published_at:snapshot.publishedAt};
}
