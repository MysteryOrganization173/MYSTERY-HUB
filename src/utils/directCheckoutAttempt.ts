/** Recovery records contain no recipient, email, access code or session token. */
export interface DirectCheckoutAttempt {requestId:string;productId:string;reference?:string}
export const directAttemptKey=(accountId?:string)=>`mh_direct_checkout:${accountId||'guest'}`;
export function readDirectAttempt(storage:Pick<Storage,'getItem'>,key:string):DirectCheckoutAttempt|null {
  try{const row=JSON.parse(storage.getItem(key)||'null');
    if(!row||typeof row.requestId!=='string'||!/^[-0-9a-f]{36}$/i.test(row.requestId)||typeof row.productId!=='string'||row.productId.length>128)return null;
    return {requestId:row.requestId,productId:row.productId,...(typeof row.reference==='string'&&/^MH-[a-zA-Z0-9-]{1,60}$/.test(row.reference)?{reference:row.reference}:{})};
  }catch{return null;}
}
export function saveDirectAttempt(storage:Pick<Storage,'setItem'>,key:string,row:DirectCheckoutAttempt){try{storage.setItem(key,JSON.stringify(row));}catch{/* The in-memory guard remains authoritative for this page. */}}
export function clearDirectAttempt(storage:Pick<Storage,'getItem'|'removeItem'>,key:string,requestId:string){try{if(readDirectAttempt(storage,key)?.requestId===requestId)storage.removeItem(key);}catch{}}
