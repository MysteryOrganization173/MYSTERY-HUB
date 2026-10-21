import type {WebsiteTemplate} from '../types/index.js';

/**
 * The visible wording each designed template carries beyond the owner's core details: hero badges,
 * button labels and section headings. `demo` is the gallery wording. `owner` replaces it on an owner's
 * website where the demo would make a claim the owner never made (luxury, ratings, prices, places).
 * Owners override any slot through `content.copy`, keyed `${layout}.${slot}`; empty means the design's
 * wording. Platform notices (stock, payment and booking confirmations) are deliberately not slots.
 */
export interface TemplateCopySlot {label: string; demo?: string; owner?: string; max: number}
type Slots = Record<string, TemplateCopySlot>;
const s = (label: string, demo: string | undefined, owner?: string, max = 80): TemplateCopySlot => ({label, demo, owner, max});
const intro = (label: string, demo: string, owner?: string) => s(label, demo, owner, 200);

const dynamic = (eyebrow: string, primary: string, itemsEyebrow: string, itemsHeading: string, itemButton: string, demoEyebrow = eyebrow): Slots => ({
  eyebrow: s('Badge above the heading', demoEyebrow, eyebrow, 50),
  primary: s('Main page button', primary, undefined, 40),
  itemsEyebrow: s('Section label', itemsEyebrow, undefined, 50),
  itemsHeading: s('Section heading', itemsHeading),
  itemButton: s('Card button', itemButton, undefined, 40),
});

export const TEMPLATE_COPY: Record<string, Slots> = {
  restaurant: {
    eyebrow: s('Badge above the heading', 'Modern Ghanaian Gastronomy', 'Ghanaian kitchen', 50),
    primary: s('Main page button', 'Ask about a table', undefined, 40),
    secondary: s('Second page button', 'Explore Digital Menu', 'Explore our menu', 40),
    itemsEyebrow: s('Menu label', 'Curated Culinary Selection', 'From our kitchen', 50),
    itemsHeading: s('Menu heading', 'Explore our menu'),
    itemsIntro: intro('Menu introduction', 'Contact us for current menu details, ingredients and availability.'),
    enquiryEyebrow: s('Reservations label', 'Reservation enquiry', undefined, 50),
    enquiryHeading: s('Reservations heading', 'Ask about a table'),
    enquiryIntro: intro('Reservations introduction', 'Contact the business to arrange a reservation. No booking is made on this page.', 'Contact us to confirm availability and arrange your reservation.'),
  },
  salon: {
    brand: s('Line under your name', 'Hair · Barbershop · Esthetics', undefined, 50),
    eyebrow: s('Badge above the heading', undefined, 'Hair, beauty & grooming', 50),
    primary: s('Main page button', 'Schedule Your Glow Up', undefined, 40),
    secondary: s('Second page button', 'View Service Rate Card', 'View our services', 40),
    itemsEyebrow: s('Services label', 'Transparent Pricing in Ghana Cedis', 'Our services', 50),
    itemsHeading: s('Services heading', 'Luxury Hair & Grooming Menu', 'Hair & Grooming Menu'),
    itemsIntro: intro('Services introduction', 'Contact us to confirm services, prices and what is included.'),
    itemButton: s('Service card button', 'Book This Treatment', undefined, 40),
    enquiryEyebrow: s('Appointments label', 'Appointment enquiry', undefined, 50),
    enquiryHeading: s('Appointments heading', 'Book Your Glow Session'),
    enquiryIntro: intro('Appointments introduction', 'Contact us to discuss your preferred service and appointment time.'),
  },
  hotel: {
    brand: s('Line under your name', 'Eco-Resort & Beachfront Villas', 'Hotel & guest house', 50),
    eyebrow: s('Badge above the heading', 'Ada Foah Estuary Sanctuary', 'Stay with us', 50),
    primary: s('Main page button', 'Ask about availability', undefined, 40),
    secondary: s('Second page button', 'Explore Suites', 'Explore our rooms', 40),
    itemsEyebrow: s('Rooms label', 'Private Eco Sanctuary', 'Explore your stay', 50),
    itemsHeading: s('Rooms heading', 'Rooms & Stays'),
    itemButton: s('Room card button', 'Book This Suite', 'Ask about this room', 40),
  },
  construction: {
    brand: s('Line under your name', 'Civil & Structural Engineers Ghana', 'Building & construction', 50),
    eyebrow: s('Badge above the heading', 'Heavy Civil & Commercial Engineering', 'Building & construction', 50),
    primary: s('Main page button', 'Request a Project Estimate', undefined, 40),
    secondary: s('Second page button', 'View projects', undefined, 40),
    itemsEyebrow: s('Projects label', 'Project portfolio', undefined, 50),
    itemsHeading: s('Projects heading', 'Our projects'),
    extraEyebrow: s('Services label', 'Technical Capabilities', 'What we do', 50),
    extraHeading: s('Services heading', 'Full-Spectrum Contracting', 'Services'),
    extraIntro: intro('Services introduction', 'End-to-end engineering, procurement, and construction (EPC) solutions.', 'Contact us to discuss the services and experience needed for your project.'),
    enquiryEyebrow: s('Estimates label', 'Project enquiries', undefined, 50),
    enquiryHeading: s('Estimates heading', 'Request Project Estimate & Feasibility', 'Request a project estimate'),
    enquiryIntro: intro('Estimates introduction', 'Contact the business to discuss project scope, qualifications and estimates.'),
  },
  realestate: {
    brand: s('Line under your name', 'Luxury Property & Estates Ghana', 'Property & real estate', 50),
    eyebrow: s('Badge above the heading', 'Prime Real Estate in Ghana', 'Homes & property', 50),
    primary: s('Main page button', 'Browse listings', undefined, 40),
    itemsEyebrow: s('Listings label', 'Curated Portfolio', 'Our listings', 50),
    itemsHeading: s('Listings heading', 'Featured Luxury Residences', 'Featured properties'),
    itemButton: s('Listing card button', 'Schedule Private Tour', 'Ask about a viewing', 40),
    enquiryEyebrow: s('Viewings label', 'VIP Buyer Concierge', 'Viewings', 50),
    enquiryHeading: s('Viewings heading', 'Schedule a Viewing'),
    enquiryIntro: intro('Viewings introduction', 'Contact us to discuss available properties and arrange a viewing.'),
  },
  portfolio: {
    eyebrow: s('Badge above the heading', 'Documentary & Fashion Cinematography', 'Photography & film', 50),
    primary: s('Main page button', 'Explore Selected Work', undefined, 40),
    secondary: s('Second page button', 'Request Rate Card', 'Get in touch', 40),
    itemsEyebrow: s('Work label', 'Archive 2024 — 2026', 'Our work', 50),
    itemsHeading: s('Work heading', 'Selected Projects'),
    extraEyebrow: s('Equipment label', 'Production Setup', undefined, 50),
    extraHeading: s('Equipment heading', 'Commercial Kit & Day Rates', 'Equipment & rates'),
    kitOneTitle: s('First card title', 'Cinema & Stills Package', 'Equipment'),
    kitOneText: intro('First card text', 'Sony FX6 Full-Frame Cinema Line, Leica M11 Rangefinder, G-Master f/1.2 primes, Aputure 600d lighting kit, and DJI Ronin 4D stabilization.', 'Contact us to discuss the equipment and production setup for your project.'),
    kitTwoTitle: s('Second card title', 'Standard Commercial Day Rate', 'Rates'),
    kitTwoText: intro('Second card text', 'Full-day shoot (up to 8 hours), master color grading, commercial licensing release, and RAW deliverables archived via cloud storage.', 'Confirm scope, rates, licensing and deliverables with us before booking.'),
    enquiryEyebrow: s('Bookings label', 'Direct Booking', undefined, 50),
    enquiryHeading: s('Bookings heading', 'Commission a Shoot'),
    enquiryIntro: intro('Bookings introduction', 'Editorial campaigns, documentary features, and high-impact commercial imagery.', 'Tell us about your shoot: the date, the place and what you need.'),
  },
  agency: {
    brand: s('Line under your name', 'Cloud & Fintech Infrastructure', 'Technology services', 50),
    eyebrow: s('Badge above the heading', 'Mission-Critical African Enterprise Engineering', 'Technology for business', 50),
    primary: s('Main page button', 'Schedule Architecture Audit', 'Discuss your project', 40),
    secondary: s('Second page button', 'Explore Tech Stack', 'Explore our services', 40),
    itemsEyebrow: s('Services label', 'Flagship Systems', 'What we do', 50),
    itemsHeading: s('Services heading', 'Engineered for Scale', 'Our services'),
    enquiryEyebrow: s('Contact label', 'Direct Engagement', undefined, 50),
    enquiryHeading: s('Contact heading', 'Discuss your project'),
    enquiryIntro: intro('Contact introduction', 'Contact us to discuss your project and arrange a conversation.'),
  },
  ecommerce: {
    eyebrow: s('Badge above the heading', 'Explore the collection', undefined, 50),
    primary: s('Main page button', 'Browse Catalog', undefined, 40),
    secondary: s('Second page button', 'Contact to order', undefined, 40),
    itemsHeading: s('Products heading', 'Trending Hardware & Gadgets', 'Our products'),
    itemsIntro: intro('Products introduction', 'Contact the business to confirm current stock and delivery options.'),
  },
  nightkitchen: {
    eyebrow: s('Line above the heading', 'Lunch and dinner', 'Cooked fresh', 50),
    primary: s('Main page button', 'Order on WhatsApp', undefined, 40),
    picksEyebrow: s('Picks label', 'Owner’s picks', undefined, 50),
    picksHeading: s('Picks heading', 'Start here'),
    menuHeading: s('Menu heading', 'Menu'),
    menuIntro: intro('Menu introduction', 'Add dishes to your order, then send it on WhatsApp. We confirm prices, pickup or delivery with you.'),
    hoursHeading: s('Hours heading', 'Hours'),
    findHeading: s('Find us heading', 'Find us'),
    enquiryHeading: s('Table enquiry heading', 'Coming with a group?'),
  },
  boutique: {
    eyebrow: s('Line above the heading', 'New this week', 'The collection', 50),
    primary: s('Main page button', 'Shop the collection', undefined, 40),
    secondary: s('Second page button', 'Visit or ask', undefined, 40),
    collectionHeading: s('Products heading', 'The collection'),
    collectionIntro: intro('Products introduction', 'Tap a product for photos and options. Order on WhatsApp and we confirm stock and delivery.'),
    policiesHeading: s('Policies heading', 'Delivery, payment & returns'),
    visitHeading: s('Visit heading', 'Visit or ask'),
  },
  // Data stores: the storefront's own wording. Bundles, prices, payment and delivery notices stay platform-managed.
  reseller: {
    brand: s('Line under your name', 'Data bundle store', undefined, 50),
    secondary: s('Second page button', 'Track an order', undefined, 40),
    catalogueEyebrow: s('Bundles label', 'Data bundles', undefined, 50),
    catalogueHeading: s('Bundles heading', 'Choose your bundle'),
    stepsHeading: s('Steps heading', 'How buying works'),
    helpHeading: s('Help heading', 'Need help with an order?'),
    helpIntro: intro('Help introduction', 'Message or call us and have your order reference ready, so we can check it quickly.'),
  },
  education: dynamic('Learning & training', 'Explore our courses', 'Learn with us', 'Courses & classes', 'Ask about this course'),
  church: dynamic('Faith & community', 'Explore our gatherings', 'Gather with us', 'Services & activities', 'Find out more'),
  fashion: dynamic('Fashion & tailoring', 'Explore the collection', 'Featured pieces', 'Explore the collection', 'Ask about this piece', 'Luxury Fashion'),
  services: dynamic('Professional services', 'Explore our services', 'How we help', 'Our services', 'Ask about this service'),
};

export const templateCopyLayout = (t: Pick<WebsiteTemplate, 'layoutType' | 'category'>) => String(t.layoutType || t.category || '').toLowerCase();
/** Slots this design shows, as `${layout}.${slot}` keys. Custom sections have none. */
export function templateCopySlots(t: WebsiteTemplate): [string, TemplateCopySlot][] {
  if (t.composition) return [];
  const layout = templateCopyLayout(t);
  return Object.entries(TEMPLATE_COPY[layout] || {}).map(([slot, def]) => [`${layout}.${slot}`, def]);
}
/** The wording shown for one slot: the owner's own words, else the design's wording for owners, else the demo. */
export function templateCopyText(t: WebsiteTemplate, slot: string): string {
  const layout = templateCopyLayout(t), def = TEMPLATE_COPY[layout]?.[slot];
  if (!def) return '';
  const fallback = def.demo ?? t.categoryLabel;
  if (!t.siteContent) return fallback;
  return t.siteContent.copy?.[`${layout}.${slot}`] || def.owner || fallback;
}
