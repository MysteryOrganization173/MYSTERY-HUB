/**
 * Creative Studio work samples. V1 shows only artwork made for Mystery Hub's own brand and launches, taken from the
 * Mystery Hub Cloudinary library, and says so on the page. There is no client work here yet.
 *
 * To add a client project later: add an entry with `owner: 'client'` only after the client has agreed in writing that
 * it may be shown, and never invent a client name. The page labels each piece from `owner`.
 */
export type CreativeWorkKind = 'Logo & identity' | 'Campaign graphic' | 'Social graphic' | 'Banner';

export interface CreativeWork {
  id: string;
  title: string;
  kind: CreativeWorkKind;
  owner: 'mystery-hub' | 'client';
  /** A versioned Cloudinary original from the Mystery Hub library (never a guessed public id). */
  src: string;
  width: number;
  height: number;
  alt: string;
  note: string;
}

const LIBRARY = 'https://res.cloudinary.com/da6oeat7m/image/upload/';

export const CREATIVE_WORK: readonly CreativeWork[] = [
  { id: 'earn-launch', title: 'Mystery Earn launch banner', kind: 'Campaign graphic', owner: 'mystery-hub', src: `${LIBRARY}v1790873549/Mystery_Hub_Referral_Rewards_pjlb3q.png`, width: 1672, height: 941,
    alt: 'Banner reading “Share Mystery Hub. Get Rewarded.” with a smiling woman holding a phone and three steps: share, people join, earn rewards.', note: 'Headline, steps and photography in one wide banner.' },
  { id: 'hub-emblem', title: 'Mystery Hub emblem', kind: 'Logo & identity', owner: 'mystery-hub', src: `${LIBRARY}v1784626980/mystery-hub/logo-full.png`, width: 1536, height: 1024,
    alt: 'Mystery Hub logo: a green M with a signal symbol inside a ring, above the words Mystery Hub and the tagline Everything digital, one trusted place.', note: 'Emblem, wordmark and tagline lockup.' },
  { id: 'earn-portrait', title: 'Mystery Earn social post', kind: 'Social graphic', owner: 'mystery-hub', src: `${LIBRARY}v1790877287/72fcc9b0-5ea3-4d4f-92fe-bfd1e3b8ac52_xe8gdu.png`, width: 1122, height: 1402,
    alt: 'Portrait social post: a woman using her phone at night, surrounded by glowing icons for sharing, rewards and a wallet.', note: 'Portrait format for Status and feeds.' },
  { id: 'ai-mark', title: 'Mystery AI product mark', kind: 'Logo & identity', owner: 'mystery-hub', src: `${LIBRARY}v1790791174/ChatGPT_Image_Sep_30_2026_05_59_10_PM_klrk81.png`, width: 1254, height: 1254,
    alt: 'Mystery AI logo: a green M joined by a spark and a dotted line, above the words Mystery AI on a dark background.', note: 'A product mark that sits with the main brand.' },
  { id: 'data-campaign', title: 'Data bundles campaign', kind: 'Campaign graphic', owner: 'mystery-hub', src: `${LIBRARY}v1790933009/Neon_Data_Bundles_in_Accra_h2hkiv.png`, width: 1672, height: 941,
    alt: 'Night-time Accra scene with a woman on her phone and floating cards showing MTN, Telecel and AirtelTigo data bundle sizes.', note: 'Product promotion built around the networks customers know.' },
  { id: 'market-banner', title: 'Marketplace banner', kind: 'Banner', owner: 'mystery-hub', src: `${LIBRARY}v1790865356/Futuristic_Ghana_Tech_Marketplace_Banner_uvziku.png`, width: 1672, height: 941,
    alt: 'Wide banner of laptops, phones, a camera, headphones and a card machine on a dark stage with green light.', note: 'Website header artwork for the Marketplace.' },
  { id: 'hub-cart-mark', title: 'Mystery Hub shopping mark', kind: 'Logo & identity', owner: 'mystery-hub', src: `${LIBRARY}v1790778106/ChatGPT_Image_Sep_30_2026_02_21_38_PM_jmwjyk.png`, width: 1254, height: 1254,
    alt: 'Mystery Hub logo variation: a large green and white M with a shopping cart, above the word MysteryHub.', note: 'A logo variation for shopping features.' },
  { id: 'builder-art', title: 'Website Builder artwork', kind: 'Banner', owner: 'mystery-hub', src: `${LIBRARY}v1791055733/ChatGPT_Image_Oct_3_2026_06_52_28_PM-1_exdift.png`, width: 1448, height: 1086,
    alt: 'A laptop, tablet and phone on a desk, each showing the same green business website.', note: 'Service artwork showing one website on three screens.' },
];

export const CREATIVE_WORK_OWNER_LABEL: Record<CreativeWork['owner'], string> = {
  'mystery-hub': 'Made for Mystery Hub',
  client: 'Client project',
};
