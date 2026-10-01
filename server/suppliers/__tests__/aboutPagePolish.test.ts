/**
 * Mystery Hub About Page Polish & Image Loading Test Suite
 * Validates:
 * - Official Cloudinary About Hero Image 2 URL (v1790866633)
 * - Official Cloudinary Built for Ghana Image 1 URL (v1790866217)
 * - Above-the-fold About Hero eager loading strategy
 * - Below-the-fold Image 1 lazy loading strategy via OptimizedImage
 * - Grounded copy: no exaggerated claims, no unreleased church payment promises
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('About Page Polish & Artwork Integration', () => {
  test('1. AboutPage contains official About Hero Image 2 Cloudinary URL', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/about/AboutPage.tsx'),
      'utf-8'
    );

    assert.ok(
      pageCode.includes('v1790866633/Futuristic_Accra_Network_Nightscape_zwp9ld.png'),
      'AboutPage must integrate official Cloudinary Hero Image 2'
    );
  });

  test('2. AboutPage contains official Connected Futures Image 1 Cloudinary URL', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/about/AboutPage.tsx'),
      'utf-8'
    );

    assert.ok(
      pageCode.includes('v1790866217/Neon_Ghana__Connected_Futures_qdf0ek.png'),
      'AboutPage must integrate official Cloudinary Image 1 (Built for Ghana)'
    );
  });

  test('3. Hero image uses eager loading and high fetchPriority', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/about/AboutPage.tsx'),
      'utf-8'
    );

    assert.ok(
      pageCode.includes('loading="eager"'),
      'Hero image must be eagerly loaded'
    );
    assert.ok(
      pageCode.includes('fetchPriority="high"'),
      'Hero image must specify high fetch priority'
    );
  });

  test('4. Connected Futures Image 1 uses OptimizedImage component for lazy loading', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/about/AboutPage.tsx'),
      'utf-8'
    );

    assert.ok(
      pageCode.includes('<OptimizedImage'),
      'Connected Futures Image 1 must use OptimizedImage for below-the-fold lazy loading'
    );
  });

  test('5. About copy avoids unreleased tithes/offerings or exaggerated claims', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/about/AboutPage.tsx'),
      'utf-8'
    );

    assert.strictEqual(
      pageCode.includes('Accept online tithes & offerings'),
      false,
      'Unreleased church tithes feature claim must be removed'
    );
    assert.strictEqual(
      pageCode.includes('no hidden charges'),
      false,
      'Unsubstantiated "no hidden charges" claim must be removed'
    );
  });

  test('6. Connected Futures image container maintains calibrated height and navbar clearance', () => {
    const pageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/about/AboutPage.tsx'),
      'utf-8'
    );

    assert.ok(
      pageCode.includes('lg:h-[330px]'),
      'Desktop visual height must be approximately 320-350px (e.g. lg:h-[330px])'
    );
    assert.ok(
      pageCode.includes('scroll-mt-24 sm:scroll-mt-28'),
      'Headings must have proper scroll margins to clear the sticky navbar'
    );
  });
});
