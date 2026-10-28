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

/**
 * Ref callback for a horizontally scrolling chip row: when the row mounts (for example after search closes), the
 * selected chip is brought inside the row. One measurement on mount; no scroll listeners.
 */
export function revealPressedChip(row: HTMLElement | null): void {
  const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!row || !chip) return;
  const end = chip.offsetLeft - row.offsetLeft + chip.offsetWidth;
  if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth + 24;
}

/**
 * onFocus for a chip row. Chrome leaves a half-visible chip where it is when it takes keyboard focus, so the row
 * brings the focused chip fully into view itself (React focus events bubble, so one handler covers the row).
 */
export function revealFocusedChip(event: { target: EventTarget | null; currentTarget: HTMLElement }): void {
  const chip = event.target as HTMLElement | null;
  if (!chip || chip === event.currentTarget || typeof chip.scrollIntoView !== 'function') return;
  chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
