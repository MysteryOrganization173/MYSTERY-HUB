/**
 * Website style variants (V7.1). One design can be drawn in a few genuinely different ways that share the same
 * content, sections and commerce. A variant changes composition, surfaces, typography and image handling only.
 *
 * Persistence: the optional `content.styleVariant`. Absent means the design's original look, so every existing
 * website renders exactly as before until its owner picks a style on purpose. New websites are created with the
 * design's default. The registry is keyed by layout so other industries can add their own variants later.
 */
export interface WebsiteStyleVariant { id: string; name: string; summary: string; detail: string; image: 'cover' | 'banner' | 'none' | 'card' | 'arch' }

export const WEBSITE_STYLE_VARIANTS: Readonly<Record<string, readonly WebsiteStyleVariant[]>> = Object.freeze({
  reseller: Object.freeze<WebsiteStyleVariant[]>([
    { id: 'horizon', name: 'Horizon', summary: 'Your banner fills the top, bundles start right below.', detail: 'Image-led and immersive. Works best with dark colours and a wide photo.', image: 'cover' },
    { id: 'market', name: 'Market', summary: 'Bright and shop-like, with bundles as price tags.', detail: 'Commerce first. Good with light colours; a short banner keeps bundles on the first screen.', image: 'banner' },
    { id: 'studio', name: 'Studio', summary: 'Big type and your logo, no banner photo.', detail: 'Clean and fast. Loads the least data, so it suits slow connections.', image: 'none' },
    // V7.2: three more compositions. Same content, bundles, prices and checkout; only the arrangement changes.
    { id: 'compact', name: 'Compact', summary: 'A short header, then a tidy price list.', detail: 'Bundles on the first screen. Network tabs stay at the top while customers scroll. No banner photo.', image: 'none' },
    { id: 'editorial', name: 'Editorial', summary: 'Magazine-style headline beside a framed photo.', detail: 'Elegant serif type, numbered bundles and calm spacing. Lovely with light colours.', image: 'card' },
    { id: 'signature', name: 'Signature', summary: 'Your colour and logo lead, with an arched photo.', detail: 'Brand-first: a bold block in your main colour, bundles shown as tickets.', image: 'arch' },
    { id: 'classic', name: 'Classic', summary: 'The original Data Store layout.', detail: 'Banner card beside your headline. Existing stores keep this until they choose another style.', image: 'card' },
  ]),
});
/** The style a brand-new website of this layout starts with. */
// V7.4: Market leads. It is the clearest first impression (headline beside a framed photo, then readable bundle cards
// with full-width Buy buttons) and what the gallery shows is what a new store starts with. Existing stores keep their saved style.
export const WEBSITE_DEFAULT_STYLE: Readonly<Record<string, string>> = Object.freeze({ reseller: 'market' });
/** The style an existing website without a saved choice has always rendered. */
export const WEBSITE_ORIGINAL_STYLE: Readonly<Record<string, string>> = Object.freeze({ reseller: 'classic' });

/** Every id any layout accepts. The server validates against this list; renderers check their own layout. */
export const WEBSITE_STYLE_VARIANT_IDS: readonly string[] = Object.freeze([...new Set(Object.values(WEBSITE_STYLE_VARIANTS).flatMap(list => list.map(v => v.id)))]);
export const isWebsiteStyleVariant = (value: unknown): value is string => typeof value === 'string' && WEBSITE_STYLE_VARIANT_IDS.includes(value);

/**
 * The style to draw. A saved, known style wins. An owner's website without one keeps its original look;
 * a gallery demo (no owner content) shows the design's current default.
 */
export function resolveWebsiteStyle(layout: string, saved: unknown, owner: boolean): string {
  const list = WEBSITE_STYLE_VARIANTS[layout];
  if (!list) return '';
  if (typeof saved === 'string' && list.some(v => v.id === saved)) return saved;
  return owner ? WEBSITE_ORIGINAL_STYLE[layout] || list[0].id : WEBSITE_DEFAULT_STYLE[layout] || list[0].id;
}

/* ------------------------------------------------------------------------------------------------
 * Data Store wording ideas. Deterministic, editable presets so an owner who is not a marketer still
 * gets a finished-sounding store. Plain English, no prices, speeds, guarantees, reviews or numbers.
 * Never described to customers or owners as AI writing.
 * ---------------------------------------------------------------------------------------------- */
export const DATA_STORE_COPY_IDEAS = Object.freeze({
  tagline: Object.freeze([
    'Buy data in a few taps.',
    'Affordable data. Easy checkout.',
    'Stay connected for less.',
    'Pick a bundle. Pay. Done.',
    'Your everyday data store.',
    'Data for home, school and work.',
    'Buy Data. Stay Connected.',
  ]),
  aboutText: Object.freeze([
    'Pick a network, choose a bundle and pay securely.',
    'Choose your network, pick a bundle and pay securely. Track your order here with your order reference.',
    'Choose a bundle, pay securely and track your order.',
    'Bundles for you, your family and your business. Pay securely through Paystack.',
    'Clear prices, secure payment and an order reference so you can follow your order.',
  ]),
  ctaLabel: Object.freeze(['Buy Data', 'Shop Bundles', 'See bundles', 'Buy a bundle']),
});
