import { ActivePage } from '../types';

/**
 * Authoritative Canonical Path Map for all Active Pages in Mystery Hub
 */
export const ROUTE_PATH_MAP: Record<ActivePage, string> = {
  home: '/',
  wallet: '/wallet',
  data: '/data',
  website: '/website-builder',
  business: '/my-business',
  marketplace: '/marketplace',
  services: '/services',
  about: '/about',
  help: '/help',
  orders: '/orders',
  admin: '/admin',
  earn: '/earn',
  afa: '/afa',
  app: '/app',
  // The editor's real address carries the website (websiteEditorPath); without one it falls back to the Builder.
  editor: '/website-builder',
};

/** Builder V6: the dedicated editor of one owned website. */
export const WEBSITE_EDITOR_PREFIX = '/website-builder/edit/';
export function websiteEditorPath(siteId: string): string {
  return WEBSITE_EDITOR_PREFIX + encodeURIComponent(siteId);
}
/** An in-app address the editor may return to: a local path, never the editor itself or another origin. */
export function safeEditorReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.length > 300) return null;
  if (/^\/website-builder\/edit\//i.test(value) || /[\s\\]/.test(value)) return null;
  return value;
}
/** The website id in an editor address (case kept, as the server issued it), or null. */
export function editorSiteIdFromPath(rawPath: string | null | undefined): string | null {
  const path = String(rawPath || '').split(/[?#]/)[0].replace(/\/+/g, '/');
  const match = path.match(/^\/website-builder\/edit\/([^/]+)\/?$/i);
  if (!match) return null;
  try { const id = decodeURIComponent(match[1]); return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : null; } catch { return null; }
}

/**
 * Normalizes any incoming pathname or URL to a clean, lowercase path string.
 *
 * Handles:
 * - Full URLs (e.g. "https://mystery-hub.onrender.com/admin" -> "/admin")
 * - Trailing slashes (e.g. "/admin/" or "/data///" -> "/admin", "/data")
 * - Query strings and hash fragments (e.g. "/admin?tab=orders#top" -> "/admin")
 * - Multiple redundant slashes (e.g. "//admin" -> "/admin")
 * - Case insensitivity (e.g. "/ADMIN" -> "/admin")
 * - Empty/null/undefined inputs default safely to "/"
 */
export function normalizePathname(rawPath: string | null | undefined): string {
  if (!rawPath) return '/';

  let path = rawPath.trim();
  if (!path) return '/';

  // If a full URL was provided, extract the pathname component safely
  if (path.includes('://')) {
    try {
      const parsed = new URL(path);
      path = parsed.pathname;
    } catch {
      const match = path.match(/^[a-z]+:\/\/[^/]+(\/.*)?$/i);
      path = match && match[1] ? match[1] : '/';
    }
  }

  // Strip query string and hash
  path = path.split('?')[0].split('#')[0];

  // Collapse multiple consecutive slashes
  path = path.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Remove trailing slashes (unless it is the root "/")
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }

  return path.toLowerCase();
}

/**
 * Authoritative Pathname Resolver:
 * Determines the target ActivePage for any given raw pathname.
 *
 * Recognized Routes:
 * - / -> 'home'
 * - /index.html -> 'home'
 * - /data (or /data/index.html) -> 'data'
 * - /website-builder/edit/:siteId -> 'editor' (Builder V6 dedicated editor)
 * - /website-builder, /website (or /website-builder/index.html) -> 'website'
 * - /my-business and its sections (/my-business/orders...) -> 'business'
 * - /marketplace (or /marketplace/index.html) -> 'marketplace'
 * - /services (or /services/index.html) -> 'services'
 * - /about (or /about/index.html) -> 'about'
 * - /orders (or /orders/index.html) -> 'orders'
 * - /admin (or /admin/index.html) -> 'admin'
 *
 * Fallback Behavior:
 * Unknown routes fallback to 'home' (the existing intentional product fallback).
 */
export function getPageFromPath(rawPath: string | null | undefined): ActivePage {
  const normalized = normalizePathname(rawPath);
  if (normalized === '/wallet') return 'wallet';

  // Exact root or direct index.html
  if (normalized === '/' || normalized === '/index.html') {
    return 'home';
  }

  // Core product routes and aliases
  if (normalized === '/data' || normalized === '/data/index.html') {
    return 'data';
  }

  // The dedicated editor has its own application shell (before the Builder's catch-all below).
  if (editorSiteIdFromPath(normalized)) return 'editor';

  if (
    normalized === '/website-builder' ||
    normalized === '/website' ||
    normalized.startsWith('/website-builder/') ||
    normalized.startsWith('/website/') ||
    normalized === '/website-builder/index.html' ||
    normalized === '/website/index.html'
  ) {
    return 'website';
  }

  // An owner's Business Workspace; each section has its own address so it can be bookmarked.
  if (normalized === '/my-business' || normalized.startsWith('/my-business/')) {
    return 'business';
  }

  if (
    normalized === '/marketplace' ||
    normalized.startsWith('/marketplace/') ||
    normalized === '/marketplace/index.html'
  ) {
    return 'marketplace';
  }

  if (normalized === '/services' || normalized === '/services/index.html') {
    return 'services';
  }

  if (normalized === '/help' || normalized === '/help/index.html' || normalized === '/faq') return 'help';

  if (normalized === '/about' || normalized === '/about/index.html') {
    return 'about';
  }

  if (normalized === '/orders' || normalized === '/orders/index.html') {
    return 'orders';
  }

  if (normalized === '/admin' || normalized === '/admin/index.html') {
    return 'admin';
  }

  if (
    normalized === '/earn' ||
    normalized === '/earn/index.html' ||
    normalized === '/referral' ||
    normalized === '/rewards'
  ) {
    return 'earn';
  }

  if (
    normalized === '/afa' ||
    normalized === '/afa/index.html' ||
    normalized === '/afa-registration' ||
    normalized === '/afa-registration/index.html'
  ) {
    return 'afa';
  }

  // The app landing page that WhatsApp links point to (dist/app/index.html carries its own share preview).
  if (normalized === '/app' || normalized === '/app/index.html') return 'app';

  // Intentional fallback for unknown routes
  return 'home';
}
