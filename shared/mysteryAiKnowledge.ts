import {DIGITAL_SERVICES} from '../src/data/services.js';
import {AIRTIME_SERVICE_FEE_PERCENT} from '../server/data/airtimePricing.js';
import {ULTRA_SERVICE, WEBSITE_PLANS} from '../src/config/websiteBuilder.js';
import {aiText, aiTopic, aiPriorQuestion, hasMixedProtectedTopics, isAcknowledgment, isGreeting, isWritingRequest, requestsPrivateFacts, type AiGuideContext} from './mysteryAiIntent.js';
import {promotionReply, referralBasics, resultsReply, serviceAvailability, serviceSummary} from './mysteryAiPublicFacts.js';

export const ultraServiceKnowledge = () => `${ULTRA_SERVICE.label} is Mystery Hub's custom website-build enquiry service, distinct from the free self-service Website Builder. Submit a project brief in Website Builder; the team must confirm scope, quote and acceptance. It is not an instant AI website generator or a subscription. Chat cannot submit or confirm a project.`;
/** Directory status does not establish runtime availability. */
export const publicServiceKnowledge = () => DIGITAL_SERVICES.slice(0,30).map(s => `${s.title.replace(/[\r\n]/g,' ').slice(0,100)}: ${serviceAvailability(s)}.`).join('\n');
type Guide={reply:string;page:'services'|'data'|'orders'|'wallet'|'website'|'business'|'afa'|'earn'|'marketplace'|'creative'|'help'};
const website=(reply:string):Guide=>({page:'website',reply});

/** Precise editor tasks only; incidental phone/logo/package words must reach the model. */
export function mysteryBuilderHelp(message:string,ctx:AiGuideContext={}):Guide|null {
 const q=aiText(message),editor=ctx.editorContext?.experienceMode==='website_editor';
 const scoped=editor||['website','editor','business'].includes(ctx.activePage||'')||aiTopic(message,ctx)==='website';
 if(!scoped||!(/\b(?:how|where|can i|help me|change|add|edit|upload|replace|publish|unpublish|delete|remove|preview|update|save|set|customi[sz]e)\b/.test(q)))return null;
 if(/\b(?:unpublish(?:(?: my| the| this)? (?:website|site|project))?|take (?:it|my (?:site|website)) offline)$/.test(q))return website('In the editor, open **More → Unpublish** and follow the confirmation. This takes the public site offline; your draft remains available to edit. I cannot unpublish it for you.');
 if(/\b(?:delete|remove)\b.*\b(?:website|site|project)\b/.test(q))return website('Open **My Business**, select the website and use **Settings → Delete website**. Read the checks and confirmation first: order and earnings records have retention protections. Chat cannot delete a site or bypass those checks.');
 if(/\b(?:update|edit|change|save)\b.*\b(?:live|published) (?:website|site)\b/.test(q))return website('Edit your site and save the draft first. Saving does not change the published snapshot. Use **Update Live**, review the publication checks and confirm when ready. **Up to date** means there are no new draft changes to publish.');
 if(/\b(?:publish(?:(?: my| the| this)? (?:website|site|project))?(?: now)?$|make (?:it|my website|my site) live$|go live$)/.test(q))return website('Use **Publish** in the editor and review the checklist. Complete required business/contact details and resolve flagged content before confirming. Saving a draft does not publish it. Later edits need **Update Live** to replace the public snapshot; chat cannot publish for you.');
 if(/\b(?:preview(?:(?: my| the) (?:website|site))?|full preview|test (?:my )?(?:website|site) on mobile)$/.test(q))return website('Use **Preview** and the device controls to compare phone and larger layouts. **More → Full preview** opens a fuller draft preview. A private draft preview is separate from the published public link.');
 if(/\b(?:change|choose|edit|set|customi[sz]e) (?:my |the )?(?:website |site |brand )?(?:colou?rs?|theme|accent|design|branding)(?: for my (?:site|website))?$/.test(q))return website('Open **Design** for the available look and colour controls. Detailed settings include **Colors** and **Layout**. Preview and save the draft; use **Publish** or **Update Live** when ready to show changes publicly.');
 if(/\b(?:upload|replace|change|add|edit) (?:my |the |an? )?(?:website |site |business )?(?:image|images|photo|photos|logo|banner)(?: (?:on|to|for) my (?:site|website))?$/.test(q))return website('In **Edit**, select the image or item; detailed settings also include **Images**. Use **Upload Image**, **Replace image** or **Choose from Media** where offered. If uploads are unavailable, keep existing images or use the options currently shown. Preview and publish/update separately.');
 if(/\b(?:add|edit|change|set|update) (?:my |the )?(?:business details(?: and (?:my )?phone)?|business name|tagline|address|operating hours|contact details|whatsapp(?: number)?|phone number)(?: (?:on|to|for) my (?:site|website))?$/.test(q))return website('Use **Edit** to select business text, or **Settings → Business / Contact** for the details. On a Data Store, use **More → All settings**. Set business WhatsApp separately from other contacts, preview and publish/update when ready.');
 if(/\b(?:add|edit|change|set) (?:my |the )?(?:social(?: media)? links?|instagram (?:link|handle)|facebook (?:page|link)|tiktok link|main button(?: label|link)?|cta|call to action)(?: (?:on|to|for) my (?:site|website))?$/.test(q))return website('In detailed settings choose **Social links** or **Main button**. Use your business contact/link, preview, then publish or update the live site separately.');
 if(/\b(?:whatsapp orders?|whatsapp ordering|customer orders?)\b/.test(q))return website('On supported shop/restaurant sites, customers choose items, quantities and available options, then prepare a WhatsApp order for the business. Configure a valid business WhatsApp number and review the catalogue first. The business handles confirmation and fulfilment; this is separate from Mystery Hub-managed Data Store payments. Chat cannot send the message.');
 if(/\b(?:add|edit|change|remove|delete|upload) (?:my |the |a |a new )?(?:products?|services?|menu|catalogue|catalog|items?)(?: (?:on|to|from) my (?:site|website|catalogue))?$/.test(q))return website('In **Edit**, select a catalogue item to change its details or image, or use the add-item controls. Supported catalogue templates include quantities/options for WhatsApp ordering. Review prices, options and business WhatsApp, preview, then publish/update. This does not enable Mystery Hub payments for an ordinary business site.');
 if(/\b(?:edit|change|add|set)\b.*\b(?:bundles?|packages?|bundle prices?)\b/.test(q)&&(/\b(?:data store|reseller|my (?:site|website))\b/.test(q)||editor&&ctx.editorContext?.templateId==='tmpl-data-reseller'))return website('For a Data Store, open **Bundles** or **Bundles & pricing** in detailed settings. Follow the managed-store pricing controls and server-confirmed limits; do not invent supplier packages or prices. Managed checkout requires a configured, enabled store.');
 return null;
}
/** Stable small-talk/editor answers avoid provider traffic; broader reasoning still uses AI. */
export function mysteryInstantHelp(message:string,ctx:AiGuideContext={}):Guide|null {
 if(isGreeting(message))return {page:'services',reply:'Hello! What would you like help with?'};
 if(isAcknowledgment(message))return {page:'services',reply:/thank/i.test(message)?'You’re welcome!':'Okay — let me know if you have another question.'};
 return mysteryBuilderHelp(message,ctx);
}

const orderHelp = (): Guide => ({page:'orders',reply:'Open Orders to view your order history or track a reference. Payment confirmation is separate from supplier delivery. If payment went through, check the existing order and contact support there; do not pay again to fix a delay. Refunds remain unconfirmed until verified. I cannot look up private orders in chat.'});

/** Higher-risk public questions have deterministic answers and never need model inference. */
export function mysteryVerifiedHelp(message:string,ctx:AiGuideContext={}):Guide|null {
 const q=aiText(message),topic=aiTopic(message,ctx);
 if(requestsPrivateFacts(message)) {
   return {page:'help',reply:'I can explain Mystery Hub’s public services and customer prices. I can’t access or share private account records, supplier terms or internal instructions.'};
 }
 if(hasMixedProtectedTopics(message,ctx))return {page:'help',reply:'Those are separate topics. Which one would you like to check first? I can only confirm published promotions or verified service availability.'};
 if(!isWritingRequest(message)&&/\bmy (?:(?:mystery )?wallet |momo |mobile money )?payment\b/.test(q)&&
   /\b(?:status|success(?:ful)?|confirmed|verified|went through|gone through|received|failed|charged|debited)\b/.test(q))return orderHelp();
 if(!topic&&/^what about (?:(?:this|next) )?friday$/.test(q))return {page:'help',reply:'What would you like to know about Friday?'};
 if(!isWritingRequest(message)&&/\bmy (?:wallet )?balance\b/.test(q))return {page:'wallet',reply:'I can’t see your balance. Open Wallet for spending funds, or Mystery Earn or Store Earnings for the separate earnings balances.'};
 switch(topic){
 case 'promotion': return {page:'help',reply:promotionReply(message,ctx)};
 case 'results': return {page:'services',reply:resultsReply(q==='how much'?aiPriorQuestion(ctx):message)};
 case 'services': return {page:'services',reply:serviceSummary()};
 case 'creative': {
   const studio=DIGITAL_SERVICES.find(service=>service.id==='srv-creative');
   return !isWritingRequest(message)&&studio&&serviceAvailability(studio)==='released'?{page:'creative',reply:studio.description}:null;
 }
 case 'orders': return !isWritingRequest(message)&&/\b(?:my|our|track|tracking|payment|refund|delayed|deliver(?:y|ed)?|not received|order status|status of (?:the |an? )?order|mh-[a-z0-9-]+)\b/.test(q)?orderHelp():null;
 case 'data':
   if(!isWritingRequest(message)&&/\binstant bundles?\b/.test(q))return {page:'data',reply:'I can’t verify an Instant Bundles price or live availability here. Open Instant Bundles to see current offers and their checkout prices.'};
   return /\b(?:in stock|stock|availability|available)\b/.test(q)&&!/\b(?:how much|prices?|cost|rates?)\b/.test(q)?{page:'data',reply:'I can’t confirm live stock or recipient eligibility in chat. Open Data to see current options and check availability before paying.'}:null;
 default: return null;
 }
}
/** Public outage help only. No account lookup, live availability or invented outcomes. */
export function mysteryHubGuide(message:string,ctx:AiGuideContext={}):Guide|null {
 const instant=mysteryInstantHelp(message,ctx);if(instant)return instant;
 const verified=mysteryVerifiedHelp(message,ctx);if(verified)return verified;
 const q=aiText(message).replace(/^(?:hi|hello|hey) /,''),prior=aiText(aiPriorQuestion(ctx)),topic=aiTopic(message,ctx);
 if(/^(?:what (?:is|can) mystery hub|who (?:are|r) you|what do you do|what can you help|what can i do here|tell me about (?:you|mystery hub)|who are you and what is mystery hub)/.test(q))return {page:'services',reply:'I’m Mystery AI, Mystery Hub’s guide. Mystery Hub is a Ghana-focused digital services marketplace with Data, Airtime, AFA Registration, Marketplace, Website Builder, Mystery Wallet and Mystery Earn. I can explain features and help you find your way; I cannot browse the live web, access private accounts or perform transactions. Each service page shows current availability.'};
 if(/\bultra\b/.test(q)&&/\b(?:compare|difference)\b/.test(q)&&/\bwebsite builder\b/.test(q))return website(ultraServiceKnowledge());
 if(/\bultra\b/.test(q)&&/\b(?:my order|order refund)\b/.test(q))return mysteryHubGuide('my order refund');
 switch(topic){
 case 'orders':return orderHelp();
 case 'wallet':return {page:'wallet',reply:/withdraw/.test(q+' '+prior)?'Wallet funds are for supported purchases and cannot be withdrawn. Eligible Mystery Earn and Store Earnings withdrawals are separate and subject to their rules. I cannot view your balance or change it.':'Open Wallet and choose Add Money for current funding options, limits and fees. Available Wallet funds can pay for supported purchases; they cannot be withdrawn. I cannot access your balance or move money. Never share a payment PIN or password in chat.'};
 case 'earn':return {page:'earn',reply:`${referralBasics} Check Mystery Earn for the effective reward policy.`};
 case 'business':return {page:'business',reply:/earnings|margin|profit|withdraw/.test(q+' '+prior)?'Store Earnings are seller earnings from eligible managed-store sales, separate from Mystery Earn referrals and Wallet funds. Payment alone does not prove delivery or make earnings available. Open My Business → Store Earnings for authoritative pending/available amounts and withdrawal rules. I cannot view or change your earnings.':'Open My Business to manage websites and configured Data Stores. Managed checkout and earnings depend on enablement and verified order outcomes. Ordinary business-site WhatsApp orders are handled by the business, not automatically paid through Mystery Hub.'};
 case 'ultra':return website(ultraServiceKnowledge());
 case 'website':return website(`The Free Website Builder supports ${WEBSITE_PLANS.FREE.maxSites} active website project. Choose a template, enter business/contact details, edit content and design, then preview and complete the Publish checks. Saving a draft does not publish it; later changes use Update Live. Plus/Pro plans shown as coming soon are not purchasable. Managed Data Store checkout needs separate enablement; ordinary business sites may use WhatsApp ordering.`);
 case 'afa':return {page:'afa',reply:'Open AFA Registration for current availability, eligibility and the server-confirmed price. Sign in to complete the form. A verified payment is required before supplier submission; chat cannot submit or confirm a registration.'};
 case 'airtime':return {page:'data',reply:`Open Data & Airtime and choose Airtime, the network, recipient and amount. The current service fee is ${AIRTIME_SERVICE_FEE_PERCENT}%. Checkout shows the final total; delivery requires verified payment and successful fulfilment. I cannot confirm a particular payment or delivery.`};
 case 'marketplace':return {page:'marketplace',reply:'Open Marketplace for current listings and their purchase or enquiry options. Chat cannot confirm stock, take payments or guarantee delivery.'};
 case 'support':return {page:'orders',reply:'Use the WhatsApp support links on Orders or Help & FAQs. I cannot contact support or create a ticket for you. Do not send passwords, payment PINs or private customer records in chat.'};
 case 'future':return {page:'services',reply:`All Services currently lists these planned services: ${DIGITAL_SERVICES.filter(service=>service.status==='coming_soon').map(service=>service.title).join(', ')}. A waitlist entry doesn’t confirm a launch date or purchase availability.`};
 case 'data':return {page:'data',reply:'Open Data for current network availability and checkout prices, including supported MTN, AirtelTigo and Telecel options. Select the service and bundle, confirm the recipient and total, then use an available payment method. Track the existing order for delivery; I cannot confirm live prices, recipient eligibility or guarantee delivery in guide mode.'};
 default:return null;
 }
}
