import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Download, MessageCircle, SquarePlus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { OrderRecord } from '../../types';
import { CHANNEL_COPY, installCopy, installProgressCopy, verifiedPurchase } from '../../pwa/invitationCopy';
import { BUSINESS_CONFIG } from '../../config/business';
import { BrandMark } from '../common/BrandLogo';
import { useAppInstall } from '../../pwa/useAppInstall';
import { openOverlayCount, subscribeOverlays } from '../../utils/overlayStack';
import {
  calmPage, channelInviteAllowed, claimInvitation, engaged, inlineOfferVisible, invitationOnScreen, invitationOrder,
  noteActive, noteDismissal, notePurchase, noteView, readChannelInvite, readSession, recordChannelFollowing,
  recordChannelLater, recordChannelOpened, releaseInvitation, SETTLE_MS, subscribeInvitations, type InvitationKind,
} from '../../pwa/invitations';
import { trackGrowth } from '../../utils/growthAnalytics';
import { GROWTH_PAGES, type GrowthPage } from '../../../shared/growthAnalytics';
import { isCoarsePointer } from '../../pwa/appEnvironment';
import { AppleInstallSteps } from './InstallAppPromo';
import { appBusy } from './invitationBusy';
import './pwa.css';

type Outcome = 'dismissed' | 'acted' | 'ignored';
const ACTIVE_TICK_MS = 5_000;
const growthPage = (page: string): GrowthPage => (GROWTH_PAGES.includes(page as GrowthPage) ? page as GrowthPage : 'home');

/**
 * Mystery Hub's own suggestions (install the app, follow the WhatsApp Channel), coordinated by pwa/invitations:
 * one small card at a time, on a calm page, after real engagement, at most once per visit. It is never a blocking
 * layer: no focus is taken, Escape and "Not now" close it, and it steps aside for any dialog, a page change or a long
 * scroll, so it never becomes a permanent strip at the bottom of a small phone.
 */
export const InvitationLayer: React.FC = () => {
  const app = useApp();
  const { activePage, isAuthChecking, isStatusModalOpen, activeOrder } = app;
  const overlays = useSyncExternalStore(subscribeOverlays, openOverlayCount, () => 0);
  const slot = useSyncExternalStore(subscribeInvitations, invitationOnScreen, () => null);
  const inlineOffer = useSyncExternalStore(subscribeInvitations, inlineOfferVisible, () => false);
  const installState = useAppInstall();
  const [shown, setShown] = useState<{ kind: InvitationKind; page: string } | null>(null);
  const shownRef = useRef<InvitationKind | null>(null);
  const [tick, setTick] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const cardRef = useRef<HTMLElement | null>(null);
  // Never over any overlay on the shared stack (dialogs, sheets, the phone menu), nor over the app's own busy states.
  const busy = overlays > 0 || isAuthChecking || appBusy(app);

  // Engagement: pages viewed in this visit, and visible time after the first tap, key or scroll.
  useEffect(() => { noteView(activePage); setTick(t => t + 1); }, [activePage]);
  useEffect(() => {
    let interacted = false;
    const mark = () => { interacted = true; };
    window.addEventListener('pointerdown', mark, { passive: true });
    window.addEventListener('keydown', mark);
    window.addEventListener('scroll', mark, { passive: true });
    const timer = window.setInterval(() => {
      if (!interacted || document.visibilityState !== 'visible' || engaged(readSession())) return;
      if (engaged(noteActive(ACTIVE_TICK_MS))) setTick(t => t + 1);
    }, ACTIVE_TICK_MS);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
      window.removeEventListener('scroll', mark);
      window.clearInterval(timer);
    };
  }, []);

  // A verified purchase is a good moment, but only after its receipt has been closed: the receipt and tracking
  // controls are never covered.
  const receipt = useRef<OrderRecord | null>(null);
  useEffect(() => {
    if (isStatusModalOpen) { if (activeOrder) receipt.current = activeOrder; return; }
    const order = receipt.current;
    receipt.current = null;
    if (verifiedPurchase(order)) { notePurchase(); setTick(t => t + 1); }
  }, [isStatusModalOpen, activeOrder]);

  const close = useCallback((outcome: Outcome) => {
    const kind = shownRef.current;
    // Someone answering from the keyboard keeps their place: focus returns to the page, not to <body>.
    if (cardRef.current?.contains(document.activeElement)) document.getElementById('main-content')?.focus({ preventScroll: true });
    shownRef.current = null;
    setShown(null);
    setAnnouncement('');
    if (kind) releaseInvitation(kind);
    if (outcome === 'dismissed') noteDismissal();
  }, []);

  const installOffer = installState.mode !== 'hidden' && installState.progress === 'idle';
  useEffect(() => {
    if (shown || slot || busy || inlineOffer || !calmPage(activePage, window.location.search) || !engaged(readSession())) return;
    const timer = window.setTimeout(() => {
      const kind = claimInvitation(invitationOrder({ install: installOffer, channel: channelInviteAllowed(readChannelInvite(), Date.now()) }));
      if (!kind) return;
      shownRef.current = kind;
      setShown({ kind, page: activePage });
      // A short, polite note for screen readers; the card itself is a labelled landmark at the end of the page.
      setAnnouncement(kind === 'install' ? 'Suggestion: install Mystery Hub. Find it at the end of the page.' : 'Suggestion: follow the Mystery Hub WhatsApp Channel. Find it at the end of the page.');
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [shown, slot, busy, inlineOffer, activePage, tick, installOffer]);

  // Step aside for any dialog, sheet or menu, and when the visitor moves to another page: shown once is enough.
  useEffect(() => { if (shown && (busy || activePage !== shown.page)) close('ignored'); }, [shown, busy, activePage, close]);
  // A long scroll past it means "not interested": it leaves rather than riding along at the bottom of the screen.
  useEffect(() => {
    if (!shown) return;
    const start = window.scrollY;
    const onScroll = () => { if (Math.abs(window.scrollY - start) > window.innerHeight * 1.5) close('ignored'); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shown, close]);
  useEffect(() => () => { if (shownRef.current) releaseInvitation(shownRef.current); }, []);

  return <>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {shown && (shown.kind === 'install'
      ? <InstallInvitation cardRef={cardRef} page={growthPage(shown.page)} state={installState} onClose={close} />
      : <ChannelInvitation cardRef={cardRef} onClose={close} />)}
  </>;
};

/** The close button acts like the card's own "Not now" / "Maybe later" (it snoozes), under a distinct name. */
function InvitationCard({ cardRef, titleId, icon, title, text, closeLabel, onClose, status = false, children }: {
  cardRef: React.RefObject<HTMLElement | null>; titleId: string; icon: React.ReactNode; title: React.ReactNode; text: string; closeLabel: string;
  onClose: () => void; status?: boolean; children: React.ReactNode;
}) {
  return <aside ref={cardRef} aria-labelledby={titleId} role={status ? 'status' : undefined} className="mh-invite"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <button type="button" className="mh-invite-close mh-compact-control" onClick={onClose} aria-label={closeLabel}><X className="size-4" aria-hidden="true" /></button>
    <div className="mh-invite-head">
      <span className="mh-invite-icon" aria-hidden="true">{icon}</span>
      <div className="mh-invite-copy"><h2 id={titleId}>{title}</h2><p>{text}</p></div>
    </div>
    <div className="mh-invite-actions">{children}</div>
  </aside>;
}

function InstallInvitation({ cardRef, page, state, onClose }: {
  cardRef: React.RefObject<HTMLElement | null>; page: GrowthPage; state: ReturnType<typeof useAppInstall>; onClose: (outcome: Outcome) => void;
}) {
  const [phone] = useState(() => isCoarsePointer());
  const [mode] = useState(state.mode);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [stepsRead, setStepsRead] = useState(false);
  const titleId = useId(), stepsId = useId();
  // "Not now" counts towards the 30-day rest and the three-strikes rule, as on the page card.
  const notNow = () => { state.dismiss(); onClose('dismissed'); };
  // Closing after reading the iPhone steps is not a "no": Safari cannot tell whether it was added, so it rests.
  const closeCard = () => { if (stepsRead) { state.stepsSeen(); onClose('acted'); } else notNow(); };
  const accept = async () => {
    const outcome = await state.install();
    if (outcome === 'dismissed') onClose('dismissed');
    else if (outcome === 'unavailable') onClose('ignored');
  };

  if (state.progress !== 'idle') {
    const copy = installProgressCopy(state.progress, phone);
    const done = () => onClose('acted');
    return <InvitationCard cardRef={cardRef} titleId={titleId} status icon={<CheckCircle2 className="size-6 text-emerald-300" />} title={copy.title} text={copy.text} closeLabel="Close" onClose={done}>
      <button type="button" className="mh-button" onClick={done}>Done</button>
    </InvitationCard>;
  }
  const copy = installCopy(phone);
  return <InvitationCard cardRef={cardRef} titleId={titleId} icon={<BrandMark size="md" ariaHidden />} title={copy.title} text={copy.text} closeLabel="Close" onClose={closeCard}>
    {mode === 'apple'
      ? <button type="button" className="mh-button" aria-expanded={stepsOpen} aria-controls={stepsId} onClick={() => { if (!stepsOpen) { trackGrowth('install_action', { page }); setStepsRead(true); } setStepsOpen(open => !open); }}>
          <SquarePlus className="size-4" aria-hidden="true" />{stepsOpen ? 'Hide steps' : 'Add to Home Screen'}
        </button>
      : <button type="button" className="mh-button" onClick={() => { void accept(); }}><Download className="size-4" aria-hidden="true" />Install App</button>}
    <button type="button" className="mh-invite-later" onClick={notNow}>Not now</button>
    {mode === 'apple' && stepsOpen && <AppleInstallSteps id={stepsId} />}
  </InvitationCard>;
}

function ChannelInvitation({ cardRef, onClose }: { cardRef: React.RefObject<HTMLElement | null>; onClose: (outcome: Outcome) => void }) {
  const titleId = useId();
  const later = () => { recordChannelLater(); onClose('dismissed'); };
  const following = () => { recordChannelFollowing(); onClose('dismissed'); };
  // Opening WhatsApp is a click, not a follow: nothing here says "followed".
  const open = () => { recordChannelOpened(); window.setTimeout(() => onClose('acted'), 0); };
  return <InvitationCard cardRef={cardRef} titleId={titleId} icon={<MessageCircle className="size-6 text-[#44df95]" />}
    title={<>{CHANNEL_COPY.title} <span aria-hidden="true">💚</span></>} text={CHANNEL_COPY.text} closeLabel="Close" onClose={later}>
    <a className="mh-button" href={BUSINESS_CONFIG.contact.whatsappChannelUrl} target="_blank" rel="noopener noreferrer" onClick={open}>
      {CHANNEL_COPY.follow}<span className="sr-only"> (opens WhatsApp)</span>
    </a>
    <div className="mh-invite-quiet">
      <button type="button" className="mh-invite-later" onClick={later}>{CHANNEL_COPY.later}</button>
      <button type="button" className="mh-invite-later" onClick={following}>{CHANNEL_COPY.following}</button>
    </div>
  </InvitationCard>;
}
