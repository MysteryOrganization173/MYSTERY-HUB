import type {SiteContent} from '../types/index.js';

export type WebsiteLayoutMode = 'template' | 'sections';
/** Missing metadata preserves the pre-B1 interpretation; inactive composition is never deleted. */
export function websiteLayoutMode(templateId:string, content?:Partial<SiteContent>):WebsiteLayoutMode {
  if(templateId==='tmpl-start-blank')return 'sections';
  return content?.layoutMode || (content?.composition ? 'sections' : 'template');
}
export function websiteExampleReview(content:Partial<SiteContent>) {
  const examples=(content.items || []).filter(item=>item.isExample===true);
  return {required:examples.length>0,count:examples.length,items:examples.map(item=>({id:item.id,name:item.name})),code:'EXAMPLE_REVIEW_REQUIRED' as const};
}
