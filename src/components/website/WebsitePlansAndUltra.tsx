import { API_BASE_URL } from '../../services/apiClient.js';
import React, { useState } from 'react';
import { WEBSITE_PLANS, ULTRA_SERVICE, type UltraEnquiryInput } from '../../config/websiteBuilder.js';
const initial: UltraEnquiryInput = { businessName: '', businessType: '', contactName: '', phone: '', email: '', existingDomain: 'no', estimatedPages: 1, featuresRequirements: '', preferredStyle: '', referenceWebsite: '', projectNotes: '' };
export function WebsitePlansAndUltra({ sessionToken, onStartBlank }: { sessionToken?: string; onStartBlank: () => void }) {
  const [form, setForm] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [saved, setSaved] = useState<{ reference: string; whatsappUrl: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); setSaved(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/websites/ultra/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) }, body: JSON.stringify(form) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save your enquiry.'); setSaved(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  };
  return <section className="max-w-7xl mx-auto px-4 py-12 space-y-8 text-white">
    <div className="flex flex-wrap justify-between gap-4"><h2 className="text-2xl font-bold">Build your way</h2><button type="button" onClick={onStartBlank} className="rounded-xl px-5 py-3 bg-[#00c365] text-black font-bold">Start Blank · Free</button></div>
    <div className="grid sm:grid-cols-3 gap-4">{Object.values(WEBSITE_PLANS).map(plan => <article key={plan.label} className="border border-slate-700 rounded-2xl p-5"><h3 className="font-bold text-xl">{plan.label}</h3><p>GH₵{plan.monthlyMinor / 100}/month</p><p className="mt-3 text-sm text-slate-300">{plan.available ? 'Live: one site, standard templates, basic sections, customization and /sites publishing with Mystery Hub attribution.' : `Upcoming: up to ${plan.maxSites} sites, premium designs, AI editing, branding and domains. ${plan.label === 'Pro' ? 'Advanced commerce and priority support planned.' : ''} Subscription billing is not available yet.`}</p></article>)}</div>
    <div className="border border-slate-700 rounded-2xl p-5 sm:p-8"><h2 className="text-2xl font-bold">Need something beyond the builder? Go Ultra.</h2><p className="mt-3 text-slate-300">A done-for-you professional website service from GH₵{ULTRA_SERVICE.startingMinor / 100}. Custom builds, additional pages and sections, domain setup, mobile optimization, integrations scoped per project and launch support. Final price depends on project scope.</p>
      <form onSubmit={submit} className="mt-6 grid sm:grid-cols-2 gap-4">
        {(['businessName','businessType','contactName','phone','email','preferredStyle','referenceWebsite'] as const).map(key => <label key={key} className="text-sm">{{businessName:'Business Name',businessType:'Business Type',contactName:'Contact Name',phone:'WhatsApp / Phone',email:'Email (optional)',preferredStyle:'Preferred Style',referenceWebsite:'Reference Website (optional)'}[key]}<input required={!['email','referenceWebsite'].includes(key)} type={key === 'email' ? 'email' : key === 'referenceWebsite' ? 'url' : key === 'phone' ? 'tel' : 'text'} maxLength={key === 'phone' ? 30 : key === 'referenceWebsite' ? 500 : key === 'preferredStyle' ? 300 : key === 'contactName' || key === 'businessType' ? 100 : 150} value={form[key] || ''} disabled={Boolean(saved)} className="block w-full bg-slate-900 border border-slate-700 p-3 rounded-lg mt-1" onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
        <label className="text-sm">Existing Domain?<select disabled={Boolean(saved)} className="block w-full bg-slate-900 p-3 mt-1 rounded-lg" value={form.existingDomain} onChange={e => setForm({ ...form, existingDomain: e.target.value as 'yes' | 'no' })}><option value="no">No</option><option value="yes">Yes</option></select></label>
        <label className="text-sm">Estimated Pages<input required disabled={Boolean(saved)} type="number" min={1} max={100} className="block w-full bg-slate-900 p-3 mt-1 rounded-lg" value={form.estimatedPages} onChange={e => setForm({ ...form, estimatedPages: Number(e.target.value) })} /></label>
        {(['featuresRequirements','projectNotes'] as const).map(key => <label key={key} className="text-sm sm:col-span-2">{key === 'featuresRequirements' ? 'Features / Requirements' : 'Project Notes'}<textarea required={key === 'featuresRequirements'} disabled={Boolean(saved)} maxLength={2000} rows={3} value={form[key]} className="block w-full bg-slate-900 border border-slate-700 p-3 rounded-lg mt-1" onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
        {error && <p role="alert" className="text-rose-300 sm:col-span-2">{error}</p>}
        {!saved ? <button disabled={busy} className="rounded-xl p-3 bg-[#00c365] text-black font-bold">{busy ? 'Saving enquiry…' : 'Submit enquiry'}</button> : <div role="status" className="sm:col-span-2 space-y-3"><p>Enquiry saved: {saved.reference}</p><a href={saved.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl p-3 bg-[#00c365] text-black font-bold">Continue on WhatsApp</a></div>}
      </form>
    </div>
  </section>;
}
