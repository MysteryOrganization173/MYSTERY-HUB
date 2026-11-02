import { websiteContrast, websiteActionText } from './websiteBrand.js';

/**
 * V7.2: palettes are grouped by mood so a longer library stays quick to scan. A palette sets only the three colours
 * a website already saves (background, main and accent); surfaces, borders and text are derived from them by each
 * design (resolveStoreTheme for Data Stores), which is what keeps every combination readable.
 */
export type WebsitePaletteGroup = 'dark' | 'light' | 'warm' | 'colour';
export interface WebsitePalette { name: string; backgroundColor: string; primaryColor: string; accentColor: string; group?: WebsitePaletteGroup }
export const WEBSITE_PALETTE_GROUPS: ReadonlyArray<{ id: WebsitePaletteGroup; label: string }> = Object.freeze([
  { id: 'dark', label: 'Dark & bold' },
  { id: 'light', label: 'Light & minimal' },
  { id: 'warm', label: 'Warm' },
  { id: 'colour', label: 'Colourful' },
]);
/** Curated starting points. Each passes a 4.5:1 check for its button text and a 3:1 check for the accent on the background. */
export const WEBSITE_PALETTES: readonly WebsitePalette[] = Object.freeze([
  { name: 'Ember night', backgroundColor: '#140d0b', primaryColor: '#1c1310', accentColor: '#e8833a', group: 'warm' },
  { name: 'Paper and ink', backgroundColor: '#f4efe7', primaryColor: '#1f1a17', accentColor: '#8a5a3b', group: 'warm' },
  { name: 'Signal blue', backgroundColor: '#0a0f1d', primaryColor: '#0f172a', accentColor: '#3b82f6', group: 'dark' },
  { name: 'Fresh green', backgroundColor: '#ffffff', primaryColor: '#0f172a', accentColor: '#047857', group: 'light' },
  { name: 'Kente gold', backgroundColor: '#1a1408', primaryColor: '#2a1f0b', accentColor: '#e0a526', group: 'warm' },
  { name: 'Berry', backgroundColor: '#fff7fb', primaryColor: '#4a1030', accentColor: '#be185d', group: 'colour' },
  { name: 'Ocean', backgroundColor: '#f2f8fb', primaryColor: '#0b3954', accentColor: '#0e7490', group: 'light' },
  { name: 'Charcoal lime', backgroundColor: '#111315', primaryColor: '#1b1f22', accentColor: '#a3e635', group: 'dark' },
  // V7.2 library.
  { name: 'Navy and gold', backgroundColor: '#0b1526', primaryColor: '#13213a', accentColor: '#d9a441', group: 'dark' },
  { name: 'Graphite teal', backgroundColor: '#121417', primaryColor: '#1c2024', accentColor: '#2cc6b4', group: 'dark' },
  { name: 'Steel and cyan', backgroundColor: '#0e1922', primaryColor: '#172634', accentColor: '#38c8e8', group: 'dark' },
  { name: 'Charcoal copper', backgroundColor: '#161312', primaryColor: '#211c1a', accentColor: '#d07a43', group: 'dark' },
  { name: 'Ivory and forest', backgroundColor: '#f8f5ec', primaryColor: '#16301f', accentColor: '#1f5a3a', group: 'light' },
  { name: 'Monochrome', backgroundColor: '#f5f4f0', primaryColor: '#111111', accentColor: '#151515', group: 'light' },
  { name: 'Slate and coral', backgroundColor: '#f4f6f8', primaryColor: '#1e293b', accentColor: '#c2412d', group: 'light' },
  { name: 'Burgundy cream', backgroundColor: '#fbf5ec', primaryColor: '#4a1020', accentColor: '#8c1c33', group: 'warm' },
  { name: 'Sandstone olive', backgroundColor: '#f1e9db', primaryColor: '#3b3a24', accentColor: '#556326', group: 'warm' },
  { name: 'Aubergine gold', backgroundColor: '#1d1022', primaryColor: '#2a1631', accentColor: '#d2ab55', group: 'colour' },
  { name: 'Royal indigo', backgroundColor: '#14123a', primaryColor: '#1f1b52', accentColor: '#a7a3ff', group: 'colour' },
  { name: 'Ocean mint', backgroundColor: '#062a3a', primaryColor: '#0a3a4f', accentColor: '#4ade9b', group: 'colour' },
]);
export const paletteIsReadable = (p: WebsitePalette) => websiteContrast(websiteActionText(p.accentColor), p.accentColor) >= 4.5 && websiteContrast(p.accentColor, p.backgroundColor) >= 3;
