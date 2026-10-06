/**
 * Mystery Hub Brand Asset & Logo Integration Test Suite
 * Validates:
 * - Official Cloudinary brand mark configuration
 * - Delivery URL helper transformations (f_auto, q_auto, responsive widths)
 * - Distinct separation between Mystery Hub corporate mark and Mystery AI signal emblem
 * - PWA manifest.json icons & browser metadata
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUSINESS_CONFIG } from '../../../src/config/business.js';
import {
  OFFICIAL_BRAND_MARK_URL,
  getBrandMarkDeliveryUrl,
} from '../../../src/components/common/BrandLogo.js';

describe('Mystery Hub Brand Asset & Logo Integration', () => {
  test('1. Official Cloudinary brand mark URL is configured in BUSINESS_CONFIG and BrandLogo', () => {
    const expectedUrl =
      'https://res.cloudinary.com/da6oeat7m/image/upload/v1790859552/30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png';

    assert.equal(BUSINESS_CONFIG.brandMarkUrl, expectedUrl);
    assert.equal(OFFICIAL_BRAND_MARK_URL, expectedUrl);
  });

  test('2. getBrandMarkDeliveryUrl correctly formats Cloudinary f_auto, q_auto, and responsive width', () => {
    const url96 = getBrandMarkDeliveryUrl(96);
    assert.ok(url96.includes('f_auto,q_auto,w_96'));
    assert.ok(url96.includes('30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png'));

    const url256 = getBrandMarkDeliveryUrl(256);
    assert.ok(url256.includes('f_auto,q_auto,w_256'));
  });

  test('3. Mystery AI uses a distinct scalable signal emblem', () => {
    const mysteryAiIconPath = path.resolve(
      process.cwd(),
      'src/components/ai/MysteryAiIcon.tsx'
    );
    const content = fs.readFileSync(mysteryAiIconPath, 'utf8');

    // Must NOT use corporate M mark
    assert.ok(
      !content.includes('30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png'),
      'Mystery AI must not use the corporate Mystery Hub M mark'
    );
    // Must retain its distinct emblem artwork
    assert.ok(
      content.includes('<svg viewBox="0 0 48 48"') && content.includes('aria-hidden="true"') && !content.includes('<img'),
      'Mystery AI must use its dedicated decorative vector emblem without an image request'
    );
  });

  test('4. manifest.json contains valid PWA icon entries matching official brand asset', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.name, 'Mystery Hub');
    assert.equal(manifest.short_name, 'Mystery Hub');
    assert.equal(manifest.theme_color, '#00c365');
    assert.equal(manifest.background_color, '#070b0e');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);

    const icon192 = manifest.icons.find((i: { sizes: string }) => i.sizes === '192x192');
    const icon512 = manifest.icons.find(
      (i: { sizes: string; purpose?: string }) => i.sizes === '512x512' && i.purpose === 'maskable'
    );

    assert.ok(icon192, '192x192 icon must be defined');
    assert.ok(icon512, '512x512 maskable icon must be defined');
    assert.ok(icon192.src.includes('30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png'));
  });

  test('5. index.html contains updated favicon, apple-touch-icon, social image, and schema.org logo', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.ok(html.includes('rel="icon"'), 'favicon link must exist');
    assert.ok(html.includes('rel="apple-touch-icon"'), 'apple-touch-icon link must exist');
    assert.ok(html.includes('rel="manifest"'), 'manifest link must exist');
    assert.ok(html.includes('property="og:image"'), 'og:image must exist');
    assert.ok(html.includes('name="twitter:image"'), 'twitter:image must exist');
    assert.ok(
      html.includes('30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png'),
      'HTML must reference the official brand mark asset'
    );
  });
});
