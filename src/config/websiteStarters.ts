import {WEBSITE_TEMPLATES} from '../data/templates.js';
import type {SiteContent,SiteSettings,TemplateItem} from '../types/index.js';
import {websiteTemplateItemFields} from './websiteBuilder.js';

export const WEBSITE_STARTER_VERSION=1;
const vocabulary:Record<string,[string,string,string]>={
  restaurant:['Menu item','Describe the dish, ingredients and portion you actually offer.','Menu'],
  salon:['Service','Describe this service and what a customer can expect.','Services'],
  construction:['Project outline','Replace this example with an accurate description of your own work or offering.','Projects'],
  realestate:['Property outline','Replace this example with a property you are authorized to advertise.','Properties'],
  portfolio:['Work sample','Replace this example with your own work and image.','Portfolio'],
  agency:['Service','Describe the service your business actually provides.','Services'],
  hotel:['Room outline','Replace this example with an accurate room description and photo.','Rooms'],
  education:['Offering','Describe an actual course or learning activity.','Offerings'],
  church:['Activity','Describe an activity and confirm its details before publishing.','Activities'],
  fashion:['Collection item','Describe an item your business actually offers.','Collection'],
  services:['Service','Describe a service your business actually provides.','Services'],
  ecommerce:['Product','Describe an actual product and confirm availability before publishing.','Products'],
  retail:['Product','Describe an actual product and confirm availability before publishing.','Products'],
};
/** Curated structures, never a copy of demo claims, contacts, prices, ratings or statistics. */
export function websiteStarter(templateId:string,businessName:string) {
  const t=WEBSITE_TEMPLATES.find(t=>t.id===templateId);
  if(!t)throw new Error('Unknown website template.');
  const fields=websiteTemplateItemFields(templateId),v=vocabulary[t.layoutType || t.category] || vocabulary.services;
  const items:TemplateItem[]=templateId==='tmpl-data-reseller'||templateId==='tmpl-start-blank'?[]:Array.from({length:3},(_,n)=>({
    id:`starter-v1-${n+1}`,name:`Example ${v[0].toLowerCase()} ${n+1}`,desc:v[1],isExample:true,
    ...(fields.includes('category')?{category:v[2]}:{}),
    // Existing registered imagery remains illustrative; no ownership/availability claim is made.
    ...(fields.includes('image') && t.items?.[n]?.image?{image:t.items[n].image}:{}),
  }));
  const content:Partial<SiteContent>={starterVersion:WEBSITE_STARTER_VERSION,businessName,tagline:`Welcome to ${businessName}`,aboutText:'',location:'',phone:'',whatsapp:'',email:'',logoUrl:'',heroImage:t.heroImage || '',ctaLabel:templateId==='tmpl-data-reseller'?'Buy Data':'Contact us',ctaTarget:'',social:{},items,stats:[],features:[],...(templateId==='tmpl-start-blank'?{layoutMode:'sections' as const,composition:structuredClone(t.composition!)}:{layoutMode:'template' as const})};
  const settings:SiteSettings={primaryColor:t.colorScheme?.primary || '#0f172a',accentColor:t.accentColor || '#00c365',backgroundColor:t.colorScheme?.background || '#ffffff',fontFamily:'font-sans',borderRadius:'rounded-xl'};
  return {starterVersion:WEBSITE_STARTER_VERSION,templateId,content,settings,capabilities:{layoutModes:templateId==='tmpl-start-blank'?['sections']:['template','sections'],itemFields:templateId==='tmpl-data-reseller'?[]:fields,managed:templateId==='tmpl-data-reseller',exampleCount:items.length}};
}
