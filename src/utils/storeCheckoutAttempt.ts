/** Client lifecycle only. Payment status and money remain server-authoritative. */
export function createStoreCheckoutAttempt() {
  let active=true, busy=false, generation=0, settled=false;
  return {
    begin() { if(!active||busy)return null;busy=true;settled=false;return ++generation; },
    current(id:number) { return active&&!settled&&id===generation; },
    settle(id:number) { if(!active||settled||id!==generation)return false;settled=true;busy=false;return true; },
    dispose() { active=false;busy=false;++generation; },
  };
}

export interface StoreCheckoutRecovery {requestId:string;reference?:string}
/** A browser deadline is uncertainty, never proof that the server created no order. */
export async function waitForStoreInitialization<T extends {orderRef?:string}>(work:Promise<T>,remember:(ref:string)=>void,timeoutMs=20_000):Promise<T> {
  let expired=false,timer:ReturnType<typeof setTimeout>;
  const tracked=work.then(result=>{if(expired&&result.orderRef)remember(result.orderRef);return result;},error=>{if(expired&&error?.existingOrderReference)remember(error.existingOrderReference);throw error;});
  try{return await Promise.race([tracked,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error('The payment connection timed out. An order may already exist.'));},timeoutMs);})]);}
  finally{clearTimeout(timer!);}
}
export function readStoreCheckoutRecovery(storage:Pick<Storage,'getItem'>,siteId:string):StoreCheckoutRecovery|null {
  try {
    const row=JSON.parse(storage.getItem(`mh_store_checkout:${siteId}`)||'null');
    if(!row||typeof row.requestId!=='string'||!/^[-0-9a-f]{36}$/i.test(row.requestId))return null;
    return {requestId:row.requestId,...(typeof row.reference==='string'&&/^MH-[a-zA-Z0-9-]{1,60}$/.test(row.reference)?{reference:row.reference}:{})};
  } catch {return null;}
}
