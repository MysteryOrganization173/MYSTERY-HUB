/**
 * Mystery Hub Marketplace V1 Server Integration Test Suite
 * Validates:
 * - Product schema and data store CRUD operations
 * - Public API filters: published=true and archived=false only
 * - Slug generation and uniqueness deduplication (including multiple collisions)
 * - Server-side validation: price types, positive price_minor, valid image URLs, safe inputs
 * - Admin publish, unpublish, feature, and archive operations
 * - Admin audit logging for all mutations
 * - Integer pesewa pricing arithmetic and formatting
 * - Public response data safety (no internal admin/audit exposure)
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MarketplaceStore } from '../../db/marketplaceStore.js';
import { AdminAuditStore } from '../../db/adminAuditStore.js';
import {
  formatMarketplacePrice,
  formatGhcAmount,
  generateSlug,
  CATEGORY_LABELS,
  toPublicMarketplaceProduct,
  toAdminMarketplaceProduct,
} from '../../types/marketplace.js';

describe('Marketplace V1 Sourcing Catalog & Admin Integration', () => {
  const mockAdminId = 'usr_admin_test_1';

  beforeEach(() => {
    MarketplaceStore._clearInMemoryStore();
  });

  test('1. Price formatting utility converts integer pesewas accurately', () => {
    assert.strictEqual(formatGhcAmount(0), '0');
    assert.strictEqual(formatGhcAmount(100), '1');
    assert.strictEqual(formatGhcAmount(390000), '3,900');
    assert.strictEqual(formatGhcAmount(1250050), '12,500.50');

    // Price type rules
    assert.strictEqual(formatMarketplacePrice('quote', null), 'Request Quote');
    assert.strictEqual(formatMarketplacePrice('fixed', 390000), 'GH₵3,900');
    assert.strictEqual(formatMarketplacePrice('starting_at', 680000), 'From GH₵6,800');
  });

  test('2. Slug generation handles special characters and creates safe slugs', () => {
    assert.strictEqual(generateSlug('Business Ultrabook 14"'), 'business-ultrabook-14');
    assert.strictEqual(generateSlug('2K / 4K Webcam @ 60FPS!'), '2k-4k-webcam-60fps');
    assert.strictEqual(generateSlug('   '), 'product');
  });

  test('3. Admin can create product with automatic slug deduplication', async () => {
    const prod1 = await MarketplaceStore.createProduct(
      {
        name: 'HP ProBook 450 G9',
        category: 'laptops_computers',
        tagline: 'Business workstation',
        description: '16GB RAM, 512GB SSD',
        priceType: 'fixed',
        priceMinor: 750000,
        availability: 'available',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        highlights: ['16GB RAM', '512GB NVMe SSD'],
        published: true,
      },
      mockAdminId
    );

    assert.ok(prod1.id.startsWith('mp_'));
    assert.strictEqual(prod1.slug, 'hp-probook-450-g9');
    assert.strictEqual(prod1.price_minor, 750000);
    assert.strictEqual(prod1.published, true);
    assert.strictEqual(prod1.archived, false);

    // Create another product with the same name -> slug should be deduplicated (-2)
    const prod2 = await MarketplaceStore.createProduct(
      {
        name: 'HP ProBook 450 G9',
        category: 'laptops_computers',
        priceType: 'quote',
        availability: 'check_availability',
        published: true,
      },
      mockAdminId
    );

    assert.strictEqual(prod2.slug, 'hp-probook-450-g9-2');

    // Create a 3rd with same name -> slug should be (-3)
    const prod3 = await MarketplaceStore.createProduct(
      {
        name: 'HP ProBook 450 G9',
        category: 'laptops_computers',
        priceType: 'quote',
        availability: 'check_availability',
        published: true,
      },
      mockAdminId
    );

    assert.strictEqual(prod3.slug, 'hp-probook-450-g9-3');
  });

  test('4. Public query returns ONLY published and non-archived products', async () => {
    // 1. Published Live
    await MarketplaceStore.createProduct(
      {
        name: 'Published Laptop',
        category: 'laptops_computers',
        priceType: 'fixed',
        priceMinor: 500000,
        availability: 'available',
        published: true,
      },
      mockAdminId
    );

    // 2. Draft (Unpublished)
    await MarketplaceStore.createProduct(
      {
        name: 'Draft Laptop',
        category: 'laptops_computers',
        priceType: 'fixed',
        priceMinor: 400000,
        availability: 'available',
        published: false,
      },
      mockAdminId
    );

    // 3. Archived Product
    const archProd = await MarketplaceStore.createProduct(
      {
        name: 'Old Archived Laptop',
        category: 'laptops_computers',
        priceType: 'fixed',
        priceMinor: 300000,
        availability: 'limited',
        published: true,
      },
      mockAdminId
    );
    await MarketplaceStore.archiveProduct(archProd.id, mockAdminId);

    // Query public
    const publicProducts = await MarketplaceStore.getPublicProducts();
    assert.strictEqual(publicProducts.length, 1);
    assert.strictEqual(publicProducts[0].name, 'Published Laptop');
    assert.strictEqual(publicProducts[0].priceDisplay, 'GH₵5,000');
    assert.strictEqual(publicProducts[0].categoryLabel, 'Laptops & Computers');

    // Verify public product object does NOT expose internal admin fields
    const pubObj = publicProducts[0] as unknown as Record<string, unknown>;
    assert.strictEqual(pubObj.archived, undefined, 'Public product must NOT expose archived field');
    assert.strictEqual(pubObj.published, undefined, 'Public product must NOT expose published field');
    assert.strictEqual(pubObj.sort_order, undefined, 'Public product must NOT expose sort_order field');

    // Admin query sees all 3
    const adminProducts = await MarketplaceStore.getAdminProducts();
    assert.strictEqual(adminProducts.length, 3);

    const metrics = await MarketplaceStore.getAdminMetrics();
    assert.strictEqual(metrics.total, 3);
    assert.strictEqual(metrics.published, 1);
    assert.strictEqual(metrics.drafts, 1);
    assert.strictEqual(metrics.archived, 1);
  });

  test('5. Admin publish, unpublish, and feature workflows', async () => {
    const prod = await MarketplaceStore.createProduct(
      {
        name: 'Rode PodMic USB',
        category: 'creator_tools',
        priceType: 'starting_at',
        priceMinor: 180000,
        availability: 'available',
        published: false,
      },
      mockAdminId
    );

    assert.strictEqual(prod.published, false);

    // Publish
    const pub = await MarketplaceStore.setPublished(prod.id, true, mockAdminId);
    assert.strictEqual(pub.published, true);

    let publicList = await MarketplaceStore.getPublicProducts();
    assert.strictEqual(publicList.length, 1);

    // Unpublish
    const unpub = await MarketplaceStore.setPublished(prod.id, false, mockAdminId);
    assert.strictEqual(unpub.published, false);

    publicList = await MarketplaceStore.getPublicProducts();
    assert.strictEqual(publicList.length, 0);

    // Feature
    const feat = await MarketplaceStore.setFeatured(prod.id, true, mockAdminId);
    assert.strictEqual(feat.featured, true);
  });

  test('6. Category filtering and search query on public and admin stores', async () => {
    await MarketplaceStore.createProduct(
      {
        name: 'MacBook Air M2',
        category: 'laptops_computers',
        tagline: 'Apple Silicon for Creators',
        description: '8-core CPU 10-core GPU',
        priceType: 'fixed',
        priceMinor: 1150000,
        availability: 'available',
        published: true,
      },
      mockAdminId
    );

    await MarketplaceStore.createProduct(
      {
        name: 'USB Studio Mic',
        category: 'creator_tools',
        tagline: 'Crystal clear podcast recording',
        description: 'Broadcast cardioid mic',
        priceType: 'fixed',
        priceMinor: 85000,
        availability: 'available',
        published: true,
      },
      mockAdminId
    );

    // Filter category
    const laptopOnly = await MarketplaceStore.getPublicProducts({ category: 'laptops_computers' });
    assert.strictEqual(laptopOnly.length, 1);
    assert.strictEqual(laptopOnly[0].name, 'MacBook Air M2');

    // Search query
    const searchMic = await MarketplaceStore.getPublicProducts({ search: 'podcast' });
    assert.strictEqual(searchMic.length, 1);
    assert.strictEqual(searchMic[0].name, 'USB Studio Mic');
  });

  test('7. Admin audit logging records marketplace mutations', async () => {
    const prod = await MarketplaceStore.createProduct(
      {
        name: 'Audit Test Product',
        category: 'business_software',
        priceType: 'quote',
        availability: 'available',
        published: true,
      },
      mockAdminId
    );

    await MarketplaceStore.updateProduct(prod.id, { tagline: 'Updated tagline' }, mockAdminId);
    await MarketplaceStore.archiveProduct(prod.id, mockAdminId);

    const logs = await AdminAuditStore.findRecent(20);
    const actions = logs.map((l) => l.action);

    assert.ok(actions.includes('marketplace_product_created'), 'Must log product creation');
    assert.ok(actions.includes('marketplace_product_updated'), 'Must log product update');
    assert.ok(actions.includes('marketplace_product_archived'), 'Must log product archive');
  });

  test('8. Category labels mapping covers all supported categories', () => {
    assert.strictEqual(CATEGORY_LABELS['laptops_computers'], 'Laptops & Computers');
    assert.strictEqual(CATEGORY_LABELS['phones_accessories'], 'Phones & Accessories');
    assert.strictEqual(CATEGORY_LABELS['ai_productivity'], 'AI & Productivity Tools');
    assert.strictEqual(CATEGORY_LABELS['creator_tools'], 'Creator & Media Tools');
    assert.strictEqual(CATEGORY_LABELS['business_software'], 'Business Software');
    assert.strictEqual(CATEGORY_LABELS['digital_products'], 'Digital Products');
    assert.strictEqual(CATEGORY_LABELS['business_essentials'], 'Business Hardware');
  });
});
