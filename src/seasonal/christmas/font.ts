/** The festive serif (Fraunces italic, also used by Creative Studio), requested only when seasonal code loads. */
const SERIF_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&display=swap';
export function loadSeasonalSerif() {
  if (typeof document === 'undefined' || document.querySelector(`link[href="${SERIF_HREF}"]`)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = SERIF_HREF; document.head.appendChild(link);
}
