import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, Share2, Link2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { personalReferralLink, copyReferralLink, shareReferralLink, earnShareTopics, referralShareMessage, referralWhatsAppUrl, type EarnSummary } from '../../utils/earnExperience';

/** One sharing studio: pick what to share, see the exact message, then copy, WhatsApp or use the device share sheet. */
export function EarnSharing({ summary, unavailable, loading }: { summary: EarnSummary | null; unavailable: boolean; loading: boolean }) {
  const { showToast } = useApp();
  const [topicId, setTopicId] = useState<string>(earnShareTopics[0].id);
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const url = unavailable ? null : personalReferralLink(summary);
  const currentUrl = useRef(url); currentUrl.current = url;
  const topic = earnShareTopics.find(item => item.id === topicId) || earnShareTopics[0];
  const link = url ? personalReferralLink(summary, topic.path) : null;
  const message = link ? referralShareMessage(topic, link) : null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { generation.current++; pending.current = false; setBusy(false); setCopied(null); setManual(null); }, [url]);
  useEffect(() => { setCopied(null); setManual(null); }, [topicId]);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(null), 2500); return () => window.clearTimeout(timer); }, [copied]);
  const perform = async (kind: 'link' | 'message' | 'native') => {
    if (!link || !message || pending.current) return;
    const request = generation.current;
    pending.current = true; setBusy(true); setCopied(null); setManual(null);
    const shareResult = kind === 'native' ? await shareReferralLink(link, navigator.share?.bind(navigator), topic.message) : 'fallback';
    if (!mounted.current || request !== generation.current || !currentUrl.current) return;
    if (shareResult === 'shared') showToast('Shared successfully.', 'success', 'earn-share');
    if (shareResult === 'fallback') {
      const text = kind === 'message' ? message : link;
      const success = await copyReferralLink(text, navigator.clipboard);
      if (!mounted.current || request !== generation.current || !currentUrl.current) return;
      if (success) { setCopied(kind === 'message' ? 'message' : 'link'); setManual(null); showToast(kind === 'message' ? 'Message and link copied.' : 'Referral link copied.', 'success', 'earn-share'); }
      else { setManual(text); showToast('Select and copy it below.', 'info', 'earn-share'); }
    }
    // Native cancellation deliberately produces no success notification or clipboard side effect.
    pending.current = false; setBusy(false);
  };
  const status = loading ? 'Loading your personal referral link…' : summary?.isEnabled === false ? 'Referral sharing is disabled for your account. Existing balances and account navigation remain available.' : unavailable ? 'Your referral link could not be verified. Retry activity above to enable sharing.' : !url ? 'Your personal referral link is unavailable. Refresh activity to try again.' : '';
  const label = topic.label;
  const code = url ? new URL(url).searchParams.get('ref') : null;
  return <section className="earn-share-panel" aria-labelledby="earn-personal-link" id="earn-share">
    <div className="earn-share-title"><span className="earn-share-emblem"><Share2 size={22} aria-hidden="true" /></span><div><p className="earn-eyebrow">Your personal link</p><h2 id="earn-personal-link">Share something useful</h2></div>{code && <p className="earn-referral-identity"><span>Code</span><strong>{code}</strong></p>}</div>
    <fieldset className="earn-topics" disabled={!url}><legend>Share a Service</legend><div role="radiogroup" aria-label="What would you like to share?">{earnShareTopics.map(item => <label key={item.id} className={item.id === topic.id ? 'is-active' : undefined}><input type="radio" name="earn-share-topic" value={item.id} checked={item.id === topic.id} onChange={() => setTopicId(item.id)} /><span>{item.short}</span></label>)}</div></fieldset>
    <div className="earn-message" aria-live="polite">
      {message ? <><p className="earn-message-label">Message preview · {label}</p><p className="earn-message-text">{topic.message} Here’s my link: <span>{link}</span></p><p className="earn-fine">{topic.note}</p></>
        : <p id="earn-link-status" role="status" className="earn-fine">{status}</p>}
    </div>
    <div className="earn-actions earn-share-actions">
      {link && message ? <a className="earn-primary earn-whatsapp-cta" href={referralWhatsAppUrl(message)} target="_blank" rel="noopener noreferrer" aria-label={`Share ${label} on WhatsApp`}><MessageCircle size={18} aria-hidden="true" />WhatsApp</a>
        : <button className="earn-primary earn-whatsapp-cta" disabled aria-label={`Share ${label} on WhatsApp`}><MessageCircle size={18} aria-hidden="true" />WhatsApp</button>}
      <button className="earn-secondary" disabled={!url || busy} onClick={() => void perform('link')} aria-label={`Copy ${label} referral link`}>{copied === 'link' ? <Check size={17} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}{copied === 'link' ? 'Copied' : 'Copy link'}</button>
      <button className="earn-secondary" disabled={!url || busy} onClick={() => void perform('message')} aria-label={`Copy ${label} message with link`}>{copied === 'message' ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{copied === 'message' ? 'Copied' : 'Copy message'}</button>
      <button className="earn-secondary earn-icon-only" disabled={!url || busy} onClick={() => void perform('native')} aria-label="More sharing options"><Share2 size={18} aria-hidden="true" /></button>
    </div>
    <ul className="earn-share-tips" aria-label="Where sharing tends to work"><li><strong>WhatsApp Status</strong><span>Friends see it when they need data.</span></li><li><strong>A group you’re in</strong><span>Family, church, class or work chats.</span></li><li><strong>One person, one need</strong><span>Pick the service that fits them.</span></li></ul>
    {message && status === '' && <p className="earn-fine earn-share-foot">Every link carries your code. Rewards come only from qualifying purchases, not visits.</p>}
    {manual && url && <div className="earn-manual" role="status"><label htmlFor="earn-manual-link">Automatic copy is unavailable. Select this text and copy it.</label><input id="earn-manual-link" readOnly value={manual} onFocus={event => event.target.select()} /></div>}
  </section>;
}
