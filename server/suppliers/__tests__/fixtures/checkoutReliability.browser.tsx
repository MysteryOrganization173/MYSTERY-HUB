/** Compiled local-only browser fixture. All HTTP and Paystack behavior is synthetic. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ManagedDataStorefront} from '../../../../src/components/website/ManagedDataStorefront';
import {CheckoutModal} from '../../../../src/components/checkout/CheckoutModal';
import {WEBSITE_TEMPLATES} from '../../../../src/data/templates';
import {preflightFailure} from '../../../../shared/checkoutFailure';
const query=new URLSearchParams(location.search),surface=query.get('surface')||'store',scenario=query.get('case')||'denied';
const template={...WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!,demoBusinessName:'Synthetic Store',siteContent:{whatsapp:'0241234567'},colorScheme:{...WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!.colorScheme!,accent:'#8055dd'}};
const bundle={id:'mtn-1gb',network:'mtn',dataAmount:'1GB',priceGhc:5.49,validity:'30 days',validityCategory:'Monthly',description:'Synthetic bundle',serviceType:'data'} as const;
let requests=0,popups=0,blockedCalls=0;const report=()=>window.dispatchEvent(new Event('fixture-evidence'));
const json=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
(window as any).PaystackPop=class {resumeTransaction(_code:string,callbacks:any){popups++;report();const popup=document.createElement('section');popup.id='synthetic-payment';popup.textContent='Synthetic payment window — no gateway contacted';const cancel=document.createElement('button');cancel.textContent='Close synthetic payment';cancel.onclick=()=>{popup.remove();callbacks.onCancel();};popup.append(cancel);document.body.append(popup);}};
window.fetch=async(input,options)=>{
 const url=String(input);
 if(url.startsWith('http')&&!url.startsWith(location.origin)){blockedCalls++;report();throw Error('External fixture request blocked');}
 if(url.includes('/commercial/quote/'))return json({regularMinor:549,totalMinor:549,discountMinor:0,pricingRevision:'fixture',promotionRevision:'fixture',offer:{state:'guest'}});
 if(url.endsWith('/instant-bundles'))return json({success:true,available:true,products:query.has('instant')?[{network:'mtn',recipientAlternative:true}]:[]});
 if(url.endsWith('/finance'))return json({walletMinor:query.has('wallet')?10000:0,restricted:false});
 if(url.endsWith('/storefront'))return json({data:{products:[{id:'mtn-1gb',network:'mtn',dataAmount:'1GB',retailMinor:549,validity:'30 days'}]}});
 if(url.includes('/public-events'))return json({data:{}});
 if(url.includes('/store-checkout')||url.endsWith('/payments/initialize')){
  requests++;report();if(scenario==='held-wallet')await new Promise(r=>{((window as any).__walletPending||=(([]) as any)).push(r);});if(scenario==='slow')await new Promise(r=>setTimeout(r,1200));
  if(scenario==='uncertain')throw new TypeError('Synthetic disconnected response');
  if(scenario==='retry'&&requests>1||scenario==='success'){
   const data={success:true,orderRef:'MH-synthetic-checkout',reference:'SYNTHETIC',accessCode:'synthetic',amountPesewas:549,currency:'GHS'};return json(surface==='store'?{data}:data);
  }
  const code=scenario==='unavailable'?'BENEFICIARY_CHECK_UNAVAILABLE':scenario==='package'?'PACKAGE_UNAVAILABLE':'BENEFICIARY_NOT_ELIGIBLE';
  return json({code,error:'Synthetic rejection',checkout:preflightFailure(code)},code==='BENEFICIARY_NOT_ELIGIBLE'?400:503);
 }
 if(url.includes('/store-orders/')||url.includes('/orders/lookup/'))return json({error:'Synthetic pending'},503);
 if(url.includes('/payments/cancel/'))return json({success:true});
 blockedCalls++;report();throw Error('Unexpected fixture request blocked');
};
function Fixture(){
 const [open,setOpen]=useState(true),[tick,setTick]=useState(0),[productVersion,setProductVersion]=useState(0);
 (window as any).__swapProduct=()=>setProductVersion(v=>v+1);
 const selectedBundle=React.useMemo(()=>productVersion?{...bundle,id:'mtn-2gb',dataAmount:'2GB'}:bundle,[productVersion]);
 React.useEffect(()=>{const listener=()=>setTick(x=>x+1);window.addEventListener('fixture-evidence',listener);return()=>window.removeEventListener('fixture-evidence',listener);},[]);
 (window as any).__checkoutApp={isCheckoutOpen:open,closeCheckout:()=>setOpen(false),checkoutBundle:selectedBundle,user:query.has('signed')?{id:'synthetic-customer',name:'Synthetic',email:'fixture@example.test',phone:'0241234567'}:null,sessionToken:query.has('signed')?'synthetic-only':null,createOrder:()=>({}),openOrderStatus:()=>{},openDataPage:()=>setOpen(false),setActivePage:()=>{}};
 return <><aside style={{padding:12,background:'#101725',color:'white'}}><h1>Synthetic checkout verification</h1><output aria-live="polite">Requests {requests} · Popups {popups} · Blocked unexpected calls {blockedCalls}</output><span hidden>{tick}</span>{!open&&<button onClick={()=>setOpen(true)}>Reopen checkout</button>}</aside>{surface==='store'?<ManagedDataStorefront siteId={`synthetic-reliability-${scenario}`} template={template} preview={query.has('preview')} previewProducts={[{id:'mtn-1gb',network:'mtn',dataAmount:'1GB',retailMinor:549,enabled:true} as any]}/>:<CheckoutModal/>}</>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
