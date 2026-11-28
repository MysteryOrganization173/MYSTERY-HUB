import { BUSINESS_CONFIG } from '../config/business';
import { canShareNatively, copyLink, type CopyResult, type ShareResult } from '../greetings/share';

/**
 * Sharing the countdown: the one canonical link, never with anything personal or any tracking identifier in it.
 * Nothing opens a share sheet or WhatsApp without a tap, and nothing claims that anything was sent.
 */
export const COUNTDOWN_PATH = '/countdown';
export const COUNTDOWN_URL = `https://${BUSINESS_CONFIG.domain}${COUNTDOWN_PATH}`;

export const countdownShareText = (after: boolean) => after
  ? 'Happy New Year! 2027 has arrived in Accra. Afehyia pa!'
  : 'Counting down to 2027 with Mystery Hub. Join me for midnight in Accra:';

export const countdownWhatsappHref = (after: boolean, url = COUNTDOWN_URL) => `https://wa.me/?text=${encodeURIComponent(`${countdownShareText(after)} ${url}`)}`;

/** Must be called directly from a tap. 'opened' only means the share sheet was used, never that anything was sent. */
export async function shareCountdown(after: boolean, nav: Navigator = navigator, url = COUNTDOWN_URL): Promise<ShareResult> {
  if (!canShareNatively(nav, url)) return 'unsupported';
  try { await nav.share({ title: after ? 'Welcome 2027 · Mystery Hub' : 'Countdown to 2027 · Mystery Hub', text: countdownShareText(after), url }); return 'opened'; }
  catch (error) { return (error as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'unsupported'; }
}

export const copyCountdownLink = (doc: Document = document, nav: Navigator = navigator): Promise<CopyResult> => copyLink(COUNTDOWN_URL, doc, nav);
export { canShareNatively };
