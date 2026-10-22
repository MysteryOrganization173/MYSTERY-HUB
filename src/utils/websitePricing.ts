import {MAX_MONEY_MINOR, moneyMinor, parseGhs, formatGhs} from '../../shared/money.js';
export interface SellerBundle { id:string; network:string; networkName:string; dataAmount:string; retailMinor:number; enabled:boolean; minimumMinor:number|null; wholesaleMinor:number|null; configured:boolean; }
export interface SellerDraft {price:string;enabled:boolean;}
export function sellerDrafts(products:SellerBundle[]):Record<string,SellerDraft> {
  return Object.fromEntries(products.map(p=>[p.id,{price:p.retailMinor?(p.retailMinor/100).toFixed(2):'',enabled:p.enabled}]));
}
export function canPrice(p:SellerBundle) {return p.configured && Number.isSafeInteger(p.minimumMinor) && p.minimumMinor!>0;}
/** Markup input is parsed as decimal digits; no binary floating-point money arithmetic. */
export function bulkSellerPrices(products:SellerBundle[],scope:string,kind:'percent'|'flat',value:string) {
  if(!/^\d{1,5}(\.\d{1,2})?$/.test(value.trim()))throw new Error('Enter a non-negative markup with at most two decimal places.');
  const [whole,fraction='']=value.trim().split('.');
  const units=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(kind==='percent'&&units>1_000_000n)throw new Error('Choose a markup of 10,000% or less.');
  return products.filter(p=>(scope==='all'||p.network===scope)&&canPrice(p)).map(p=>{
    const base=BigInt(p.minimumMinor!);
    const added=kind==='flat'?units:(base*units+5000n)/10000n;
    const next=Number(base+added);
    if(next>MAX_MONEY_MINOR)throw new Error('This markup exceeds the supported selling price.');
    return {id:p.id,retailMinor:moneyMinor(next)};
  });
}
export function sellerPriceError(p:SellerBundle,draft:SellerDraft):string {
  if(!canPrice(p))return '';
  if(!draft.price&&!draft.enabled)return '';
  try {if(parseGhs(draft.price)<p.minimumMinor!)return `Minimum selling price is ${formatGhs(p.minimumMinor!)}.`;}
  catch{return 'Enter a valid selling price with at most two decimal places.';}
  return '';
}

/**
 * V5.1 bundle setup: one plan for "set up the bundles I want to sell". Prices and on-sale state are
 * separate choices, so a markup never switches a bundle on unless the owner asks for it. The plan
 * only proposes values the server already accepts (minimum price, configured bundles); the server
 * re-validates every row on save and stays authoritative.
 */
export type SetupPriceMode='markup'|'keep';
export type SetupActivation='enable'|'keep'|'disable';
export interface BundleSetupChoice {networks:string[];priceMode:SetupPriceMode;kind:'percent'|'flat';value:string;activation:SetupActivation}
export type BundleSetupRowStatus='changed'|'unchanged'|'ineligible'|'needs-price';
export interface BundleSetupRow {id:string;network:string;before:SellerDraft;after:SellerDraft;status:BundleSetupRowStatus;priceChanged:boolean;enabledChanged:boolean}
export interface BundleSetupPlan {
  rows:BundleSetupRow[];
  summary:{inScope:number;priceChanges:number;newlyEnabled:number;newlyDisabled:number;unchanged:number;ineligible:number;needsPrice:number;sellableBefore:number;sellableAfter:number;liveRemoved:number};
}
const draftMinor=(price:string):number|null=>{try{return price.trim()?parseGhs(price):null;}catch{return null;}};
/** A bundle customers can buy with this draft: configured by Mystery Hub, switched on and at or above its minimum. */
export function isSellableDraft(p:SellerBundle,draft:SellerDraft|undefined):boolean {
  if(!draft?.enabled||!canPrice(p))return false;
  const minor=draftMinor(draft.price);
  return minor!==null&&minor>=p.minimumMinor!;
}
export function sellableCount(products:SellerBundle[],drafts:Record<string,SellerDraft>):number {return products.filter(p=>isSellableDraft(p,drafts[p.id])).length;}
export function planBundleSetup(products:SellerBundle[],drafts:Record<string,SellerDraft>,choice:BundleSetupChoice):BundleSetupPlan {
  if(!choice.networks.length)throw new Error('Choose at least one network.');
  if(choice.priceMode==='keep'&&choice.activation==='keep')throw new Error('Choose a price change, or choose to turn bundles on or off.');
  const scope=products.filter(p=>choice.networks.includes(p.network));
  const priced=choice.priceMode==='markup'?new Map(bulkSellerPrices(scope,'all',choice.kind,choice.value).map(row=>[row.id,row.retailMinor])):new Map<string,number>();
  const rows:BundleSetupRow[]=scope.map(p=>{
    const before=drafts[p.id]||{price:'',enabled:false};
    if(!canPrice(p))return {id:p.id,network:p.network,before,after:before,status:'ineligible',priceChanged:false,enabledChanged:false};
    const nextMinor=priced.get(p.id);
    const price=nextMinor!==undefined?(nextMinor/100).toFixed(2):before.price;
    const wanted=choice.activation==='enable'?true:choice.activation==='disable'?false:before.enabled;
    // Switching on needs a valid price; such a bundle is reported, not sent, so one row cannot fail the whole save.
    const priceOk=(()=>{const minor=draftMinor(price);return minor!==null&&minor>=p.minimumMinor!;})();
    const needsPrice=wanted&&!priceOk;
    const after={price,enabled:needsPrice?before.enabled:wanted};
    const priceChanged=draftMinor(before.price)!==draftMinor(after.price);
    const enabledChanged=before.enabled!==after.enabled;
    return {id:p.id,network:p.network,before,after,status:needsPrice?'needs-price':priceChanged||enabledChanged?'changed':'unchanged',priceChanged,enabledChanged};
  });
  const afterDrafts={...drafts};for(const row of rows)afterDrafts[row.id]=row.after;
  return {rows,summary:{
    inScope:rows.length,
    priceChanges:rows.filter(r=>r.priceChanged).length,
    newlyEnabled:rows.filter(r=>r.enabledChanged&&r.after.enabled).length,
    newlyDisabled:rows.filter(r=>r.enabledChanged&&!r.after.enabled).length,
    unchanged:rows.filter(r=>r.status==='unchanged').length,
    ineligible:rows.filter(r=>r.status==='ineligible').length,
    needsPrice:rows.filter(r=>r.status==='needs-price').length,
    sellableBefore:sellableCount(products,drafts),
    sellableAfter:sellableCount(products,afterDrafts),
    liveRemoved:rows.filter(r=>{const p=products.find(x=>x.id===r.id)!;return isSellableDraft(p,r.before)&&!isSellableDraft(p,r.after);}).length,
  }};
}
/** Rows the server must receive: only real differences from the saved catalogue, never unchanged values. */
export function bundleSaveRows(products:SellerBundle[],saved:Record<string,SellerDraft>,drafts:Record<string,SellerDraft>) {
  return products.filter(p=>drafts[p.id]&&saved[p.id]&&(draftMinor(drafts[p.id].price)!==draftMinor(saved[p.id].price)||drafts[p.id].enabled!==saved[p.id].enabled))
    .map(p=>({productId:p.id,enabled:drafts[p.id].enabled,retailMinor:draftMinor(drafts[p.id].price)??0}));
}
