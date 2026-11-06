import type { CreativeServiceId } from '../../shared/creativeStudio';

/**
 * Creative Studio portfolio. V1.1 shows three Studio Concepts: fictional brands designed by Mystery Hub to show range.
 * All images live in Cloudinary under mysteryhub/creative-studio/concepts, so a piece can be replaced by changing its
 * entry here.
 *
 * Adding a real client project later: use `owner: 'client'` only after the client has agreed in writing that it may be
 * shown, and never invent a client name. The page labels every project and piece from `owner`.
 */
export type CreativeWorkKind = 'Identity' | 'Menu & print' | 'Social media' | 'Packaging' | 'Banner & web';
export const CREATIVE_WORK_KINDS: readonly CreativeWorkKind[] = ['Identity', 'Menu & print', 'Social media', 'Packaging', 'Banner & web'];

export interface CreativeWork {
  id: string;
  title: string;
  kind: CreativeWorkKind;
  /** A versioned Cloudinary original from the Mystery Hub library (never a guessed public id). */
  src: string;
  width: number;
  height: number;
  alt: string;
  note: string;
}

export interface CreativeProject {
  id: string;
  name: string;
  sector: string;
  owner: 'concept' | 'client';
  summary: string;
  /** What the project shows, as short tags. */
  includes: readonly string[];
  /** Main brand colours, as swatches. */
  palette: readonly string[];
  /** The brief this project leads to when a customer wants something similar. */
  service: CreativeServiceId;
  /** First piece is the project cover. */
  pieces: readonly CreativeWork[];
}

const LIB = 'https://res.cloudinary.com/da6oeat7m/image/upload/';
const art = (version: string, id: string) => `${LIB}v${version}/mysteryhub/creative-studio/concepts/${id}.jpg`;

export const CREATIVE_PROJECTS: readonly CreativeProject[] = [
  {
    id: 'harmattan-table', name: 'Harmattan Table', sector: 'Restaurant', owner: 'concept', service: 'flyers',
    summary: 'A warm identity for a slow-cooking Ghanaian restaurant in Osu. The mark is a low harmattan sun fading into bands of dust, and the colours come from chilli, clay pots and dry-season light.',
    includes: ['Logo', 'Colour system', 'Menu', 'Promotional flyer', 'Social ad'],
    palette: ['#B5341C', '#E3A32B', '#D9785A', '#4B5B2E', '#2A1710'],
    pieces: [
      { id: 'ht-cover', title: 'Brand cover', kind: 'Identity', src: art('1793966541', 'ht-cover'), width: 1600, height: 1000, alt: 'Harmattan Table logo and name on a chilli-red panel beside a table of jollof, soup and grilled chicken.', note: 'The brand at its first impression.' },
      { id: 'ht-identity', title: 'Logo and colours', kind: 'Identity', src: art('1793966543', 'ht-identity'), width: 1600, height: 1000, alt: 'Harmattan Table logo on cream and on dark brown, with five colour swatches and a type sample.', note: 'Logo versions, palette and type.' },
      { id: 'ht-menu', title: 'Menu', kind: 'Menu & print', src: art('1793966544', 'ht-menu'), width: 1200, height: 1500, alt: 'A printed Harmattan Table menu listing dishes from the pot, from the coals and drinks.', note: 'A one-page menu, easy to read in low light.' },
      { id: 'ht-flyer', title: 'Sunday Long Table flyer', kind: 'Menu & print', src: art('1793966542', 'ht-flyer'), width: 1080, height: 1350, alt: 'Ochre flyer reading Sunday Long Table, with a plate of jollof, chicken and plantain.', note: 'A weekly promotion for print and WhatsApp.' },
      { id: 'ht-social', title: 'Friday night ad', kind: 'Social media', src: art('1793966545', 'ht-social'), width: 1080, height: 1080, alt: 'Square social ad reading Whole fish. Hot coals. over a grilled tilapia with banku.', note: 'A square ad built around one dish.' },
      { id: 'ht-scene', title: 'The brand together', kind: 'Menu & print', src: art('1793966544', 'ht-scene'), width: 1600, height: 1000, alt: 'Harmattan Table menu cover, flyer, round coaster and business card laid out on a restaurant table.', note: 'Menu, flyer, coaster and card as one family.' },
    ],
  },
  {
    id: 'indigo-hour', name: 'Indigo Hour', sector: 'Skin care', owner: 'concept', service: 'social',
    summary: 'Calm skin care made with clay, shea and hibiscus. A circle dipped once in an indigo vat became the logo, and the same dye line runs across every label and carton.',
    includes: ['Logo', 'Packaging', 'Product labels', 'Social campaign'],
    palette: ['#1F2A5A', '#C9805C', '#EFE3D2', '#7A1F3D'],
    pieces: [
      { id: 'ih-cover', title: 'Campaign image', kind: 'Social media', src: art('1793966546', 'ih-cover'), width: 1600, height: 893, alt: 'Indigo Hour oil, cleanser and night butter on a terracotta shelf, with the line Skin care for the slow end of the day.', note: 'The range, labelled, in its brand setting.' },
      { id: 'ih-identity', title: 'Logo and colours', kind: 'Identity', src: art('1793966546', 'ih-identity'), width: 1600, height: 1000, alt: 'Indigo Hour logo, a circle half filled with indigo, with four colour swatches and a type sample.', note: 'A simple mark that works very small.' },
      { id: 'ih-packaging', title: 'Carton system', kind: 'Packaging', src: art('1793966547', 'ih-packaging'), width: 1600, height: 1000, alt: 'Three Indigo Hour cartons in indigo, cream and hibiscus red on a clay background.', note: 'Three carton designs for one shelf.' },
      { id: 'ih-social-a', title: 'Night routine post', kind: 'Social media', src: art('1793966548', 'ih-social-a'), width: 1080, height: 1350, alt: 'Portrait social post reading Three steps. Then bed. above a pump bottle and ceramic jar.', note: 'A portrait post for Instagram and Status.' },
      { id: 'ih-social-b', title: 'Ingredients post', kind: 'Social media', src: art('1793966548', 'ih-social-b'), width: 1080, height: 1080, alt: 'Indigo social post reading River clay. Raw shea. Hibiscus. in large serif type.', note: 'A type-led post with no photograph.' },
      { id: 'ih-story', title: 'Product launch post', kind: 'Social media', src: art('1793966549', 'ih-story'), width: 1080, height: 1350, alt: 'Hibiscus-red post reading Night butter is here. with the Indigo Hour logo.', note: 'A launch announcement.' },
    ],
  },
  {
    id: 'lonzero', name: 'Lonzero', sector: 'Technology', owner: 'concept', service: 'logo',
    summary: 'Delivery route planning for Ghanaian businesses. The logo is a zero crossed by the prime meridian, which runs through Tema, and it became the idea behind the whole brand: every drop on one line.',
    includes: ['Logo', 'Stationery', 'Launch banner', 'Social ad', 'Website design'],
    palette: ['#2438E8', '#FFB000', '#0D1130', '#FFFFFF'],
    pieces: [
      { id: 'lz-cover', title: 'Brand cover', kind: 'Identity', src: art('1793966550', 'lz-cover'), width: 1600, height: 1000, alt: 'Lonzero name and a large zero crossed by a vertical amber bar on a bright blue grid.', note: 'A bold mark on a bold colour.' },
      { id: 'lz-identity', title: 'Logo and colours', kind: 'Identity', src: art('1793966551', 'lz-identity'), width: 1600, height: 1000, alt: 'Lonzero logo drawn on a grid and on dark navy, with colour swatches and a type sample.', note: 'A logo built on a simple grid.' },
      { id: 'lz-stationery', title: 'Letterhead and cards', kind: 'Menu & print', src: art('1793966552', 'lz-stationery'), width: 1600, height: 1000, alt: 'Lonzero letterhead and two business cards, one blue and one white, on a grey surface.', note: 'Everyday stationery, kept simple.' },
      { id: 'lz-banner', title: 'Launch banner', kind: 'Banner & web', src: art('1793966549', 'lz-banner'), width: 1600, height: 800, alt: 'Navy banner with a blue route line and amber stops, reading Every drop. One line.', note: 'A wide banner for web and social covers.' },
      { id: 'lz-social', title: 'Social ad', kind: 'Social media', src: art('1793966551', 'lz-social'), width: 1080, height: 1080, alt: 'Amber ad reading Stop phoning your drivers. above a phone showing today\'s delivery list.', note: 'One clear customer problem.' },
      { id: 'lz-web', title: 'Website design', kind: 'Banner & web', src: art('1793966553', 'lz-web'), width: 1600, height: 1000, alt: 'Lonzero website in a browser window, headed Your deliveries, in the right order.', note: 'A homepage design for the brand.' },
    ],
  },
];

/** The brief a kind of work leads to, so "Request something similar" on a banner opens the banner brief. */
export const CREATIVE_KIND_SERVICE: Record<CreativeWorkKind, CreativeServiceId> = {
  Identity: 'logo', 'Menu & print': 'flyers', 'Social media': 'social', Packaging: 'logo', 'Banner & web': 'banners',
};

/** Every piece, in project order. */
export const CREATIVE_WORK: readonly CreativeWork[] = CREATIVE_PROJECTS.flatMap(project => project.pieces);

export const creativeWorkById = (id: string): CreativeWork => CREATIVE_WORK.find(work => work.id === id)!;
export const creativeProjectOf = (work: CreativeWork): CreativeProject => CREATIVE_PROJECTS.find(project => project.pieces.includes(work))!;

export const CREATIVE_OWNER_LABEL: Record<CreativeProject['owner'], string> = {
  concept: 'Studio Concept',
  client: 'Client project',
};
