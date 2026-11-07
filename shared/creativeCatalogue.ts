/**
 * Mystery Creative Studio V2: the fixed-price package catalogue, shared by the page and the server.
 *
 * Prices are integer pesewas and the server is the only authority: a package order request names a package and its
 * extras, never an amount, and the server prices it from this file and stores the result as a snapshot together with
 * CREATIVE_COMMERCE.catalogueVersion. Change the version whenever a price, deliverable or extra changes.
 *
 * Two switches keep this safe until the founder approves the commercial set-up:
 * - `pricing: 'draft'` labels every price as a draft and says the team confirms it before any payment.
 * - `payments: 'off'` means nothing can be paid online. An order request is stored for the team (Admin → Marketplace →
 *   Enquiries) and no money changes hands. There is no Creative Studio checkout in this release.
 */
import type { CreativeServiceId } from './creativeStudio.js';

export const CREATIVE_COMMERCE = {
  catalogueVersion: '2026-11-v2-draft',
  pricing: 'draft' as 'draft' | 'approved',
  payments: 'off' as 'off' | 'live',
} as const;

export interface CreativeCategory {
  id: CreativeServiceId;
  name: string;
  /** Short label for the category tabs. */
  tab: string;
  line: string;
}

/** The four categories are the four V1 services, so briefs, analytics and Admin keep one vocabulary. */
export const CREATIVE_CATEGORIES: readonly CreativeCategory[] = [
  { id: 'flyers', name: 'Flyers & print', tab: 'Flyers & print', line: 'Flyers, promotions and menus for WhatsApp, social media and print.' },
  { id: 'social', name: 'Social media', tab: 'Social media', line: 'Posts and campaign sets sized for Instagram, Facebook, TikTok and Status.' },
  { id: 'logo', name: 'Logo & brand', tab: 'Logo & brand', line: 'Logos, refreshes, labels and a starter identity for a new business.' },
  { id: 'banners', name: 'Banners & web', tab: 'Banners & web', line: 'Covers and hero banners for websites, YouTube and social pages.' },
];

export interface CreativeExtra {
  id: string;
  name: string;
  /** One line under the name: what the customer gets. */
  detail: string;
  priceMinor: number;
}

export interface CreativePackage {
  id: string;
  category: CreativeServiceId;
  name: string;
  /** One line for the catalogue card. */
  tagline: string;
  /** Two or three sentences for the detail view. */
  summary: string;
  priceMinor: number;
  /** Working days (Monday to Saturday) from a confirmed order with a complete brief. */
  turnaroundDays: number;
  /** Rounds of consolidated changes included. Never unlimited. */
  revisions: number;
  /** Exactly what is delivered. */
  deliverables: readonly string[];
  /** Files the customer receives. */
  files: string;
  /** What the customer provides, and what is not included. */
  limits: readonly string[];
  extras: readonly CreativeExtra[];
  /** Ids of portfolio pieces in src/data/creativeStudioWork.ts: the first is the card image, the rest the gallery. */
  art: readonly string[];
  /** Real use cases, shown as small tags. */
  goodFor: readonly string[];
}

const ghs = (cedis: number) => Math.round(cedis * 100);
const express = (cedis: number, days: string): CreativeExtra => ({ id: 'express', name: 'Express delivery', detail: `First draft within ${days}`, priceMinor: ghs(cedis) });
const extraRound = (cedis: number): CreativeExtra => ({ id: 'extra-revision', name: 'Extra revision round', detail: 'One more round of consolidated changes', priceMinor: ghs(cedis) });

export const CREATIVE_PACKAGES: readonly CreativePackage[] = [
  {
    id: 'standard-flyer', category: 'flyers', name: 'Standard flyer', tagline: 'One clear flyer for an event, sale or announcement.',
    summary: 'A single flyer built around your message, ready to post on WhatsApp and social media. Ideal for church programmes, events, shop promotions and notices.',
    priceMinor: ghs(99), turnaroundDays: 2, revisions: 2,
    deliverables: ['1 flyer design', '1 size: portrait 1080 × 1350 px or square 1080 × 1080 px', 'Your wording, photos and logo laid out and checked'],
    files: 'High-resolution JPG and PNG',
    limits: ['You send the wording, photos and logo', 'Up to 2 of your photos', 'Printing is not included'],
    extras: [express(50, '1 working day'), { id: 'extra-size', name: 'Extra size', detail: 'WhatsApp Status 1080 × 1920 px or another digital size', priceMinor: ghs(30) }, { id: 'print-pdf', name: 'Print-ready PDF', detail: 'A4 or A5 with bleed, for your printer', priceMinor: ghs(30) }, extraRound(25)],
    art: ['ht-flyer'], goodFor: ['Church', 'Events', 'Shop promotions'],
  },
  {
    id: 'premium-flyer', category: 'flyers', name: 'Premium flyer', tagline: 'A richer, photo-led design in three formats.',
    summary: 'A more crafted flyer with photo retouching, cut-outs and a stronger layout, delivered for social media, Status and print. For launches, concerts, conferences and premium brands.',
    priceMinor: ghs(179), turnaroundDays: 3, revisions: 3,
    deliverables: ['1 flyer design', '3 formats: portrait post, WhatsApp Status and A4 or A5 print', 'Photo retouching and cut-outs for up to 4 of your photos'],
    files: 'JPG and PNG, plus a print-ready PDF with bleed',
    limits: ['You send the wording, photos and logo', 'Free-licence stock images only if you have no photos', 'Printing is not included'],
    extras: [express(80, '2 working days'), { id: 'extra-size', name: 'Extra size', detail: 'Another digital or print size of the same design', priceMinor: ghs(30) }, extraRound(30)],
    art: ['ih-social-a', 'ih-story'], goodFor: ['Launches', 'Concerts', 'Conferences'],
  },
  {
    id: 'menu-price-list', category: 'flyers', name: 'Menu or price list', tagline: 'A one-page menu or price list that is easy to read.',
    summary: 'A single-page menu, price list or service list for a restaurant, salon, shop or school, designed for print and for sharing on WhatsApp.',
    priceMinor: ghs(249), turnaroundDays: 4, revisions: 3,
    deliverables: ['1 page, single-sided', 'Up to 40 items with prices', 'A print version and a phone-friendly digital version'],
    files: 'Print-ready PDF with bleed, plus JPG for WhatsApp',
    limits: ['You send the full item list and prices', 'Food or product photography is not included', 'Printing is not included'],
    extras: [{ id: 'second-side', name: 'Second side', detail: 'A back page with up to 40 more items', priceMinor: ghs(120) }, express(80, '2 working days'), extraRound(30)],
    art: ['ht-menu', 'ht-scene'], goodFor: ['Restaurants', 'Salons', 'Price lists'],
  },
  {
    id: 'social-post', category: 'social', name: 'Single social post', tagline: 'One promotional post for one product, offer or message.',
    summary: 'A scroll-stopping post for Instagram, Facebook, TikTok or WhatsApp Status, built around one product, price or announcement.',
    priceMinor: ghs(69), turnaroundDays: 2, revisions: 2,
    deliverables: ['1 social media graphic', '1 size: square, portrait or Status'],
    files: 'High-resolution JPG and PNG',
    limits: ['You send the wording, prices and product photo', 'Posting and advert management are not included'],
    extras: [express(40, '1 working day'), { id: 'extra-size', name: 'Extra size', detail: 'The same post in another platform size', priceMinor: ghs(25) }, extraRound(20)],
    art: ['ht-social'], goodFor: ['Offers', 'Products', 'Announcements'],
  },
  {
    id: 'campaign-five', category: 'social', name: 'Campaign set of 5', tagline: 'Five matching posts for one campaign or launch.',
    summary: 'A coordinated set of five posts with one look, so a launch, sale or season reads as one campaign across a week of posting.',
    priceMinor: ghs(299), turnaroundDays: 4, revisions: 2,
    deliverables: ['5 matching social media graphics', '1 size for each post', 'One campaign look, used across the set'],
    files: 'High-resolution JPG and PNG for every post',
    limits: ['You send the wording and photos for each post', 'Revision rounds cover the whole set', 'Posting and advert management are not included'],
    extras: [{ id: 'status-set', name: 'Status versions', detail: 'All 5 posts resized for WhatsApp Status', priceMinor: ghs(60) }, { id: 'extra-post', name: 'Extra post', detail: 'One more post in the same campaign look', priceMinor: ghs(55) }, express(90, '2 working days')],
    art: ['ih-story', 'ih-social-b', 'ih-social-a'], goodFor: ['Launches', 'Seasonal sales', 'Product ranges'],
  },
  {
    id: 'logo-design', category: 'logo', name: 'Logo design', tagline: 'A new logo with versions for light and dark backgrounds.',
    summary: 'A distinctive logo for a new business or brand. You choose between two first concepts, then we refine your choice into final files you can use everywhere.',
    priceMinor: ghs(399), turnaroundDays: 5, revisions: 3,
    deliverables: ['2 first logo concepts to choose from', 'Final logo in colour, black and white', 'Versions for light and dark backgrounds', 'Your logo colours as codes'],
    files: 'PNG with transparent background, JPG, SVG and PDF',
    limits: ['Trademark searches and registration are not included', 'A new concept after you choose a direction is new work'],
    extras: [{ id: 'business-card', name: 'Business card design', detail: 'Front and back, print-ready', priceMinor: ghs(89) }, { id: 'social-kit', name: 'Social profile kit', detail: 'Profile picture and cover for 2 platforms', priceMinor: ghs(99) }, express(150, '3 working days'), extraRound(60)],
    art: ['lz-identity', 'lz-cover'], goodFor: ['New businesses', 'Churches & groups', 'Personal brands'],
  },
  {
    id: 'logo-refresh', category: 'logo', name: 'Logo refresh', tagline: 'A clean, sharp version of the logo you already have.',
    summary: 'For a blurry, pixelated or dated logo. We redraw it cleanly and tidy the lettering and colours, keeping what customers already recognise.',
    priceMinor: ghs(249), turnaroundDays: 3, revisions: 2,
    deliverables: ['1 refreshed logo, redrawn sharp', 'Versions for light and dark backgrounds'],
    files: 'PNG with transparent background, JPG, SVG and PDF',
    limits: ['You send the best copy of your current logo', 'A completely new logo is the Logo design package'],
    extras: [express(100, '2 working days'), extraRound(40)],
    art: ['ih-identity'], goodFor: ['Blurry logos', 'Older brands', 'Signboards'],
  },
  {
    id: 'product-label', category: 'logo', name: 'Product label', tagline: 'A shelf-ready label for one product.',
    summary: 'A label for one product, laid out to your container size with the information your customers and regulators expect to see.',
    priceMinor: ghs(349), turnaroundDays: 5, revisions: 3,
    deliverables: ['1 label design for 1 product', 'Front and back panels', 'Laid out to your label or container size'],
    files: 'Print-ready PDF with bleed, plus PNG preview',
    limits: ['You send the size, product details and any required wording', 'Regulatory approval, barcodes and printing are not included'],
    extras: [{ id: 'variant', name: 'Extra flavour or variant', detail: 'The same label adapted for another variant', priceMinor: ghs(99) }, express(120, '3 working days'), extraRound(40)],
    art: ['ih-packaging'], goodFor: ['Shea & skin care', 'Drinks', 'Food products'],
  },
  {
    id: 'starter-identity', category: 'logo', name: 'Starter brand identity', tagline: 'Logo, colours, fonts and the first pieces to launch with.',
    summary: 'Everything a new business needs to look consistent from day one: a logo, a colour palette, font choices, a one-page brand guide, a business card and a social profile kit.',
    priceMinor: ghs(899), turnaroundDays: 8, revisions: 3,
    deliverables: ['Logo design with 2 first concepts', 'Colour palette and font pairing', 'One-page brand guide', 'Business card design, front and back', 'Social profile picture and cover for 2 platforms'],
    files: 'Logo in PNG, JPG, SVG and PDF; brand guide PDF; print-ready card; social images',
    limits: ['Trademark searches and printing are not included', 'Revision rounds apply to each part'],
    extras: [{ id: 'letterhead', name: 'Letterhead', detail: 'An A4 letterhead as PDF and PNG', priceMinor: ghs(89) }, { id: 'launch-post', name: 'Launch post', detail: 'One social post announcing the new brand', priceMinor: ghs(59) }, extraRound(80)],
    art: ['ht-identity', 'ht-scene', 'lz-stationery'], goodFor: ['New businesses', 'Rebrands', 'Restaurants & shops'],
  },
  {
    id: 'cover-banner', category: 'banners', name: 'Cover or banner', tagline: 'One banner for a website, YouTube channel or social page.',
    summary: 'A wide banner for one placement: a website hero, a YouTube channel cover, a Facebook cover or a digital advert, sized correctly so nothing important is cut off.',
    priceMinor: ghs(129), turnaroundDays: 2, revisions: 2,
    deliverables: ['1 banner design', '1 placement, sized to that platform'],
    files: 'High-resolution JPG and PNG',
    limits: ['You send the wording, photos and logo', 'Large-format print files are a custom project'],
    extras: [express(60, '1 working day'), { id: 'extra-size', name: 'Extra placement', detail: 'The same banner adapted for another platform', priceMinor: ghs(39) }, extraRound(25)],
    art: ['lz-banner'], goodFor: ['YouTube', 'Facebook covers', 'Websites'],
  },
  {
    id: 'web-hero-set', category: 'banners', name: 'Website hero set', tagline: 'One hero design for desktop, mobile and social.',
    summary: 'One campaign banner adapted for a website on desktop, the same site on a phone, and a matching social cover, so your launch looks consistent everywhere.',
    priceMinor: ghs(249), turnaroundDays: 3, revisions: 2,
    deliverables: ['1 hero banner design', '3 sizes: desktop hero, mobile hero and social cover'],
    files: 'High-resolution JPG and PNG, web-optimised',
    limits: ['You send the wording, photos and logo', 'Building or editing the website is not included'],
    extras: [express(90, '2 working days'), { id: 'extra-size', name: 'Extra size', detail: 'Another web or social placement', priceMinor: ghs(39) }, extraRound(30)],
    art: ['lz-web', 'lz-banner'], goodFor: ['Website launches', 'Online stores', 'Campaigns'],
  },
];

export const creativeCategory = (id: unknown) => CREATIVE_CATEGORIES.find(category => category.id === id);
export const creativePackage = (id: unknown) => CREATIVE_PACKAGES.find(pkg => pkg.id === id);
export const creativePackagesIn = (category: CreativeServiceId) => CREATIVE_PACKAGES.filter(pkg => pkg.category === category);
export const creativeFromPrice = (category?: CreativeServiceId) => Math.min(...(category ? creativePackagesIn(category) : CREATIVE_PACKAGES).map(pkg => pkg.priceMinor));

/** "GH₵99" for whole cedis, "GH₵99.50" otherwise. */
export const creativeCedis = (minor: number) => `GH₵${(minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
export const creativeDays = (days: number) => `${days} working ${days === 1 ? 'day' : 'days'}`;
export const creativeRounds = (rounds: number) => `${rounds} revision ${rounds === 1 ? 'round' : 'rounds'}`;

export class CreativePriceError extends Error {
  constructor(message: string, public field = 'package') { super(message); }
}

export interface CreativePrice {
  catalogueVersion: string;
  pricing: 'draft' | 'approved';
  package: CreativePackage;
  extras: readonly CreativeExtra[];
  totalMinor: number;
}

/**
 * The one price calculation, used by the page (to show the total) and the server (the number that is stored).
 * Unknown packages and extras are refused rather than ignored, so a stale page can never under-price an order.
 */
export function priceCreativeOrder(packageId: unknown, extraIds: unknown = []): CreativePrice {
  const pkg = creativePackage(packageId);
  if (!pkg) throw new CreativePriceError('This package is no longer available. Refresh the page and choose again.');
  if (!Array.isArray(extraIds) || extraIds.length > pkg.extras.length) throw new CreativePriceError('Choose extras from the list.', 'extras');
  const extras: CreativeExtra[] = [];
  for (const id of extraIds) {
    const extra = pkg.extras.find(candidate => candidate.id === id);
    if (!extra) throw new CreativePriceError('One of the extras is no longer available. Refresh the page and choose again.', 'extras');
    if (extras.includes(extra)) throw new CreativePriceError('Each extra can be chosen once.', 'extras');
    extras.push(extra);
  }
  // Keep the catalogue order so the same choice always produces the same snapshot.
  extras.sort((a, b) => pkg.extras.indexOf(a) - pkg.extras.indexOf(b));
  return { catalogueVersion: CREATIVE_COMMERCE.catalogueVersion, pricing: CREATIVE_COMMERCE.pricing, package: pkg, extras, totalMinor: pkg.priceMinor + extras.reduce((sum, extra) => sum + extra.priceMinor, 0) };
}

/** The plain-text snapshot Admin reads: what was chosen and what the page showed, at this catalogue version. */
export function creativePriceLines(price: CreativePrice): string[] {
  const { package: pkg } = price;
  return [
    `Package: ${pkg.name} (${creativeCedis(pkg.priceMinor)})`,
    ...(price.extras.length ? [`Extras: ${price.extras.map(extra => `${extra.name} (+${creativeCedis(extra.priceMinor)})`).join(', ')}`] : ['Extras: none']),
    `Total shown: ${creativeCedis(price.totalMinor)} (${price.pricing === 'draft' ? 'draft price' : 'fixed price'}, catalogue ${price.catalogueVersion})`,
    `Includes: ${creativeRounds(pkg.revisions)}, ${creativeDays(pkg.turnaroundDays)}`,
  ];
}
