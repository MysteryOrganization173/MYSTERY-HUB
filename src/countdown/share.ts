import { BUSINESS_CONFIG } from '../config/business';
import { canShareNatively, copyLink, type CopyResult, type ShareResult } from '../greetings/share';

/**
 * Sharing the countdown: the one canonical link, never with anything personal or any tracking identifier in it.
 * Nothing opens a share sheet or WhatsApp without a tap, and nothing claims that anything was sent.
 */
export const COUNTDOWN_PATH = '/countdown';
export const COUNTDOWN_URL = `https://${BUSINESS_CONFIG.domain}${COUNTDOWN_PATH}`;

/**
 * 3.7 closeout: the words people forward. Warm and personal (the founder's own wording, lightly refined), with the
 * link on its own line in WhatsApp. Native sharing passes the link separately (the share sheet adds it), so it never
 * appears twice. The link preview's description (utils/socialMetadata.ts countdownHead) says the same thing.
 */
export const COUNTDOWN_SHARE_BEFORE = 'Counting down to 2027 with Mystery Hub! ✨\nAnother year, another chance to make beautiful memories. Let’s welcome 2027 together! 🥂💚';
export const COUNTDOWN_SHARE_AFTER = 'Happy New Year! 🎉\nMay 2027 bring you happiness, peace, new opportunities and countless reasons to smile.\nHere’s to another beautiful year together. Afehyia pa! 💚';
export const countdownShareText = (after: boolean) => after ? COUNTDOWN_SHARE_AFTER : COUNTDOWN_SHARE_BEFORE;

export const countdownWhatsappHref = (after: boolean, url = COUNTDOWN_URL) => `https://wa.me/?text=${encodeURIComponent(`${countdownShareText(after)}\n${url}`)}`;

/** Must be called directly from a tap. 'opened' only means the share sheet was used, never that anything was sent. */
export async function shareCountdown(after: boolean, nav: Navigator = navigator, url = COUNTDOWN_URL): Promise<ShareResult> {
  if (!canShareNatively(nav, url)) return 'unsupported';
  try { await nav.share({ title: after ? 'Welcome 2027 · Mystery Hub' : 'Countdown to 2027 · Mystery Hub', text: countdownShareText(after), url }); return 'opened'; }
  catch (error) { return (error as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'unsupported'; }
}

export const copyCountdownLink = (doc: Document = document, nav: Navigator = navigator): Promise<CopyResult> => copyLink(COUNTDOWN_URL, doc, nav);
export { canShareNatively };
