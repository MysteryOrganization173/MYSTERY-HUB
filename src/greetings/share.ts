import { OCCASION_COPY, type Occasion } from './model';

/**
 * Sharing is the creator's own choice: nothing opens WhatsApp or a share sheet without a tap, and nothing claims a
 * greeting was sent or delivered. The teaser never contains the message, the names or any secret; only the link.
 */
export const shareText = (occasion: Occasion) => OCCASION_COPY[occasion].teaser;
export const whatsappHref = (occasion: Occasion, url: string) => `https://wa.me/?text=${encodeURIComponent(`${shareText(occasion)} ${url}`)}`;

export type CopyResult = 'copied' | 'blocked';
/** Clipboard API first, then the legacy copy command on a temporary field; 'blocked' if neither is allowed. */
export async function copyLink(url: string, doc: Document = document, nav: Navigator = navigator): Promise<CopyResult> {
  try { if (nav.clipboard?.writeText) { await nav.clipboard.writeText(url); return 'copied'; } } catch { /* denied: try the fallback */ }
  try {
    const field = doc.createElement('textarea');
    field.value = url; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0'; field.style.top = '0';
    doc.body.appendChild(field); field.select(); field.setSelectionRange(0, url.length);
    const ok = doc.execCommand?.('copy') === true;
    field.remove();
    return ok ? 'copied' : 'blocked';
  } catch { return 'blocked'; }
}

export const canShareNatively = (nav: Navigator = navigator, url = 'https://mysterybundlehub.com/') => {
  try { return typeof nav.share === 'function' && (typeof nav.canShare !== 'function' || nav.canShare({ url })); } catch { return false; }
};
export type ShareResult = 'opened' | 'cancelled' | 'unsupported';
/** Must be called directly from a tap. 'opened' only means the share sheet was used, never that anything was sent. */
export async function shareNatively(occasion: Occasion, url: string, nav: Navigator = navigator): Promise<ShareResult> {
  if (!canShareNatively(nav, url)) return 'unsupported';
  try { await nav.share({ title: 'Mystery Greetings', text: shareText(occasion), url }); return 'opened'; }
  catch (error) { return (error as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'unsupported'; }
}
