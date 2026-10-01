/**
 * Mystery Hub Mobile Nav Restructure, Mystery Earn Teaser & Services Compression Test Suite
 * Validates:
 * - MobileNav 5th/4th destination replaced with Marketplace (label: Marketplace)
 * - More Services remains accessible in Navbar mobile drawer
 * - Quick-order Navbar trigger replaced with Mystery Earn shortcut (/earn)
 * - /earn teaser page renders Coming Soon badge, 3 earning types, 3-step workflow
 * - Guest vs Member Earn state behavior without fake balances
 * - MoreServicesPage hero compression (~280-340px mobile max height) and compact service rows
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Mobile Nav Restructure, Mystery Earn & Services Compression', () => {
  test('1. MobileNav contains Marketplace instead of Services in bottom navigation', () => {
    const mobileNavCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/common/MobileNav.tsx'),
      'utf-8'
    );

    assert.ok(
      mobileNavCode.includes('id: \'marketplace\''),
      'MobileNav must include marketplace item ID'
    );
    assert.ok(
      mobileNavCode.includes('label: \'Marketplace\''),
      'MobileNav item label must strictly say Marketplace'
    );
    assert.strictEqual(
      mobileNavCode.includes('id: \'services\''),
      false,
      'MobileNav bottom bar must NOT contain services item'
    );
  });

  test('2. More Services remains available in Navbar mobile drawer and desktop nav', () => {
    const navbarCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/common/Navbar.tsx'),
      'utf-8'
    );

    assert.ok(
      navbarCode.includes('id: \'services\', label: \'More Services\''),
      'Navbar navLinks must retain More Services link'
    );
  });

  test('3. Navbar quick-order action replaced with Mystery Earn Gift shortcut', () => {
    const navbarCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/common/Navbar.tsx'),
      'utf-8'
    );

    assert.strictEqual(
      navbarCode.includes('openOrderStatus(recentOrder)'),
      false,
      'Redundant Navbar quick order status trigger must be removed'
    );
    assert.ok(
      navbarCode.includes('handleNavClick(\'earn\')'),
      'Navbar must contain shortcut to Mystery Earn page (/earn)'
    );
    assert.ok(
      navbarCode.includes('title="Mystery Earn"'),
      'Navbar shortcut button must have title or aria-label for Mystery Earn'
    );
  });

  test('4. ROUTE_PATH_MAP and getPageFromPath recognize /earn route', () => {
    const routingCode = fs.readFileSync(
      path.join(process.cwd(), 'src/utils/routing.ts'),
      'utf-8'
    );

    assert.ok(
      routingCode.includes('earn: \'/earn\''),
      'ROUTE_PATH_MAP must map earn page to /earn'
    );
    assert.ok(
      routingCode.includes('normalized === \'/earn\''),
      'getPageFromPath must resolve /earn to earn active page'
    );
  });

  test('5. MysteryEarnPage renders Coming Soon positioning without fake balances', () => {
    const earnPageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/earn/MysteryEarnPage.tsx'),
      'utf-8'
    );

    assert.ok(
      earnPageCode.includes('Mystery Earn · Coming Soon'),
      'MysteryEarnPage must render Coming Soon badge'
    );
    assert.ok(
      earnPageCode.includes('Share Mystery Hub. Get Rewarded.'),
      'MysteryEarnPage must render headline'
    );
    assert.ok(
      earnPageCode.includes('Share Mystery Hub'),
      'MysteryEarnPage must explain Share Mystery Hub feature'
    );
    assert.ok(
      earnPageCode.includes('Service Referrals'),
      'MysteryEarnPage must explain Service Referrals feature'
    );
    assert.ok(
      earnPageCode.includes('Product-Specific Rewards'),
      'MysteryEarnPage must explain Product-Specific Rewards feature'
    );
    assert.strictEqual(
      earnPageCode.includes('GH₵150'),
      false,
      'MysteryEarnPage must NOT display fake wallet balances'
    );
    assert.strictEqual(
      earnPageCode.includes('GH₵50.00'),
      false,
      'MysteryEarnPage must NOT display fake referral reward amounts'
    );
  });

  test('6. Guest Earn view offers signup CTA and Member Earn view acknowledges member status', () => {
    const earnPageCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/earn/MysteryEarnPage.tsx'),
      'utf-8'
    );

    assert.ok(
      earnPageCode.includes('openAuth(\'signup\')'),
      'Guest Earn page must provide signup CTA'
    );
    assert.ok(
      earnPageCode.includes('You\'re already a Mystery Hub member.'),
      'Member Earn view must acknowledge existing membership status'
    );
  });

  test('7. MoreServicesPage compressed mobile hero and horizontal card rows', () => {
    const servicesCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/services/MoreServicesPage.tsx'),
      'utf-8'
    );

    assert.ok(
      servicesCode.includes('block sm:hidden'),
      'MoreServicesPage must provide compact mobile view'
    );
    assert.ok(
      servicesCode.includes('line-clamp-2'),
      'MoreServicesPage mobile rows must clamp long descriptions to 2 lines'
    );
    assert.ok(
      servicesCode.includes('Secure checkout powered by Paystack'),
      'MoreServicesPage must display grounded Paystack trust line'
    );
  });
});
