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
