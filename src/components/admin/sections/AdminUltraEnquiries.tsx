import React, { useEffect, useRef, useState } from 'react';
import type { UltraEnquiryRecord } from '../../../../server/db/websiteUltraStore';
import { getAdminUltraEnquiries, getAdminUltraEnquiry } from '../../../services/apiClient';
import { ultraCustomerWhatsApp, ultraReferenceWebsite } from '../../../utils/ultraEnquiryPresentation';

export function AdminUltraEnquiries({ token }: { token: string }) {
  const [search, setSearch] = useState(''), [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminUltraEnquiries>> | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState<UltraEnquiryRecord | null>(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState(''), [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), detailRequest = useRef(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const timer = setTimeout(() => { void getAdminUltraEnquiries(token, search, offset).then(result => { if (active) setData(result); }).catch(() => { if (active) { setData(null); setError('Could not load Ultra enquiries. Please retry.'); } }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [token, search, offset, refresh]);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected?.reference]);
  useEffect(() => () => { detailRequest.current++; }, []);
  const close = () => { detailRequest.current++; setSelected(null); setDetailError(''); };
  const inspect = async (enquiry: UltraEnquiryRecord) => {
    const request = ++detailRequest.current; setSelected(enquiry); setDetailLoading(true); setDetailError(''); setCopied(false);
    try { const result = await getAdminUltraEnquiry(token, enquiry.reference); if (request === detailRequest.current) setSelected(result.enquiry); }
    catch { if (request === detailRequest.current) setDetailError('Could not refresh the brief. The saved list copy is shown below.'); }
    finally { if (request === detailRequest.current) setDetailLoading(false); }
  };
  const button = 'min-h-11 px-3 py-2 rounded-xl border border-slate-600 text-sm disabled:opacity-40';
  const whatsapp = selected && ultraCustomerWhatsApp(selected.brief.phone), referenceSite = selected && ultraReferenceWebsite(selected.brief.referenceWebsite);
  return <section aria-label="Ultra enquiries" className="min-w-0 space-y-4 rounded-2xl border border-slate-800 bg-[#0b1116] p-4">
    <header><h2 className="text-lg font-bold text-white">Ultra Enquiries</h2><p className="text-sm text-slate-400">Read original project briefs and contact customers. This inbox does not change submissions, and it does not track follow-up status yet.</p></header>
    <div className="flex flex-wrap gap-2"><input aria-label="Search Ultra enquiries" placeholder="Reference, business, contact, phone or email" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setOffset(0); }} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 p-3" /><button className={button} onClick={() => setRefresh(value => value + 1)}>Refresh enquiries</button></div>
    {loading && <p role="status">Loading Ultra enquiries…</p>}
    {error && <div role="alert"><p>{error}</p><button className={button} onClick={() => setRefresh(value => value + 1)}>Retry enquiries</button></div>}
    {!loading && !error && data && <>
      {data.enquiries.length ? data.enquiries.map(enquiry => <article key={enquiry.id} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
        <h3 className="font-semibold break-words">{enquiry.brief.businessName}</h3><p className="text-sm break-words">{enquiry.brief.businessType} · {enquiry.brief.contactName}</p><p className="text-sm break-all text-slate-300">{enquiry.brief.phone}{enquiry.brief.email ? ` · ${enquiry.brief.email}` : ''}</p><p className="text-xs text-slate-400 break-words">{enquiry.reference} · {new Date(enquiry.created_at).toLocaleString()}</p><div className="flex flex-wrap gap-2"><button className={`${button} border-[#00c365]/50 text-[#7dffbf]`} onClick={() => void inspect(enquiry)}>View project brief</button>{ultraCustomerWhatsApp(enquiry.brief.phone) && <a className={button} href={ultraCustomerWhatsApp(enquiry.brief.phone)!} target="_blank" rel="noopener noreferrer">WhatsApp</a>}</div>
      </article>) : <p>{search ? 'No enquiries match this search.' : 'No Ultra enquiries yet.'}</p>}
      <nav aria-label="Ultra enquiry pagination" className="flex flex-wrap items-center justify-between gap-2 text-sm"><button className={button} disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - data.limit))}>Previous enquiries</button><span>{data.total ? `${Math.min(offset + 1, data.total)}–${Math.min(offset + data.limit, data.total)} of ${data.total}` : '0 enquiries'}</span><button className={button} disabled={offset + data.limit >= data.total} onClick={() => setOffset(value => value + data.limit)}>Next enquiries</button></nav>
    </>}
    {selected && <dialog ref={dialog} aria-labelledby="ultra-brief-title" onCancel={close} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-600 bg-slate-950 text-white p-4 backdrop:bg-black/70">
      <div className="flex justify-between items-start gap-3"><h2 id="ultra-brief-title" className="font-bold text-lg break-words min-w-0">{selected.brief.businessName}</h2><button className={button} onClick={close}>Close brief</button></div>
      {detailLoading && <p role="status">Loading original brief…</p>}{detailError && <p role="alert">{detailError}</p>}
      <dl className="space-y-3 my-4 text-sm">{[['Reference', selected.reference], ['Submitted', new Date(selected.created_at).toLocaleString()], ['Business type', selected.brief.businessType], ['Contact name', selected.brief.contactName], ['Phone', selected.brief.phone], ['Email', selected.brief.email || 'Not provided'], ['Existing domain', selected.brief.existingDomain === 'yes' ? 'Yes' : 'No'], ['Page count', selected.brief.estimatedPages], ['Design preferences', selected.brief.preferredStyle], ['Requested features / project brief', selected.brief.featuresRequirements], ['Additional notes', selected.brief.projectNotes || 'Not provided']].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
      {referenceSite ? <a href={referenceSite} target="_blank" rel="noopener noreferrer" className="block min-h-11 text-emerald-300 underline break-all">Reference website: {selected.brief.referenceWebsite}</a> : selected.brief.referenceWebsite ? <p className="break-all">Reference website (text only): {selected.brief.referenceWebsite}</p> : <p className="text-sm text-slate-400">No reference website provided.</p>}
      <div className="flex flex-wrap gap-2 mt-3">{whatsapp && <a className={button} href={whatsapp} target="_blank" rel="noopener noreferrer">Contact customer on WhatsApp</a>}<button className={button} onClick={async () => { try { await navigator.clipboard.writeText(selected.reference); setCopied(true); } catch { setDetailError('Copy is unavailable. Select the reference and copy it manually.'); } }}>{copied ? 'Reference copied' : 'Copy enquiry reference'}</button></div>
    </dialog>}
  </section>;
}
