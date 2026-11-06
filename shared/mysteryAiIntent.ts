/** User evidence only: generated answers are deliberately not an input to navigation. */
export type AiTopic='data'|'airtime'|'website'|'business'|'wallet'|'earn'|'orders'|'marketplace'|'afa'|'future'|'support'|'ultra'|'promotion'|'results'|'creative'|'services';
export interface AiTurn {role:'user'|'assistant';content:string}
export interface AiGuideContext {history?:readonly AiTurn[];activePage?:string;editorContext?:{experienceMode?:string;templateId?:string;siteStatus?:string;activeEditorSection?:string;hasUnsavedChanges?:boolean}|null}
export interface AiNavigation {type:'navigate';targetPage:'data'|'website'|'business'|'wallet'|'earn'|'orders'|'marketplace'|'afa'|'services'|'help'|'creative';label:string;dataMode?:'data'|'instant'|'airtime'}
export const aiText=(s:string)=>s.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9'\s-]/g,' ').replace(/\s+/g,' ').trim();
export const isAcknowledgment=(s:string)=>/^(?:thanks(?: a lot| so much)?|thank you(?: very much)?|okay|ok|alright|got it|understood|great|nice|cool|cheers)$/.test(aiText(s));
export const isGreeting=(s:string)=>/^(?:hi|hello|hey|good (?:morning|afternoon|evening))(?: there)?$/.test(aiText(s));
export const isWritingRequest=(s:string)=>/^(?:(?:please|can you|could you|help me) )?(?:draft|write|compose|rewrite|edit)\b/.test(aiText(s));
export const requestsPrivateFacts=(s:string)=>/\b(?:api keys?|supplier costs?|wholesale pric(?:e|es|ing)|supplier identit(?:y|ies)|(?:name|who is) (?:your|the) supplier|another customer|other customers|system prompt|private (?:customer|ranking|admin|order) (?:data|records?|details|history))\b/.test(aiText(s));
const isFollowUp=(s:string)=>/^(?:why|how|how much|explain|tell me more|explain more|what about (?:telecel|mtn|airteltigo|at|(?:this |next )?friday)|who won|is (?:it|the round) (?:active|open)|can i use (?:it|this|that) (?:for free|free)|is (?:it|this|that) free|where do i start|take me there|open (?:it|that|this)|show me (?:it|that)|how do i do (?:it|that))$/.test(s);
const pageTopic:Record<string,AiTopic>={data:'data',website:'website',editor:'website',business:'business',wallet:'wallet',earn:'earn',orders:'orders',marketplace:'marketplace',afa:'afa'};
function directTopics(text:string,ctx:AiGuideContext):AiTopic[]{
 const q=aiText(text),topics=new Set<AiTopic>();
 if(/^(?:(?:please )?(?:open|go to|take me to|show me) (?:the )?)(?:data(?: page| bundles?)?|instant bundles?)(?: please)?$/.test(q))topics.add('data');
 const builder=ctx.editorContext?.experienceMode==='website_editor'||['website','editor','business'].includes(ctx.activePage||'');
 if(/\b(?:create|build|start|make)\b.*\b(?:website|web site|site|storefront)\b/.test(q))topics.add('website');
 if(/^(?:please )?(?:open|go to|take me to|show me) (?:all )?services$/.test(q))topics.add('future');
 if(/^(?:please )?(?:open|go to|take me to|show me) (?:help|help and faqs)$/.test(q))topics.add('support');
 if(/\bultra\b/.test(q))topics.add('ultra');
 if(/\b(?:store earnings|my business|managed reseller|reseller|data store|my storefront)\b/.test(q)&&!topics.has('website'))topics.add('business');
 if(/\b(?:wallet)\b/.test(q))topics.add('wallet');
 if(/\b(?:mystery earn|referrals?|refer|referrer|referring)\b/.test(q))topics.add('earn');
 if(/^(?:giveaways?|promotions?)$/.test(q)||/\b(?:customer of the week|customer champions|customer recognition|friday (?:giveaways?|prizes?|rewards?|draw)|mystery hub (?:promotions?|promotional rewards?))\b/.test(q)||
   /\b(?:giveaways?|promotions?|give away|promotional rewards?|discounts?)\b/.test(q)&&/\b(?:mystery hub|you|current|next|today|this week|friday|winner|active|running|status)\b/.test(q))topics.add('promotion');
 if(/\b(?:results? checkers?|checker (?:pins?|vouchers?)|(?:waec|wassce|bece) (?:pins?|vouchers?|checkers?|results?)|(?:waec|wassce|bece).{0,24}\b(?:buy|price|cost)|(?:buy|price|cost).{0,24}\b(?:waec|wassce|bece))\b/.test(q))topics.add('results');
 if(/\b(?:creative studio|design services?)\b/.test(q)||/\b(?:design|create|quote)\b.*\b(?:flyer|poster|logo|banner)\b/.test(q)&&/\b(?:you|mystery hub)\b/.test(q))topics.add('creative');
 if(/^(?:what services (?:are (?:currently )?available|do you (?:offer|have|provide))|which services (?:are (?:currently )?available|can i use))(?: on mystery hub)?$/.test(q))topics.add('services');
 const websiteOrder=/\b(?:whatsapp orders?|whatsapp ordering|customer orders?|menu|catalogue|catalog)\b/.test(q)&&(builder||/\b(?:my (?:website|site|shop)|restaurant|business website)\b/.test(q));
 if(websiteOrder)topics.add('website');
 if(/\b(?:website builder|my website|my site|business website|free website|free site|website templates?)\b/.test(q)||/\bwebsite\b/.test(q)&&/\b(?:publish|edit|template|no coding|coding skills)\b/.test(q))topics.add('website');
 if(/\b(?:airtime|recharge)\b/.test(q))topics.add('airtime');
 if(!websiteOrder&&(/\b(?:order|orders|tracking|track|delivery|delayed|refund)\b/.test(q)||/\bpayment.*(?:went through|paid|received|success(?:ful)?|confirmed|verified)|\bpaid.*(?:received|bundle)/.test(q)))topics.add('orders');
 if(/\b(?:afa)\b/.test(q))topics.add('afa');
 if(/\b(?:marketplace)\b/.test(q))topics.add('marketplace');
 if(/\b(?:ecg|dstv|esim|gwcl|coming soon|future services|planned services|utilities)\b/.test(q)||/\b(?:pay|buy)\b.*\b(?:water bill|electricity|power tokens?)\b/.test(q))topics.add('future');
 if(/\b(?:support|helpdesk)\b/.test(q)||!websiteOrder&&/\b(?:contact support|whatsapp support)\b/.test(q))topics.add('support');
 if(/\b(?:instant bundles?|data bundles?|buy data|mobile data|bundle prices?|bundle rates?|data prices?|data rates?|data price|data pricing|data package)\b/.test(q)||/\b\d+(?: \d+)?\s*(?:gb|mb)\b/.test(q))topics.add('data');
 if(!topics.size&&/\b(?:mtn|telecel|airteltigo|bundles?)\b/.test(q)&&(/\b(?:buy|purchase|offers?|available|support|choose|select|how much|prices?|rates?)\b/.test(q)||ctx.activePage==='data'&&!isFollowUp(q)))topics.add('data');
 // A service qualifier on an order problem is evidence about that order, not a second destination.
 const comparing=/\b(?:compare|comparison|difference|versus|vs)\b/.test(q);
 const purchasing=/^(?:(?:how|where) (?:do|can) i |i want to |please )?(?:buy|purchase|recharge)\b/.test(q);
 if(topics.has('orders')&&[...topics].every(t=>['orders','data','airtime','afa','ultra'].includes(t))&&!comparing&&!purchasing&&!/\b(?:buy|purchase|open|recharge)\b.*\band\b|\band (?:then )?(?:buy|purchase|open|recharge)\b/.test(q))return ['orders'];
 // AFA data eligibility is one service; explicit multi-service requests stay ambiguous.
 if(topics.has('afa')&&!comparing&&!/\band\b/.test(q))topics.delete('data');
 return [...topics];
}
export function aiTopic(message:string,ctx:AiGuideContext={}):AiTopic|null {
 const q=aiText(message),topics=directTopics(message,ctx);if(topics.length===1)return topics[0];if(topics.length>1)return null;
 if(!isFollowUp(q))return null;
 const previous=[...(ctx.history||[])].reverse().find(t=>t.role==='user'&&!isAcknowledgment(t.content)&&!isGreeting(t.content)&&!isFollowUp(aiText(t.content)));
 if(previous){const previousTopics=directTopics(previous.content,ctx);return previousTopics.length===1?previousTopics[0]:null;}
 return /^(?:can i use|is (?:it|this|that) free|where do i start)/.test(q)?pageTopic[ctx.activePage||'']||null:null;
}
export function aiPriorQuestion(ctx:AiGuideContext={}){return [...(ctx.history||[])].reverse().find(t=>t.role==='user'&&!isAcknowledgment(t.content)&&!isGreeting(t.content)&&!isFollowUp(aiText(t.content)))?.content||'';}
export function hasMixedProtectedTopics(message:string,context:AiGuideContext){
 const topics=directTopics(message,context);
 return topics.length>1&&topics.some(topic=>topic==='promotion'||topic==='results');
}
export function aiNavigation(message:string,ctx:AiGuideContext={}):AiNavigation|undefined {
 const q=aiText(message);
 if(requestsPrivateFacts(message)||isWritingRequest(message))return;
 if(isGreeting(q)||isAcknowledgment(q)||/^(?:why|how|explain|tell me more|can i use (?:it|this|that) (?:for free|free)|what about)/.test(q)&&isFollowUp(q))return;
 if(/\b(?:don't|do not|not to|no need to|without)\b.*\b(?:open|navigate|take|go|buy|purchase|recharge|top up|create|build|track)\b|\b(?:admin|dashboard credentials|browse the (?:live )?web)\b/.test(q))return;
 const topic=aiTopic(message,ctx);if(!topic)return;
 if(topic==='promotion'||topic==='results')return;
 const request=/^(?:please )?(?:open|take me|go to|show me|buy|purchase|recharge|top up|add money)\b/.test(q)
  ||/\b(?:i want to|i would like to|i'd like to|help me) (?:buy|purchase|recharge|top up|add|create|build|track|find|access|view|use|open|fund)\b/.test(q)
  ||/\b(?:how|where) (?:do|can) i (?:buy|purchase|recharge|track|pay|create|build|start|fund|withdraw|find|access|use|view|see|add|top up)\b/.test(q)
  ||/^(?:where (?:is|can i find)|where do i start|can i (?:create|build)|can you (?:open|show me|take me))\b/.test(q)
  ||topic==='orders'&&/\b(?:my order|my bundle)\b.*\b(?:delayed|delivered|track|not received)\b/.test(q)
  ||topic==='creative'&&/^(?:what can creative studio|can (?:you|mystery hub) design|how do i (?:request|get) a quote)\b/.test(q);
 if(!request)return;
 const pages:Record<Exclude<AiTopic,'promotion'|'results'>,AiNavigation['targetPage']>={data:'data',airtime:'data',website:'website',business:'business',wallet:'wallet',earn:'earn',orders:'orders',marketplace:'marketplace',afa:'afa',future:'services',services:'services',support:'orders',ultra:'website',creative:'creative'};
 const helpDestination=topic==='support'&&/\b(?:help|faqs)\b/.test(q)&&!/\borders?\b/.test(q);
 const targetPage=helpDestination?'help':pages[topic];if(ctx.activePage===targetPage&&targetPage!=='data')return;
 const labels:Record<Exclude<AiTopic,'promotion'|'results'>,string>={data:'Open Data Bundles',airtime:'Open Airtime',website:'Open Website Builder',business:'Open My Business',wallet:'Open Wallet',earn:'Open Mystery Earn',orders:'Open Order Tracking',marketplace:'Open Marketplace',afa:'Open AFA Registration',future:'View Service Availability',services:'View Service Availability',support:'Open Orders & Support',ultra:'View Ultra Enquiries',creative:'Open Creative Studio'};
 return {type:'navigate',targetPage,label:helpDestination?'Open Help & FAQs':labels[topic],...(topic==='airtime'?{dataMode:'airtime' as const}:topic==='data'?{dataMode:/\binstant bundles?\b/.test(q)?'instant' as const:'data' as const}:{})};
}
