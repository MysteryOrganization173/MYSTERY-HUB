import { WEBSITE_TEMPLATES } from '../../data/templates';
import { GHANA_NETWORKS } from '../../data/bundles';
import { websiteActionText, resolveResellerTheme } from '../../utils/websiteBrand';
import React,{useEffect,useRef,useState} from 'react';
import { BundleCard } from '../data/BundleCard';
import { DataResellerTemplateView } from './templates/DataResellerTemplateView';
import { usePaystack } from '../../hooks/usePaystack';
import { websiteBusinessRequest,trackPublicWebsite } from '../../services/websiteBusinessApi';
import { dataDeliveryNote, dataOrderPresentation, maskDataRecipient } from '../../utils/dataPurchasePresentation';
import { formatGhs } from '../../../shared/money';
import type { WebsiteTemplate,DataBundle } from '../../types';
import { createStoreCheckoutAttempt, readStoreCheckoutRecovery } from '../../utils/storeCheckoutAttempt';
import { isValidGhanaPhoneNumber } from '../../../server/utils/phone';
const control='min-h-11 px-4 py-2 rounded-lg border disabled:opacity-50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--website-focus)]';
export function ManagedDataStorefront({siteId,template}:{siteId:string;template:WebsiteTemplate}) {
  // A different store gets a separate lifecycle, form and tracking state.
  return <StorefrontCheckout key={siteId} siteId={siteId} template={template}/>;
}
function StorefrontCheckout({siteId,template}:{siteId:string;template:WebsiteTemplate}) {
  const [products,setProducts]=useState<any[]>([]),[network,setNetwork]=useState('mtn'),[selected,setSelected]=useState<DataBundle|null>(null),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[order,setOrder]=useState<any>(null),[reference,setReference]=useState(''),[busy,setBusy]=useState(false);
  const requestId=useRef<string|null>(null),guard=useRef(false),dialog=useRef<HTMLDialogElement>(null),payButton=useRef<HTMLButtonElement>(null),restoreFocus=useRef(false);
  const lifecycle=useRef(createStoreCheckoutAttempt()),mounted=useRef(false),trackingGeneration=useRef(0),paymentReference=useRef(''),started=useRef(false),trackingInput=useRef<HTMLInputElement>(null);
  const [locked,setLocked]=useState(false),[recoveryOnly,setRecoveryOnly]=useState(false),[trackingError,setTrackingError]=useState('');
  const recoveryKey=`mh_store_checkout:${siteId}`;
  const checkpoint=(ref?:string)=>{try{sessionStorage.setItem(recoveryKey,JSON.stringify({requestId:requestId.current,...(ref?{reference:ref}:{})}));}catch{/* In-memory guard remains effective when storage is unavailable. */}};
  useEffect(()=>{
    mounted.current=true;lifecycle.current=createStoreCheckoutAttempt();
    let saved=null;try{saved=readStoreCheckoutRecovery(sessionStorage,siteId);}catch{/* Storage can be disabled. */}
    if(saved){requestId.current=saved.requestId;started.current=true;setLocked(true);setRecoveryOnly(true);if(saved.reference){paymentReference.current=saved.reference;setReference(saved.reference);}setError('A previous checkout may still exist. Check its order status or contact the business before starting another payment.');}
    return()=>{mounted.current=false;lifecycle.current.dispose();++trackingGeneration.current;};
  },[siteId]);
  const payment=usePaystack();
  const colors=resolveResellerTheme(template.colorScheme || WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!.colorScheme!);
  const neutral={backgroundColor:colors.background,borderColor:colors.border,color:colors.text};
  const primary={backgroundColor:colors.accent,borderColor:colors.border,color:websiteActionText(colors.accent)};
  const muted={color:colors.mutedText};
  useEffect(()=>{let active=true;setLoading(true);websiteBusinessRequest(`websites/${encodeURIComponent(siteId)}/storefront`).then(data=>{if(active)setProducts(data.products);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[siteId]);
  useEffect(()=>{
    if(!selected||busy||!dialog.current||dialog.current.open)return;
    dialog.current.showModal();
    if(restoreFocus.current){restoreFocus.current=false;if(payButton.current&&!payButton.current.disabled)payButton.current.focus();else dialog.current.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();}
  },[selected,busy]);
  const refresh=async(ref=reference)=>{
    if(!ref)return;const generation=++trackingGeneration.current;
    try{const result=await websiteBusinessRequest(`websites/${encodeURIComponent(siteId)}/store-orders/${encodeURIComponent(ref)}`);
      if(!mounted.current||generation!==trackingGeneration.current)return;setOrder(result);setTrackingError('');
      // A known, authoritative completed payment can release the old attempt.
      // Pending, failed, cancelled and manual-review states never permit a blind retry.
      if(ref===paymentReference.current&&!guard.current&&dataOrderPresentation(result.status,result.manual_review).paymentConfirmed&&!result.manual_review&&!['refund_pending','refunded'].includes(result.status)){
        started.current=false;setLocked(false);setRecoveryOnly(false);setSelected(null);setError('');try{sessionStorage.removeItem(recoveryKey);}catch{}
      }
    }catch(e:any){if(mounted.current&&generation===trackingGeneration.current){setOrder(null);setTrackingError(e.message);}}
  };
  useEffect(()=>{if(!reference)return;void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>clearInterval(timer);},[reference]);
  const choose=(bundle:DataBundle,recipient?:string)=>{if(guard.current)return;if(started.current){setError('Finish or track your existing order before choosing another bundle.');trackingInput.current?.focus();return;}restoreFocus.current=false;paymentReference.current="";setSelected(bundle);if(recipient)setPhone(recipient);requestId.current=crypto.randomUUID();setError('');trackPublicWebsite(siteId,'product_view');trackPublicWebsite(siteId,'checkout_started');};
  const checkout=async()=>{
    if(!selected||guard.current||recoveryOnly)return;
    if(!isValidGhanaPhoneNumber(phone)){setError('Enter a valid Ghana recipient number.');return;}
    if(!/^\S+@\S+\.\S+$/.test(email)){setError('Enter a valid email for your receipt.');return;}
    const currentAttempt=lifecycle.current.begin();if(currentAttempt===null)return;
    guard.current=true;setBusy(true);setError('');
    started.current=true;setLocked(true);checkpoint(paymentReference.current||undefined);
    const finish=()=>{
      if(!lifecycle.current.settle(currentAttempt))return false;
      restoreFocus.current=true;guard.current=false;setBusy(false);return true;
    };
    // Native modal dialogs occupy the top layer and make a body-mounted Paystack
    // iframe inert. Release the modal synchronously, before even a fast SDK opens.
    // Keep the form and request ID mounted so cancellation can safely resume it.
    dialog.current?.close();
    const remember=(ref:string)=>{paymentReference.current=ref;checkpoint(ref);if(mounted.current)setReference(ref);};
    await payment.initializeServerPayment({isActive:()=>lifecycle.current.current(currentAttempt),store:{siteId,requestId:requestId.current!,expectedMinor:Math.round(selected.priceGhc*100)},productId:selected.id,recipientPhone:phone,customerEmail:email,onOrderCreated:remember,onPaymentReceived:(ref)=>{if(!finish())return;remember(ref);setSelected(null);setRecoveryOnly(true);void refresh(ref);trackingInput.current?.focus();},onCancel:(ref)=>{if(!finish())return;if(ref){remember(ref);void refresh(ref);}},onError:e=>{if(!finish())return;if(e.existingOrderReference){remember(e.existingOrderReference);void refresh(e.existingOrderReference);}setRecoveryOnly(true);setError(`${e.message} Payment is not confirmed. Keep this page open and check the existing order or contact the business before trying again.`);}});
    // Once initialized, retain the request ID while the popup is open or cancelled.
  };
  const contact=template.siteContent?.whatsapp||template.siteContent?.phone||'';
  const contactDigits=contact.replace(/\D/g,'').replace(/^0/,'233');
  const businessContact=/^233\d{9}$/.test(contactDigits)?`https://wa.me/${contactDigits}`:null;
  const availability=loading?'loading':products.length?'available':error?'error':'empty';
  const presentation=order?dataOrderPresentation(order.status,order.manual_review):null;
  const storefront=<div className="space-y-5" style={{color:colors.text, '--website-focus':colors.focus, '--website-placeholder':colors.mutedText} as React.CSSProperties}>
    <h2 className="text-xl font-bold">Data bundles from {template.demoBusinessName}</h2><p className="text-sm" style={muted}>{availability==='available'?'Secure checkout powered by Mystery Hub. Your advertised price is the total.':'Check current availability or track an existing order.'}</p>
    <nav aria-label="Store networks" className="flex flex-wrap gap-2">{(['mtn','telecel','airteltigo'] as const).map(net=>{const brand=GHANA_NETWORKS[net].brandColor;return <button key={net} className={control} style={network===net?{backgroundColor:brand,borderColor:colors.border,color:websiteActionText(brand)}:neutral} aria-pressed={network===net} onClick={()=>setNetwork(net)}>{network===net&&<span aria-hidden="true">✓ </span>}{net==='mtn'?'MTN':net==='telecel'?'Telecel':'AirtelTigo'}</button>;})}</nav>
    {loading&&<p role="status">Loading available bundles…</p>}{error&&!selected&&<p role="alert" className="break-words" style={{color:colors.text}}>{error}</p>}
    {!loading&&!error&&!products.filter(p=>p.network===network).length&&<section role="status" className="rounded-xl border p-5 space-y-2" style={neutral}><h3 className="font-bold">{products.length?'No bundles available on this network right now.':'Bundles are not available right now.'}</h3><p style={muted}>{products.length?'Choose another network or check back later.':'Please check back later or contact the business.'}</p>{businessContact&&<a href={businessContact} className={control} style={{...primary,display:'inline-flex',alignItems:'center'}}>Contact Business</a>}</section>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{products.filter(p=>p.network===network).map(p=>{const bundle:DataBundle={id:p.id,network:p.network,dataAmount:p.dataAmount,dataBytesValue:0,priceGhc:p.retailMinor/100,validity:p.validity||'',validityCategory:'Monthly',description:p.description,serviceType:'data'};return <BundleCard key={p.id} colorScheme={colors} bundle={bundle} recipientPhone={phone} onPhoneChange={value=>{if(!started.current&&!guard.current)setPhone(value);}} onBuy={(b,options)=>choose(b,options?.recipientPhone)}/>;})}</div>
    <section className="border-t pt-5 space-y-3" style={{borderColor:colors.border}} aria-label="Track store order"><h3 className="font-bold">Track your order</h3><form className="flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();void refresh();}}><input ref={trackingInput} aria-label="Order reference" value={reference} onChange={event=>{++trackingGeneration.current;setReference(event.target.value.trim());setOrder(null);setTrackingError('');}} maxLength={64} placeholder="MH-… order reference" style={neutral} className="min-w-0 flex-1 min-h-11 p-3 rounded-lg border placeholder:text-[var(--website-placeholder)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--website-focus)]"/><button className={control} style={neutral}>Check status</button></form>{trackingError&&<p role="alert" className="break-words">{trackingError}</p>}{order&&<div className="space-y-2 text-sm"><p className="font-bold">{order.network.toUpperCase()} {order.bundle_size_snapshot} · {formatGhs(order.amount)}</p><p>Recipient: {maskDataRecipient(order.recipient_phone)}</p><p className="capitalize">{order.status.replace(/_/g,' ')}</p><p style={muted}>{presentation?.next}</p><p className="text-xs break-all">{order.public_reference}</p></div>}</section>
    {busy&&<p role="status" aria-live="polite">{payment.loadingPhase==='opening'?'Complete payment in the secure payment window.':'Connecting to secure payment…'}</p>}
    {selected&&<dialog style={{backgroundColor:colors.surface,borderColor:colors.border,color:colors.surfaceText}} ref={dialog} aria-labelledby="store-checkout-title" onCancel={event=>{event.preventDefault();if(!busy)setSelected(null);}} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[90dvh] overflow-auto border rounded-2xl p-5 backdrop:bg-black/70"><div className="flex justify-between gap-3"><h2 id="store-checkout-title" className="font-bold text-xl">Review your order</h2><button disabled={busy} className={control} style={neutral} onClick={()=>setSelected(null)}>Close</button></div><p className="mt-3 font-semibold">{template.demoBusinessName}</p><p className="text-sm" style={{color:colors.surfaceMutedText}}>{selected.network.toUpperCase()} · {selected.dataAmount}</p><p className="text-2xl font-bold my-3">{formatGhs(Math.round(selected.priceGhc*100))} total</p><label className="block text-sm mt-4">Recipient number<input autoFocus type="tel" inputMode="tel" maxLength={16} disabled={busy||locked} value={phone} onChange={event=>{if(started.current)return;setPhone(event.target.value);requestId.current=crypto.randomUUID();}} style={neutral} className="w-full min-h-11 mt-1 p-3 rounded-lg border placeholder:text-[var(--website-placeholder)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--website-focus)]"/></label><label className="block text-sm mt-4">Receipt email<input type="email" maxLength={254} disabled={busy||locked} value={email} onChange={event=>{if(started.current)return;setEmail(event.target.value);requestId.current=crypto.randomUUID();}} style={neutral} className="w-full min-h-11 mt-1 p-3 rounded-lg border placeholder:text-[var(--website-placeholder)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--website-focus)]"/></label><p className="text-xs my-4" style={{color:colors.surfaceMutedText}}>{dataDeliveryNote(selected.network)} Check the recipient carefully before paying. Keep your order reference for tracking.</p>{locked&&<p className="text-sm my-3" style={{color:colors.surfaceMutedText}}>Keep these details for this payment attempt. Cancelling the payment window does not cancel the saved order.</p>}{error&&<p role="alert" style={{color:colors.surfaceText}} className="my-3 break-words">{error}</p>}{paymentReference.current&&<div className="my-3 text-sm"><p className="break-all">Order reference: {paymentReference.current}</p><button style={neutral} className={control} onClick={()=>{setSelected(null);void refresh(paymentReference.current);requestAnimationFrame(()=>trackingInput.current?.focus());}}>Check existing order</button></div>}<button style={primary} ref={payButton} className={`${control} w-full font-bold`} disabled={busy||recoveryOnly} onClick={()=>void checkout()}>{busy?payment.loadingPhase==='opening'?'Opening secure payment…':'Connecting to secure payment…':`Pay ${formatGhs(Math.round(selected.priceGhc*100))}`}</button><button style={neutral} className={`${control} w-full mt-2`} disabled={busy||locked} onClick={()=>setSelected(null)}>Change package</button></dialog>}
  </div>;
  return <DataResellerTemplateView template={template} managedCheckout={storefront} managedAvailability={availability}/>;
}
