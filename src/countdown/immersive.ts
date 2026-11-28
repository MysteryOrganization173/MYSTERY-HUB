/**
 * Optional immersive view: browser full screen where the browser allows it, and a quiet layout everywhere (iPhone
 * Safari has no full screen for pages, so there the layout alone is the immersive view). It is only ever entered from a
 * tap, a refused or cancelled request changes nothing, and Escape, the exit button or the browser's own exit all leave.
 *
 * While immersive, it asks the browser to keep the screen on (Screen Wake Lock), for a phone propped up for midnight.
 * Browsers release that lock by themselves when the page is hidden; it is asked again on return and released on exit.
 */
type FullscreenDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export function fullscreenAvailable(doc: Document = document) {
  const d = doc as FullscreenDocument;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}
export function isFullscreen(doc: Document = document) {
  const d = doc as FullscreenDocument;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}
/** True when the browser actually went full screen; false when unsupported, refused or cancelled. */
export async function requestFullscreen(element: HTMLElement, doc: Document = document): Promise<boolean> {
  if (!fullscreenAvailable(doc)) return false;
  const el = element as FullscreenElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else return false;
    return isFullscreen(doc);
  } catch { return false; }
}
export async function leaveFullscreen(doc: Document = document) {
  const d = doc as FullscreenDocument;
  try {
    if (!isFullscreen(doc)) return;
    if (d.exitFullscreen) await d.exitFullscreen();
    else d.webkitExitFullscreen?.();
  } catch { /* already left */ }
}
export const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange'] as const;

interface Sentinel { release: () => Promise<void>; released?: boolean }
type WakeNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };
/** A held screen wake lock, or null where unsupported or refused (battery saver, permissions policy). */
export async function keepScreenOn(nav: Navigator = navigator): Promise<Sentinel | null> {
  try { return await (nav as WakeNavigator).wakeLock?.request('screen') ?? null; } catch { return null; }
}
