import { useEffect } from 'react';
import { BUSINESS_CONFIG } from '../config/business';
import { loadSeasonalSerif } from '../seasonal/christmas/font';

/** The approved Mystery Hub mark, small and quiet: the greeting is the subject, not the brand. */
export const GREETINGS_MARK = BUSINESS_CONFIG.brandMarkUrl.replace('/upload/', '/upload/f_auto,q_auto,w_64/');

/** Fraunces has no Ɛ ɛ Ɔ ɔ Ɖ ɖ Ƒ Ɣ ɣ Ʋ ʋ Ʒ ʒ. A matching italic serif supplies just those glyphs (Google Fonts text= subset),
 *  so names such as Ɛfua or Ɔsei look like the rest of the line. --mg-serif lists it right after Fraunces. */
export const GHANAIAN_LETTERS = 'ƐɛƆɔƉɖƑƔɣƲʋƷʒ';
const GHANAIAN_SERIF_HREF = `https://fonts.googleapis.com/css2?family=Noto+Serif+Display:ital,wght@1,500;1,600&text=${encodeURIComponent(GHANAIAN_LETTERS)}&display=swap`;
export function useGreetingsFonts() {
  useEffect(() => {
    loadSeasonalSerif();
    if (document.querySelector(`link[href="${GHANAIAN_SERIF_HREF}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = GHANAIAN_SERIF_HREF; document.head.appendChild(link);
  }, []);
}

export function GreetingsTopBar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <header className="mg-topbar">
      <a className="mg-topbar-mark" href="/" onClick={onNavigate} aria-label="Mystery Hub home">
        <img src={GREETINGS_MARK} alt="" width="22" height="15" decoding="async" />
        <span aria-hidden="true">Mystery Greetings</span>
      </a>
    </header>
  );
}

/** Background light for the occasion and design (pure CSS: gradients, a few soft lights and, for Starlight, stars). */
export function GreetingsSky() {
  return <div className="mg-sky" aria-hidden="true"><span className="mg-sky-lights" /><span className="mg-sky-stars" /></div>;
}
