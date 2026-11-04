/**
 * Business Workspace V1: the owner's management areas and their addresses (/my-business, /my-business/orders...).
 * Which areas a website has comes from the dashboard's existing tab rule (Data store, or Data history kept after a
 * design change), never from template names scattered through the UI. Each area maps to one dashboard tab.
 */
export type WorkspaceSection = 'overview' | 'orders' | 'products' | 'earnings' | 'promote' | 'analytics' | 'website';

export const WORKSPACE_BASE_PATH = '/my-business';

export const WORKSPACE_SECTIONS: Record<WorkspaceSection, { label: string; short: string; slug: string; tab: string; hint: string }> = {
  overview: { label: 'Overview', short: 'Overview', slug: '', tab: 'Overview', hint: 'Today’s picture and what needs you' },
  orders: { label: 'Orders', short: 'Orders', slug: 'orders', tab: 'Orders', hint: 'Payment and delivery for each sale' },
  products: { label: 'Products & pricing', short: 'Pricing', slug: 'products', tab: 'Bundles & Pricing', hint: 'Bundles on sale and your prices' },
  earnings: { label: 'Store Earnings', short: 'Earnings', slug: 'earnings', tab: 'Store Earnings', hint: 'Pending, available and withdrawals' },
  promote: { label: 'Promote your business', short: 'Promote', slug: 'promote', tab: 'Promote', hint: 'Ready-made adverts and captions' },
  analytics: { label: 'Analytics', short: 'Analytics', slug: 'analytics', tab: 'Analytics', hint: 'Visits and customer activity' },
  website: { label: 'Website & settings', short: 'Website', slug: 'website', tab: 'Settings', hint: 'Publish, share, design and delete' },
};

const ORDER: WorkspaceSection[] = ['overview', 'orders', 'products', 'earnings', 'promote', 'analytics', 'website'];

export function workspacePath(section: WorkspaceSection): string {
  const slug = WORKSPACE_SECTIONS[section].slug;
  return slug ? `${WORKSPACE_BASE_PATH}/${slug}` : WORKSPACE_BASE_PATH;
}

/** /my-business/orders → orders. Unknown or missing areas open the Overview. */
export function workspaceSectionFromPath(pathname: string | null | undefined): WorkspaceSection {
  const parts = String(pathname || '').toLowerCase().split(/[?#]/)[0].split('/').filter(Boolean);
  if (parts[0] !== WORKSPACE_BASE_PATH.slice(1)) return 'overview';
  const slug = parts[1] || '';
  return ORDER.find(section => WORKSPACE_SECTIONS[section].slug === slug) || 'overview';
}

export const sectionForTab = (tab: string): WorkspaceSection => ORDER.find(section => WORKSPACE_SECTIONS[section].tab === tab) || 'overview';

/** The areas this website has, in navigation order, from the dashboard's own tab list. */
export function workspaceSections(tabs: string[]): WorkspaceSection[] {
  return ORDER.filter(section => tabs.includes(WORKSPACE_SECTIONS[section].tab));
}

/** Before the business records load, show only what the design alone guarantees (a Data store has every area). */
export function initialWorkspaceTabs(reseller: boolean): string[] {
  return reseller ? ORDER.map(section => WORKSPACE_SECTIONS[section].tab) : ['Overview', 'Analytics', 'Settings'];
}

/**
 * V7.2.1: the business dock (phones and tablets) shows at most four areas plus More. A Data store keeps its daily
 * work there (Overview, Orders, Pricing, Earnings) with Analytics and Website & settings under More; other websites
 * have few areas, so every one of them fits. More only ever lists what the dock does not. V7.3: Promote (Data Stores)
 * opens from More and from the Overview share kit.
 */
export function businessDock(available: WorkspaceSection[], reseller: boolean): WorkspaceSection[] {
  return available.filter(section => !reseller || (section !== 'promote' && section !== 'analytics' && section !== 'website')).slice(0, 4);
}

/** The Website Builder's design gallery, explicitly. A plain /website-builder visit by an owner opens My Business. */
export const WEBSITE_DESIGNS_PATH = '/website-builder/designs';

/** Should a visit to this Builder address take an existing owner to My Business? Only the bare Website destination:
 * the explicit gallery, a design link (?template=…, /website-builder/template/…) and the editor always stay put. */
export function builderVisitOpensBusiness(pathname: string, search = ''): boolean {
  const path = String(pathname || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase() || '/';
  const params = new URLSearchParams(search);
  if (params.has('template') || params.has('t')) return false;
  return path === '/website-builder' || path === '/website' || path === '/website-builder/index.html' || path === '/website/index.html';
}

const RANGE_LABEL: Record<string, string> = { '1': 'last 24 hours', '7': 'last 7 days', '30': 'last 30 days', '90': 'last 90 days', all: 'all time' };
export const workspaceRangeLabel = (range: string) => RANGE_LABEL[range] || `last ${range} days`;
