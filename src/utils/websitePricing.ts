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
