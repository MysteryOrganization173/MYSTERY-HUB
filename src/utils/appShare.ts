import { BUSINESS_CONFIG } from '../config/business';

/** The one public link for the app. Never carries a referral code, account detail or anything about the sender. */
export const APP_SHARE_URL = `https://${BUSINESS_CONFIG.domain}/app`;
export const APP_SHARE_TITLE = 'Mystery Hub';
export const APP_SHARE_TEXT = 'I use Mystery Hub for data, airtime and more. You can put it on your phone for free, no app store needed:';

export type AppShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Native share sheet where the browser has one, otherwise the link is copied. Only ever called from a tap. */
export async function shareApp(
  share?: (data: ShareData) => Promise<void>,
  clipboard?: Pick<Clipboard, 'writeText'>,
): Promise<AppShareOutcome> {
  if (share) {
    try {
      await share({ title: APP_SHARE_TITLE, text: APP_SHARE_TEXT, url: APP_SHARE_URL });
      return 'shared';
    } catch (error) {
      // Closing the share sheet is a choice, not a failure: no toast, no clipboard write.
      if ((error as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  if (!clipboard?.writeText) return 'failed';
  try { await clipboard.writeText(APP_SHARE_URL); return 'copied'; } catch { return 'failed'; }
}

/** Copy only, for the landing page's "copy the link and open it in Chrome" step. */
export async function copyAppLink(clipboard?: Pick<Clipboard, 'writeText'>): Promise<boolean> {
  if (!clipboard?.writeText) return false;
  try { await clipboard.writeText(APP_SHARE_URL); return true; } catch { return false; }
}
