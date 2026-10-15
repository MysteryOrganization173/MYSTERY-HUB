/** Deduplicate SDK close/error signals, while allowing one late success to trigger server verification. */
export function paymentSignals(active:()=>boolean,strictSettlement=false) {
  let closed=false,success=false;
  return {
    close:()=>{if(!active() || closed || success)return false;closed=true;return true;},
    success:()=>{if(!active() || success || strictSettlement&&closed)return false;success=true;return true;},
  };
}
