/** The festive serif (Fraunces italic, also used by Creative Studio), requested only when seasonal code loads. */
export const SEASONAL_SERIF_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&display=swap';
/** Adds the serif's stylesheet once (3.7.3: the page's first script may already have added it, see startupHints.ts). */
export function loadSeasonalSerif() {
  if (typeof document === 'undefined' || document.querySelector(`link[href="${SEASONAL_SERIF_HREF}"]`)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = SEASONAL_SERIF_HREF; document.head.appendChild(link);
}
