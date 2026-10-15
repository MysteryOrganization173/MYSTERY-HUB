import React from 'react';

/**
 * One way to show cedis across Data, Instant, Airtime and AFA: a quiet currency mark, the whole
 * amount at full weight and smaller pesewas, with tabular figures so prices line up in lists.
 * Display only; amounts always come from the catalogue, the quote or the server.
 */
export function splitGhs(ghc: number) {
  const fixed = (Math.round(ghc * 100) / 100).toFixed(2);
  const [whole, pesewas] = fixed.split('.');
  return { whole: Number(whole).toLocaleString('en-GH'), pesewas };
}

const SIZES = {
  sm: { box: 'text-sm', mark: 'text-[0.7em]', dec: 'text-[0.78em]' },
  md: { box: 'text-lg', mark: 'text-[0.62em]', dec: 'text-[0.68em]' },
  lg: { box: 'text-2xl', mark: 'text-[0.55em]', dec: 'text-[0.6em]' },
  xl: { box: 'text-3xl sm:text-4xl', mark: 'text-[0.5em]', dec: 'text-[0.55em]' },
} as const;

/** `text` replaces the size's default font size, for responsive steps such as `text-base sm:text-xl`. */
export const Money: React.FC<{ ghc: number; size?: keyof typeof SIZES; text?: string; className?: string; markClassName?: string }> = ({
  ghc, size = 'md', text, className = 'text-white', markClassName = 'text-slate-400',
}) => {
  const { whole, pesewas } = splitGhs(ghc);
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-baseline font-extrabold tabular-nums tracking-tight leading-none whitespace-nowrap ${text || s.box} ${className}`}>
      <span className={`${s.mark} font-semibold mr-[0.12em] ${markClassName}`}>GH₵</span>
      {whole}<span className={`${s.dec} font-bold opacity-80`}>.{pesewas}</span>
    </span>
  );
};
