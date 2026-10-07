import { validateWebsiteComposition, validateWebsiteContentPatch } from '../services/websiteValidation.js';
import { resolveWebsitePlan, WEBSITE_PLANS, createWebsiteComposition } from '../../src/config/websiteBuilder.js';
/**
 * Website Builder Data Store
 * Persists and queries user websites in PostgreSQL with in-memory fallback.
 * Strictly enforces server-side ownership, slug uniqueness, and free-tier limits.
 */

import { websiteDatabase, withWebsiteLock, websiteTransactionClient } from './websiteTransaction.js';
import { WebsiteAssetStore } from './websiteAssetStore.js';
import { WebsiteOperationError } from '../services/websiteCloudinary.js';
import { migrateWebsiteTemplate } from '../../src/utils/websiteTemplateMigration.js';
import { AdminAuditStore } from './adminAuditStore.js';
import {
  WebsiteSiteRecord,
  WebsiteSiteStatus,
  SiteContent,
  SiteSettings,
  CreateWebsiteInput,
  UpdateWebsiteInput,
  generateSafeSlug,
  sanitizeString,
  sanitizeColor,
  sanitizeUrl,
  sanitizeTemplateItems,
  isValidTemplateId,
} from '../types/website.js';
import { WEBSITE_TEMPLATES } from '../../src/data/templates.js';

// In-memory fallback store for local development/testing without PostgreSQL
const devWebsiteStore = new Map<string, WebsiteSiteRecord>();

export class WebsiteStore {
  /**
   * Clear in-memory store (used for test isolation)
   */
  static clearDevStore(): void {
    devWebsiteStore.clear();
  }

  /**
   * Find all active sites owned by a specific user
   */
  static async findSitesByUserId(userId: string): Promise<WebsiteSiteRecord[]> {
    const pool = websiteDatabase();
    if (!pool) {
      return Array.from(devWebsiteStore.values())
        .filter((s) => s.user_id === userId && s.status !== 'archived')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).map(s => structuredClone(s));
    }

    const res = await pool.query<WebsiteSiteRecord>(
      `SELECT * FROM website_sites WHERE user_id = $1 AND status != 'archived' ORDER BY updated_at DESC;`,
      [userId]
    );

    return res.rows.map((row) => this.normalizeRecord(row));
  }

  /**
   * Find a site by ID
   */
  static async findSiteById(id: string): Promise<WebsiteSiteRecord | null> {
    const pool = websiteDatabase();
    if (!pool) {
      const site = devWebsiteStore.get(id);
      return site && site.status !== 'archived' ? structuredClone(site) : null;
    }

    const res = await pool.query<WebsiteSiteRecord>(
      `SELECT * FROM website_sites WHERE id = $1 AND status != 'archived';`,
      [id]
    );

    if (res.rows.length === 0) return null;
    return this.normalizeRecord(res.rows[0]);
  }

  /**
   * Find a public site by slug (published status only)
   */
  static async findPublishedSiteBySlug(slug: string): Promise<WebsiteSiteRecord | null> {
    const cleanSlug = slug.toLowerCase().trim();
    const pool = websiteDatabase();
    if (!pool) {
      for (const s of devWebsiteStore.values()) {
        if (s.slug === cleanSlug && s.status === 'published') {
          return structuredClone(s);
        }
      }
      return null;
    }

    const res = await pool.query<WebsiteSiteRecord>(
      `SELECT * FROM website_sites WHERE slug = $1 AND status = 'published';`,
      [cleanSlug]
    );

    if (res.rows.length === 0) return null;
    return this.normalizeRecord(res.rows[0]);
  }

  /**
   * Check if a slug already exists
   */
  static async isSlugTaken(slug: string, excludeSiteId?: string): Promise<boolean> {
    const cleanSlug = slug.toLowerCase().trim();
    const pool = websiteDatabase();
    if (!pool) {
      for (const s of devWebsiteStore.values()) {
        if (s.slug === cleanSlug && s.status !== 'archived' && s.id !== excludeSiteId) {
          return true;
        }
      }
      return false;
    }

    const res = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM website_sites WHERE slug = $1 AND status != 'archived' ${
        excludeSiteId ? 'AND id != $2' : ''
      };`,
      excludeSiteId ? [cleanSlug, excludeSiteId] : [cleanSlug]
    );

    return parseInt(res.rows[0].count, 10) > 0;
  }

  /**
   * Generate an available unique slug based on business name
   */
  static async generateUniqueSlug(baseName: string, excludeSiteId?: string): Promise<string> {
    let candidate = generateSafeSlug(baseName);
    if (!(await this.isSlugTaken(candidate, excludeSiteId))) {
      return candidate;
    }

    // Try suffixes
    for (let i = 1; i <= 20; i++) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const attempt = `${candidate.slice(0, 30)}-${suffix}`;
      if (!(await this.isSlugTaken(attempt, excludeSiteId))) {
        return attempt;
      }
    }

    return `${candidate.slice(0, 24)}-${Date.now().toString(36)}`;
  }

  /**
   * Create a new website project
   * Enforces 1 active site limit for free tier
   */
  static async createSite(userId: string, input: CreateWebsiteInput) {
    return withWebsiteLock(userId, () => this.createSiteLocked(userId, input));
  }
  private static async createSiteLocked(
    userId: string,
    input: CreateWebsiteInput
  ): Promise<{ site: WebsiteSiteRecord; alreadyExists?: boolean }> {
    validateWebsiteContentPatch(input.content);
    // 1. Enforce 1 active site limit per user for V1
    const existingSites = await this.findSitesByUserId(userId);
    if (existingSites.length >= WEBSITE_PLANS[resolveWebsitePlan(userId)].maxSites) {
      // User already has an active site, return it instead of silently duplicating
      return { site: existingSites[0], alreadyExists: true };
    }

    const id = `site_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const templateId = sanitizeString(input.template_id, 64);

    const templateDef = WEBSITE_TEMPLATES.find((t) => t.id === templateId);
    if (!templateDef) {
      throw new Error(`Invalid or unknown templateId: "${templateId}".`);
    }

    // Template demos are illustrative. New websites must not inherit demo contacts or claims.
    const demoPhone = '';
    const defaultBusinessName = templateDef.demoBusinessName || 'My Business Website';
    const name = sanitizeString(input.name || defaultBusinessName, 128);

    const slug = await this.generateUniqueSlug(input.slug || name);

    // Initial content derived from the selected template record (editable starter content)
    const initialContent: SiteContent = {
      ...(input.content?.composition !== undefined ? { composition: validateWebsiteComposition(input.content.composition, userId) } : templateId === "tmpl-start-blank" ? { composition: createWebsiteComposition() } : {}),
      businessName: sanitizeString(input.content?.businessName || name, 100),
      tagline: sanitizeString(input.content?.tagline || 'Welcome to our business', 150),
      aboutText: sanitizeString(
        input.content?.aboutText || '',
        2000
      ),
      location: sanitizeString(input.content?.location || '', 150),
      phone: sanitizeString(input.content?.phone || demoPhone || '', 30),
      whatsapp: sanitizeString(input.content?.whatsapp || input.content?.phone || demoPhone || '', 30),
      email: sanitizeString(input.content?.email || '', 100),
      heroImage: sanitizeUrl(input.content?.heroImage || templateDef.heroImage || ''),
      logoUrl: sanitizeUrl(input.content?.logoUrl || ''),
      ctaLabel: sanitizeString(
        input.content?.ctaLabel || (templateDef.id === 'tmpl-data-reseller' ? 'Buy Data' : templateDef.id === 'tmpl-start-blank' ? 'Contact us' : 'Order via WhatsApp'),
        50
      ),
      ctaTarget: sanitizeUrl(input.content?.ctaTarget || input.content?.whatsapp || demoPhone || ''),
      social: {
        instagram: sanitizeString(input.content?.social?.instagram || '', 50),
        facebook: sanitizeString(input.content?.social?.facebook || '', 100),
        tiktok: sanitizeString(input.content?.social?.tiktok || '', 50),
      },
      items: sanitizeTemplateItems(input.content?.items ?? []),
      stats: (input.content?.stats || []).slice(0, 8).map(s => ({label:sanitizeString(s.label,50),value:sanitizeString(s.value,50)})),
      features: (input.content?.features || []).slice(0, 10).map(f => sanitizeString(f,80)),
    };

    const initialSettings: SiteSettings = {
      primaryColor: sanitizeColor(input.settings?.primaryColor || templateDef.colorScheme?.primary, '#0f172a'),
      accentColor: sanitizeColor(input.settings?.accentColor || templateDef.accentColor || templateDef.colorScheme?.secondary, '#00c365'),
      backgroundColor: sanitizeColor(input.settings?.backgroundColor || templateDef.colorScheme?.background, '#ffffff'),
      fontFamily: sanitizeString(input.settings?.fontFamily || 'font-sans', 30),
      borderRadius: sanitizeString(input.settings?.borderRadius || 'rounded-xl', 30),
    };

    const siteRecord: WebsiteSiteRecord = {
      id,
      user_id: userId,
      template_id: templateId,
      name,
      slug,
      status: 'draft',
      content_json: initialContent,
      settings_json: initialSettings,
      created_at: now,
      updated_at: now,
      published_at: null,
    };

    await WebsiteAssetStore.validateReferences(id, userId, initialContent);
    const pool = websiteDatabase();
    if (!pool) {
      devWebsiteStore.set(id, structuredClone(siteRecord));
      return { site: siteRecord };
    }

    await pool.query(
      `INSERT INTO website_sites (
        id, user_id, template_id, name, slug, status, content_json, settings_json, created_at, updated_at, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
      [
        siteRecord.id,
        siteRecord.user_id,
        siteRecord.template_id,
        siteRecord.name,
        siteRecord.slug,
        siteRecord.status,
        JSON.stringify(siteRecord.content_json),
        JSON.stringify(siteRecord.settings_json),
        siteRecord.created_at,
        siteRecord.updated_at,
        siteRecord.published_at,
      ]
    );

    return { site: siteRecord };
  }

  /**
   * Update an existing site
   * Enforces server-side ownership (user_id)
   */
  static async updateSite(id: string, userId: string, input: UpdateWebsiteInput) {
    return withWebsiteLock(userId, () => this.updateSiteLocked(id, userId, input));
  }
  private static async updateSiteLocked(
    id: string,
    userId: string,
    input: UpdateWebsiteInput
  ): Promise<WebsiteSiteRecord | null> {
    validateWebsiteContentPatch(input.content);
    const existing = await this.findSiteById(id);
    if (!existing) return null;

    // Strict ownership verification
    if (existing.user_id !== userId) {
      throw new Error('Forbidden: You do not own this website.');
    }

    if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== existing.updated_at) throw new WebsiteOperationError('Your website changed in another session. Reload before saving.', 409);

    const now = new Date(Math.max(Date.now(), Date.parse(existing.updated_at) + 1)).toISOString();
    const updatedName = input.name !== undefined ? sanitizeString(input.name, 128) : existing.name;

    const mergedContent: SiteContent = {
      ...existing.content_json,
      ...(input.content?.composition !== undefined ? { composition: validateWebsiteComposition(input.content.composition, userId) } : {}),
      ...(input.content
        ? {
            businessName:
              input.content.businessName !== undefined
                ? sanitizeString(input.content.businessName, 100)
                : existing.content_json.businessName,
            tagline:
              input.content.tagline !== undefined
                ? sanitizeString(input.content.tagline, 150)
                : existing.content_json.tagline,
            aboutText:
              input.content.aboutText !== undefined
                ? sanitizeString(input.content.aboutText, 2000)
                : existing.content_json.aboutText,
            location:
              input.content.location !== undefined
                ? sanitizeString(input.content.location, 150)
                : existing.content_json.location,
            phone:
              input.content.phone !== undefined
                ? sanitizeString(input.content.phone, 30)
                : existing.content_json.phone,
            whatsapp:
              input.content.whatsapp !== undefined
                ? sanitizeString(input.content.whatsapp, 30)
                : existing.content_json.whatsapp,
            email:
              input.content.email !== undefined
                ? sanitizeString(input.content.email, 100)
                : existing.content_json.email,
            heroImage:
              input.content.heroImage !== undefined
                ? sanitizeUrl(input.content.heroImage)
                : existing.content_json.heroImage,
            logoUrl:
              input.content.logoUrl !== undefined
                ? sanitizeUrl(input.content.logoUrl)
                : existing.content_json.logoUrl,
            ctaLabel:
              input.content.ctaLabel !== undefined
                ? sanitizeString(input.content.ctaLabel, 50)
                : existing.content_json.ctaLabel,
            ctaTarget:
              input.content.ctaTarget !== undefined
                ? sanitizeUrl(input.content.ctaTarget)
                : existing.content_json.ctaTarget,
            social: input.content.social
              ? {
                  instagram: sanitizeString(input.content.social.instagram || '', 50),
                  facebook: sanitizeString(input.content.social.facebook || '', 100),
                  tiktok: sanitizeString(input.content.social.tiktok || '', 50),
                }
              : existing.content_json.social,
            items: Array.isArray(input.content.items)
              ? sanitizeTemplateItems(input.content.items)
              : existing.content_json.items,
            stats: Array.isArray(input.content.stats)
              ? input.content.stats
              : existing.content_json.stats,
            features: Array.isArray(input.content.features)
              ? input.content.features
              : existing.content_json.features,
          }
        : {}),
    };

    await WebsiteAssetStore.validateReferences(id, userId, mergedContent);

    const mergedSettings: SiteSettings = {
      ...existing.settings_json,
      ...(input.settings
        ? {
            primaryColor:
              input.settings.primaryColor !== undefined
                ? sanitizeColor(input.settings.primaryColor, existing.settings_json.primaryColor)
                : existing.settings_json.primaryColor,
            accentColor:
              input.settings.accentColor !== undefined
                ? sanitizeColor(input.settings.accentColor, existing.settings_json.accentColor)
                : existing.settings_json.accentColor,
            backgroundColor:
              input.settings.backgroundColor !== undefined
                ? sanitizeColor(input.settings.backgroundColor, existing.settings_json.backgroundColor)
                : existing.settings_json.backgroundColor,
            fontFamily:
              input.settings.fontFamily !== undefined
                ? sanitizeString(input.settings.fontFamily, 30)
                : existing.settings_json.fontFamily,
            borderRadius:
              input.settings.borderRadius !== undefined
                ? sanitizeString(input.settings.borderRadius, 30)
                : existing.settings_json.borderRadius,
          }
        : {}),
    };

    const updatedRecord: WebsiteSiteRecord = {
      ...existing,
      name: updatedName,
      content_json: mergedContent,
      settings_json: mergedSettings,
      updated_at: now,
    };

    const pool = websiteDatabase();
    if (!pool) {
      devWebsiteStore.set(id, structuredClone(updatedRecord));
      return updatedRecord;
    }

    await pool.query(
      `UPDATE website_sites 
       SET name = $1, content_json = $2, settings_json = $3, updated_at = $4
       WHERE id = $5 AND user_id = $6;`,
      [
        updatedRecord.name,
        JSON.stringify(updatedRecord.content_json),
        JSON.stringify(updatedRecord.settings_json),
        updatedRecord.updated_at,
        id,
        userId,
      ]
    );

    return updatedRecord;
  }

  /**
   * Publish a website
   * Enforces server-side ownership
   */
  static async publishSite(id: string, userId: string) {
    return withWebsiteLock(userId, () => this.publishSiteLocked(id, userId));
  }
  private static async publishSiteLocked(id: string, userId: string): Promise<WebsiteSiteRecord | null> {
    const existing = await this.findSiteById(id);
    if (!existing) return null;

    if (existing.user_id !== userId) {
      throw new Error('Forbidden: You do not own this website.');
    }

    const now = new Date(Math.max(Date.now(), Date.parse(existing.updated_at) + 1)).toISOString();
    const updatedRecord: WebsiteSiteRecord = {
      ...existing,
      status: 'published',
      published_at: now,
      updated_at: now,
    };

    const pool = websiteDatabase();
    if (!pool) {
      devWebsiteStore.set(id, structuredClone(updatedRecord));
      return updatedRecord;
    }

    await pool.query(
      `UPDATE website_sites 
       SET status = 'published', published_at = $1, updated_at = $2
       WHERE id = $3 AND user_id = $4;`,
      [updatedRecord.published_at, updatedRecord.updated_at, id, userId]
    );

    return updatedRecord;
  }

  /**
   * Unpublish a website (return to draft)
   * Enforces server-side ownership
   */
  static async unpublishSite(id: string, userId: string) {
    return withWebsiteLock(userId, () => this.unpublishSiteLocked(id, userId));
  }
  private static async unpublishSiteLocked(id: string, userId: string): Promise<WebsiteSiteRecord | null> {
    const existing = await this.findSiteById(id);
    if (!existing) return null;

    if (existing.user_id !== userId) {
      throw new Error('Forbidden: You do not own this website.');
    }

    const now = new Date(Math.max(Date.now(), Date.parse(existing.updated_at) + 1)).toISOString();
    const updatedRecord: WebsiteSiteRecord = {
      ...existing,
      status: 'draft',
      updated_at: now,
    };

    const pool = websiteDatabase();
    if (!pool) {
      devWebsiteStore.set(id, structuredClone(updatedRecord));
      return updatedRecord;
    }

    await pool.query(
      `UPDATE website_sites 
       SET status = 'draft', updated_at = $1
       WHERE id = $2 AND user_id = $3;`,
      [updatedRecord.updated_at, id, userId]
    );

    return updatedRecord;
  }

  /**
   * Delete a site permanently with ownership check.
   * Releases user's one-site free limit.
   */
  static async deleteSite(id: string, userId: string) {
    return withWebsiteLock(userId, () => this.deleteSiteLocked(id, userId));
  }
  private static async deleteSiteLocked(id: string, userId: string): Promise<boolean> {
    const existing = await this.findSiteById(id);
    if (!existing) {
      return false;
    }

    if (existing.user_id !== userId) {
      throw new Error('Forbidden: You do not own this website.');
    }

    await WebsiteAssetStore.detachSite(id);
    const pool = websiteDatabase();
    if (!pool) {
      devWebsiteStore.delete(id);
      return true;
    }

    await pool.query(
      `DELETE FROM website_sites WHERE id = $1 AND user_id = $2;`,
      [id, userId]
    );

    return true;
  }

  static async changeTemplate(id: string, userId: string, targetTemplateId: string, expectedUpdatedAt?: string) {
    return withWebsiteLock(userId, async () => {
      const existing = await WebsiteAssetStore.ownedSite(id, userId);
      if (!isValidTemplateId(targetTemplateId) || targetTemplateId === existing.template_id) throw new WebsiteOperationError('Choose a different valid template.');
      if (expectedUpdatedAt && expectedUpdatedAt !== existing.updated_at) throw new WebsiteOperationError('Your website changed. Reload before changing template.', 409);
      const content = migrateWebsiteTemplate(existing.content_json, existing.template_id, targetTemplateId);
      if (content.composition) content.composition = validateWebsiteComposition(content.composition, userId);
      await WebsiteAssetStore.validateReferences(id, userId, content);
      const updated = { ...existing, template_id: targetTemplateId, content_json: content, updated_at: new Date(Math.max(Date.now(), Date.parse(existing.updated_at) + 1)).toISOString() };
      const db = websiteDatabase();
      if (db) await db.query('UPDATE website_sites SET template_id=$1, content_json=$2, updated_at=$3 WHERE id=$4 AND user_id=$5', [targetTemplateId, JSON.stringify(content), updated.updated_at, id, userId]);
      else devWebsiteStore.set(id, structuredClone(updated));
      return updated;
    });
  }
  static async allSites(): Promise<WebsiteSiteRecord[]> {
    const db = websiteDatabase();
    return db ? (await db.query("SELECT * FROM website_sites WHERE status != 'archived' ORDER BY created_at DESC")).rows.map(row => this.normalizeRecord(row)) : [...devWebsiteStore.values()].filter(s => s.status !== 'archived').map(s => structuredClone(s));
  }
  static async forceUnpublish(id: string, adminId: string, confirmation: string) {
    const site = await this.findSiteById(id);
    if (!site) throw new WebsiteOperationError('Website not found.', 404);
    return withWebsiteLock(site.user_id, async () => {
      const current = await this.findSiteById(id);
      if (!current) throw new WebsiteOperationError('Website not found.', 404);
      if (confirmation !== current.slug) throw new WebsiteOperationError('Type the website slug to confirm.');
      const result = await this.unpublishSite(id, current.user_id);
      await AdminAuditStore.record({ adminUserId: adminId, action: 'website_admin_unpublished', entityType: 'website', entityId: id, metadata: { previousStatus: current.status } }, websiteTransactionClient());
      return result;
    });
  }

  /**
   * Normalize DB row JSONB types safely
   */
  private static normalizeRecord(row: any): WebsiteSiteRecord {
    return {
      id: row.id,
      user_id: row.user_id,
      template_id: row.template_id,
      name: row.name,
      slug: row.slug,
      status: row.status as WebsiteSiteStatus,
      content_json:
        typeof row.content_json === 'string'
          ? JSON.parse(row.content_json)
          : row.content_json || {},
      settings_json:
        typeof row.settings_json === 'string'
          ? JSON.parse(row.settings_json)
          : row.settings_json || {},
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
      published_at: row.published_at
        ? row.published_at instanceof Date
          ? row.published_at.toISOString()
          : String(row.published_at)
        : null,
    };
  }
}
