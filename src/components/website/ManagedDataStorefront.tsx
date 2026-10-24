import { WEBSITE_TEMPLATES } from '../../data/templates';
import { detectGhanaNetwork } from '../../data/bundles';
import { websiteActionText, resolveStoreTheme } from '../../utils/websiteBrand';
import React,{useEffect,useRef,useState} from 'react';
import { BundleRow, NetworkTabs, bundleFilters, filterBundles, lowestPrice, networkSummaries, sortBundles, storeNetworkColor, storeNetworkName, storeNetworksIn, type BundleFilter, type StoreBundle, type StoreNetwork } from './storefront/ResellerCatalogue';
import { renderTemplateLayout } from '../../utils/templateRendererUtils';
import { usePaystack } from '../../hooks/usePaystack';
import { websiteBusinessRequest,trackPublicWebsite } from '../../services/websiteBusinessApi';
import { dataDeliveryNote, dataOrderPresentation, maskDataRecipient } from '../../utils/dataPurchasePresentation';
import { formatGhs } from '../../../shared/money';
import type { WebsiteTemplate,DataBundle } from '../../types';
import { createStoreCheckoutAttempt, readStoreCheckoutRecovery } from '../../utils/storeCheckoutAttempt';
import { isValidGhanaPhoneNumber } from '../../../server/utils/phone';
import {websitePreviewCatalog,type WebsitePreviewProduct} from '../../utils/websitePreviewCatalog';
const sentence=(text:string)=>/[.!?]$/.test(text.trim())?text.trim():`${text.trim()}.`;
export function ManagedDataStorefront({siteId,template,preview=false,previewProducts}:{siteId:string;template:WebsiteTemplate;preview?:boolean;previewProducts?:WebsitePreviewProduct[]}) {
  // A different store gets a separate lifecycle, form and tracking state.
  // Switching into preview also disposes any pending published-store callbacks.
  return <StorefrontCheckout key={`${siteId}:${preview?'preview':'published'}`} siteId={siteId} template={template} preview={preview} previewProducts={previewProducts}/>;
}
function StorefrontCheckout({siteId,template,preview,previewProducts}:{siteId:string;template:WebsiteTemplate;preview:boolean;previewProducts?:WebsitePreviewProduct[]}) {
  const [products,setProducts]=useState<any[]>([]),[network,setNetwork]=useState(''),[selected,setSelected]=useState<DataBundle|null>(null),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[order,setOrder]=useState<any>(null),[reference,setReference]=useState(''),[busy,setBusy]=useState(false);
  const requestId=useRef<string|null>(null),guard=useRef(false),dialog=useRef<HTMLDialogElement>(null),payButton=useRef<HTMLButtonElement>(null),restoreFocus=useRef(false);
  const lifecycle=useRef(createStoreCheckoutAttempt()),mounted=useRef(false),trackingGeneration=useRef(0),paymentReference=useRef(''),started=useRef(false),trackingInput=useRef<HTMLInputElement>(null);
  const [locked,setLocked]=useState(false),[recoveryOnly,setRecoveryOnly]=useState(false),[trackingError,setTrackingError]=useState('');
  // V5.2 Data Store is bundle-first: browse a network's bundles, tap one, then give the number, confirm its network and pay in one sheet.
  const [filter,setFilter]=useState<BundleFilter>('all'),[expanded,setExpanded]=useState(false),[hint,setHint]=useState('');
  // The buyer's own network confirmation, bound to the exact number and bundle network it was given for.
  const [confirmedFor,setConfirmedFor]=useState(''),[trackInput,setTrackInput]=useState(''),[checkedAt,setCheckedAt]=useState(''),[copied,setCopied]=useState(''),[ownReference,setOwnReference]=useState('');
  const numberInput=useRef<HTMLInputElement>(null),orderHeading=useRef<HTMLHeadingElement>(null),lastStatus=useRef('');
  const recoveryKey=`mh_store_checkout:${siteId}`;
  // This tab's latest order on this store: only its server reference, so a reload keeps it on screen after payment is settled.
  const lastOrderKey=`mh_store_last_order:${siteId}`;
  const checkpoint=(ref?:string)=>{try{sessionStorage.setItem(recoveryKey,JSON.stringify({requestId:requestId.current,...(ref?{reference:ref}:{})}));}catch{/* In-memory guard remains effective when storage is unavailable. */}};
  useEffect(()=>{
    mounted.current=true;lifecycle.current=createStoreCheckoutAttempt();
    let saved=null;try{if(!preview)saved=readStoreCheckoutRecovery(sessionStorage,siteId);}catch{/* Storage can be disabled. */}
    let last='';try{if(!preview)last=sessionStorage.getItem(lastOrderKey)||'';}catch{/* Storage can be disabled. */}
    if(/^MH-[a-zA-Z0-9-]{1,60}$/.test(last)&&!saved?.reference){setOwnReference(last);setReference(last);}
    if(saved){requestId.current=saved.requestId;started.current=true;setLocked(true);setRecoveryOnly(true);if(saved.reference){paymentReference.current=saved.reference;setOwnReference(saved.reference);setReference(saved.reference);}setError(saved.reference?'':'You started a payment on this page earlier and we could not confirm whether it went through. If money left your account, contact the business before paying again.');}
    return()=>{mounted.current=false;lifecycle.current.dispose();++trackingGeneration.current;};
  },[siteId]);
  const payment=usePaystack();
  const colors=resolveStoreTheme(template.colorScheme || WEBSITE_TEMPLATES.find(t=>t.id==='tmpl-data-reseller')!.colorScheme!);
  const neutral={backgroundColor:colors.background,borderColor:colors.border,color:colors.text};
  const primary={backgroundColor:colors.accent,borderColor:colors.border,color:websiteActionText(colors.accent)};
  const muted={color:colors.mutedText};
  const card={...neutral,backgroundColor:colors.surface,color:colors.surfaceText};
  const quiet={...neutral,backgroundColor:'transparent',color:colors.surfaceText};
  useEffect(()=>{
    // Drafts are not public stores. Only the authenticated parent supplies a safe read-only projection.
    if(preview){setProducts(websitePreviewCatalog(previewProducts));setError('');setLoading(false);return;}
    let active=true;setLoading(true);websiteBusinessRequest(`websites/${encodeURIComponent(siteId)}/storefront`).then(data=>{if(active)setProducts(data.products);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[siteId,preview,previewProducts]);
  useEffect(()=>{
    if(preview||!selected||busy||!dialog.current||dialog.current.open)return;
    dialog.current.showModal();
    if(restoreFocus.current){restoreFocus.current=false;if(payButton.current&&!payButton.current.disabled)payButton.current.focus();else dialog.current.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();}
  },[selected,busy]);
  const refresh=async(ref=reference)=>{
    if(preview||!ref)return;const generation=++trackingGeneration.current;
    try{const result=await websiteBusinessRequest(`websites/${encodeURIComponent(siteId)}/store-orders/${encodeURIComponent(ref)}`);
      if(!mounted.current||generation!==trackingGeneration.current)return;setOrder(result);setTrackingError('');lastStatus.current=result.status;setCheckedAt(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      // A known, authoritative completed payment can release the old attempt.
      // Pending, failed, cancelled and manual-review states never permit a blind retry.
      if(ref===paymentReference.current&&!guard.current&&dataOrderPresentation(result.status,result.manual_review).paymentConfirmed&&!result.manual_review&&!['refund_pending','refunded'].includes(result.status)){
        started.current=false;setLocked(false);setRecoveryOnly(false);setSelected(null);setError('');try{sessionStorage.removeItem(recoveryKey);}catch{}
      }
    }catch(e:any){if(mounted.current&&generation===trackingGeneration.current){setOrder(null);setTrackingError(/not found/i.test(e.message||'')?'We could not find that order on this store. Check the reference and try again.':`We could not check this order right now. ${e.message||''}`.trim());}}
  };
  // Live status while an order is open; settled outcomes stop polling (Track this order still refreshes on demand).
  useEffect(()=>{if(!reference)return;void refresh();const timer=setInterval(()=>{if(!['delivered','refunded','cancelled','expired'].includes(lastStatus.current))void refresh();},10000);return()=>clearInterval(timer);},[reference]);
  const choose=(bundle:DataBundle,recipient?:string)=>{if(preview){setError('Preview only. Customer checkout is available on the published store.');return;}if(guard.current)return;if(started.current){setError('Finish or track your existing order before choosing another bundle.');(orderHeading.current||trackingInput.current)?.focus();return;}restoreFocus.current=false;paymentReference.current="";setSelected(bundle);if(recipient)setPhone(recipient);requestId.current=crypto.randomUUID();setError('');setHint('');trackPublicWebsite(siteId,'product_view');trackPublicWebsite(siteId,'checkout_started');};
  const digits=phone.replace(/\D/g,'');
  const validNumber=isValidGhanaPhoneNumber(phone);
  const confirmKey=selected?`${digits}:${selected.network}`:'';
  const networkConfirmed=!!selected&&validNumber&&confirmedFor===confirmKey;
  const checkout=async()=>{
    if(preview||!selected||guard.current)return;
    if(recoveryOnly)return;
    if(!isValidGhanaPhoneNumber(phone)){setHint('Enter a valid Ghana number to receive the data, like 024 123 4567.');numberInput.current?.focus();return;}
    if(!networkConfirmed){setHint(`Confirm that this number is on ${storeNetworkName(selected.network as StoreNetwork)}.`);return;}
    if(!/^\S+@\S+\.\S+$/.test(email)){setHint('Enter a valid email address. Paystack needs it for this payment.');return;}
    setHint('');
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
    const remember=(ref:string)=>{paymentReference.current=ref;checkpoint(ref);try{sessionStorage.setItem(lastOrderKey,ref);}catch{/* The reference stays on screen for this visit. */}if(mounted.current){setOwnReference(ref);setReference(ref);}};
    await payment.initializeServerPayment({isActive:()=>lifecycle.current.current(currentAttempt),store:{siteId,requestId:requestId.current!,expectedMinor:Math.round(selected.priceGhc*100)},productId:selected.id,recipientPhone:phone,customerEmail:email,onOrderCreated:remember,onPaymentReceived:(ref)=>{if(!finish())return;remember(ref);setSelected(null);setRecoveryOnly(true);void refresh(ref);requestAnimationFrame(()=>{orderHeading.current?.scrollIntoView({block:'center'});orderHeading.current?.focus();});},onCancel:(ref)=>{if(!finish())return;if(ref){remember(ref);void refresh(ref);}},onError:e=>{if(!finish())return;if(e.existingOrderReference){remember(e.existingOrderReference);void refresh(e.existingOrderReference);}setRecoveryOnly(true);setError(`${e.message} Payment is not confirmed. Keep this page open and check the existing order or contact the business before trying again.`);}});
    // Once initialized, retain the request ID while the popup is open or cancelled.
  };
  const contact=template.siteContent?.whatsapp||template.siteContent?.phone||'';
  const contactDigits=contact.replace(/\D/g,'').replace(/^0/,'233');
  const businessContact=/^233\d{9}$/.test(contactDigits)?`https://wa.me/${contactDigits}`:null;
  // A draft with nothing on sale is the owner's setup state; customers of a published store see `empty`.
  const availability=loading?'loading':products.length?'available':error?'error':preview?'setup':'empty';
  const presentation=order?dataOrderPresentation(order.status,order.manual_review):null;
  // Only the server's eligible products, at the server's retail prices, are ever shown or sold.
  const bundles:StoreBundle[]=products.map(p=>({id:p.id,network:p.network,dataAmount:p.dataAmount,validity:p.validity||'',priceMinor:p.retailMinor}));
  const networks=storeNetworksIn(bundles);
  const shown=networks.includes(network as StoreNetwork)?network as StoreNetwork:networks[0]||'mtn';
  const pinned=(template.siteContent?.pinnedBundles||[]).filter(id=>bundles.some(b=>b.id===id&&b.network===shown));
  // Owner choices lead the default list, so the collapsed catalogue cannot hide them.
  const onNetwork=filterBundles(sortBundles(bundles.filter(b=>b.network===shown)),'all',pinned);
  const filters=bundleFilters(onNetwork,pinned);
  const activeFilter=filters.some(f=>f.id===filter)?filter:'all';
  const matching=filterBundles(onNetwork,activeFilter,pinned);
  // Long lists start with the six smallest.
  const collapsed=!expanded&&matching.length>7;
  const listed=collapsed?matching.filter((b,i)=>i<6):matching;
  const toBundle=(b:StoreBundle):DataBundle=>({id:b.id,network:b.network,dataAmount:b.dataAmount,dataBytesValue:0,priceGhc:b.priceMinor/100,validity:b.validity||'',validityCategory:'Monthly',description:'',serviceType:'data'});
  const switchNetwork=(n:StoreNetwork)=>{setNetwork(n);setFilter('all');setExpanded(false);};
  const summary={networks,fromMinor:lowestPrice(bundles),count:bundles.length,byNetwork:networkSummaries(bundles),onPickNetwork:switchNetwork};
  const pick=(b:StoreBundle)=>choose(toBundle(b));
  // Detection is advice only. Ported numbers keep their old prefix, so the buyer always confirms the network themselves.
  const detected=selected&&validNumber?detectGhanaNetwork(phone) as StoreNetwork|null:null;
  const selectedNetwork=selected?selected.network as StoreNetwork:'mtn';
  const mismatch=!!detected&&detected!==selectedNetwork;
  const spaced=digits.length===10?`${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`:phone;
  const closeSheet=()=>{if(!busy)setSelected(null);};
  const copy=async(text:string,what:string)=>{try{await navigator.clipboard.writeText(text);setCopied(what);}catch{setCopied('manual');}};
  const sessionOrder=!!reference&&reference===ownReference;
  const orderCard=(own:boolean)=>reference&&(own?sessionOrder:!sessionOrder)?<div className="store-order" aria-live="polite" style={{borderColor:colors.border,'--store-network':storeNetworkColor(order?.network==='airteltigo'||order?.network==='telecel'?order.network:'mtn')} as React.CSSProperties}>
    <p className="store-step-label" style={{color:colors.surfaceAccentText}}>{own?'Your order':'Order status'}</p>
    <h3 ref={own?orderHeading:undefined} tabIndex={-1} className="store-order-title site-display">{presentation?.title||(trackingError?'Order status unavailable':'Checking your order…')}</h3>
    {presentation&&<p className="store-order-pill" style={{borderColor:colors.border}}>{presentation.label}</p>}
    {order&&<p className="store-order-line">{storeNetworkName(order.network==='airteltigo'||order.network==='telecel'?order.network:'mtn')} {order.bundle_size_snapshot} · {formatGhs(order.amount)} · to {maskDataRecipient(order.recipient_phone)}</p>}
    {presentation&&<p className="store-note" style={{color:colors.surfaceMutedText}}>{presentation.next}</p>}
    {trackingError&&<p role="alert" className="store-note break-words">{trackingError}</p>}
    <div className="store-ref" style={{borderColor:colors.border,backgroundColor:colors.background,color:colors.text}}>
      <span className="store-ref-label" style={muted}>Order reference</span>
      <code className="store-ref-code">{reference}</code>
    </div>
    <div className="store-order-actions">
      <button type="button" className="store-primary" style={primary} onClick={()=>void copy(reference,'reference')}>{copied==='reference'?'Reference copied':'Copy reference'}</button>
      <button type="button" className="store-secondary" style={quiet} onClick={()=>void refresh(reference)}>Track this order</button>
      <button type="button" className="store-link" style={{color:colors.surfaceText}} onClick={()=>void copy(`Order reference: ${reference}\nTrack it on ${template.demoBusinessName}: ${window.location.origin}${window.location.pathname}#store-track`,'details')}>{copied==='details'?'Details copied':'Copy tracking details'}</button>
    </div>
    <p role="status" className="store-note" style={{color:colors.surfaceMutedText}}>{copied==='manual'?'Copying is blocked in this browser. Press and hold the reference above to copy it.':`${checkedAt?`Last checked ${checkedAt}. `:''}${own?'Save this reference: it is how you find this order again after you close this page or on another phone.':''}`}</p>
  </div>:null;
  const storefront=<div className="space-y-4" style={{color:colors.text, '--website-focus':colors.focus, '--website-placeholder':colors.mutedText} as React.CSSProperties}>
    {preview&&<p role="status" className="store-card store-note" style={card}><strong>Draft preview.</strong> Checkout and order tracking are turned off. Bundles shown use your saved settings; live checkout also depends on publication and current availability.</p>}
    <p className="sr-only">Data bundles from {template.demoBusinessName}</p>
    {sessionOrder&&<section className="store-card" style={card} aria-label="Your order">{orderCard(true)}</section>}
    {loading&&<p role="status" className="store-note" style={muted}>Loading available bundles…</p>}{error&&!selected&&<div role="alert" className="store-card store-note break-words" style={card}><p>{error}</p>{recoveryOnly&&!reference&&businessContact&&<a href={businessContact} className="store-secondary mt-3" style={quiet}>Contact the business</a>}</div>}
    {!loading&&!error&&!onNetwork.length&&!(preview&&!products.length)&&<section role="status" className="store-card space-y-2" style={card}><h3 className="font-bold">{products.length?'No bundles available on this network right now.':'Bundles are not available right now.'}</h3><p className="store-note" style={{color:colors.surfaceMutedText}}>{products.length?'Choose another network or check back later.':'Please check back later or contact the business.'}</p>{businessContact&&<a href={businessContact} className="store-primary" style={{...primary,display:'inline-flex',alignItems:'center'}}>Contact Business</a>}</section>}
    {bundles.length>0&&<section className="store-buy" aria-label={`${storeNetworkName(shown)} bundles`}>
      {networks.length>1?<NetworkTabs networks={networks} value={shown} onChange={switchNetwork} bundles={bundles} theme={colors}/>:<p className="store-one-network" style={muted}><i aria-hidden="true" style={{backgroundColor:storeNetworkColor(shown)}}/>{storeNetworkName(shown)} bundles</p>}
      {filters.length>1&&<div className="store-chips" role="group" aria-label="Filter bundles">{filters.map(f=><button key={f.id} type="button" aria-pressed={activeFilter===f.id} onClick={()=>setFilter(f.id)} style={activeFilter===f.id?{...primary}:{...neutral,backgroundColor:'transparent',color:colors.text}}>{f.label}{f.id==='all'?` ${f.count}`:''}</button>)}</div>}
      {listed.length>0&&<div className="store-rows">{listed.map(b=><BundleRow key={b.id} bundle={b} theme={colors} selected={selected?.id===b.id} featured={pinned.includes(b.id)} action="Buy" onChoose={pick}/>)}</div>}
      {collapsed&&<button type="button" className="store-secondary w-full" style={{...neutral,backgroundColor:'transparent',color:colors.text}} onClick={()=>setExpanded(true)}>Show all {matching.length} {storeNetworkName(shown)} bundles</button>}
      {onNetwork.length>0&&<p className="store-note" style={muted}>{storeNetworkName(shown)}: {sentence(dataDeliveryNote(shown))} The price shown is the total you pay.</p>}
    </section>}
    <section id="store-track" className="store-card scroll-mt-20" style={card} aria-label="Track store order"><h3 className="text-lg font-bold site-display">Track your order</h3><p className="store-note mt-1" style={{color:colors.surfaceMutedText}}>Paste or type the order reference (it starts with MH-) you received after paying.</p><form className="store-track-form" onSubmit={event=>{event.preventDefault();const ref=trackInput.replace(/\s+/g,'').replace(/^mh-/i,'MH-');if(!/^MH-[a-zA-Z0-9-]{1,60}$/.test(ref)){setTrackingError('Order references start with MH-. Check the reference and try again.');return;}setTrackingError('');if(ref===reference)void refresh(ref);else{++trackingGeneration.current;setOrder(null);setCheckedAt('');lastStatus.current='';setReference(ref);}}}><input ref={trackingInput} aria-label="Order reference" value={trackInput} onChange={event=>{setTrackInput(event.target.value);setTrackingError('');}} maxLength={64} autoCapitalize="characters" autoComplete="off" spellCheck={false} enterKeyHint="search" placeholder="MH-… order reference" style={neutral} className="store-field flex-1 placeholder:text-[var(--website-placeholder)]"/><button className="store-secondary" style={card}>Check status</button></form>{trackingError&&!reference&&<p role="alert" className="store-note mt-2 break-words">{trackingError}</p>}{orderCard(false)}</section>
    {busy&&<p role="status" aria-live="polite" className="store-note">{payment.loadingPhase==='opening'?'Complete payment in the secure payment window.':'Connecting to secure payment…'}</p>}
    {selected&&<dialog style={card} ref={dialog} aria-labelledby="store-checkout-title" onCancel={event=>{event.preventDefault();closeSheet();}} onClick={event=>{if(event.target===dialog.current)closeSheet();}} className="store-sheet">
      <div className="flex justify-between items-center gap-3"><h2 id="store-checkout-title" className="font-bold text-xl site-display">Buy {selected.dataAmount} {storeNetworkName(selectedNetwork)}</h2><button type="button" disabled={busy} className="store-secondary" style={{...card,minHeight:44}} onClick={closeSheet}>Close</button></div>
      <div className="store-summary" style={{borderColor:colors.border,'--store-network':storeNetworkColor(selectedNetwork)} as React.CSSProperties}><div className="pl-2 min-w-0"><p className="text-2xl font-bold site-display leading-none">{selected.dataAmount}</p><p className="text-sm mt-1" style={{color:colors.surfaceMutedText}}>{storeNetworkName(selectedNetwork)}{selected.validity?` · ${selected.validity}`:''} · {template.demoBusinessName}</p></div><p className="text-xl font-bold text-right" style={{color:colors.surfaceAccentText}}>{formatGhs(Math.round(selected.priceGhc*100))}<span className="block text-xs font-medium" style={{color:colors.surfaceMutedText}}>total</span></p></div>
      <label className="block text-sm font-semibold mt-4">Number to receive the data<input ref={numberInput} type="tel" inputMode="tel" autoComplete="tel-national" enterKeyHint="next" maxLength={16} disabled={busy||locked} value={phone} placeholder="024 123 4567" onChange={event=>{if(started.current||guard.current)return;setPhone(event.target.value);requestId.current=crypto.randomUUID();setHint('');}} style={neutral} className="store-field store-number mt-1.5 placeholder:text-[var(--website-placeholder)]"/></label>
      {phone&&!validNumber&&<p className="store-note mt-1.5" style={{color:colors.surfaceMutedText}}>Enter a full Ghana number, like 024 123 4567.</p>}
      {validNumber&&<div className={`store-network-check${mismatch?' is-warning':''}`} style={{borderColor:mismatch?storeNetworkColor(selectedNetwork):colors.border}}>
        {mismatch&&<p className="store-note" role="note"><strong>{spaced} usually belongs to {storeNetworkName(detected!)}.</strong> This bundle only works on {storeNetworkName(selectedNetwork)}. Numbers can be moved (ported) between networks, so continue only if this number is on {storeNetworkName(selectedNetwork)} now.</p>}
        <label className="store-check"><input type="checkbox" data-network={selectedNetwork} checked={networkConfirmed} disabled={busy||locked} onChange={event=>{setConfirmedFor(event.target.checked?confirmKey:'');setHint('');}}/><span>{mismatch?`Yes, ${spaced} is on ${storeNetworkName(selectedNetwork)} now`:`${spaced} is an ${storeNetworkName(selectedNetwork)} number`}</span></label>
        {mismatch&&networks.includes(detected!)&&!locked&&<button type="button" className="store-link" style={{color:colors.surfaceText}} onClick={()=>{switchNetwork(detected!);setSelected(null);}}>Show {storeNetworkName(detected!)} bundles instead</button>}
      </div>}
      <label className="block text-sm font-semibold mt-4">Email<input type="email" inputMode="email" autoComplete="email" enterKeyHint="done" maxLength={254} disabled={busy||locked} value={email} placeholder="you@example.com" onChange={event=>{if(started.current)return;setEmail(event.target.value);requestId.current=crypto.randomUUID();setHint('');}} style={neutral} className="store-field mt-1.5 font-normal placeholder:text-[var(--website-placeholder)]"/></label>
      <p className="store-note mt-1.5" style={{color:colors.surfaceMutedText}}>Paystack needs an email for this payment. Your order reference appears on this page after you pay.</p>
      {validNumber&&<p className="store-confirm-line" style={{borderColor:colors.border}}>Sending <strong>{selected.dataAmount} {storeNetworkName(selectedNetwork)}</strong> to <strong>{spaced}</strong> · you pay <strong>{formatGhs(Math.round(selected.priceGhc*100))}</strong></p>}
      <p className="text-xs my-3 leading-relaxed" style={{color:colors.surfaceMutedText}}>{sentence(dataDeliveryNote(selected.network))}</p>
      {locked&&<p className="text-sm my-3" style={{color:colors.surfaceMutedText}}>Keep these details for this payment attempt. Closing the payment window does not cancel an order that was already created.</p>}
      {(hint||error)&&<p role="alert" style={{color:colors.surfaceText}} className="store-sheet-alert my-3 break-words">{hint||error}</p>}
      {paymentReference.current&&<div className="my-3 text-sm"><p className="break-all">Order reference: <code className="store-ref-code">{paymentReference.current}</code></p><button type="button" style={neutral} className="store-secondary mt-2" onClick={()=>{setSelected(null);void refresh(paymentReference.current);requestAnimationFrame(()=>orderHeading.current?.focus());}}>Check existing order</button></div>}
      <button style={primary} ref={payButton} className="store-primary w-full font-bold" disabled={busy||recoveryOnly} onClick={()=>void checkout()}>{busy?payment.loadingPhase==='opening'?'Opening secure payment…':'Connecting to secure payment…':`Pay ${formatGhs(Math.round(selected.priceGhc*100))}`}</button>
      <button type="button" style={quiet} className="store-secondary w-full mt-2" disabled={busy||locked} onClick={closeSheet}>Choose another bundle</button>
      <p className="text-xs mt-3 text-center" style={{color:colors.surfaceMutedText}}>Secure payment by Paystack · Delivered by Mystery Hub</p>
    </dialog>}
  </div>;
  return renderTemplateLayout(template,{managedCheckout:storefront,managedAvailability:availability,managedSummary:summary,onCtaClick:preview?()=>{}:undefined});
}
