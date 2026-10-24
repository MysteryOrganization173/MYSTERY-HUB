import {WEBSITE_TEMPLATES} from '../data/templates.js';
import type {SiteContent,SiteSettings,TemplateItem} from '../types/index.js';
import {websiteTemplateItemFields} from './websiteBuilder.js';

export const WEBSITE_STARTER_VERSION=1;
const vocabulary:Record<string,[string,string,string]>={
  restaurant:['Menu item','Describe the dish, ingredients and portion you actually offer.','Menu'],
  nightkitchen:['Menu item','Describe the dish, ingredients and portion you actually offer.','Menu'],
  boutique:['Product','Describe an actual product and confirm availability before publishing.','Products'],
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
/**
 * Industry examples an owner recognises as their own kind of business. Names and descriptions are
 * plain and neutral: no prices, ratings, contacts, statistics or claims. Every item is marked as an
 * example and must be kept or removed by the owner before publishing. `image` indexes the
 * template's registered illustrative photo, never a stock claim about the owner's work.
 */
type StarterExample={name:string;desc:string;category?:string;image?:number};
const examples:Record<string,StarterExample[]>={
  'tmpl-buka-bistro':[
    {name:'Jollof rice with grilled chicken',desc:'Smoky tomato jollof served with grilled chicken and fresh salad.',category:'Mains',image:2},
    {name:'Light soup with fufu',desc:'Goat or fish light soup served with soft fufu.',category:'Soups',image:1},
    {name:'Grilled tilapia with banku',desc:'Whole grilled tilapia with banku, pepper sauce and sliced onions.',category:'Mains',image:0},
  ],
  'tmpl-night-kitchen':[
    {name:'Jollof rice with grilled chicken',desc:'Smoky tomato jollof served with grilled chicken and fresh salad.',category:'Mains',image:0},
    {name:'Grilled tilapia with banku',desc:'Whole grilled tilapia with banku, pepper sauce and sliced onions.',category:'Mains',image:1},
    {name:'Light soup with fufu',desc:'Goat or fish light soup served with soft fufu.',category:'Soups',image:2},
  ],
  'tmpl-boutique':[
    {name:'Occasion outfit',desc:'Describe the fabric, sizes and colours you offer.',category:'Occasion',image:0},
    {name:'Everyday piece',desc:'Describe the fabric, sizes and colours you offer.',category:'Everyday',image:1},
    {name:'Gift idea',desc:'Describe a product customers often buy as a gift.',category:'Gifts',image:2},
  ],
  'tmpl-accra-build':[
    {name:'Offices and shops',desc:'Design and construction of offices, shops and mixed-use buildings.',category:'Commercial',image:0},
    {name:'Family homes',desc:'New homes, extensions and finishing work, from foundation to handover.',category:'Residential',image:1},
    {name:'Warehouses and yards',desc:'Warehouses, storage yards and site preparation for business clients.',category:'Industrial',image:2},
  ],
  'tmpl-glow-salon':[
    {name:'Knotless braids',desc:'Neat knotless braids in the length and size you choose.',category:'Hair styling',image:0},
    {name:'Haircut and beard trim',desc:'A clean cut and shape-up, finished with a beard trim.',category:'Barbering',image:1},
    {name:'Facial treatment',desc:'A cleansing facial to refresh and care for your skin.',category:'Skin care',image:2},
  ],
  'tmpl-goldcoast-realty':[
    {name:'Three-bedroom apartment',desc:'Open-plan living area, fitted kitchen and parking space.',category:'For sale',image:0},
    {name:'Two-bedroom house',desc:'A house with a small garden, available to rent.',category:'For rent',image:1},
    {name:'Family home with garden',desc:'A family home with outdoor space and room to grow.',category:'For sale',image:2},
  ],
  'tmpl-lens-creative':[
    {name:'Street festival story',desc:'A photo series from a day at a local street festival.',category:'Documentary',image:0},
    {name:'Fashion shoot',desc:'Studio and outdoor portraits for a clothing collection.',category:'Fashion',image:1},
    {name:'Coastal landscapes',desc:'Early-morning views along the coast.',category:'Landscape',image:2},
  ],
  'tmpl-vortex-tech':[
    {name:'Website design',desc:'Clear, mobile-friendly websites for small businesses.',category:'Web'},
    {name:'Mobile app development',desc:'Android and iOS apps planned and built around your customers.',category:'Apps'},
    {name:'IT support',desc:'Setup, maintenance and support for office computers and networks.',category:'Support'},
  ],
  'tmpl-akwaaba-hotel':[
    {name:'Deluxe double room',desc:'A double room with a private bathroom, air conditioning and Wi-Fi.',image:0},
    {name:'Garden chalet',desc:'A quiet chalet with a garden view and a private veranda.',image:1},
    {name:'Family room',desc:'A larger room with space for a family to stay together.'},
  ],
  'tmpl-horizon-edu':[
    {name:'Introduction to coding',desc:'A beginner course covering the basics of programming.',category:'Courses'},
    {name:'Maths and science classes',desc:'Small-group lessons that help students prepare for exams.',category:'Classes'},
    {name:'Computer skills for adults',desc:'Hands-on lessons in typing, email, documents and spreadsheets.',category:'Courses'},
  ],
  'tmpl-makola-mart':[
    {name:'Everyday laptop',desc:'A lightweight laptop for work, school and browsing.',category:'Laptops',image:0},
    {name:'Wireless headphones',desc:'Comfortable over-ear headphones for music and calls.',category:'Audio',image:1},
    {name:'Fast phone charger',desc:'A wall charger and cable for phones and tablets.',category:'Accessories',image:2},
  ],
  'tmpl-grace-ministry':[
    {name:'Sunday service',desc:'Worship, prayer and the Word together as a church family.',category:'Sundays'},
    {name:'Midweek Bible study',desc:'A midweek gathering to study the Bible and pray together.',category:'Weekdays'},
    {name:'Youth fellowship',desc:'Fellowship, music and teaching for young people.',category:'Youth'},
  ],
  'tmpl-afrochic-threads':[
    {name:'Kente outfit',desc:'Made-to-measure kente outfits for weddings and special occasions.',category:'Traditional',image:0},
    {name:'Linen kaftan',desc:'A relaxed linen kaftan, tailored to your measurements.',category:'Contemporary',image:1},
    {name:'Ankara dress',desc:'A custom Ankara dress in the fabric and style you choose.',category:'Contemporary'},
  ],
  'tmpl-legon-consult':[
    {name:'Business registration',desc:'Help registering your business and preparing the required documents.',category:'Business setup'},
    {name:'Tax filing support',desc:'Preparing and filing your business tax returns.',category:'Tax'},
    {name:'Bookkeeping',desc:'Monthly bookkeeping so your records stay organised.',category:'Accounting'},
  ],
};
/**
 * A headline and short description in each design's voice, so a new website reads as finished.
 * Suggested wording only: no ratings, prices, hours, places, credentials or achievements. The editor
 * marks it as suggested until the owner changes it.
 */
const wording:Record<string,{tagline:string;aboutText:string}>={
  'tmpl-data-reseller':{tagline:'Buy Data. Stay Connected.',aboutText:'Choose a bundle, pay securely and track your order.'},
  'tmpl-buka-bistro':{tagline:'Ghanaian flavours, cooked with care',aboutText:'Take a look at our menu, then message us to ask about a table or to place an order.'},
  'tmpl-night-kitchen':{tagline:'Home-style food, cooked fresh every day.',aboutText:'Browse the menu, add what you fancy and send your order on WhatsApp. Or come and eat with us.'},
  'tmpl-boutique':{tagline:'Pieces made to be worn every day.',aboutText:'Browse the collection, pick your size or colour and order on WhatsApp. We confirm stock and delivery with you.'},
  'tmpl-accra-build':{tagline:'Built right, from foundation to handover',aboutText:'See the kind of work we take on, then tell us about your project and ask for an estimate.'},
  'tmpl-glow-salon':{tagline:'Look good. Feel confident.',aboutText:'Browse our services and message us to book a time that suits you.'},
  'tmpl-goldcoast-realty':{tagline:'Find a place that feels like home',aboutText:'Browse our listings and message us to ask about a property or arrange a viewing.'},
  'tmpl-lens-creative':{tagline:'Stories told through the lens',aboutText:'Explore a selection of our work and get in touch to plan your shoot.'},
  'tmpl-vortex-tech':{tagline:'Technology that works for your business',aboutText:'See how we can help, then tell us what you need and we will get back to you.'},
  'tmpl-akwaaba-hotel':{tagline:'A warm welcome and a restful stay',aboutText:'Explore our rooms and message us to ask about availability for your dates.'},
  'tmpl-horizon-edu':{tagline:'Learn new skills with confidence',aboutText:'Explore our courses and classes, then contact us to ask about joining.'},
  'tmpl-makola-mart':{tagline:'Discover our products and collections',aboutText:'Explore the catalogue and contact us to confirm stock, delivery, payment and warranty terms.'},
  'tmpl-grace-ministry':{tagline:'A place to belong, worship and grow',aboutText:'Join us for worship and fellowship. Message us to find out more about our gatherings.'},
  'tmpl-afrochic-threads':{tagline:'African fashion, tailored for you',aboutText:'Explore our pieces and message us to talk about fabric, fit and your measurements.'},
  'tmpl-legon-consult':{tagline:'Clear advice for growing businesses',aboutText:'Tell us what you need help with and we will explain how we can support you.'},
};
/** The suggested headline and description a design starts with, if it has them. */
export const websiteStarterWording=(templateId:string)=>wording[templateId];
const itemWords:Record<string,[string,string,string]>={
  restaurant:['Dish','Menu','dishes'],nightkitchen:['Dish','Menu','dishes'],boutique:['Product','Products','products'],salon:['Service','Services','services'],construction:['Project','Projects','projects'],realestate:['Property','Properties','properties'],
  portfolio:['Work','Portfolio','works'],agency:['Service','Services','services'],hotel:['Room','Rooms','rooms'],education:['Course','Courses','courses'],
  church:['Activity','Activities','activities'],fashion:['Item','Collection','items'],services:['Service','Services','services'],ecommerce:['Product','Products','products'],retail:['Product','Products','products'],
};
/** Owner-facing words for a template's items: one ("Dish"), the area ("Menu") and a count ("dishes"). */
export function websiteItemVocabulary(templateId:string) {
  const t=WEBSITE_TEMPLATES.find(t=>t.id===templateId);
  const [singular,plural,many]=itemWords[t?.layoutType || t?.category || ''] || ['Item','Items','items'];
  return {singular,plural,many};
}
export function websiteStarter(templateId:string,businessName:string) {
  const t=WEBSITE_TEMPLATES.find(t=>t.id===templateId);
  if(!t)throw new Error('Unknown website template.');
  const fields=websiteTemplateItemFields(templateId),v=vocabulary[t.layoutType || t.category] || vocabulary.services;
  const curated=examples[templateId];
  const items:TemplateItem[]=templateId==='tmpl-data-reseller'||templateId==='tmpl-start-blank'?[]:Array.from({length:3},(_,n)=>{
    const e=curated?.[n];
    const image=e ? (e.image!==undefined ? t.items?.[e.image]?.image : undefined) : t.items?.[n]?.image;
    return {
      id:`starter-v1-${n+1}`,name:e?.name || `Example ${v[0].toLowerCase()} ${n+1}`,desc:e?.desc || v[1],isExample:true,
      ...(fields.includes('category')?{category:e?.category || v[2]}:{}),
      // Existing registered imagery remains illustrative; no ownership/availability claim is made.
      ...(fields.includes('image') && image?{image}:{}),
    };
  });
  const content:Partial<SiteContent>={starterVersion:WEBSITE_STARTER_VERSION,businessName,tagline:wording[templateId]?.tagline || `Welcome to ${businessName}`,aboutText:wording[templateId]?.aboutText || '',location:'',phone:'',whatsapp:'',email:'',logoUrl:'',heroImage:t.heroImage || '',ctaLabel:templateId==='tmpl-data-reseller'?'Shop Bundles':'Contact us',ctaTarget:'',social:{},items,stats:[],features:[],...(templateId==='tmpl-start-blank'?{layoutMode:'sections' as const,composition:structuredClone(t.composition!)}:{layoutMode:'template' as const})};
  const settings:SiteSettings={primaryColor:t.colorScheme?.primary || '#0f172a',accentColor:t.accentColor || '#00c365',backgroundColor:t.colorScheme?.background || '#ffffff',fontFamily:'font-sans',borderRadius:'rounded-xl'};
  return {starterVersion:WEBSITE_STARTER_VERSION,templateId,content,settings,capabilities:{layoutModes:templateId==='tmpl-start-blank'?['sections']:['template','sections'],itemFields:templateId==='tmpl-data-reseller'?[]:fields,managed:templateId==='tmpl-data-reseller',exampleCount:items.length}};
}
