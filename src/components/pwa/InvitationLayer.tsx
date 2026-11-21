import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { BellOff, BellRing, CheckCircle2, Download, MessageCircle, SquarePlus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { OrderRecord } from '../../types';
import { CHANNEL_COPY, installCopy, installProgressCopy, NOTIFICATION_ACTIONS, NOTIFICATION_RESULT, notificationCopy, notificationNote, PAUSED_INVITE_NOTE, verifiedPurchase } from '../../pwa/invitationCopy';
import { activateNotificationInvite, notificationInviteOpportunity, onNotificationChoice, type NotificationOpportunity } from '../../pwa/notificationOnboarding';
import { notificationPermissionState } from '../../pwa/notifications';
import { createAutoHide, windowClock } from '../../pwa/autoHide';
import { httpCustomerNotificationsClient, httpGuestNotificationsClient } from '../../services/customerNotifications';
import { notificationInviteResting, notificationSnoozeEnds, readSnooze, recordDismissal, STORAGE_KEYS } from '../../pwa/launchPolicy';
import { BUSINESS_CONFIG } from '../../config/business';
import { BrandMark } from '../common/BrandLogo';
import { useAppInstall } from '../../pwa/useAppInstall';
import { openOverlayCount, subscribeOverlays } from '../../utils/overlayStack';
import {
  calmPage, channelInviteAllowed, claimInvitation, engaged, inlineOfferInView, inlineOfferVisible, invitationOnScreen,
  invitationPlan, noteActive, noteDismissal, noteNotificationsYield, notePurchase, notificationRestEnds, notificationsLead, noteView,
  NOTIFICATION_TIMING, readChannelInvite, readSeen, readSession, recordChannelFollowing, recordChannelLater,
  recordChannelOpened, releaseInvitation, sessionAllows, subscribeInvitations, type InvitationKind,
} from '../../pwa/invitations';
import { trackGrowth } from '../../utils/growthAnalytics';
import { GROWTH_PAGES, type GrowthPage } from '../../../shared/growthAnalytics';
import { isCoarsePointer, isInstalledApp } from '../../pwa/appEnvironment';
import { AppleInstallSteps } from './InstallAppPromo';
import { appBusy, isFormEntry } from './invitationBusy';
import './pwa.css';

type Outcome = 'dismissed' | 'acted' | 'ignored';
type NotificationStage = 'invite' | 'working' | 'result';
const ACTIVE_TICK_MS = 5_000;
/** If the page's `load` never fires (a hung third-party request), stop waiting for it after this long. */
const LOAD_FALLBACK_MS = 10_000;
const growthPage = (page: string): GrowthPage => (GROWTH_PAGES.includes(page as GrowthPage) ? page as GrowthPage : 'home');

const ANNOUNCEMENTS: Record<InvitationKind, string> = {
  install: 'Suggestion: install Mystery Hub. Find it at the end of the page.',
  // It leaves by itself after a few seconds, so the note also names the entry that is always there.
  notifications: 'Suggestion: turn on Mystery Hub notifications, at the end of the page for a few seconds. Notifications in the footer is always there.',
  channel: 'Suggestion: follow the Mystery Hub WhatsApp Channel. Find it at the end of the page.',
};

/** Whether the page is still loading its first resources, or the tab is in the background, or a field has focus. */
function usePageState() {
  const [loaded, setLoaded] = useState(() => typeof document === 'undefined' || document.readyState === 'complete');
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [typing, setTyping] = useState(() => typeof document !== 'undefined' && isFormEntry(document.activeElement as HTMLElement | null));
  useEffect(() => {
    if (loaded) return;
    const done = () => setLoaded(true);
    window.addEventListener('load', done, { once: true });
    const fallback = window.setTimeout(done, LOAD_FALLBACK_MS);
    return () => { window.removeEventListener('load', done); window.clearTimeout(fallback); };
  }, [loaded]);
  useEffect(() => {
    const visibility = () => setTabVisible(document.visibilityState !== 'hidden');
    const focusIn = (event: FocusEvent) => setTyping(isFormEntry(event.target as HTMLElement | null));
    const focusOut = (event: FocusEvent) => setTyping(isFormEntry(event.relatedTarget as HTMLElement | null));
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
    };
  }, []);
  return { loaded, tabVisible, typing };
}

/**
 * Mystery Hub's own suggestions (install the app, allow notifications, follow the WhatsApp Channel), coordinated by
 * pwa/invitations: one small card at a time, on a calm page, at most once per visit. It is never a blocking layer: no
 * focus is taken, Escape and "Not now" close it, and it steps aside for any dialog, a page change, typing in a form,
 * an in-page install card coming into view or a long scroll, so it never becomes a permanent strip on a small phone.
 *
 * Notification onboarding V2: the notification card leads whenever this device can register and is not registered
 * yet, about five seconds after a calm page settles (no engagement needed). It takes turns with Install and the
 * Channel (pwa/invitations `notificationsLead`), and leaves by itself if untouched (an "ignored" showing, not a "no").
 * A verified purchase is still the member's best moment, so it always leads then.
 */
export const InvitationLayer: React.FC = () => {
  const app = useApp();
  const { activePage, isAuthChecking, isStatusModalOpen, activeOrder, user, sessionToken } = app;
  const overlays = useSyncExternalStore(subscribeOverlays, openOverlayCount, () => 0);
  const slot = useSyncExternalStore(subscribeInvitations, invitationOnScreen, () => null);
  const inlineOffer = useSyncExternalStore(subscribeInvitations, inlineOfferVisible, () => false);
  const inlineInView = useSyncExternalStore(subscribeInvitations, inlineOfferInView, () => false);
  const installState = useAppInstall();
  const [installedApp] = useState(() => isInstalledApp());
  const { loaded, tabVisible, typing } = usePageState();
  const [shown, setShown] = useState<{ kind: InvitationKind; page: string } | null>(null);
  const shownRef = useRef<InvitationKind | null>(null);
  const [tick, setTick] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const cardRef = useRef<HTMLElement | null>(null);
  // The notification card's stage: while it is working (the browser's question, then registration) only another
  // account takes it away, so a permission request or a registration is never cut off halfway.
  const [stage, setStage] = useState<NotificationStage>('invite');
  // Never over any overlay on the shared stack (dialogs, sheets, the phone menu), nor over the app's own busy states.
  const busy = overlays > 0 || isAuthChecking || appBusy(app);

  // Engagement (Install and Channel only): pages viewed in this visit, and visible time after the first tap, key or scroll.
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
    // Someone who answered from the keyboard keeps their place on the page rather than landing on <body>. Automatic
    // closes (a dialog, a page change, a long scroll, the notification card leaving by itself) leave focus alone.
    if (outcome !== 'ignored' && cardRef.current?.contains(document.activeElement)) document.getElementById('main-content')?.focus({ preventScroll: true });
    shownRef.current = null;
    setStage('invite');
    setShown(null);
    setAnnouncement('');
    if (kind) releaseInvitation(kind);
    if (outcome === 'dismissed') noteDismissal();
  }, []);

  // Notifications: assessed once per account (or guest) per page life, read-only, once the auth check has answered
  // and a calm page is open. Assessed again only if the browser permission changed meanwhile.
  const [notifyInvite, setNotifyInvite] = useState<NotificationOpportunity | null>(null);
  // The order of suggestions is decided only once this read-only check has answered (or failed), so a quick
  // Channel card never takes the visit's one slot from a notification invitation that was still being checked.
  const [notifyAssessed, setNotifyAssessed] = useState<string | null>(null);
  // Allowed (or blocked) from another place on this page since the assessment: never offered again here.
  const [notifyDone, setNotifyDone] = useState(false);
  const [reassess, setReassess] = useState(0);
  const assessment = useRef<{ key: string; controller: AbortController } | null>(null);
  const lookAgain = useRef<number | null>(null);
  const accountKey = sessionToken && user ? `member:${user.id}:${sessionToken}` : 'guest';
  const onCalmPage = calmPage(activePage, typeof window === 'undefined' ? '' : window.location.search);
  useEffect(() => onNotificationChoice(() => setNotifyDone(true)), []);
  useEffect(() => {
    if (isAuthChecking || !onCalmPage) return;
    if (assessment.current?.key === accountKey) return;
    assessment.current?.controller.abort();
    const controller = new AbortController();
    assessment.current = { key: accountKey, controller };
    setNotifyInvite(null);
    setNotifyDone(false);
    const key = accountKey;
    // Nothing to ask the server when the card cannot appear now anyway: already shown or answered in this visit, or
    // resting (snoozed, the 12-hour rest, the half-hour gap). The other suggestions are not held up, and no request is
    // made on every page load. A rest that ends while the page is open is looked at again at that moment.
    if (lookAgain.current !== null) { window.clearTimeout(lookAgain.current); lookAgain.current = null; }
    const snooze = readSnooze(STORAGE_KEYS.notificationOptIn), at = Date.now(), visit = readSession();
    if (visit.shown || visit.dismissed) { setNotifyAssessed(key); return; }
    const restEnds = Math.max(notificationSnoozeEnds(snooze, at) ?? 0, notificationRestEnds(readSeen(), at, { installedApp }) ?? 0);
    if (restEnds > at || !sessionAllows('notifications', visit, readSeen(), at, { installedApp })) {
      setNotifyAssessed(key);
      if (restEnds > at) lookAgain.current = window.setTimeout(() => { lookAgain.current = null; assessment.current = null; setReassess(n => n + 1); }, Math.min(restEnds - at + 1_000, 2_147_000_000));
      return;
    }
    void notificationInviteOpportunity(httpCustomerNotificationsClient, httpGuestNotificationsClient, {
      token: sessionToken || null, accountId: user?.id, isCustomer: user ? user.role === 'customer' : undefined,
      signal: controller.signal, snooze, now: at,
    }).then(invite => { if (!controller.signal.aborted) { setNotifyInvite(invite); setNotifyAssessed(key); } },
      () => { if (!controller.signal.aborted) setNotifyAssessed(key); });
  }, [accountKey, isAuthChecking, onCalmPage, reassess]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { assessment.current?.controller.abort(); if (lookAgain.current !== null) window.clearTimeout(lookAgain.current); }, []);

  // What may appear here, in which order and after how long (pure rules in pwa/invitations).
  const installOffer = installState.mode !== 'hidden' && installState.progress === 'idle';
  const session = readSession(), seen = readSeen(), now = Date.now();
  const assessed = notifyAssessed === accountKey;
  const installAllowed = installOffer && sessionAllows('install', session, seen, now);
  const channelAllowed = channelInviteAllowed(readChannelInvite(), now) && sessionAllows('channel', session, seen, now);
  const memberPurchase = session.purchase && notifyInvite?.audience === 'member';
  const plan = assessed ? invitationPlan({
    // The snooze is read again here: "Not now" given elsewhere (the Notification Center, another tab) counts at once.
    notifications: Boolean(notifyInvite) && !notifyDone && !notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn), now) && sessionAllows('notifications', session, seen, now, { installedApp }),
    // An in-page install card is that page's suggestion: the floating Install and Channel cards stay off its page.
    install: installAllowed && !inlineOffer, channel: channelAllowed && !inlineOffer,
    othersWaiting: installAllowed || channelAllowed,
    engaged: engaged(session), lead: memberPurchase || notificationsLead(session, seen, now),
  }) : null;
  const planKey = plan ? `${plan.order.join(',')}|${plan.delayMs}` : '';
  const planRef = useRef(plan), notifyRef = useRef(notifyInvite);
  planRef.current = plan;
  notifyRef.current = notifyInvite;
  // On the others' turn, remember it, so the next visit goes back to notifications even if neither appears.
  useEffect(() => { if (plan?.yieldTurn) noteNotificationsYield(); }, [plan?.yieldTurn]);

  // The settle clock starts when this page becomes calm and is not restarted by unrelated re-renders: only by the
  // page changing or something interrupting the calm (a dialog, typing, a hidden tab, an in-page card in view).
  const calm = !shown && !slot && !busy && !typing && tabVisible && loaded && !inlineInView && onCalmPage;
  const [calmSince, setCalmSince] = useState<number | null>(null);
  useEffect(() => { setCalmSince(calm ? Date.now() : null); }, [calm, activePage]);
  useEffect(() => {
    if (calmSince === null || !plan?.order.length) return;
    const timer = window.setTimeout(() => {
      const latest = planRef.current, invite = notifyRef.current;
      if (!latest?.order.length) return;
      // The browser permission changed since the assessment (allowed or blocked in another tab or in settings):
      // assess again rather than offer something out of date.
      if (latest.order.includes('notifications') && invite && notificationPermissionState() !== invite.permission) {
        assessment.current = null;
        setNotifyAssessed(null);
        setReassess(n => n + 1);
        return;
      }
      const order = latest.order.filter(kind => kind !== 'notifications' || !notificationInviteResting(readSnooze(STORAGE_KEYS.notificationOptIn), Date.now()));
      const kind = claimInvitation(order, Date.now(), { installedApp });
      if (!kind) return;
      shownRef.current = kind;
      setShown({ kind, page: activePage });
      // A short, polite note for screen readers; the card itself is a labelled landmark at the end of the page.
      setAnnouncement(ANNOUNCEMENTS[kind]);
    }, Math.max(0, calmSince + plan.delayMs - Date.now()));
    return () => window.clearTimeout(timer);
  }, [calmSince, planKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Another account (or signing out) never inherits a notification card prepared for the previous one.
  useEffect(() => { if (shown?.kind === 'notifications') close('ignored'); }, [accountKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step aside for any dialog, sheet or menu, typing in a form, an in-page install card coming into view, and when
  // the visitor moves to another page: shown once is enough. Never while the notification card is working.
  useEffect(() => {
    if (shown && stage !== 'working' && (busy || typing || inlineInView || activePage !== shown.page)) close('ignored');
  }, [shown, stage, busy, typing, inlineInView, activePage, close]);
  // A long scroll past it means "not interested": it leaves rather than riding along at the bottom of the screen.
  useEffect(() => {
    if (!shown || stage === 'working') return;
    const start = window.scrollY;
    const onScroll = () => { if (Math.abs(window.scrollY - start) > window.innerHeight * 1.5) close('ignored'); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shown, stage, close]);
  useEffect(() => () => { if (shownRef.current) releaseInvitation(shownRef.current); }, []);
  void tick; // engagement and purchase changes re-render this layer so the plan above is recomputed

  return <>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {shown?.kind === 'install' && <InstallInvitation cardRef={cardRef} page={growthPage(shown.page)} state={installState} onClose={close} />}
    {shown?.kind === 'notifications' && notifyInvite && <NotificationInvitation key={accountKey} cardRef={cardRef} onStage={setStage} invite={notifyInvite} token={sessionToken || null} onClose={close} />}
    {shown?.kind === 'channel' && <ChannelInvitation cardRef={cardRef} onClose={close} />}
  </>;
};

/** The close button acts like the card's own "Not now" / "Maybe later" (it snoozes), under a distinct name. */
function InvitationCard({ cardRef, titleId, icon, title, text, closeLabel, onClose, status = false, leaving = false, children }: {
  cardRef: React.RefObject<HTMLElement | null>; titleId: string; icon: React.ReactNode; title: React.ReactNode; text: string; closeLabel: string;
  onClose: () => void; status?: boolean; leaving?: boolean; children: React.ReactNode;
}) {
  return <aside ref={cardRef} aria-labelledby={titleId} role={status ? 'status' : undefined} className={leaving ? 'mh-invite mh-invite-leaving' : 'mh-invite'}
    style={leaving ? { animationDuration: `${NOTIFICATION_TIMING.exitMs}ms` } : undefined}
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

/**
 * One first-party invitation, then the browser's own permission request, then server registration with the consent
 * the copy names, then one state for what really happened. "On" appears only after the server confirms the device.
 *
 * Left untouched, the invitation leaves by itself after about 12 seconds (pwa/autoHide): an "ignored" showing, with
 * no snooze and no strike, that may come back on a later visit. Hover, focus inside, a hidden tab or any tap on the
 * card hold it; after Allow it never leaves by itself (working, blocked, error and success all wait for the person).
 */
function NotificationInvitation({ cardRef, onStage, invite, token, onClose }: {
  cardRef: React.RefObject<HTMLElement | null>; onStage: (stage: NotificationStage) => void; invite: NotificationOpportunity; token: string | null; onClose: (outcome: Outcome) => void;
}) {
  const titleId = useId();
  const [step, setStep] = useState<'invite' | 'working' | 'registered' | 'denied' | 'error'>('invite');
  useEffect(() => { onStage(step === 'invite' || step === 'working' ? step : 'result'); }, [step, onStage]);
  const [offersOff, setOffersOff] = useState<'no' | 'saving' | 'off' | 'failed'>('no');
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const dropOffers = async () => {
    if (!token || offersOff === 'saving') return;
    setOffersOff('saving');
    const saved = await httpCustomerNotificationsClient.savePreferences(token, { transactional: true, promotional: false, expectedVersion: '', source: 'notification_invitation' }).catch(() => ({ ok: false as const, message: '' }));
    if (!request.current?.signal.aborted) setOffersOff(saved.ok && !saved.value.promotional ? 'off' : 'failed');
  };
  const request = useRef<AbortController | null>(null);
  useEffect(() => { request.current = new AbortController(); return () => { request.current?.abort(); if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current); }; }, []);

  // The untouched invitation leaves gently (at once with reduced motion), without moving focus anywhere.
  useEffect(() => {
    const card = cardRef.current;
    if (step !== 'invite' || !card) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const auto = createAutoHide(() => {
      if (reduced) { onClose('ignored'); return; }
      setLeaving(true);
      leaveTimer.current = window.setTimeout(() => { leaveTimer.current = null; onClose('ignored'); }, NOTIFICATION_TIMING.exitMs);
    }, windowClock);
    const enter = (event: PointerEvent) => { if (event.pointerType !== 'touch') auto.hold('hover'); };
    const leave = (event: PointerEvent) => { if (event.pointerType !== 'touch') auto.release('hover'); };
    // Reaching the card during its exit keeps it: whatever was pressed still works, and nothing underneath gets it.
    const cancelExit = () => { if (leaveTimer.current !== null) { window.clearTimeout(leaveTimer.current); leaveTimer.current = null; setLeaving(false); } };
    const down = () => { auto.hold('interacted'); cancelExit(); };
    // Keyboard users may need longer than 12 seconds to reach the end of the page: once they move by keyboard, the card
    // waits until focus has been inside it and left again.
    let visited = false;
    const keydown = (event: KeyboardEvent) => { if (!visited && (event.key === 'Tab' || event.key === 'F6')) auto.hold('keyboard'); };
    const focusIn = () => { auto.hold('focus'); cancelExit(); };
    const focusOut = (event: FocusEvent) => { if (card.contains(event.relatedTarget as Node | null)) return; visited = true; auto.release('focus'); auto.release('keyboard'); };
    const visibility = () => { if (document.visibilityState === 'hidden') auto.hold('hidden'); else auto.release('hidden'); };
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    card.addEventListener('pointerdown', down);
    card.addEventListener('click', cancelExit);
    card.addEventListener('focusin', focusIn);
    document.addEventListener('keydown', keydown);
    card.addEventListener('focusout', focusOut);
    document.addEventListener('visibilitychange', visibility);
    if (card.contains(document.activeElement)) auto.hold('focus');
    if (card.matches(':hover')) auto.hold('hover');
    visibility();
    auto.start();
    return () => {
      auto.stop();
      cancelExit();
      document.removeEventListener('keydown', keydown);
      card.removeEventListener('click', cancelExit);
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
      card.removeEventListener('pointerdown', down);
      card.removeEventListener('focusin', focusIn);
      card.removeEventListener('focusout', focusOut);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [step, cardRef, onClose]);

  // "Not now" (or closing) rests it three days, every time; there is no permanent "no". The browser's "Block" is final.
  const notNow = () => { if (step === 'working') return; recordDismissal(STORAGE_KEYS.notificationOptIn); onClose('dismissed'); };
  // Someone who pressed Allow from the keyboard keeps their place: focus moves to the result's first button.
  const focusResult = useRef(false);
  useEffect(() => {
    if (step === 'invite' || step === 'working' || !focusResult.current) return;
    focusResult.current = false;
    // Only if focus was not taken elsewhere meanwhile (someone typing in a search box keeps their place).
    const active = document.activeElement;
    if (active && active !== document.body && !cardRef.current?.contains(active)) return;
    cardRef.current?.querySelector<HTMLElement>('.mh-invite-actions button')?.focus({ preventScroll: true });
  }, [step, cardRef]);
  const allow = async () => {
    const signal = request.current?.signal;
    if (step === 'working' || !signal || signal.aborted) return;
    focusResult.current = Boolean(cardRef.current?.contains(document.activeElement));
    setStep('working');
    try {
      const result = await activateNotificationInvite(httpCustomerNotificationsClient, httpGuestNotificationsClient, invite, { token, signal });
      if (signal.aborted) return;
      if (result.step === 'dismissed') { recordDismissal(STORAGE_KEYS.notificationOptIn); onClose('dismissed'); }
      else setStep(result.step);
    } catch { if (!signal.aborted) setStep('error'); }
  };
  if (step === 'registered' || step === 'denied' || step === 'error') {
    const copy = NOTIFICATION_RESULT[step];
    const done = () => onClose(step === 'registered' ? 'acted' : 'dismissed');
    // Right where the choice was made, offers can be dropped in one tap (order updates stay on).
    const ordersOnly = step === 'registered' && invite.audience === 'member' && invite.offers && token;
    return <InvitationCard cardRef={cardRef} titleId={titleId} status icon={step === 'registered' ? <CheckCircle2 className="size-6 text-emerald-300" /> : <BellOff className="size-6 text-slate-300" />}
      title={copy.title} text={offersOff === 'off' ? `${copy.text} Offers are off.` : copy.text} closeLabel="Close" onClose={done}>
      {step === 'error' && <button type="button" className="mh-button" onClick={() => { void allow(); }}>Try again</button>}
      <button type="button" className={step === 'error' ? 'mh-invite-later' : 'mh-button'} onClick={done}>{step === 'error' ? 'Close' : 'Done'}</button>
      {ordersOnly && offersOff !== 'off' && <button type="button" className="mh-invite-later" disabled={offersOff === 'saving'} onClick={() => { void dropOffers(); }}>{offersOff === 'saving' ? 'Saving…' : NOTIFICATION_ACTIONS.ordersOnly}</button>}
      {step === 'registered' && invite.paused && <p className="mh-invite-note mh-invite-paused">{PAUSED_INVITE_NOTE}</p>}
      {offersOff === 'failed' && <p className="mh-invite-note" role="alert">That didn’t save. You can turn offers off in My Account.</p>}
    </InvitationCard>;
  }
  const copy = notificationCopy(invite);
  return <InvitationCard cardRef={cardRef} titleId={titleId} leaving={leaving} icon={<BellRing className="size-6 text-[#44df95]" />} title={copy.title} text={copy.text} closeLabel="Close" onClose={notNow}>
    <button type="button" className="mh-button" disabled={step === 'working'} aria-busy={step === 'working' || undefined} onClick={() => { void allow(); }}>{step === 'working' ? 'Allowing…' : NOTIFICATION_ACTIONS.allow}</button>
    <button type="button" className="mh-invite-later" disabled={step === 'working'} onClick={notNow}>{NOTIFICATION_ACTIONS.later}</button>
    {invite.paused && <p className="mh-invite-note mh-invite-paused">{PAUSED_INVITE_NOTE}</p>}
    <p className="mh-invite-note">{notificationNote(invite)}</p>
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
