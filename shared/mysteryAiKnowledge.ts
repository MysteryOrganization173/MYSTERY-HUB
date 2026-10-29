import {DIGITAL_SERVICES} from '../src/data/services.js';
import {AIRTIME_SERVICE_FEE_PERCENT} from '../server/data/airtimePricing.js';
import {ULTRA_SERVICE} from '../src/config/websiteBuilder.js';

export const ultraServiceKnowledge = () => `${ULTRA_SERVICE.label} is Mystery Hub's custom website-build enquiry service, distinct from the free self-service Website Builder. Submit a project brief in Website Builder; the team must confirm scope, quote and acceptance. It is not an instant AI website generator or a subscription. Chat cannot submit or confirm a project.`;

/** Public product facts only. No account lookup, prices, provider state or transcript persistence. */
export const publicServiceKnowledge = () => DIGITAL_SERVICES.map(service =>
  `${service.title}: ${service.description} (${service.status === 'coming_soon' ? 'planned, not available for purchase' : 'see the service page for current availability'})`).join('\n');

export function mysteryHubGuide(message:string):{reply:string;page:'services'|'data'|'orders'|'wallet'|'website'|'afa'|'earn'|'marketplace'}|null {
  const q=message.toLowerCase().trim();
  const service=(id:string)=>DIGITAL_SERVICES.find(s=>s.id===id)!.description;
  if(/\b(order|track|delivery|delayed|refund)\b/.test(q)||/payment.*(through|paid|received)|paid.*(received|bundle)/.test(q))
    return {page:'orders',reply:'Open Orders page to view your order history or track a reference. Payment confirmation is separate from supplier delivery. If payment went through, check the existing order and contact support there; do not pay again to fix a delay. Refunds remain unconfirmed until verified. I cannot look up private orders in chat.'};
  if(/\bwallet\b/.test(q))return {page:'wallet',reply:`Mystery Wallet is live. ${service('srv-wallet')} Sign in, open Wallet and choose Add Money for current funding options, limits and fees. I cannot access your balance or move money. Never share a payment PIN or password in chat.`};
  if(/\b(earn|referr?al|refer|rewards?)\b/.test(q))return {page:'earn',reply:`${service('srv-rewards')} Open Mystery Earn for your referral link, current eligibility and effective reward policy. Rewards are not guaranteed for every purchase; Wallet spending funds and withdrawable eligible earnings are different. I cannot inspect or change your rewards.`};
  if(/\bultra\b/.test(q))return {page:'website',reply:ultraServiceKnowledge()};
  if(/\b(website|reseller|template)\b/.test(q))return {page:'website',reply:`${service('srv-website')} Draft saving does not publish your site; use Publish when ready. Managed Data storefront checkout works only when configured and enabled. Ordinary business sites may use WhatsApp ordering.`};
  if(/\bafa\b/.test(q))return {page:'afa',reply:'Open AFA Registration for current availability, eligibility and the server-confirmed price. Sign in to complete the form. A verified payment is required before supplier submission; chat cannot submit or confirm a registration.'};
  if(/\b(airtime|recharge)\b/.test(q))return {page:'data',reply:`Open Data & Airtime and choose Airtime, the network, recipient and amount. The current authoritative service fee is ${AIRTIME_SERVICE_FEE_PERCENT}%. Checkout shows the final total; delivery requires verified payment and successful fulfilment. I cannot confirm a particular payment or delivery.`};
  if(/\b(marketplace|gadgets?|laptops?)\b/.test(q))return {page:'marketplace',reply:`${service('srv-marketplace')} Open Marketplace for current listings; chat cannot guarantee stock or delivery.`};
  if(/\b(support|contact|helpdesk|whatsapp)\b/.test(q))return {page:'orders',reply:'Use the WhatsApp support links on Orders or Help & FAQs. Do not send passwords, payment PINs or private customer records in chat.'};
  if(/\b(ecg|water|electricity|waec|dstv|coming soon|esim)\b/.test(q))return {page:'services',reply:'Open All Services to see which services are available and which are planned. A preview or saved waitlist enquiry is not a purchasable service or a promise of a launch date or notification.'};
  if(/\b(data|bundles?|prices?|pricing|costs?|rates?|network|mtn|telecel|airteltigo)\b|how much|\b\d+(?:\.\d+)?\s*(?:gb|mb)\b/.test(q))return {page:'data',reply:'Open Data to see current network availability and checkout prices. Select a bundle, confirm the recipient and total, then pay using an available method. Track the existing order for delivery; I cannot confirm live prices or guarantee delivery in guide mode.'};
  if(/^(hi|hello|hey)\b|what can you help|what can i do here|what (?:is|can) mystery hub|who (?:are|r) you|what do you do|tell me about (?:you|mystery hub)/.test(q))
    return {page:'services',reply:'This is Mystery AI’s help guide. Mystery Hub is a Ghana-focused digital services marketplace with Data, Airtime, AFA Registration, Marketplace, Website Builder, Mystery Wallet and Mystery Earn. I can guide you through these services, tracking an order or contacting support. This is a help guide, not a live AI response; I cannot access private accounts or perform transactions.'};
  return null;
}
