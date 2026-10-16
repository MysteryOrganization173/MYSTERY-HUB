import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Brief confirmation that a purchase tap registered: a CSS pulse while the next screen opens and
 * a very short vibration on Android when the customer has not asked for reduced motion.
 */
export function useTapFeedback(duration = 420) {
  const [tapped, setTapped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = useCallback(() => {
    setTapped(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTapped(false), duration);
    try {
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(8);
    } catch { /* vibration is optional */ }
  }, [duration]);
  return [tapped, trigger] as const;
}
