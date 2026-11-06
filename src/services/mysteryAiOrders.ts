import {validateAndNormalizeGhanaPhone} from '../../server/utils/phone';
import {aiActions} from '../../shared/mysteryAiIntent';
import {DATA_BUNDLES} from '../data/bundles';
import type {DataBundle, NetworkId} from '../types';
import {commercialRequest} from './commercialApi';

// Read the full digit run rather than accepting the valid prefix of a malformed number.
const recipientPattern = /\+?\(?\d(?:[ \t()./\u00a0\u202f-]*\d){5,}\)?/g;
const sizePattern = /\b(\d{1,4}(?:\.\d{1,2})?)\s*(GB|MB)\b/gi;
const networkPattern = /\b(mtn|telecel|airtel\s*tigo)\b/gi;
export const maskAiRecipient = (text:string) => text.replace(recipientPattern,'[number hidden]');

export type DataRequest = {network?:NetworkId; size?:string; recipient?:string; browse?:boolean; invalidRecipient?:boolean; ambiguousNetwork?:boolean; ambiguousSize?:boolean};
export type AiDataChoice = Pick<DataBundle,'id'|'network'|'dataAmount'|'priceGhc'>;

export function parseAiDataRequest(message:string, previous?:DataRequest):DataRequest|null {
 const safe=maskAiRecipient(message).trim();
 if(/\b(?:don['’]t|do not|without|not buying|cancel|refund|failed|delayed|status|delivery|compare|airtime|instant|reseller|wallet|voucher|checkers?|draft|write|paid|payment|help|my order)\b/i.test(safe)
   ||/\b(?:my|existing|previous|last)\b.{0,55}\border\b/i.test(safe))return null;
 const networks=[...safe.matchAll(networkPattern)].map(match=>match[1].toLowerCase().replace(/\s/g,'') as NetworkId);
 const sizes=[...safe.matchAll(sizePattern)].map(match=>`${Number(match[1])}${match[2].toUpperCase()}`);
 // Questions about selling, other services or how buying works are not a request for a specific bundle.
 if(/\b(?:never|sell|sells|selling|resell|resells|reselling|website|site|logo|flyer|poster|banner|design|creative|earn|marketplace|afa|guide|usage)\b|\b(?:how|where)\s+(?:do|can|does)\b/i.test(safe)
   ||!sizes.length&&/\b(?:shop|store|business)\b/i.test(safe))return null;
 // A general Data request with no network, size or number keeps its normal page button.
 if(!networks.length&&!sizes.length&&!safe.includes('[number hidden]')&&aiActions(safe,{activePage:'home'}).length)return null;
 const wants=/\b(?:i (?:want|need|would like)|buy|purchase|show me|do you have|cheapest)\b/i.test(safe);
 const topic=/\b(?:data|bundles?)\b/i.test(safe)||sizes.length>0||networks.length>0;
 const short=/^(?:(?:mtn|telecel|airtel\s*tigo)\s*)?(?:\d{1,4}(?:\.\d{1,2})?\s*(?:gb|mb))?(?:\s*(?:mtn|telecel|airtel\s*tigo))?(?:\s*data)?[.!?]?$/i.test(safe.replace(/\s*(?:to|for)?\s*\[number hidden\](?=[.!?]?$)/i,'').trim());
 const recipientOnly=Boolean(previous)&&/^(?:(?:to|for)\s+)?\[number hidden\][.!?]?$/i.test(safe);
 const skipRecipient=Boolean(previous)&&/^(?:i.ll enter (?:the|my) number at checkout|skip (?:the )?(?:number|recipient))[.!?]?$/i.test(safe);
 if(!(wants&&topic)&&!(short&&topic&&(sizes.length>0||Boolean(previous)))&&!recipientOnly&&!skipRecipient)return null;
 const usePrevious=Boolean(previous&&!wants&&(short||recipientOnly||skipRecipient));
 const supplied=[...message.matchAll(recipientPattern)].map(match=>validateAndNormalizeGhanaPhone(match[0]));
 const malformed=/(?:\b(?:to|for|number)\s*:?\s*)[+(]?\d(?:[ \t()./\u00a0\u202f-]*\d){2,}(?![\dA-Z])/i.test(message)&&!supplied.length;
 const ambiguousNetwork=new Set(networks).size>1||Boolean(usePrevious&&!networks.length&&previous?.ambiguousNetwork);
 const ambiguousSize=new Set(sizes).size>1||Boolean(usePrevious&&!sizes.length&&previous?.ambiguousSize);
 return {
   network:ambiguousNetwork?undefined:networks[0]??(usePrevious?previous?.network:undefined),
   size:ambiguousSize?undefined:sizes[0]??(usePrevious?previous?.size:undefined),
   recipient:skipRecipient||malformed||supplied.length>1?undefined:supplied.length?supplied[0].formattedLocal??undefined:usePrevious?previous?.recipient:undefined,
   browse:/\b(?:cheapest|show me|do you have)\b/i.test(safe)||(usePrevious&&previous?.browse),
   invalidRecipient:!skipRecipient&&(malformed||supplied.some(phone=>!phone.isValid)||supplied.length>1||Boolean(usePrevious&&!supplied.length&&previous?.invalidRecipient)),
   ambiguousNetwork,ambiguousSize,
 };
}

export async function readAiDirectCatalog(signal?:AbortSignal):Promise<DataBundle[]> {
 const result=await commercialRequest('commercial/products',null,undefined,signal);
 if(!Array.isArray(result?.products))throw new Error('The current Data catalogue is unavailable.');
 const verified:DataBundle[]=[];
 for(const row of result.products as unknown[]){
   if(!row||typeof row!=='object')continue;
   const p=row as Record<string,unknown>;
   const bundle=DATA_BUNDLES.find(b=>b.id===p.id&&b.network===p.network&&b.dataAmount===p.dataAmount);
   if(!bundle||p.isActive!==true||p.currency!=='GHS'||typeof p.amountPesewas!=='number'||!Number.isSafeInteger(p.amountPesewas)||p.amountPesewas<=0)continue;
   verified.push({...bundle,priceGhc:p.amountPesewas/100});
 }
 return verified;
}

export async function confirmAiDataChoice(choice:AiDataChoice,signal:AbortSignal):Promise<DataBundle|undefined> {
 const catalogue=await readAiDirectCatalog(AbortSignal.any([signal,AbortSignal.timeout(6000)]));
 return catalogue.find(b=>b.id===choice.id&&b.network===choice.network&&b.dataAmount===choice.dataAmount&&b.priceGhc===choice.priceGhc);
}

export async function aiDataChoices(draft:DataRequest,signal:AbortSignal){
 if(draft.invalidRecipient)return {reply:'Please enter one valid Ghana recipient number, or say “skip number” to enter it at checkout.',choices:[]};
 if(draft.ambiguousNetwork)return {reply:'Which one network would you like?',choices:[]};
 if(draft.ambiguousSize)return {reply:'Which one bundle size would you like?',choices:[]};
 if(!draft.network)return {reply:'Which network would you like: MTN, Telecel or AirtelTigo?',choices:[]};
 if(!draft.size&&!draft.browse)return {reply:'What bundle size would you like?',choices:[]};
 const catalogue=await readAiDirectCatalog(AbortSignal.any([signal,AbortSignal.timeout(6000)]));
 const choices=catalogue.filter(b=>b.network===draft.network&&(!draft.size||b.dataAmount.toUpperCase()===draft.size))
   .sort((a,b)=>a.priceGhc-b.priceGhc).slice(0,3).map(({id,network,dataAmount,priceGhc})=>({id,network,dataAmount,priceGhc}));
 return {reply:choices.length?'Choose a listed bundle to review the recipient, current total and payment method in checkout.':'No matching bundle is listed right now. Try a different size or check the Data page.',choices};
}
