/**
 * Installable app: what the /app landing page offers on this device. Pure, so every branch is testable.
 *
 * The install card on Home stays quiet unless installing works here. The landing page is different: people arrive
 * on purpose (usually from a WhatsApp link), so it always explains the next step, including when this browser
 * cannot install at all (for example WhatsApp's or Facebook's in-app browser).
 */
export type AppLandingState =
  | 'installed'  // Opened from the home screen: nothing to install.
  | 'prompt'     // Chromium offered its install dialog: one button.
  | 'apple'      // iPhone/iPad: Share → Add to Home Screen.
  | 'in-app'     // An app's built-in browser (WhatsApp, Facebook, Instagram…): open the link in a real browser first.
  | 'android'    // Android browser without an install dialog: browser menu → Install app / Add to Home screen.
  | 'desktop'    // Computer without an install dialog.
  | 'checking';  // The first moments, before Chromium has had time to offer its dialog.

/** Android WebViews mark themselves with "; wv)". The rest are the in-app browsers that also say who they are. */
const IN_APP_BROWSER = /; wv\)|\bFBAN\b|\bFBAV\b|\bFB_IAB\b|\bFBIOS\b|Instagram|WhatsApp|\bLine\/|Snapchat|musical_ly|BytedanceWebview|TikTok|\bTwitter\b/i;

export const isInAppBrowser = (userAgent = '') => IN_APP_BROWSER.test(userAgent);
export const isAndroid = (userAgent = '') => /Android/i.test(userAgent);

/** Long enough for Chromium to fire beforeinstallprompt on a slow phone, short enough to never feel like waiting. */
export const INSTALL_CHECK_MS = 1500;

export function appLandingState({ installed, hasPrompt, apple, userAgent, checked }: {
  installed: boolean; hasPrompt: boolean; apple: boolean; userAgent: string; checked: boolean;
}): AppLandingState {
  if (installed) return 'installed';
  if (hasPrompt) return 'prompt';
  // In-app browsers cannot install a web app on either platform, whatever else they report.
  if (isInAppBrowser(userAgent)) return 'in-app';
  if (apple) return 'apple';
  if (!checked) return 'checking';
  return isAndroid(userAgent) ? 'android' : 'desktop';
}
