/**
 * The festive serif (Fraunces italic), requested only when seasonal code loads.
 *
 * 3.7 closeout (founder-approved investigation, docs/mystery-hub-3-7-closeout.md): seasonal pages and Greetings use
 * Fraunces fixed at optical size 72, both weights: 45.2 KB instead of 81.7 KB for the latin file. Their serif text is
 * set from 10 px to 75 px; at headline sizes (the seasonal hero, which is the page's LCP) the fixed cut is almost the
 * same as the automatic one, and smaller text is about 7–8 % narrower with finer hairlines, in the same character.
 * The Countdown keeps the full optical-size range: its numerals are drawn at up to 240 px, where the automatic
 * high-contrast display cut (opsz 144) is part of the approved Midnight Dial.
 */
export const SEASONAL_SERIF_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,72,500;1,72,600&display=swap';
export const COUNTDOWN_SERIF_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&display=swap';
/** Adds the serif's stylesheet once (3.7.3: the page's first script may already have added it, see startupHints.ts). */
export function loadSeasonalSerif(href: string = SEASONAL_SERIF_HREF) {
  if (typeof document === 'undefined' || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
}
