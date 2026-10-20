import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, Share2, Link2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { personalReferralLink, copyReferralLink, shareReferralLink, earnShareTopics, referralShareMessage, referralWhatsAppUrl, type EarnSummary } from '../../utils/earnExperience';

/** Sharing studio: pick a service, see the exact message, then WhatsApp or copy; rarer options sit in a quieter row. */
export function EarnSharing({ summary, unavailable, loading }: { summary: EarnSummary | null; unavailable: boolean; loading: boolean }) {
  const { showToast, user, sessionToken } = useApp();
  const [topicId, setTopicId] = useState<string>(earnShareTopics[0].id);
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const url = unavailable ? null : personalReferralLink(summary);
  const currentUrl = useRef(url); currentUrl.current = url;
  const owner = `${user?.id || ''}:${sessionToken || ''}`;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const topic = earnShareTopics.find(item => item.id === topicId) || earnShareTopics[0];
  const link = url ? personalReferralLink(summary, topic.path) : null;
  const message = link ? referralShareMessage(topic, link) : null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { generation.current++; pending.current = false; setBusy(false); setCopied(null); setManual(null); }, [url, owner]);
  const changeTopic = (id: string) => {
    // Invalidate synchronously: a late clipboard/share result belongs to the old topic.
    generation.current++; pending.current = false; setBusy(false); setCopied(null); setManual(null); setTopicId(id);
  };
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(null), 2500); return () => window.clearTimeout(timer); }, [copied]);
  const perform = async (kind: 'link' | 'message' | 'native') => {
    if (!link || !message || pending.current) return;
    const request = generation.current;
    pending.current = true; setBusy(true); setCopied(null); setManual(null);
    const shareResult = kind === 'native' ? await shareReferralLink(link, navigator.share?.bind(navigator), topic.message) : 'fallback';
    if (!mounted.current || request !== generation.current || currentUrl.current !== url || currentOwner.current !== owner) return;
    if (shareResult === 'shared') showToast('Shared successfully.', 'success', 'earn-share');
    if (shareResult === 'fallback') {
      const text = kind === 'message' ? message : link;
      const success = await copyReferralLink(text, navigator.clipboard);
      if (!mounted.current || request !== generation.current || currentUrl.current !== url || currentOwner.current !== owner) return;
      if (success) { setCopied(kind === 'message' ? 'message' : 'link'); setManual(null); showToast(kind === 'message' ? 'Message and link copied.' : 'Referral link copied.', 'success', 'earn-share'); }
      else { setManual(text); showToast('Select and copy it below.', 'info', 'earn-share'); }
    }
    // Native cancellation deliberately produces no success notification or clipboard side effect.
    pending.current = false; setBusy(false);
  };
  const status = loading ? 'Loading your personal link…' : summary?.isEnabled === false ? 'Referral sharing is paused for your account. Your balances and history are still available.' : unavailable ? 'Your link could not be checked. Use Refresh above to try again.' : !url ? 'Your personal link is unavailable. Use Refresh above to try again.' : '';
  const label = topic.label;
  const code = url ? new URL(url).searchParams.get('ref') : null;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return <section className="earn-share-panel" aria-labelledby="earn-personal-link" id="earn-share">
    <div className="earn-share-title"><h2 id="earn-personal-link">What would you like to share?</h2>{code && <p className="earn-referral-identity"><span>Your code</span><strong>{code}</strong></p>}</div>
    <fieldset className="earn-topics" disabled={!url}><legend className="sr-only">Share a Service</legend><div role="radiogroup" aria-label="What would you like to share?">{earnShareTopics.map(item => <label key={item.id} className={item.id === topic.id ? 'is-active' : undefined}><input type="radio" name="earn-share-topic" value={item.id} checked={item.id === topic.id} onChange={() => changeTopic(item.id)} /><span>{item.short}</span></label>)}</div></fieldset>
    <div className="earn-message" aria-live="polite">
      {message ? <><p className="earn-message-label">Here’s the message your friend will see. You can edit it in WhatsApp before sending.</p><p className="earn-message-text">{topic.message} Here’s my link: <span>{link}</span></p></>
        : <p id="earn-link-status" role="status" className="earn-fine">{status}</p>}
    </div>
    <div className="earn-share-actions">
      {link && message ? <a className="earn-primary earn-whatsapp-cta" href={referralWhatsAppUrl(message)} target="_blank" rel="noopener noreferrer" aria-label={`Share ${label} on WhatsApp`}><MessageCircle size={18} aria-hidden="true" />Share on WhatsApp</a>
        : <button className="earn-primary earn-whatsapp-cta" disabled aria-label={`Share ${label} on WhatsApp`}><MessageCircle size={18} aria-hidden="true" />Share on WhatsApp</button>}
      <button className="earn-secondary" disabled={!url || busy} onClick={() => void perform('link')} aria-label={`Copy ${label} referral link`}>{copied === 'link' ? <Check size={17} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}{copied === 'link' ? 'Copied' : 'Copy link'}</button>
    </div>
    <div className="earn-share-more">
      {message && <p className="earn-share-note">{topic.note}</p>}
      <div className="earn-share-more-actions">
        <button className="earn-text-button" disabled={!url || busy} onClick={() => void perform('message')} aria-label={`Copy ${label} message with link`}>{copied === 'message' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied === 'message' ? 'Message copied' : 'Copy message'}</button>
        {canNativeShare && <button className="earn-text-button" disabled={!url || busy} onClick={() => void perform('native')} aria-label="More sharing options"><Share2 size={15} aria-hidden="true" />Other apps</button>}
      </div>
    </div>
    {manual && url && <div className="earn-manual" role="status"><label htmlFor="earn-manual-link">Automatic copy is unavailable. Select this text and copy it.</label><input id="earn-manual-link" readOnly value={manual} onFocus={event => event.target.select()} /></div>}
  </section>;
}
