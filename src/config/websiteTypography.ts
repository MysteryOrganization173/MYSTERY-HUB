import type {WebsiteTemplate} from '../types/index.js';

/**
 * Display typefaces that give each industry design its own voice. Body text keeps the platform's
 * Plus Jakarta Sans, so a design downloads at most one extra family (two weights, latin subset,
 * `display=swap`). Fallback stacks keep the same character while the font loads or on a slow network.
 * Custom-section websites and designs with a deliberate identity of their own (construction's heavy
 * capitals, portfolio and agency monospace) keep the platform typography.
 */
export type WebsiteTypePreset = 'editorial' | 'couture' | 'grotesk' | 'humanist';

export const WEBSITE_TYPEFACES: Record<WebsiteTypePreset, {family: string; stack: string; query: string; headingWeight?: number}> = {
  editorial: {family: 'Fraunces', stack: "'Fraunces', Georgia, 'Noto Serif', serif", query: 'Fraunces:opsz,wght@9..144,500;9..144,700'},
  couture: {family: 'Cormorant Garamond', stack: "'Cormorant Garamond', 'Times New Roman', 'Noto Serif', serif", query: 'Cormorant+Garamond:wght@500;700', headingWeight: 700},
  grotesk: {family: 'Space Grotesk', stack: "'Space Grotesk', 'Outfit', system-ui, sans-serif", query: 'Space+Grotesk:wght@500;700'},
  humanist: {family: 'Manrope', stack: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif", query: 'Manrope:wght@600;800'},
};

const BY_LAYOUT: Record<string, WebsiteTypePreset> = {
  restaurant: 'editorial', church: 'editorial', nightkitchen: 'editorial', boutique: 'couture',
  salon: 'couture', beauty: 'couture', hotel: 'couture', fashion: 'couture',
  reseller: 'grotesk', ecommerce: 'grotesk', retail: 'grotesk',
  education: 'humanist', services: 'humanist', realestate: 'humanist',
};

export function websiteTypePreset(t: Pick<WebsiteTemplate, 'layoutType' | 'category' | 'composition'>): WebsiteTypePreset | null {
  if (t.composition) return null;
  return BY_LAYOUT[String(t.layoutType || t.category || '').toLowerCase()] || null;
}

export const websiteTypefaceHref = (preset: WebsiteTypePreset) =>
  `https://fonts.googleapis.com/css2?family=${WEBSITE_TYPEFACES[preset].query}&display=swap`;

/** Scoped to one rendered website: headings and the design's serif accents use the display face. */
export function websiteTypefaceCss(preset: WebsiteTypePreset): string {
  const face = WEBSITE_TYPEFACES[preset];
  const weight = face.headingWeight ? `font-weight:${face.headingWeight};` : '';
  return `.website-type-${preset} :is(h1,h2,h3,h4,.font-serif,.site-display){font-family:${face.stack};${weight}}`
    + `.website-type-${preset} :is(h1,h2){letter-spacing:-.015em}`;
}
