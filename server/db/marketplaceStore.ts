import { MARKETPLACE_LIMITS, duplicateMarketplaceName } from '../../shared/marketplaceLimits.js';
import { parseJsonPickupLocations, parseJsonVariants } from '../types/marketplace.js';
import { randomUUID } from 'node:crypto';
import { MarketplaceControlStore, plainText } from './marketplaceControlStore.js';
/**
 * Marketplace Data Store
 * Persists and queries marketplace products in PostgreSQL with in-memory fallback.
 * Strictly enforces RBAC auditing, slug uniqueness, and customer data safety.
 */

import { getPool } from './connection.js';
import {
  MarketplaceProductRecord,
  MarketplaceProductPriceType,
  MarketplaceProductAvailability,
  MarketplaceSpecItem,
  PublicMarketplaceProduct,
  AdminMarketplaceProduct,
  toPublicMarketplaceProduct,
  toAdminMarketplaceProduct,
  generateSlug,
} from '../types/marketplace.js';
import { AdminAuditStore } from './adminAuditStore.js';

// In-memory fallback store for local development/testing without PostgreSQL
const devMarketplaceStore = new Map<string, MarketplaceProductRecord>();

export interface CreateMarketplaceProductInput {
  productKind?: import('../types/marketplace.js').MarketplaceProductKind;
  fulfilmentNote?: string | null;
  fulfilmentIdentifierLabel?: string | null;
  fulfilmentIdentifierPlaceholder?: string | null;
  fulfilmentIdentifierRequired?: boolean;
  adminNote?: string | null;

  slug?: string;
  name: string;
  category: string;
  tagline?: string | null;
  description?: string | null;
  priceType: MarketplaceProductPriceType;
  priceMinor?: number | null;
  referralRewardMinor?: number | null;
  purchaseEnabled?: boolean;
  fulfilmentMode?: import('../types/marketplace.js').MarketplaceFulfilmentMode;
  pickupLocations?: import('../types/marketplace.js').MarketplacePickupLocation[] | null;
  deliveryAvailable?: boolean;
  deliveryNote?: string | null;
  purchaseNote?: string | null;
  paymentRequiredBeforeDelivery?: boolean;
  variants?: import('../types/marketplace.js').MarketplaceProductVariant[] | null;
  availability: MarketplaceProductAvailability;
  availabilityLabel?: string | null;
  badge?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  galleryUrls?: string[] | null;
  highlights?: string[] | null;
  specs?: MarketplaceSpecItem[] | null;
  featured?: boolean;
  published?: boolean;
  sortOrder?: number;
}

export interface UpdateMarketplaceProductInput {
  productKind?: import('../types/marketplace.js').MarketplaceProductKind;
  fulfilmentNote?: string | null;
  fulfilmentIdentifierLabel?: string | null;
  fulfilmentIdentifierPlaceholder?: string | null;
  fulfilmentIdentifierRequired?: boolean;
  adminNote?: string | null;

  slug?: string;
  name?: string;
  category?: string;
  tagline?: string | null;
  description?: string | null;
  priceType?: MarketplaceProductPriceType;
  priceMinor?: number | null;
  referralRewardMinor?: number | null;
  purchaseEnabled?: boolean;
  fulfilmentMode?: import('../types/marketplace.js').MarketplaceFulfilmentMode;
  pickupLocations?: import('../types/marketplace.js').MarketplacePickupLocation[] | null;
  deliveryAvailable?: boolean;
  deliveryNote?: string | null;
  purchaseNote?: string | null;
  paymentRequiredBeforeDelivery?: boolean;
  variants?: import('../types/marketplace.js').MarketplaceProductVariant[] | null;
  availability?: MarketplaceProductAvailability;
  availabilityLabel?: string | null;
  badge?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  galleryUrls?: string[] | null;
  highlights?: string[] | null;
  specs?: MarketplaceSpecItem[] | null;
  featured?: boolean;
  published?: boolean;
  archived?: boolean;
  sortOrder?: number;
}

export class MarketplaceStore {
  static assertStorageBounds(record:MarketplaceProductRecord) {
    plainText(record.name,'Product name',MARKETPLACE_LIMITS.productName,true);
    plainText(record.availability_label,'Availability label',MARKETPLACE_LIMITS.availabilityLabel);
    plainText(record.badge,'Badge',MARKETPLACE_LIMITS.badge);
    for(const location of parseJsonPickupLocations(record.pickup_locations))plainText(location.id,'Pickup location ID',MARKETPLACE_LIMITS.pickupId,true);
    for(const variant of parseJsonVariants(record.variants))plainText(variant.id,'Option ID',MARKETPLACE_LIMITS.variantId,true);
  }
  static async withCategoryLabels<T extends PublicMarketplaceProduct>(products: T[]): Promise<T[]> {
    const labels = new Map((await MarketplaceControlStore.getCategories()).map(c => [c.slug,c.label]));
    return products.map(p => ({...p,categoryLabel:labels.get(p.category) || p.categoryLabel}));
  }
  static async duplicateProduct(id: string, adminId: string) {
    const source = await this.getProductById(id);
    if (!source) throw new Error('Product not found.');
    const publicData = toAdminMarketplaceProduct(source);
    const copy = await this.createProduct({...publicData, name: duplicateMarketplaceName(source.name), slug: 'copy-of-' + source.slug, adminNote: source.admin_note, published:false, featured:false, sortOrder:source.sort_order},adminId);
    await AdminAuditStore.record({adminUserId:adminId,action:'marketplace_product_duplicated',entityType:'marketplace_product',entityId:copy.id,metadata:{sourceId:id}});
    return copy;
  }
  static async restoreProduct(id: string, adminId: string) {
    const saved = await this.updateProduct(id,{archived:false,published:false},adminId);
    await AdminAuditStore.record({adminUserId:adminId,action:'marketplace_product_restored',entityType:'marketplace_product',entityId:id,metadata:{published:false}});
    return saved;
  }

  /**
   * Generates a unique slug ensuring no collision in PostgreSQL or in-memory
   */
  static async resolveUniqueSlug(baseNameOrSlug: string, excludeId?: string): Promise<string> {
    const baseSlug = generateSlug(baseNameOrSlug);
    const pool = getPool();

    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      if (pool) {
        let query = 'SELECT id FROM marketplace_products WHERE slug = $1';
        const params: (string | undefined)[] = [candidate];
        if (excludeId) {
          query += ' AND id != $2';
          params.push(excludeId);
        }
        query += ' LIMIT 1;';
        const res = await pool.query(query, params);
        if (res.rows.length === 0) {
          return candidate;
        }
      } else {
        const found = Array.from(devMarketplaceStore.values()).find(
          (p) => p.slug === candidate && (!excludeId || p.id !== excludeId)
        );
        if (!found) {
          return candidate;
        }
      }

      counter++;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  /**
   * 1. Public query: Returns ONLY published & non-archived products
   * Safe customer-facing fields only
   */
  static async getPublicProducts(filters?: {
    category?: string;
    search?: string;
    featured?: boolean;
  }): Promise<PublicMarketplaceProduct[]> {
    const pool = getPool();

    if (pool) {
      const conditions: string[] = ['published = true', 'archived = false'];
      const values: unknown[] = [];
      let paramIdx = 1;

      if (filters?.category && filters.category !== 'all') {
        conditions.push(`category = $${paramIdx++}`);
        values.push(filters.category.trim());
      }

      if (filters?.featured !== undefined) {
        conditions.push(`featured = $${paramIdx++}`);
        values.push(filters.featured);
      }

      if (filters?.search && filters.search.trim().length > 0) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        conditions.push(
          `(LOWER(name) LIKE $${paramIdx} OR LOWER(tagline) LIKE $${paramIdx} OR LOWER(description) LIKE $${paramIdx})`
        );
        values.push(term);
        paramIdx++;
      }

      const query = `
        SELECT * FROM marketplace_products
        WHERE ${conditions.join(' AND ')}
        ORDER BY featured DESC, sort_order ASC, created_at DESC;
      `;

      const res = await pool.query(query, values);
      return this.withCategoryLabels(res.rows.map((row) => toPublicMarketplaceProduct(row as MarketplaceProductRecord)));
    }

    // In-memory fallback
    let items = Array.from(devMarketplaceStore.values()).filter(
      (p) => p.published && !p.archived
    );

    if (filters?.category && filters.category !== 'all') {
      items = items.filter((p) => p.category === filters.category);
    }

    if (filters?.featured !== undefined) {
      items = items.filter((p) => Boolean(p.featured) === filters.featured);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const q = filters.search.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.tagline && p.tagline.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return this.withCategoryLabels(items.map(toPublicMarketplaceProduct));
  }

  /**
   * 2. Public query by slug
   */
  static async getPublicProductBySlug(slug: string): Promise<PublicMarketplaceProduct | null> {
    const cleanSlug = slug.trim().toLowerCase();
    const pool = getPool();

    if (pool) {
      const query = `
        SELECT * FROM marketplace_products
        WHERE slug = $1 AND published = true AND archived = false
        LIMIT 1;
      `;
      const res = await pool.query(query, [cleanSlug]);
      if (res.rows.length === 0) return null;
      return (await this.withCategoryLabels([toPublicMarketplaceProduct(res.rows[0] as MarketplaceProductRecord)]))[0];
    }

    const item = Array.from(devMarketplaceStore.values()).find(
      (p) => p.slug === cleanSlug && p.published && !p.archived
    );
    return item ? (await this.withCategoryLabels([toPublicMarketplaceProduct(item)]))[0] : null;
  }

  /**
   * 3. Admin query: supports drafts, archived, category filtering, search
   */
  static async getAdminProducts(filters?: {
    category?: string;
    status?: 'all' | 'published' | 'draft' | 'archived';
    search?: string;
  }): Promise<AdminMarketplaceProduct[]> {
    const pool = getPool();

    if (pool) {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIdx = 1;

      if (filters?.status === 'published') {
        conditions.push('published = true AND archived = false');
      } else if (filters?.status === 'draft') {
        conditions.push('published = false AND archived = false');
      } else if (filters?.status === 'archived') {
        conditions.push('archived = true');
      }

      if (filters?.category && filters.category !== 'all') {
        conditions.push(`category = $${paramIdx++}`);
        values.push(filters.category.trim());
      }

      if (filters?.search && filters.search.trim().length > 0) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        conditions.push(
          `(LOWER(name) LIKE $${paramIdx} OR LOWER(slug) LIKE $${paramIdx} OR LOWER(tagline) LIKE $${paramIdx})`
        );
        values.push(term);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT * FROM marketplace_products
        ${whereClause}
        ORDER BY archived ASC, sort_order ASC, created_at DESC;
      `;

      const res = await pool.query(query, values);
      return this.withCategoryLabels(res.rows.map((row) => toAdminMarketplaceProduct(row as MarketplaceProductRecord)));
    }

    // In-memory fallback
    let items = Array.from(devMarketplaceStore.values());

    if (filters?.status === 'published') {
      items = items.filter((p) => p.published && !p.archived);
    } else if (filters?.status === 'draft') {
      items = items.filter((p) => !p.published && !p.archived);
    } else if (filters?.status === 'archived') {
      items = items.filter((p) => p.archived);
    }

    if (filters?.category && filters.category !== 'all') {
      items = items.filter((p) => p.category === filters.category);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const q = filters.search.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.tagline && p.tagline.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return this.withCategoryLabels(items.map(toAdminMarketplaceProduct));
  }

  /**
   * 4. Admin metrics summary
   */
  static async getAdminMetrics(): Promise<{
    total: number;
    published: number;
    drafts: number;
    featured: number;
    archived: number;
  }> {
    const pool = getPool();

    if (pool) {
      const query = `
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE published = true AND archived = false) AS published,
          COUNT(*) FILTER (WHERE published = false AND archived = false) AS drafts,
          COUNT(*) FILTER (WHERE featured = true AND published = true AND archived = false) AS featured,
          COUNT(*) FILTER (WHERE archived = true) AS archived
        FROM marketplace_products;
      `;
      const res = await pool.query(query);
      const row = res.rows[0];
      return {
        total: parseInt(row.total || '0', 10),
        published: parseInt(row.published || '0', 10),
        drafts: parseInt(row.drafts || '0', 10),
        featured: parseInt(row.featured || '0', 10),
        archived: parseInt(row.archived || '0', 10),
      };
    }

    const items = Array.from(devMarketplaceStore.values());
    return {
      total: items.length,
      published: items.filter((p) => p.published && !p.archived).length,
      drafts: items.filter((p) => !p.published && !p.archived).length,
      featured: items.filter((p) => p.featured && p.published && !p.archived).length,
      archived: items.filter((p) => p.archived).length,
    };
  }

  /**
   * 5. Get raw product by ID
   */
  static async getProductById(id: string): Promise<MarketplaceProductRecord | null> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM marketplace_products WHERE id = $1 LIMIT 1;', [id]);
      if (res.rows.length === 0) return null;
      return res.rows[0] as MarketplaceProductRecord;
    }
    return devMarketplaceStore.get(id) || null;
  }

  /**
   * 6. Create Product with Admin Audit Log
   */
  static async createProduct(
    input: CreateMarketplaceProductInput,
    adminUserId: string
  ): Promise<MarketplaceProductRecord> {
    const id = `mp_${randomUUID()}`;
    const slug = await this.resolveUniqueSlug(input.slug || input.name);
    const nowIso = new Date().toISOString();

    const priceMinor =
      input.priceType === 'quote'
        ? null
        : typeof input.priceMinor === 'number'
        ? Math.max(0, Math.floor(input.priceMinor))
        : null;

    const record: MarketplaceProductRecord = {
      product_kind: input.productKind ?? 'physical',
      fulfilment_note: input.fulfilmentNote ?? null,
      fulfilment_identifier_label: input.fulfilmentIdentifierLabel ?? null,
      fulfilment_identifier_placeholder: input.fulfilmentIdentifierPlaceholder ?? null,
      fulfilment_identifier_required: input.fulfilmentIdentifierRequired ?? false,
      admin_note: input.adminNote ?? null,
      id,
      slug,
      name: input.name.trim(),
      category: input.category.trim(),
      tagline: input.tagline?.trim() || null,
      description: input.description?.trim() || null,
      price_type: input.priceType,
      price_minor: priceMinor,
      referral_reward_minor: typeof input.referralRewardMinor === 'number' ? Math.max(0, Math.floor(input.referralRewardMinor)) : null,
      purchase_enabled: input.fulfilmentMode !== 'inquiry_only' && input.priceType !== 'quote' && input.purchaseEnabled !== false,
      fulfilment_mode: input.fulfilmentMode || 'both',
      pickup_locations: input.pickupLocations && input.pickupLocations.length > 0 ? JSON.stringify(input.pickupLocations) : null,
      delivery_available: input.deliveryAvailable !== false,
      delivery_note: input.deliveryNote?.trim() || null,
      purchase_note: input.purchaseNote?.trim() || null,
      payment_required_before_delivery: input.paymentRequiredBeforeDelivery !== false,
      variants: input.variants && input.variants.length > 0 ? JSON.stringify(input.variants) : null,
      availability: input.availability,
      availability_label: input.availabilityLabel?.trim() || null,
      badge: input.badge?.trim() || null,
      image_url: input.imageUrl?.trim() || null,
      image_alt: input.imageAlt?.trim() || null,
      gallery_urls: input.galleryUrls && input.galleryUrls.length > 0 ? JSON.stringify(input.galleryUrls) : null,
      highlights: input.highlights && input.highlights.length > 0 ? JSON.stringify(input.highlights) : null,
      specs: input.specs && input.specs.length > 0 ? JSON.stringify(input.specs) : null,
      featured: Boolean(input.featured),
      published: Boolean(input.published),
      archived: false,
      sort_order: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.assertStorageBounds(record);
    const pool = getPool();
    if (pool) {
      const insertSql = `
        INSERT INTO marketplace_products (
          id, slug, name, category, tagline, description, price_type, price_minor, referral_reward_minor,
          purchase_enabled, fulfilment_mode, pickup_locations, delivery_available, delivery_note, purchase_note, payment_required_before_delivery, variants,
          availability, availability_label, badge, image_url, image_alt, gallery_urls,
          highlights, specs, featured, published, archived, sort_order, created_at, updated_at, product_kind, fulfilment_note, fulfilment_identifier_label, fulfilment_identifier_placeholder, fulfilment_identifier_required, admin_note
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
        ) RETURNING *;
      `;
      const res = await pool.query(insertSql, [
        record.id,
        record.slug,
        record.name,
        record.category,
        record.tagline,
        record.description,
        record.price_type,
        record.price_minor,
        record.referral_reward_minor,
        record.purchase_enabled,
        record.fulfilment_mode,
        record.pickup_locations,
        record.delivery_available,
        record.delivery_note,
        record.purchase_note,
        record.payment_required_before_delivery,
        record.variants,
        record.availability,
        record.availability_label,
        record.badge,
        record.image_url,
        record.image_alt,
        record.gallery_urls,
        record.highlights,
        record.specs,
        record.featured,
        record.published,
        record.archived,
        record.sort_order,
        record.created_at,
        record.updated_at,
        record.product_kind,
        record.fulfilment_note,
        record.fulfilment_identifier_label,
        record.fulfilment_identifier_placeholder,
        record.fulfilment_identifier_required,
        record.admin_note,
      ]);
      const saved = res.rows[0] as MarketplaceProductRecord;

      await AdminAuditStore.record({
        adminUserId,
        action: 'marketplace_product_created',
        entityType: 'marketplace_product',
        entityId: saved.id,
        metadata: {
          name: saved.name,
          slug: saved.slug,
          category: saved.category,
          priceType: saved.price_type,
          priceMinor: saved.price_minor,
          published: saved.published,
        },
      });

      return saved;
    }

    devMarketplaceStore.set(id, record);

    await AdminAuditStore.record({
      adminUserId,
      action: 'marketplace_product_created',
      entityType: 'marketplace_product',
      entityId: id,
      metadata: {
        name: record.name,
        slug: record.slug,
        category: record.category,
        priceType: record.price_type,
        priceMinor: record.price_minor,
        published: record.published,
      },
    });

    return record;
  }

  /**
   * 7. Update Product with Admin Audit Log
   */
  static async updateProduct(
    id: string,
    input: UpdateMarketplaceProductInput,
    adminUserId: string
  ): Promise<MarketplaceProductRecord> {
    const existing = await this.getProductById(id);
    if (!existing) {
      throw new Error(`Marketplace product "${id}" not found.`);
    }

    const nowIso = new Date().toISOString();
    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await this.resolveUniqueSlug(input.slug, id);

    }

    const priceType = input.priceType !== undefined ? input.priceType : existing.price_type;
    let priceMinor = existing.price_minor;
    if (priceType === 'quote') {
      priceMinor = null;
    } else if (input.priceMinor !== undefined) {
      priceMinor = typeof input.priceMinor === 'number' ? Math.max(0, Math.floor(input.priceMinor)) : null;
    }

    let referralRewardMinor = existing.referral_reward_minor;
    if (input.referralRewardMinor !== undefined) {
      referralRewardMinor =
        typeof input.referralRewardMinor === 'number'
          ? Math.max(0, Math.floor(input.referralRewardMinor))
          : null;
    }

    const updatedRecord: MarketplaceProductRecord = {
      ...existing,
      product_kind: input.productKind !== undefined ? input.productKind : existing.product_kind ?? 'physical',
      fulfilment_note: input.fulfilmentNote !== undefined ? input.fulfilmentNote : existing.fulfilment_note ?? null,
      fulfilment_identifier_label: input.fulfilmentIdentifierLabel !== undefined ? input.fulfilmentIdentifierLabel : existing.fulfilment_identifier_label ?? null,
      fulfilment_identifier_placeholder: input.fulfilmentIdentifierPlaceholder !== undefined ? input.fulfilmentIdentifierPlaceholder : existing.fulfilment_identifier_placeholder ?? null,
      fulfilment_identifier_required: input.fulfilmentIdentifierRequired !== undefined ? input.fulfilmentIdentifierRequired : existing.fulfilment_identifier_required ?? false,
      admin_note: input.adminNote !== undefined ? input.adminNote : existing.admin_note ?? null,
      slug,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      category: input.category !== undefined ? input.category.trim() : existing.category,
      tagline: input.tagline !== undefined ? (input.tagline ? input.tagline.trim() : null) : existing.tagline,
      description: input.description !== undefined ? (input.description ? input.description.trim() : null) : existing.description,
      price_type: priceType,
      price_minor: priceMinor,
      referral_reward_minor: referralRewardMinor,
      purchase_enabled: (input.fulfilmentMode ?? existing.fulfilment_mode) !== 'inquiry_only' && priceType !== 'quote' && (input.purchaseEnabled !== undefined ? Boolean(input.purchaseEnabled) : existing.purchase_enabled !== false),
      fulfilment_mode: input.fulfilmentMode !== undefined ? input.fulfilmentMode : (existing.fulfilment_mode || 'both'),
      pickup_locations: input.pickupLocations !== undefined ? (input.pickupLocations && input.pickupLocations.length > 0 ? JSON.stringify(input.pickupLocations) : null) : existing.pickup_locations,
      delivery_available: input.deliveryAvailable !== undefined ? Boolean(input.deliveryAvailable) : (existing.delivery_available !== false),
      delivery_note: input.deliveryNote !== undefined ? (input.deliveryNote ? input.deliveryNote.trim() : null) : existing.delivery_note,
      purchase_note: input.purchaseNote !== undefined ? (input.purchaseNote ? input.purchaseNote.trim() : null) : existing.purchase_note,
      payment_required_before_delivery: input.paymentRequiredBeforeDelivery !== undefined ? Boolean(input.paymentRequiredBeforeDelivery) : (existing.payment_required_before_delivery !== false),
      variants: input.variants !== undefined ? (input.variants && input.variants.length > 0 ? JSON.stringify(input.variants) : null) : existing.variants,
      availability: input.availability !== undefined ? input.availability : existing.availability,
      availability_label: input.availabilityLabel !== undefined ? (input.availabilityLabel ? input.availabilityLabel.trim() : null) : existing.availability_label,
      badge: input.badge !== undefined ? (input.badge ? input.badge.trim() : null) : existing.badge,
      image_url: input.imageUrl !== undefined ? (input.imageUrl ? input.imageUrl.trim() : null) : existing.image_url,
      image_alt: input.imageAlt !== undefined ? (input.imageAlt ? input.imageAlt.trim() : null) : existing.image_alt,
      gallery_urls: input.galleryUrls !== undefined ? (input.galleryUrls && input.galleryUrls.length > 0 ? JSON.stringify(input.galleryUrls) : null) : existing.gallery_urls,
      highlights: input.highlights !== undefined ? (input.highlights && input.highlights.length > 0 ? JSON.stringify(input.highlights) : null) : existing.highlights,
      specs: input.specs !== undefined ? (input.specs && input.specs.length > 0 ? JSON.stringify(input.specs) : null) : existing.specs,
      featured: input.featured !== undefined ? Boolean(input.featured) : existing.featured,
      published: input.published !== undefined ? Boolean(input.published) : existing.published,
      archived: input.archived !== undefined ? Boolean(input.archived) : existing.archived,
      sort_order: input.sortOrder !== undefined ? input.sortOrder : existing.sort_order,
      updated_at: nowIso,
    };

    const pool = getPool();
    this.assertStorageBounds(updatedRecord);
    if (pool) {
      const updateSql = `
        UPDATE marketplace_products SET
          slug = $2,
          name = $3,
          category = $4,
          tagline = $5,
          description = $6,
          price_type = $7,
          price_minor = $8,
          referral_reward_minor = $9,
          purchase_enabled = $10,
          fulfilment_mode = $11,
          pickup_locations = $12,
          delivery_available = $13,
          delivery_note = $14,
          purchase_note = $15,
          payment_required_before_delivery = $16,
          variants = $17,
          availability = $18,
          availability_label = $19,
          badge = $20,
          image_url = $21,
          image_alt = $22,
          gallery_urls = $23,
          highlights = $24,
          specs = $25,
          featured = $26,
          published = $27,
          archived = $28,
          sort_order = $29,
          updated_at = $30,
          product_kind = $31,
          fulfilment_note = $32,
          fulfilment_identifier_label = $33,
          fulfilment_identifier_placeholder = $34,
          fulfilment_identifier_required = $35,
          admin_note = $36
        WHERE id = $1
        RETURNING *;
      `;
      const res = await pool.query(updateSql, [
        id,
        updatedRecord.slug,
        updatedRecord.name,
        updatedRecord.category,
        updatedRecord.tagline,
        updatedRecord.description,
        updatedRecord.price_type,
        updatedRecord.price_minor,
        updatedRecord.referral_reward_minor,
        updatedRecord.purchase_enabled,
        updatedRecord.fulfilment_mode,
        updatedRecord.pickup_locations,
        updatedRecord.delivery_available,
        updatedRecord.delivery_note,
        updatedRecord.purchase_note,
        updatedRecord.payment_required_before_delivery,
        updatedRecord.variants,
        updatedRecord.availability,
        updatedRecord.availability_label,
        updatedRecord.badge,
        updatedRecord.image_url,
        updatedRecord.image_alt,
        updatedRecord.gallery_urls,
        updatedRecord.highlights,
        updatedRecord.specs,
        updatedRecord.featured,
        updatedRecord.published,
        updatedRecord.archived,
        updatedRecord.sort_order,
        updatedRecord.updated_at,
        updatedRecord.product_kind,
        updatedRecord.fulfilment_note,
        updatedRecord.fulfilment_identifier_label,
        updatedRecord.fulfilment_identifier_placeholder,
        updatedRecord.fulfilment_identifier_required,
        updatedRecord.admin_note,
      ]);

      const saved = res.rows[0] as MarketplaceProductRecord;

      await AdminAuditStore.record({
        adminUserId,
        action: 'marketplace_product_updated',
        entityType: 'marketplace_product',
        entityId: id,
        metadata: {
          name: saved.name,
          slug: saved.slug,
          published: saved.published,
          archived: saved.archived,
        },
      });

      return saved;
    }

    devMarketplaceStore.set(id, updatedRecord);

    await AdminAuditStore.record({
      adminUserId,
      action: 'marketplace_product_updated',
      entityType: 'marketplace_product',
      entityId: id,
      metadata: {
        name: updatedRecord.name,
        slug: updatedRecord.slug,
        published: updatedRecord.published,
        archived: updatedRecord.archived,
      },
    });

    return updatedRecord;
  }

  /**
   * 8. Set published status (publish / unpublish)
   */
  static async setPublished(
    id: string,
    published: boolean,
    adminUserId: string
  ): Promise<MarketplaceProductRecord> {
    const action = published ? 'marketplace_product_published' : 'marketplace_product_unpublished';
    const updated = await this.updateProduct(id, { published }, adminUserId);

    await AdminAuditStore.record({
      adminUserId,
      action,
      entityType: 'marketplace_product',
      entityId: id,
      metadata: { published },
    });

    return updated;
  }

  /**
   * 9. Set featured status
   */
  static async setFeatured(
    id: string,
    featured: boolean,
    adminUserId: string
  ): Promise<MarketplaceProductRecord> {
    return this.updateProduct(id, { featured }, adminUserId);
  }

  /**
   * 10. Archive product (non-destructive; sets archived = true and published = false)
   */
  static async archiveProduct(id: string, adminUserId: string): Promise<MarketplaceProductRecord> {
    const updated = await this.updateProduct(id, { archived: true, published: false }, adminUserId);

    await AdminAuditStore.record({
      adminUserId,
      action: 'marketplace_product_archived',
      entityType: 'marketplace_product',
      entityId: id,
      metadata: { archived: true },
    });

    return updated;
  }

  /**
   * 11. Get raw product by slug
   */
  static async getProductBySlug(slug: string): Promise<MarketplaceProductRecord | null> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM marketplace_products WHERE slug = $1 LIMIT 1;', [slug]);
      if (res.rows.length === 0) return null;
      return res.rows[0] as MarketplaceProductRecord;
    }
    for (const p of devMarketplaceStore.values()) {
      if (p.slug === slug) return p;
    }
    return null;
  }

  /**
   * 12. Create product inquiry
   */
  static async createInquiry(payload: {
    productId?: string;
    productName: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    inquiryType?: string;
    message?: string;
    budget?: string;
  }): Promise<{ id: string; createdAt: string }> {
    return MarketplaceControlStore.createInquiry(payload);
  }

  /**
   * Clears in-memory store (for testing purposes)
   */
  static _clearInMemoryStore(): void {
    devMarketplaceStore.clear();
  }
}
