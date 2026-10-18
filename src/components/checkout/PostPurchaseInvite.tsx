import React, { useEffect, useState } from 'react';
import { ArrowRight, Gift, MessageCircle, Share2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getMyReferralSummary } from '../../services/apiClient';
import { personalReferralLink, referralShareMessage, referralWhatsAppUrl, shareReferralLink, earnShareTopics } from '../../utils/earnExperience';
import { dismissPostPurchaseInvite, postPurchaseInviteEligible, postPurchaseInviteHidden, safeLocalStorage } from '../../utils/postPurchaseInvite';
import type { OrderRecord } from '../../types';

/** Quiet, dismissible referral discovery after a confirmed first-party delivery. It never blocks tracking or support. */
export const PostPurchaseInvite: React.FC<{ order: OrderRecord; onExplore: () => void }> = ({ order, onExplore }) => {
  const { user, sessionToken, showToast } = useApp();
  const reference = order.publicReference || order.id;
  const [hidden, setHidden] = useState(() => postPurchaseInviteHidden(reference, safeLocalStorage()));
  const [link, setLink] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'disabled' | 'unavailable'>('idle');
  const eligible = postPurchaseInviteEligible(order) && !hidden;
  useEffect(() => { setHidden(postPurchaseInviteHidden(reference, safeLocalStorage())); }, [reference]);
  useEffect(() => {
    setLink(null);
    if (!eligible || !user || !sessionToken) { setState('idle'); return; }
    // Only the current session's authorized summary can produce a link; account changes discard late responses.
    let active = true; setState('loading');
    getMyReferralSummary(sessionToken).then(result => {
      if (!active) return;
      if (!result.success || result.summary?.isEnabled !== true) { setState(result.success ? 'disabled' : 'unavailable'); return; }
      const url = personalReferralLink(result.summary);
      setLink(url); setState(url ? 'ready' : 'unavailable');
    }).catch(() => { if (active) setState('unavailable'); });
    return () => { active = false; };
  }, [eligible, user?.id, sessionToken]);
  if (!eligible || state === 'disabled') return null;
  const dismiss = () => { dismissPostPurchaseInvite(reference, safeLocalStorage()); setHidden(true); };
  const topic = earnShareTopics[0];
  const message = link ? referralShareMessage(topic, link) : null;
  const nativeShare = async () => {
    if (!link) return;
    const result = await shareReferralLink(link, navigator.share?.bind(navigator), topic.message);
    if (result === 'shared') showToast('Shared successfully.', 'success', 'earn-share');
    else if (result === 'fallback') showToast('Use Share my link to send it on WhatsApp.', 'info', 'earn-share');
  };
  const member = Boolean(user && sessionToken);
  return (
    <section aria-labelledby="post-purchase-invite" className="relative rounded-2xl border border-[#00c365]/25 bg-[linear-gradient(135deg,#0e231a,#0a1511_70%)] p-4 pr-12 text-left">
      <button onClick={dismiss} aria-label="Dismiss Mystery Earn invitation" className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60"><X className="h-4 w-4" /></button>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00c365]/15 text-[#44df95]"><Gift className="h-4.5 w-4.5" /></span>
        <div className="min-w-0 space-y-1">
          <h4 id="post-purchase-invite" className="text-sm font-semibold text-white">Enjoying Mystery Hub? Share it with a friend.</h4>
          <p className="text-xs leading-relaxed text-slate-400">{member
            ? 'Your personal link helps friends discover Mystery Hub. Qualifying purchases by people you refer may earn rewards under the current rules. Your own order does not earn a referral reward.'
            : 'With a free account you get a personal link to share. Qualifying purchases by people you refer may earn rewards under the current rules.'}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pl-12">
        {member && state === 'ready' && message && <>
          <a href={referralWhatsAppUrl(message)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#00c365] px-3.5 text-sm font-semibold text-[#02190d] hover:bg-[#19d679]"><MessageCircle className="h-4 w-4" aria-hidden="true" />Share my link</a>
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && <button onClick={() => void nativeShare()} aria-label="More sharing options" className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-700 text-slate-200 hover:border-slate-500"><Share2 className="h-4 w-4" aria-hidden="true" /></button>}
        </>}
        {member && state === 'loading' && <span role="status" className="inline-flex min-h-11 items-center text-xs text-slate-500">Loading your link…</span>}
        <button onClick={onExplore} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-[#7cedb3] hover:text-white">Explore Mystery Earn <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </section>
  );
};
