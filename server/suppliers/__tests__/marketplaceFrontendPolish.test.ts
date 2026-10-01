/**
 * Mystery Hub Marketplace Frontend Polish & Image Loading Test Suite
 * Validates:
 * - Official Cloudinary hero image URL configured in business.ts
 * - Hero banner eager loading strategy (loading="eager", fetchPriority="high", decoding="async")
 * - Cloudinary image utility (f_auto, q_auto, responsive widths)
 * - Zero-product state conditional logic (hides search/categories when total products = 0)
 * - Grounded truthful copy (no "verified partners" or "verified local Ghana delivery")
 * - Staff Portal link present in public footer pointing to /admin
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUSINESS_CONFIG } from '../../../src/config/business.js';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../../src/utils/cloudinary.js';

describe('Marketplace Frontend Polish & Image Delivery Strategy', () => {
  test('1. Official Cloudinary Marketplace Hero image URL is set in BUSINESS_CONFIG', () => {
    assert.strictEqual(
      BUSINESS_CONFIG.marketplaceHeroImageUrl,
      'https://res.cloudinary.com/da6oeat7m/image/upload/v1790865356/Futuristic_Ghana_Tech_Marketplace_Banner_uvziku.png',
      'BUSINESS_CONFIG.marketplaceHeroImageUrl must point to official Cloudinary hero artwork'
    );
  });

  test('2. Cloudinary helper correctly builds transformed URLs & srcSets', () => {
    const rawUrl = 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790865356/Futuristic_Ghana_Tech_Marketplace_Banner_uvziku.png';
    
    const transformed = getCloudinaryUrl(rawUrl, { width: 1280 });
    assert.ok(transformed.includes('/upload/f_auto,q_auto,w_1280/'), 'Transformed URL must include f_auto,q_auto,w_1280');

    const srcSet = getCloudinarySrcSet(rawUrl, [640, 1280]);
    assert.ok(srcSet.includes('w_640') && srcSet.includes('640w'), 'srcSet must contain width descriptors');
    assert.ok(srcSet.includes('w_1280') && srcSet.includes('1280w'), 'srcSet must contain 1280w descriptor');
  });

  test('3. MarketplacePage implements eager loading and high fetch priority for hero image', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketplace/MarketplacePage.tsx'),
      'utf-8'
    );

    assert.ok(
      pageCode.includes('loading="eager"'),
      'Hero image must use loading="eager" to avoid layout shift'
    );
    assert.ok(
      pageCode.includes('fetchPriority="high"'),
      'Hero image must use fetchPriority="high" for fast critical LCP'
    );
    assert.ok(
      pageCode.includes('decoding="async"'),
      'Hero image must use decoding="async"'
    );
  });

  test('4. MarketplacePage hides search/categories when total products = 0 (Honest zero-product state)', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketplace/MarketplacePage.tsx'),
      'utf-8'
    );

    assert.ok(
      pageCode.includes('products.length === 0'),
      'MarketplacePage must handle zero published products state explicitly'
    );
    assert.ok(
      pageCode.includes('products.length > 0'),
      'Search and category controls must only show when products exist'
    );
  });

  test('5. Footer contains discreet Staff Portal link pointing to /admin', () => {
    const footerCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/common/Footer.tsx'),
      'utf-8'
    );

    assert.ok(footerCode.includes('Staff Portal'), 'Footer must contain Staff Portal label');
    assert.ok(
      footerCode.includes('setActivePage(\'admin\')') || footerCode.includes('href="/admin"'),
      'Staff Portal link must point to admin'
    );
  });

  test('6. Codebase is free of unverified/exaggerated claims in Marketplace copy', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketplace/MarketplacePage.tsx'),
      'utf-8'
    );

    assert.strictEqual(
      pageCode.includes('verified local arrangements'),
      false,
      'Unsupported claim "verified local arrangements" must be removed'
    );
    assert.strictEqual(
      pageCode.includes('Fast Ghana Delivery'),
      false,
      'Unsupported claim "Fast Ghana Delivery" must be removed'
    );
    assert.strictEqual(
      pageCode.includes('verified partners'),
      false,
      'Unsupported claim "verified partners" must be removed'
    );
  });
});
