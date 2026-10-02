/**
 * Website Builder V1 Types & Schemas
 */

import { TemplateItem } from '../../src/types/index.js';

export type WebsiteSiteStatus = 'draft' | 'published' | 'archived';

export interface SiteSocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface SiteContent {
  businessName: string;
  tagline: string;
  aboutText: string;
  location: string;
  phone: string;
  whatsapp: string;
  email: string;
  heroImage: string;
  logoUrl?: string;
  ctaLabel: string;
  ctaTarget: string;
  social?: SiteSocialLinks;
  items?: TemplateItem[];
  stats?: Array<{ label: string; value: string }>;
  features?: string[];
}

export interface SiteSettings {
  primaryColor: string;
  accentColor: string;
  backgroundColor?: string;
  fontFamily?: string;
  borderRadius?: string;
}

export interface WebsiteSiteRecord {
  id: string;
  user_id: string;
  template_id: string;
  name: string;
  slug: string;
  status: WebsiteSiteStatus;
  content_json: SiteContent;
  settings_json: SiteSettings;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface PublicWebsiteSite {
  id: string;
  template_id: string;
  name: string;
  slug: string;
  content: SiteContent;
  settings: SiteSettings;
  published_at?: string | null;
}

export interface CreateWebsiteInput {
  template_id: string;
  name: string;
  slug?: string;
  content?: Partial<SiteContent>;
  settings?: Partial<SiteSettings>;
}

export interface UpdateWebsiteInput {
  name?: string;
  content?: Partial<SiteContent>;
  settings?: Partial<SiteSettings>;
}

/**
 * Generate a safe URL-friendly slug
 */
export function generateSafeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 36);

  // Reserve system paths
  const reserved = new Set([
    'admin',
    'api',
    'auth',
    'data',
    'website',
    'websites',
    'sites',
    'marketplace',
    'services',
    'about',
    'orders',
    'earn',
    'login',
    'signup',
    'health',
    'public',
  ]);

  if (!cleaned || reserved.has(cleaned)) {
    return `site-${Math.random().toString(36).slice(2, 8)}`;
  }

  return cleaned;
}

/**
 * Strips dangerous HTML and scripts from string inputs
 */
export function sanitizeString(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<[^>]+>/g, '') // strip all raw html tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Validates and sanitizes hex color codes (#xxx or #xxxxxx)
 */
export function sanitizeColor(color: unknown, fallback = '#00c365'): string {
  if (typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Sanitizes URLs (only permits http, https, tel, mailto, wa.me, or relative paths)
 */
export function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed.slice(0, 500);
  }
  return '';
}
