/**
 * Mystery Hub Mobile Bundle Card Compression Test Suite
 * Validates:
 * - BundleCard compact 3-row architecture (Row 1: Network + Data Amount + Promo + Price, Row 2: Status, Row 3: Recipient Input + Compact CTA)
 * - Price is positioned in the upper product section rather than a bottom footer
 * - Recipient phone input and Review button are inline in the same row
 * - aria-label is present on phone input for accessibility
 * - Mobile card padding and density constraints
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Mystery Hub Mobile Bundle Card Compression Verification', () => {
  const cardPath = path.resolve(process.cwd(), 'src/components/data/BundleCard.tsx');
  const cardCode = fs.readFileSync(cardPath, 'utf8');

  test('1. BundleCard has price in upper header area (Row 1)', () => {
    assert.ok(
      cardCode.includes('priceGhc.toFixed(2)'),
      'Card must format and display priceGhc'
    );
    // Ensure Price is not trapped inside a bottom divider footer section
    assert.ok(
      !cardCode.includes('border-t border-slate-800/80 flex flex-col gap-2'),
      'Card must NOT have old separated bottom price footer'
    );
  });

  test('2. Recipient input and review button share row 3 (inline flex)', () => {
    assert.ok(
      cardCode.includes('flex items-center gap-1.5') || cardCode.includes('flex items-center gap-2'),
      'Card must arrange input and action CTA in a unified flex row'
    );
    assert.ok(
      cardCode.includes('aria-label="Recipient phone number"'),
      'Input must have accessible aria-label'
    );
    assert.ok(
      cardCode.includes('placeholder="024 XXX XXXX"'),
      'Input must have standard 024 XXX XXXX placeholder'
    );
  });

  test('3. Card uses compact responsive padding and squircle borders', () => {
    assert.ok(
      cardCode.includes('p-3 sm:p-4'),
      'Card must use compressed p-3 sm:p-4 padding'
    );
    assert.ok(
      cardCode.includes('rounded-2xl'),
      'Card must maintain squircle rounded-2xl geometry'
    );
  });

  test('4. Delivery status is merged into a concise single line (Row 2)', () => {
    assert.ok(
      cardCode.includes('Direct SIM Credit'),
      'Card must display direct SIM credit status'
    );
    assert.ok(
      cardCode.includes('Instant Delivery'),
      'Card must display instant delivery for AT'
    );
  });
});
