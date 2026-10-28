/**
 * Service Discovery V2: pure helpers for All Services (/services).
 * Status, search, categories and the /services?service=<slug> preview URL all derive from the static catalogue in
 * data/services.ts, so nothing here makes a request. AFA is the one service whose availability is a runtime fact.
 */
import type { DigitalService } from '../types';

export type AfaAvailability = 'checking' | 'available' | 'unavailable';
export type ServiceAvailability = 'available' | 'checking' | 'unavailable' | 'coming_soon';

export const serviceSlug = (service: Pick<DigitalService, 'id'>) => service.id.replace(/^srv-/, '');

export function findServiceBySlug(services: DigitalService[], slug: string | null | undefined) {
  const clean = (slug || '').trim().toLowerCase();
  return clean ? services.find(s => serviceSlug(s) === clean || s.id === clean) : undefined;
}

/** Catalogue status is not enough on its own: AFA is only available when /api/afa/config says so. */
export function serviceAvailability(service: DigitalService, afa: AfaAvailability): ServiceAvailability {
  if (service.status === 'coming_soon') return 'coming_soon';
  if (service.id === 'srv-afa') return afa;
  return 'available';
}

export const isUpcoming = (service: DigitalService) => service.status === 'coming_soon';

/** Short status label shown on cards. Website Builder is live on its free plan. */
export function serviceStatusLabel(service: DigitalService, availability: ServiceAvailability) {
  if (availability === 'coming_soon') return 'Coming soon';
  if (availability === 'checking') return 'Checking…';
  if (availability === 'unavailable') return 'Paused';
  if (service.id === 'srv-website') return 'Free plan';
  return 'Available';
}

/** What a card's action says. Every available service goes straight to its working page. */
export function serviceActionLabel(service: DigitalService, availability: ServiceAvailability) {
  if (availability === 'coming_soon') return 'Preview';
  const labels: Record<string, string> = {
    'srv-data': 'Buy data',
    'srv-airtime': 'Top up airtime',
    'srv-website': 'Build a website',
    'srv-marketplace': 'Browse marketplace',
    'srv-afa': availability === 'available' ? 'Register' : 'Check status',
    'srv-rewards': 'Open Mystery Earn',
    'srv-wallet': 'Open Wallet',
  };
  return labels[service.id] || 'Open';
}

/** Canonical address of each available service (used as the link href; clicks go through the app router). */
export function serviceHref(service: DigitalService) {
  const paths: Record<string, string> = { data: '/data', website: '/website-builder', marketplace: '/marketplace', afa: '/afa', earn: '/earn', wallet: '/wallet' };
  return service.status === 'coming_soon' || !service.targetPage ? servicesHref({ service: serviceSlug(service) }) : paths[service.targetPage] || '/services';
}

/* ---------------- Categories and search ---------------- */

export const categorySlug = (category: string) => category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Only categories that have at least one service, in catalogue order, with counts. */
export function serviceCategories(services: DigitalService[]) {
  const seen = new Map<string, { slug: string; label: string; count: number }>();
  for (const s of services) {
    const slug = categorySlug(s.category);
    const entry = seen.get(slug) || { slug, label: s.category, count: 0 };
    entry.count += 1;
    seen.set(slug, entry);
  }
  return [...seen.values()];
}

const normalise = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Every word typed must appear in the title, category, description or search keywords. */
export function matchesServiceQuery(service: DigitalService, query: string) {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const haystack = ` ${normalise([service.title, service.category, service.description, ...(service.keywords || [])].join(' '))}`;
  return words.every(word => haystack.includes(` ${word}`) || (word.length > 3 && haystack.includes(word)));
}

export function filterServices(services: DigitalService[], { category, q }: { category: string; q: string }) {
  return services.filter(s => (category === 'all' || categorySlug(s.category) === category) && matchesServiceQuery(s, q));
}

/* ---------------- URL state ---------------- */

export interface ServicesUrlState { service: string; q: string; category: string }

/** Reads /services?service=&q=&category= defensively; unknown categories fall back to all. */
export function readServicesUrl(search: string, services: DigitalService[]): ServicesUrlState {
  const params = new URLSearchParams(search);
  const category = (params.get('category') || '').toLowerCase();
  return {
    service: (params.get('service') || '').trim().toLowerCase().slice(0, 64),
    q: (params.get('q') || '').slice(0, 80),
    category: serviceCategories(services).some(c => c.slug === category) ? category : 'all',
  };
}

export function servicesHref(state: Partial<ServicesUrlState> = {}) {
  const params = new URLSearchParams();
  if (state.service) params.set('service', state.service);
  else {
    if (state.q?.trim()) params.set('q', state.q.trim());
    if (state.category && state.category !== 'all') params.set('category', state.category);
  }
  const query = params.toString();
  return `/services${query ? `?${query}` : ''}`;
}

/** Fired when the services URL changes without a popstate (an already-open directory re-reads it). */
export const SERVICES_URL_EVENT = 'mh-services-url';

/** Opens All Services (optionally at a preview or search) from another page; Back returns to that page. */
export function openServicesAt(setActivePage: (page: 'services') => void, state: Partial<ServicesUrlState> = {}) {
  setActivePage('services');
  if (typeof window !== 'undefined') {
    window.history.replaceState({ page: 'services' }, '', servicesHref(state));
    window.dispatchEvent(new Event(SERVICES_URL_EVENT));
  }
}
