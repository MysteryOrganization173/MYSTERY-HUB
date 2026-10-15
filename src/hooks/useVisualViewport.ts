import { useEffect, useState } from 'react';

/** Visible area above an on-screen keyboard, so bottom sheets keep their action in view on Android. */
export function useVisualViewport(active: boolean) {
  const read = () => typeof window === 'undefined' ? { height: 0, top: 0 }
    : { height: window.visualViewport?.height || window.innerHeight, top: window.visualViewport?.offsetTop || 0 };
  const [box, setBox] = useState(read);
  useEffect(() => {
    if (!active) return;
    const update = () => setBox(read());
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return box;
}
