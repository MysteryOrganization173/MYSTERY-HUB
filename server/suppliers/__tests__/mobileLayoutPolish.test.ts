/**
 * Mobile Layout Polish & Geometry Verification Test Suite
 * Validates:
 * - Squircle / radius design tokens in index.css
 * - Global overflow-x safety rules on html, body, #root
 * - Standard bundle cards density (no repeated per-card trust copy)
 * - Section-level trust badge elevation in DataPage
 * - Modal max-width viewport safety across CheckoutModal, AuthModal, OrderStatusModal, WaitlistModal
 * - Marketplace tabs negative margin removal
 * - Mobile bottom nav safe-area padding
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Mystery Hub Mobile Layout Polish & Geometry Verification', () => {
  test('1. index.css contains squircle geometry tokens and global overflow safety rules', () => {
    const cssPath = path.resolve(process.cwd(), 'src/index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('--radius-badge:'), 'Must define --radius-badge token');
    assert.ok(css.includes('--radius-control:'), 'Must define --radius-control token');
    assert.ok(css.includes('--radius-card:'), 'Must define --radius-card token');
    assert.ok(css.includes('--radius-modal:'), 'Must define --radius-modal token');
    assert.ok(css.includes('box-sizing: border-box'), 'Must apply border-box');
    assert.ok(css.includes('overflow-x: clip'), 'Must apply overflow-x: clip safety');
    assert.ok(css.includes('prefers-reduced-motion'), 'Must support prefers-reduced-motion');
  });

  test('2. BundleCard.tsx has removed repeated per-card trust copy for ~18-20% density gain', () => {
    const cardPath = path.resolve(process.cwd(), 'src/components/data/BundleCard.tsx');
    const cardCode = fs.readFileSync(cardPath, 'utf8');

    assert.ok(
      !cardCode.includes('Secure Paystack Checkout'),
      'BundleCard must NOT repeat "Secure Paystack Checkout" on every card'
    );
    assert.ok(
      cardCode.includes('p-3 sm:p-4') || cardCode.includes('p-3.5 sm:p-4') || cardCode.includes('p-3.5 sm:p-4.5'),
      'BundleCard must use compact padding'
    );
  });

  test('3. DataPage.tsx contains elevated section-level trust badge', () => {
    const dataPagePath = path.resolve(process.cwd(), 'src/components/data/DataPage.tsx');
    const dataPageCode = fs.readFileSync(dataPagePath, 'utf8');

    assert.ok(
      dataPageCode.includes('Secured by Paystack with Mobile Money & Card') ||
      dataPageCode.includes('Direct automated SIM delivery · Secured by Paystack'),
      'DataPage must contain the elevated section-level trust signal'
    );
  });

  test('4. MarketplacePage.tsx tabs have no negative horizontal margins causing overflow', () => {
    const marketplacePath = path.resolve(process.cwd(), 'src/components/marketplace/MarketplacePage.tsx');
    const marketplaceCode = fs.readFileSync(marketplacePath, 'utf8');

    assert.ok(
      !marketplaceCode.includes('-mx-4 px-4'),
      'MarketplacePage tabs must NOT use -mx-4 px-4 negative margins'
    );
  });

  test('5. Modals enforce viewport-safe width limits on narrow mobile screens', () => {
    const checkoutModal = fs.readFileSync(path.resolve(process.cwd(), 'src/components/checkout/CheckoutModal.tsx'), 'utf8');
    const authModal = fs.readFileSync(path.resolve(process.cwd(), 'src/components/auth/AuthModal.tsx'), 'utf8');
    const orderStatusModal = fs.readFileSync(path.resolve(process.cwd(), 'src/components/checkout/OrderStatusModal.tsx'), 'utf8');
    const waitlistModal = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/WaitlistModal.tsx'), 'utf8');

    assert.ok(checkoutModal.includes('max-w-[calc(100vw-1rem)]'), 'CheckoutModal must be bounded by viewport');
    assert.ok(authModal.includes('max-w-[calc(100vw-1rem)]'), 'AuthModal must be bounded by viewport');
    assert.ok(orderStatusModal.includes('max-w-[calc(100vw-1rem)]'), 'OrderStatusModal must be bounded by viewport');
    assert.ok(waitlistModal.includes('max-w-[calc(100vw-1rem)]'), 'WaitlistModal must be bounded by viewport');
  });

  test('6. MobileNav.tsx includes safe-area bottom support and overflow prevention', () => {
    const mobileNav = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/MobileNav.tsx'), 'utf8');

    assert.ok(mobileNav.includes('safe-area-inset-bottom'), 'MobileNav must support safe-area-inset-bottom');
    assert.ok(mobileNav.includes('max-w-full overflow-hidden'), 'MobileNav must prevent overflow');
  });

  test('7. MysteryAiAssistant.tsx enforces mobile viewport width boundary', () => {
    const aiAssistant = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ai/MysteryAiAssistant.tsx'), 'utf8');

    assert.ok(aiAssistant.includes('max-w-[calc(100vw-1.5rem)]'), 'Mystery AI must enforce safe max-width');
  });
});
