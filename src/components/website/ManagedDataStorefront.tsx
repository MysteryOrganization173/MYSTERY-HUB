import { WEBSITE_TEMPLATES } from '../../data/templates';
import { detectGhanaNetwork } from '../../data/bundles';
import { websiteActionText, resolveResellerTheme } from '../../utils/websiteBrand';
import React,{useEffect,useRef,useState} from 'react';
import { BundleTile, NetworkTabs, lowestPrice, sortBundles, storeNetworkColor, storeNetworkName, storeNetworksIn, type StoreBundle, type StoreNetwork } from './storefront/ResellerCatalogue';
import { renderTemplateLayout } from '../../utils/templateRendererUtils';
import { usePaystack } from '../../hooks/usePaystack';
import { websiteBusinessRequest,trackPublicWebsite } from '../../services/websiteBusinessApi';
import { dataDeliveryNote, dataOrderPresentation, maskDataRecipient } from '../../utils/dataPurchasePresentation';
import { formatGhs } from '../../../shared/money';
import type { WebsiteTemplate,DataBundle } from '../../types';
import { createStoreCheckoutAttempt, readStoreCheckoutRecovery } from '../../utils/storeCheckoutAttempt';
import { isValidGhanaPhoneNumber } from '../../../server/utils/phone';
const sentence=(text:string)=>/[.!?]$/.test(text.trim())?text.trim():`${text.trim()}.`;
export function ManagedDataStorefront({siteId,template,preview=false}:{siteId:string;template:WebsiteTemplate;preview?:boolean}) {
  // A different store gets a separate lifecycle, form and tracking state.
  // Switching into preview also disposes any pending published-store callbacks.
  return <StorefrontCheckout key={`${siteId}:${preview?'preview':'published'}`} siteId={siteId} template={template} preview={preview}/>;
}
function StorefrontCheckout({siteId,template,preview}:{siteId:string;template:WebsiteTemplate;preview:boolean}) {
  const [products,setProducts]=useState<any[]>([]),[network,setNetwork]=useState('mtn'),[selected,setSelected]=useState<DataBundle|null>(null),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[order,setOrder]=useState<any>(null),[reference,setReference]=useState(''),[busy,setBusy]=useState(false);
  const requestId=useRef<string|null>(null),guard=useRef(false),dialog=useRef<HTMLDialogElement>(null),payButton=useRef<HTMLButtonElement>(null),restoreFocus=useRef(false);
  const lifecycle=useRef(createStoreCheckoutAttempt()),mounted=useRef(false),trackingGeneration=useRef(0),paymentReference=useRef(''),started=useRef(false),trackingInput=useRef<HTMLInputElement>(null);
  const [locked,setLocked]=useState(false),[recoveryOnly,setRecoveryOnly]=useState(false),[trackingError,setTrackingError]=useState('');
  const recoveryKey=`mh_store_checkout:${siteId}`;
  const checkpoint=(ref?:string)=>{try{sessionStorage.setItem(recoveryKey,JSON.stringify({requestId:requestId.current,...(ref?{reference:ref}:{})}));}catch{/* In-memory guard remains effective when storage is unavailable. */}};
  useEffect(()=>{
    mounted.current=true;lifecycle.current=createStoreCheckoutAttempt();
    let saved=null;try{if(!preview)saved=readStoreCheckoutRecovery(sessionStorage,siteId);}catch{/* Storage can be disabled. */}
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
    if(preview||!selected||busy||!dialog.current||dialog.current.open)return;
    dialog.current.showModal();
    if(restoreFocus.current){restoreFocus.current=false;if(payButton.current&&!payButton.current.disabled)payButton.current.focus();else dialog.current.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();}
  },[selected,busy]);
  const refresh=async(ref=reference)=>{
    if(preview||!ref)return;const generation=++trackingGeneration.current;
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
  const choose=(bundle:DataBundle,recipient?:string)=>{if(preview){setError('Preview only. Customer checkout is available on the published store.');return;}if(guard.current)return;if(started.current){setError('Finish or track your existing order before choosing another bundle.');trackingInput.current?.focus();return;}restoreFocus.current=false;paymentReference.current="";setSelected(bundle);if(recipient)setPhone(recipient);requestId.current=crypto.randomUUID();setError('');trackPublicWebsite(siteId,'product_view');trackPublicWebsite(siteId,'checkout_started');};
  const checkout=async()=>{
    if(preview||!selected||guard.current)return;
    if(recoveryOnly)return;
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
  // Only the server's eligible products, at the server's retail prices, are ever shown or sold.
  const bundles:StoreBundle[]=products.map(p=>({id:p.id,network:p.network,dataAmount:p.dataAmount,validity:p.validity||'',priceMinor:p.retailMinor}));
  const networks=storeNetworksIn(bundles);
  const shown=networks.includes(network as StoreNetwork)?network as StoreNetwork:networks[0]||'mtn';
  const onNetwork=sortBundles(bundles.filter(b=>b.network===shown));
  const toBundle=(b:StoreBundle):DataBundle=>({id:b.id,network:b.network,dataAmount:b.dataAmount,dataBytesValue:0,priceGhc:b.priceMinor/100,validity:b.validity||'',validityCategory:'Monthly',description:'',serviceType:'data'});
  const detected=selected&&phone?detectGhanaNetwork(phone):null;
  const summary={networks,fromMinor:lowestPrice(bundles),count:bundles.length};
  const storefront=<div className="space-y-4" style={{color:colors.text, '--website-focus':colors.focus, '--website-placeholder':colors.mutedText} as React.CSSProperties}>
    {preview&&<p role="status" className="store-card store-note" style={{...neutral,backgroundColor:colors.surface,color:colors.surfaceText}}><strong>Draft preview.</strong> Checkout and order tracking are turned off. Customers can buy once your store is live.</p>}
    <p className="sr-only">Data bundles from {template.demoBusinessName}</p>
    {loading&&<p role="status" className="store-note" style={muted}>Loading available bundles…</p>}{error&&!selected&&<p role="alert" className="store-card store-note break-words" style={{...neutral,backgroundColor:colors.surface,color:colors.surfaceText}}>{error}</p>}
    {!loading&&!error&&!onNetwork.length&&<section role="status" className="store-card space-y-2" style={{...neutral,backgroundColor:colors.surface,color:colors.surfaceText}}><h3 className="font-bold">{products.length?'No bundles available on this network right now.':'Bundles are not available right now.'}</h3><p className="store-note" style={{color:colors.surfaceMutedText}}>{products.length?'Choose another network or check back later.':'Please check back later or contact the business.'}</p>{businessContact&&<a href={businessContact} className="store-primary" style={{...primary,display:'inline-flex',alignItems:'center'}}>Contact Business</a>}</section>}
    {networks.length>1&&<NetworkTabs networks={networks} value={shown} onChange={setNetwork} bundles={bundles} theme={colors}/>}
    {onNetwork.length>0&&<div className="store-grid">{onNetwork.map(b=><BundleTile key={b.id} bundle={b} theme={colors} onChoose={tile=>choose(toBundle(tile))}/>)}</div>}
    {onNetwork.length>0&&<p className="store-note" style={muted}>{storeNetworkName(shown)}: {sentence(dataDeliveryNote(shown))} The price shown is the total you pay.</p>}
    <section id="store-track" className="store-card scroll-mt-20" style={{...neutral,backgroundColor:colors.surface,color:colors.surfaceText}} aria-label="Track store order"><h3 className="text-lg font-bold site-display">Track your order</h3><p className="store-note mt-1" style={{color:colors.surfaceMutedText}}>Enter the order reference you received after paying.</p><form className="flex flex-wrap gap-2 mt-3" onSubmit={event=>{event.preventDefault();void refresh();}}><input ref={trackingInput} aria-label="Order reference" value={reference} onChange={event=>{++trackingGeneration.current;setReference(event.target.value.trim());setOrder(null);setTrackingError('');}} maxLength={64} placeholder="MH-… order reference" style={neutral} className="store-field flex-1 placeholder:text-[var(--website-placeholder)]"/><button className="store-secondary" style={{...neutral,backgroundColor:colors.surface,color:colors.surfaceText}}>Check status</button></form>{trackingError&&<p role="alert" className="store-note mt-2 break-words">{trackingError}</p>}{order&&<div className="store-summary text-sm" style={{borderColor:colors.border,'--store-network':storeNetworkColor(order.network==='airteltigo'||order.network==='telecel'?order.network:'mtn')} as React.CSSProperties}><div className="min-w-0 pl-2 space-y-1"><p className="font-bold">{order.network.toUpperCase()} {order.bundle_size_snapshot} · {formatGhs(order.amount)}</p><p>Recipient: {maskDataRecipient(order.recipient_phone)}</p><p className="capitalize font-semibold" style={{color:colors.surfaceAccentText}}>{order.status.replace(/_/g,' ')}</p><p style={{color:colors.surfaceMutedText}}>{presentation?.next}</p><p className="text-xs break-all" style={{color:colors.surfaceMutedText}}>{order.public_reference}</p></div></div>}</section>
    {busy&&<p role="status" aria-live="polite" className="store-note">{payment.loadingPhase==='opening'?'Complete payment in the secure payment window.':'Connecting to secure payment…'}</p>}
    {selected&&<dialog style={{backgroundColor:colors.surface,borderColor:colors.border,color:colors.surfaceText}} ref={dialog} aria-labelledby="store-checkout-title" onCancel={event=>{event.preventDefault();if(!busy)setSelected(null);}} className="store-sheet"><div className="flex justify-between items-center gap-3"><h2 id="store-checkout-title" className="font-bold text-xl site-display">Review your order</h2><button disabled={busy} className="store-secondary" style={{...neutral,backgroundColor:colors.surface,color:colors.surfaceText,minHeight:44}} onClick={()=>setSelected(null)}>Close</button></div><div className="store-summary" style={{borderColor:colors.border,'--store-network':storeNetworkColor(selected.network as StoreNetwork)} as React.CSSProperties}><div className="pl-2 min-w-0"><p className="text-2xl font-bold site-display leading-none">{selected.dataAmount}</p><p className="text-sm mt-1" style={{color:colors.surfaceMutedText}}>{storeNetworkName(selected.network as StoreNetwork)}{selected.validity?` · ${selected.validity}`:''} · {template.demoBusinessName}</p></div><p className="text-xl font-bold text-right" style={{color:colors.surfaceAccentText}}>{formatGhs(Math.round(selected.priceGhc*100))}<span className="block text-xs font-medium" style={{color:colors.surfaceMutedText}}>total</span></p></div><label className="block text-sm font-semibold mt-5">Number to receive the data<input autoFocus type="tel" inputMode="tel" autoComplete="tel" maxLength={16} disabled={busy||locked} value={phone} placeholder="024 123 4567" onChange={event=>{if(started.current||guard.current)return;setPhone(event.target.value);requestId.current=crypto.randomUUID();}} style={neutral} className="store-field mt-1.5 font-normal placeholder:text-[var(--website-placeholder)]"/></label>{detected&&detected!==selected.network&&<p className="store-note mt-1.5" role="note" style={{color:colors.surfaceMutedText}}>This number usually belongs to {storeNetworkName(detected as StoreNetwork)}. You chose a {storeNetworkName(selected.network as StoreNetwork)} bundle, so check the number before paying.</p>}<label className="block text-sm font-semibold mt-4">Email for your receipt<input type="email" inputMode="email" autoComplete="email" maxLength={254} disabled={busy||locked} value={email} placeholder="you@example.com" onChange={event=>{if(started.current)return;setEmail(event.target.value);requestId.current=crypto.randomUUID();}} style={neutral} className="store-field mt-1.5 font-normal placeholder:text-[var(--website-placeholder)]"/></label><p className="text-xs my-4 leading-relaxed" style={{color:colors.surfaceMutedText}}>{sentence(dataDeliveryNote(selected.network))} Check the recipient carefully before paying. Keep your order reference for tracking.</p>{locked&&<p className="text-sm my-3" style={{color:colors.surfaceMutedText}}>Keep these details for this payment attempt. Cancelling the payment window does not cancel the saved order.</p>}{error&&<p role="alert" style={{color:colors.surfaceText}} className="my-3 break-words">{error}</p>}{paymentReference.current&&<div className="my-3 text-sm"><p className="break-all">Order reference: {paymentReference.current}</p><button style={neutral} className="store-secondary mt-2" onClick={()=>{setSelected(null);void refresh(paymentReference.current);requestAnimationFrame(()=>trackingInput.current?.focus());}}>Check existing order</button></div>}<button style={primary} ref={payButton} className="store-primary w-full font-bold" disabled={busy||recoveryOnly} onClick={()=>void checkout()}>{busy?payment.loadingPhase==='opening'?'Opening secure payment…':'Connecting to secure payment…':`Pay ${formatGhs(Math.round(selected.priceGhc*100))}`}</button><button style={{...neutral,backgroundColor:'transparent',color:colors.surfaceText}} className="store-secondary w-full mt-2" disabled={busy||locked} onClick={()=>setSelected(null)}>Change bundle</button><p className="text-xs mt-3 text-center" style={{color:colors.surfaceMutedText}}>Secure payment by Paystack · Delivered by Mystery Hub</p></dialog>}
  </div>;
  return renderTemplateLayout(template,{managedCheckout:storefront,managedAvailability:availability,managedSummary:summary,onCtaClick:preview?()=>{}:undefined});
}
