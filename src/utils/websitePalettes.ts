import { websiteContrast, websiteActionText } from './websiteBrand.js';

export interface WebsitePalette { name: string; backgroundColor: string; primaryColor: string; accentColor: string }
/** Curated starting points. Each passes a 4.5:1 check for its button text and a 3:1 check for the accent on the background. */
export const WEBSITE_PALETTES: readonly WebsitePalette[] = Object.freeze([
  { name: 'Ember night', backgroundColor: '#140d0b', primaryColor: '#1c1310', accentColor: '#e8833a' },
  { name: 'Paper and ink', backgroundColor: '#f4efe7', primaryColor: '#1f1a17', accentColor: '#8a5a3b' },
  { name: 'Signal blue', backgroundColor: '#0a0f1d', primaryColor: '#0f172a', accentColor: '#3b82f6' },
  { name: 'Fresh green', backgroundColor: '#ffffff', primaryColor: '#0f172a', accentColor: '#047857' },
  { name: 'Kente gold', backgroundColor: '#1a1408', primaryColor: '#2a1f0b', accentColor: '#e0a526' },
  { name: 'Berry', backgroundColor: '#fff7fb', primaryColor: '#4a1030', accentColor: '#be185d' },
  { name: 'Ocean', backgroundColor: '#f2f8fb', primaryColor: '#0b3954', accentColor: '#0e7490' },
  { name: 'Charcoal lime', backgroundColor: '#111315', primaryColor: '#1b1f22', accentColor: '#a3e635' },
]);
export const paletteIsReadable = (p: WebsitePalette) => websiteContrast(websiteActionText(p.accentColor), p.accentColor) >= 4.5 && websiteContrast(p.accentColor, p.backgroundColor) >= 3;

