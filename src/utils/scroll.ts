/**
 * Mobile-friendly smooth scroll utility with accessibility respect
 * Automatically uses instant scroll if prefers-reduced-motion is requested.
 */

export function smoothScrollToElement(
  element: HTMLElement | null,
  options: {
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
    behavior?: ScrollBehavior;
  } = {}
): void {
  if (!element || typeof window === 'undefined') return;

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  element.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : options.behavior || 'smooth',
    block: options.block || 'start',
    inline: options.inline || 'nearest',
  });
}
