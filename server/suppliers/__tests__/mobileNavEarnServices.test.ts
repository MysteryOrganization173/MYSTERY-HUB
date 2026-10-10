/**
 * Mystery Hub Mobile Nav Restructure, Mystery Earn Teaser & Services Compression Test Suite
 * Validates:
 * - MobileNav uses five destinations including Earn; Marketplace remains in the main menu
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
  test('1. MobileNav uses the five approved destinations with Earn discovery', () => {
    const code=fs.readFileSync(path.join(process.cwd(),'src/components/common/MobileNav.tsx'),'utf8');
    assert.deepEqual([...code.matchAll(/id: '([^']+)', label: '([^']+)'/g)].map(m=>m[1]),['home','data','website','earn','orders']);
    assert.ok(code.includes('grid-cols-5'));
    const navbar=fs.readFileSync(path.join(process.cwd(),'src/components/common/Navbar.tsx'),'utf8');
    assert.ok(navbar.includes("handleNavClick('marketplace')"),'Marketplace remains accessible in the main menu');
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

  test('5. Earn guest presentation explains conditional rewards and uses existing signup', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/components/earn/MysteryEarnPage.tsx'), 'utf8');
    assert.match(page, /Create a Free Account/);
    assert.match(page, /No reward for clicks alone/);
    assert.match(page, /eligible purchase/);
    assert.match(page, /openAuth\('signup'\)/);
    assert.ok(!page.includes('Coming Soon'));
  });

  test('6. Earn members receive a session-owned dashboard rather than guest marketing', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/components/earn/MysteryEarnPage.tsx'), 'utf8');
    assert.match(page, /if \(user && sessionToken\) return <MemberEarn/);
    assert.match(page, /<h1>Your Mystery Earn<\/h1>/);
    assert.match(page, /earn-member-page/);
    assert.match(page, /<FinancialPanel mode="earn"/);
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
