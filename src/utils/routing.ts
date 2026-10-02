import { ActivePage } from '../types';

/**
 * Authoritative Canonical Path Map for all Active Pages in Mystery Hub
 */
export const ROUTE_PATH_MAP: Record<ActivePage, string> = {
  home: '/',
  data: '/data',
  website: '/website-builder',
  marketplace: '/marketplace',
  services: '/services',
  about: '/about',
  orders: '/orders',
  admin: '/admin',
  earn: '/earn',
};

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
 * - /website-builder, /website (or /website-builder/index.html) -> 'website'
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

  // Exact root or direct index.html
  if (normalized === '/' || normalized === '/index.html') {
    return 'home';
  }

  // Core product routes and aliases
  if (normalized === '/data' || normalized === '/data/index.html') {
    return 'data';
  }

  if (
    normalized === '/website-builder' ||
    normalized === '/website' ||
    normalized === '/website-builder/index.html' ||
    normalized === '/website/index.html'
  ) {
    return 'website';
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

  // Intentional fallback for unknown routes
  return 'home';
}
