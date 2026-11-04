/**
 * Data Business hero artwork.
 *
 * Two images, two jobs:
 * - The STARTER is the brand-neutral artwork every new Data Business website begins with. It is
 *   written into the new site's content at creation, so it is an explicit, owner-replaceable value.
 * - The LEGACY artwork is the original QuickByte-themed banner. Before V4 it was also the renderer's
 *   fallback, so any existing site whose saved hero is empty or an older retired placeholder has been
 *   showing it to customers all along. Some owners adopted it as part of their identity.
 *
 * The legacy URL is frozen here on purpose. Changing the starter must never change what an existing
 * owner's site renders, so an owner site never falls back to the starter, only to the legacy banner.
 * Galleries and previews without an owner use the starter.
 */
export const DATA_RESELLER_LEGACY_HERO_IMAGE =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1791053950/ChatGPT_Image_Oct_3_2026_06_58_33_PM_jr9ait.png';

/** Founder-approved brand-neutral starter (1536×1024, no company name, price or merchant logo). */
export const DATA_RESELLER_STARTER_HERO_IMAGE =
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1792354394/Global_Connectivity_Tech_Showcase_w4kgd6.png';

/** Placeholders that earlier versions saved and the renderer always replaced with the legacy banner. */
const RETIRED_PLACEHOLDERS = ['photo-1556742049-0a67e5572293', 'Neon_Data_Bundles_in_Accra'];

/**
 * The hero a Data Business renders.
 * - A saved, non-retired image (an upload, the legacy banner saved explicitly, the new starter) is used as is.
 * - Otherwise an owner's site keeps the legacy banner it has always shown; a gallery demo gets the starter.
 */
export function resolveDataResellerHeroImage(heroImage?: string, owner = false): string {
  const value = typeof heroImage === 'string' ? heroImage.trim() : '';
  if (!value || RETIRED_PLACEHOLDERS.some(marker => value.includes(marker))) {
    return owner ? DATA_RESELLER_LEGACY_HERO_IMAGE : DATA_RESELLER_STARTER_HERO_IMAGE;
  }
  return value;
}

/** True when an owner's site is showing the legacy QuickByte-themed banner, saved or inherited. */
export function showsLegacyDataResellerArtwork(heroImage?: string): boolean {
  return resolveDataResellerHeroImage(heroImage, true) === DATA_RESELLER_LEGACY_HERO_IMAGE;
}

/* ------------------------------------------------------------------------------------------------
 * V7.4: colour-matched default artwork.
 *
 * Twelve colour families, each a Cloudinary transformation of the founder-approved starter
 * (Global_Connectivity_Tech_Showcase_w4kgd6, 1536×1024). Hue shifts keep the composition, the
 * text-free left side and the subject exactly where they are, so every family crops the same way in
 * every style. Blue is the starter itself, untransformed. Every URL here was checked live (HTTP 200).
 *
 * To swap in dedicated artworks later, change one family's `src` here; nothing else needs to move.
 *
 * Automatic vs custom: a hero equal to one of these URLs (or the plain starter) is automatic. It
 * follows the colours when the owner changes palette, and comes back when they remove a photo. Any
 * other hero, such as an upload, a library pick or the legacy QuickByte banner, is the owner's own
 * and is never replaced. Everything changes the draft only; the live site moves on Update Live.
 * ---------------------------------------------------------------------------------------------- */
const ARTWORK_BASE = 'https://res.cloudinary.com/da6oeat7m/image/upload/';
const ARTWORK_ASSET = 'v1792354394/Global_Connectivity_Tech_Showcase_w4kgd6.png';
const shifted = (transform: string) => `${ARTWORK_BASE}${transform}/${ARTWORK_ASSET}`;

export type DataStoreArtworkFamily = 'blue' | 'cyan' | 'teal' | 'emerald' | 'lime' | 'gold' | 'amber' | 'red' | 'berry' | 'purple' | 'indigo' | 'mono';
export const DATA_STORE_ARTWORK: Readonly<Record<DataStoreArtworkFamily, { label: string; src: string }>> = Object.freeze({
  blue: { label: 'Blue', src: DATA_RESELLER_STARTER_HERO_IMAGE },
  cyan: { label: 'Cyan', src: shifted('e_hue:-6') },
  teal: { label: 'Teal', src: shifted('e_hue:-12') },
  emerald: { label: 'Green', src: shifted('e_hue:-35') },
  lime: { label: 'Lime', src: shifted('e_hue:-55') },
  gold: { label: 'Gold', src: shifted('e_hue:-85') },
  amber: { label: 'Amber', src: shifted('e_hue:-100') },
  red: { label: 'Red', src: shifted('e_hue:85') },
  berry: { label: 'Berry', src: shifted('e_hue:70') },
  purple: { label: 'Purple', src: shifted('e_hue:45') },
  indigo: { label: 'Indigo', src: shifted('e_hue:20') },
  mono: { label: 'Monochrome', src: shifted('e_grayscale') },
});

/** The twenty palettes, by their three saved colours, mapped to the family that suits them best. */
const PALETTE_FAMILY: ReadonlyArray<[string, DataStoreArtworkFamily]> = [
  ['#140d0b|#1c1310|#e8833a', 'amber'], // Ember night
  ['#f4efe7|#1f1a17|#8a5a3b', 'amber'], // Paper and ink
  ['#0a0f1d|#0f172a|#3b82f6', 'blue'], // Signal blue
  ['#ffffff|#0f172a|#047857', 'emerald'], // Fresh green
  ['#1a1408|#2a1f0b|#e0a526', 'gold'], // Kente gold
  ['#fff7fb|#4a1030|#be185d', 'berry'], // Berry
  ['#f2f8fb|#0b3954|#0e7490', 'cyan'], // Ocean
  ['#111315|#1b1f22|#a3e635', 'lime'], // Charcoal lime
  ['#0b1526|#13213a|#d9a441', 'gold'], // Navy and gold
  ['#121417|#1c2024|#2cc6b4', 'teal'], // Graphite teal
  ['#0e1922|#172634|#38c8e8', 'cyan'], // Steel and cyan
  ['#161312|#211c1a|#d07a43', 'amber'], // Charcoal copper
  ['#f8f5ec|#16301f|#1f5a3a', 'emerald'], // Ivory and forest
  ['#f5f4f0|#111111|#151515', 'mono'], // Monochrome
  ['#f4f6f8|#1e293b|#c2412d', 'red'], // Slate and coral
  ['#fbf5ec|#4a1020|#8c1c33', 'red'], // Burgundy cream
  ['#f1e9db|#3b3a24|#556326', 'lime'], // Sandstone olive
  ['#1d1022|#2a1631|#d2ab55', 'purple'], // Aubergine gold
  ['#14123a|#1f1b52|#a7a3ff', 'indigo'], // Royal indigo
  ['#062a3a|#0a3a4f|#4ade9b', 'teal'], // Ocean mint
];
const lower = (value?: string) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** Hue in degrees and saturation 0–1 of a #rrggbb colour, or null. */
function hueSat(hex: string): { h: number; s: number } | null {
  if (!/^#[0-9a-f]{6}$/.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s };
}

/**
 * The artwork family for a website's colours. A known palette maps exactly. Custom colours follow
 * the accent's hue, and a near-grey accent gets the monochrome artwork. Deterministic: the same
 * colours always give the same artwork.
 */
export function dataStoreArtworkFamily(settings: { backgroundColor?: string; primaryColor?: string; accentColor?: string } = {}): DataStoreArtworkFamily {
  const key = `${lower(settings.backgroundColor)}|${lower(settings.primaryColor)}|${lower(settings.accentColor)}`;
  const known = PALETTE_FAMILY.find(([k]) => k === key);
  if (known) return known[1];
  const hs = hueSat(lower(settings.accentColor));
  if (!hs) return 'blue';
  if (hs.s < 0.15) return 'mono';
  const h = hs.h;
  return h < 15 || h >= 345 ? 'red' : h < 40 ? 'amber' : h < 62 ? 'gold' : h < 95 ? 'lime' : h < 160 ? 'emerald' : h < 182 ? 'teal' : h < 200 ? 'cyan' : h < 235 ? 'blue' : h < 258 ? 'indigo' : h < 292 ? 'purple' : 'berry';
}

/** The default hero for these colours. */
export const matchedDataStoreArtwork = (settings: { backgroundColor?: string; primaryColor?: string; accentColor?: string } = {}) => DATA_STORE_ARTWORK[dataStoreArtworkFamily(settings)].src;

const AUTOMATIC = new Set(Object.values(DATA_STORE_ARTWORK).map(a => a.src));
/** True for automatic artwork (any family, including the plain starter). Uploads and the legacy banner are custom. */
export function isAutomaticDataStoreArtwork(heroImage?: string): boolean {
  return typeof heroImage === 'string' && AUTOMATIC.has(heroImage.trim());
}

/**
 * The hero a draft should hold after the owner changes colours: automatic artwork follows the new
 * colours, anything else (an owner's photo, the legacy banner, an empty legacy value) stays exactly
 * as it is.
 */
export function heroAfterColourChange(heroImage: string | undefined, settings: { backgroundColor?: string; primaryColor?: string; accentColor?: string }): string | undefined {
  return isAutomaticDataStoreArtwork(heroImage) ? matchedDataStoreArtwork(settings) : heroImage;
}
