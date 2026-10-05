import React, {useEffect, useState} from 'react';
import {useApp} from '../../context/AppContext';
import {AFA_PACKAGES} from '../../config/afa';
import {AfaConfig, getAfaConfig, initializeAfaPayment} from '../../services/afaApi';
import {verifyPaymentOnServer} from '../../services/apiClient';
import {GHANA_REGIONS, validateAfaPayload, afaStatusLabel} from '../../../shared/afa';
import type {SafePublicOrderDetails} from '../../../server/types/orders';

const inputClass = 'w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400';
export const AfaRegistrationPage:React.FC = () => {
  const {user,sessionToken,openAuth,setActivePage,openOrderStatus,openAccount} = useApp();
  const [config,setConfig] = useState<AfaConfig|null>(null), [registering,setRegistering] = useState(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [fieldError,setFieldError] = useState('');
  const [confirmed,setConfirmed] = useState<SafePublicOrderDetails|null>(null);
  const [form,setForm] = useState({name:'',phone:'',idNumber:'',dateOfBirth:'',region:'',location:'',occupation:'',customerEmail:''});
  const [consent,setConsent] = useState(false);
  useEffect(() => { if (fieldError) document.getElementById(`afa-${fieldError}`)?.focus(); },[fieldError]);
  useEffect(() => {let active=true; getAfaConfig().then(c => {if(active)setConfig(c);}).catch(() => {if(active)setError('AFA registration is temporarily unavailable.');}); return () => {active=false;};},[]);
  useEffect(() => {
    // Clear identity data when accounts change, including logout.
    setForm({name:user?.name || '',phone:user?.phone || '',customerEmail:user?.email || '',idNumber:'',dateOfBirth:'',region:'',location:'',occupation:''});
    setConsent(false);
  },[user?.id]);
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference') || new URLSearchParams(window.location.search).get('trxref');
    if (!reference) return;
    let active=true; setBusy(true);
    verifyPaymentOnServer(reference).then(result => {
      if (!active) return;
      if (result.order?.service_type === 'afa') setConfirmed(result.order);
      else setError('Payment has not been confirmed. Check My Orders or contact support.');
    }).catch(() => {if(active)setError('Payment confirmation is still pending. Check My Orders before starting another registration.');}).finally(() => {if(active)setBusy(false);});
    return () => {active=false;};
  },[]);
  const start = () => {
    if (!user || !sessionToken) {openAuth('login','Sign in to register your MTN number for AFA.',() => setRegistering(true));return;}
    if (user.mustChangePassword) {openAccount();return;}
    setRegistering(true);
  };
  const submit = async (event:React.FormEvent) => {
    event.preventDefault();setError('');setFieldError('');
    if (!user || !sessionToken) {start();return;}
    if (user.mustChangePassword) {openAccount();return;}
    try {
      const payload=validateAfaPayload(form);
      if (!consent) throw Object.assign(new Error('Please authorize submission of your details.'),{field:'consent'});
      setBusy(true);
      const result = await initializeAfaPayment(payload,consent,form.customerEmail,sessionToken);
      if (!result.authorizationUrl) throw new Error('Payment link unavailable. Check My Orders before trying again.');
      const url=new URL(result.authorizationUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com') throw new Error('Payment link unavailable. Contact support.');
      // Identity data stays in React memory; only Paystack receives navigation.
      window.location.assign(url.href);
    } catch (err) {setError(err instanceof Error ? err.message : 'Unable to start registration.');setFieldError((err as {field?:string}).field || '');setBusy(false);}
  };
  const viewOrder = () => {
    if (!confirmed) return;
    openOrderStatus({id:confirmed.public_reference,publicReference:confirmed.public_reference,serverReference:confirmed.public_reference,serviceType:'afa',serverStatus:confirmed.status,manualReview:confirmed.manual_review,
      bundle:{id:'afa-registration',network:'mtn',dataAmount:'AFA Registration',dataBytesValue:0,validity:'Registration',validityCategory:'Monthly',priceGhc:confirmed.amount_ghc},
      recipientPhone:confirmed.recipient_phone,network:'mtn',paymentMethod:'paystack',amountGhc:confirmed.amount_ghc,status:confirmed.status==='delivered'?'delivered':'processing',createdAt:confirmed.created_at,updatedAt:confirmed.created_at});
  };
  return <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 text-slate-100 space-y-6">
    <header className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-8 space-y-3">
      <p className="text-sm text-emerald-400">More Services · Connectivity</p><h1 className="text-2xl sm:text-3xl font-bold">MTN AFA Registration</h1>
      <p>Register your MTN number for AFA through Mystery Hub. Registration does not buy a calling or data package.</p>
      <p className="text-sm text-slate-300">AFA package eligibility and activation are subject to MTN and supplier verification. Use the full legal name and Ghana Card details of the number’s owner.</p>
      <p className="font-semibold">One-time registration fee: {config?.retailPriceGhc != null ? `GH₵${config.retailPriceGhc.toFixed(2)}` : 'Currently unavailable'}</p>
      <p className="text-sm">{config?.message || 'Checking registration availability…'}</p>
      {!confirmed && <button type="button" disabled={!config?.available || busy} onClick={start} className="rounded-lg bg-emerald-400 text-black font-bold px-5 py-3 disabled:opacity-50">REGISTER NOW</button>}
    </header>
    {busy && <p role="status">{registering ? 'Preparing secure payment…' : 'Confirming payment…'}</p>}
    {error && <p id="afa-error" role="alert" className="rounded-lg border border-amber-500 p-3 text-amber-200 break-words">{error}</p>}
    {confirmed && <div className="rounded-xl border border-emerald-500 p-5 space-y-3">
      <h2 className="text-xl font-bold">{confirmed.status==='delivered'?'Registered':confirmed.paid_at?'Payment Confirmed':afaStatusLabel(confirmed.status,confirmed.manual_review)}</h2>
      <p>Status: {afaStatusLabel(confirmed.status,confirmed.manual_review)}</p><p className="break-all">Order: {confirmed.public_reference}</p>
      <p>{confirmed.status==='delivered'?'Your AFA registration is confirmed.':'Payment confirmation does not mean registration is complete. Follow the order for updates.'}</p>
      <div className="flex flex-wrap gap-3"><button onClick={viewOrder} className="rounded-lg border p-3">VIEW ORDER</button><button onClick={() => setActivePage('orders')} className="rounded-lg border p-3">VIEW MY ORDERS</button></div>
    </div>}
    {registering && user && !confirmed && <form onSubmit={submit} className="rounded-2xl border border-slate-700 p-4 sm:p-6 space-y-5" aria-label="AFA registration" noValidate>
      <h2 className="text-xl font-semibold">Registration details</h2><p className="text-sm text-slate-300">For MTN numbers only. Number portability means your prefix alone cannot confirm your network.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
        {(['name','phone','idNumber','dateOfBirth','location','occupation','customerEmail'] as const).map(field => <div key={field} className="min-w-0 space-y-2">
          <label htmlFor={`afa-${field}`} className="block text-sm">{{name:'Full legal name',phone:'MTN phone number',idNumber:'Ghana Card number',dateOfBirth:'Date of birth',location:'Town / location',occupation:'Occupation (optional)',customerEmail:'Receipt email'}[field]}</label>
          <input id={`afa-${field}`} type={field==='dateOfBirth'?'date':field==='customerEmail'?'email':field==='phone'?'tel':'text'} className={inputClass} value={form[field]} required={field!=='occupation'}
            max={field==='dateOfBirth'?new Date().toISOString().slice(0,10):undefined} maxLength={field==='customerEmail'?254:field==='idNumber'?32:field==='phone'?32:128}
            autoComplete={field==='idNumber'?'off':field==='name'?'name':field==='phone'?'tel':field==='customerEmail'?'email':field==='dateOfBirth'?'bday':'off'}
            aria-invalid={fieldError===field} aria-describedby={fieldError===field?'afa-error':undefined} onChange={e => setForm(f=>({...f,[field]:e.target.value}))}/>
        </div>)}
        <div className="min-w-0 space-y-2"><label htmlFor="afa-region" className="block text-sm">Region</label><select id="afa-region" required value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value}))} className={inputClass} aria-invalid={fieldError==='region'} aria-describedby={fieldError==='region'?'afa-error':undefined}><option value="">Select a region</option>{GHANA_REGIONS.map(r=><option key={r}>{r}</option>)}</select></div>
      </div>
      <p className="text-sm text-slate-300">We encrypt your registration details on the server and send them securely to our registration supplier. Sensitive identity details are removed after completion or closure; unresolved support cases retain them for reconciliation. Never provide a PIN, password, card photo, or selfie.</p>
      <label className="flex items-start gap-3 text-sm"><input id="afa-consent" type="checkbox" className="mt-1 shrink-0" checked={consent} onChange={e=>setConsent(e.target.checked)} aria-invalid={fieldError==='consent'} aria-describedby={fieldError==='consent'?'afa-error':undefined}/>I confirm that I am authorized to register this MTN number and consent to Mystery Hub securely sending these details to its AFA registration supplier.</label>
      <p className="text-sm">Registration fee: {config?.retailPriceGhc != null ? `GH₵${config.retailPriceGhc.toFixed(2)}`:'Unavailable'}. Review your details before payment.</p>
      <button disabled={busy || !config?.available || !consent} className="w-full sm:w-auto rounded-lg bg-emerald-400 px-5 py-3 font-bold text-black disabled:opacity-50">Continue to secure payment</button>
    </form>}
    <div className="space-y-4"><h2 className="text-xl font-bold">About MTN AFA packages</h2><p className="text-sm text-slate-300">Examples for information only. Purchased separately from MTN after registration; availability and benefits may change. These are limited allowances, not unlimited calls.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{AFA_PACKAGES.map(p=><article key={p.name} className="rounded-xl border border-slate-700 p-4 space-y-2"><h3 className="font-semibold">{p.name}</h3><p>GH₵{p.price} · {p.days} days</p><p className="text-sm">{p.onNet} MTN minutes · {p.offNet} off-network minutes · {p.cug} CUG minutes · {p.sms} SMS{p.data ? ` · ${p.data}`:''}</p></article>)}</div>
    </div>
  </section>;
};
