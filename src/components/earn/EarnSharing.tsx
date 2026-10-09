import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, Share2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { personalReferralLink, copyReferralLink, shareReferralLink, type EarnSummary } from '../../utils/earnExperience';

const services = [
  { path: '/data', label: 'Data Bundles', description: 'Explore MTN, Telecel and AirtelTigo bundles.' },
  { path: '/marketplace', label: 'Marketplace', description: 'Discover products and make enquiries. Enquiries alone do not earn rewards.' },
  { path: '/website-builder', label: 'Free Website Builder', description: 'Create a business website. Free access is not a paid qualifying purchase.' },
  { path: '/earn', label: 'Mystery Earn', description: 'Learn how qualifying referral rewards work.' },
  { path: '/', label: 'Mystery Hub', description: 'Explore our digital services in one place.' },
];

export function EarnSharing({ summary, unavailable, loading, servicesOnly = false }: { summary: EarnSummary | null; unavailable: boolean; loading: boolean; servicesOnly?: boolean }) {
  const { showToast } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const url = unavailable ? null : personalReferralLink(summary);
  const currentUrl = useRef(url); currentUrl.current = url;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { generation.current++; pending.current = false; setBusy(false); setCopied(null); setManual(null); }, [url]);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(null), 2500); return () => window.clearTimeout(timer); }, [copied]);
  const destination = (path: string) => url ? personalReferralLink(summary, path) : null;
  const perform = async (path: string, native = false) => {
    const link = destination(path); if (!link || pending.current) return;
    const request = generation.current;
    pending.current = true; setBusy(true); setCopied(null); setManual(null);
    const shareResult = native ? await shareReferralLink(link, navigator.share?.bind(navigator)) : 'fallback';
    if (!mounted.current || request !== generation.current || !currentUrl.current) return;
    if (shareResult === 'shared') showToast('Shared successfully.', 'success', 'earn-share');
    if (shareResult === 'fallback') {
      const success = await copyReferralLink(link, navigator.clipboard);
      if (!mounted.current || request !== generation.current || !currentUrl.current) return;
      if (success) { setCopied(path); setManual(null); showToast('Referral link copied.', 'success', 'earn-share'); }
      else { setManual(link); showToast('Select and copy your link below.', 'info', 'earn-share'); }
    }
    // Native cancellation deliberately produces no success notification or clipboard side effect.
    pending.current = false; setBusy(false);
  };
  const whatsapp = (path: string, label: string) => {
    const link = destination(path);
    return link ? `https://wa.me/?text=${encodeURIComponent(`Explore ${label} on Mystery Hub.\n${link}`)}` : undefined;
  };
  const message = loading ? 'Loading your personal referral link…' : summary?.isEnabled === false ? 'Referral sharing is disabled for your account. Existing balances and account navigation remain available.' : unavailable ? 'Your referral link could not be verified. Retry activity above to enable sharing.' : !url ? 'Your personal referral link is unavailable. Refresh activity to try again.' : '';
  const action = (path: string, label: string) => <div className="earn-actions">
    <button className={servicesOnly ? 'earn-secondary' : 'earn-primary'} disabled={!url || busy} onClick={() => void perform(path)} aria-label={`Copy ${label} referral link`}>{copied === path ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copied === path ? 'Copied' : 'Copy link'}</button>
    {url ? <a className="earn-whatsapp" href={whatsapp(path, label)} target="_blank" rel="noopener noreferrer" aria-label={`Share ${label} on WhatsApp`}><MessageCircle size={18} aria-hidden="true" />{!servicesOnly && <span>WhatsApp</span>}</a> : <button className="earn-whatsapp" disabled aria-label={`Share ${label} on WhatsApp`}><MessageCircle size={18} aria-hidden="true" />{!servicesOnly && <span>WhatsApp</span>}</button>}
    {!servicesOnly && <button className="earn-secondary" disabled={!url || busy} onClick={() => void perform('/', true)} aria-label="More sharing options"><Share2 size={18} aria-hidden="true" /><span className="sr-only sm:not-sr-only">Share</span></button>}
  </div>;
  const manualLink = manual && url && <div className="earn-manual" role="status"><label htmlFor={servicesOnly ? 'service-manual-link' : 'personal-manual-link'}>Automatic copy is unavailable. Select this link and copy it.</label><input id={servicesOnly ? 'service-manual-link' : 'personal-manual-link'} readOnly value={manual} onFocus={event => event.target.select()} /></div>;
  if (servicesOnly) return <section className="earn-section" aria-labelledby="earn-service-sharing"><h2 id="earn-service-sharing">Share a Service</h2><p>Send someone straight to what they need. Reward eligibility is separate from sharing.</p>{message && <p role="status">{message}</p>}<details className="earn-service-details"><summary>Choose a service <ArrowRight size={16} aria-hidden="true" /></summary><div className="earn-services">{services.map(service => <article key={service.path}><h3>{service.label}</h3><p>{service.description}</p>{action(service.path, service.label)}</article>)}</div></details>{manualLink}</section>;
  return <section className="earn-share-panel" aria-labelledby="earn-personal-link"><div className="earn-share-title"><span className="earn-share-emblem"><Share2 size={23} aria-hidden="true" /></span><div><p className="earn-eyebrow">Made for sharing</p><h2 id="earn-personal-link">Your personal link</h2></div></div>{url && <p className="earn-referral-identity">Your code <strong>{new URL(url).searchParams.get('ref')}</strong></p>}<label className="sr-only" htmlFor="earn-personal-url">Your personal referral link</label><input id="earn-personal-url" readOnly value={url || ''} placeholder={loading ? 'Loading your link…' : 'Link unavailable'} onFocus={event => event.target.select()} aria-describedby="earn-link-status" /><p id="earn-link-status" role="status" className="earn-fine">{message || 'Every share carries your referral identity.'}</p>{action('/', 'Mystery Hub')}{manualLink}</section>;
}
