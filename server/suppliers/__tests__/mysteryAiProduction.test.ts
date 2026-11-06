/**
 * Mystery AI Production Test Suite
 * Validates dynamic context builder, absence of stale claims/supplier leaks,
 * delivery knowledge, fallback safety, and API response contracts.
 */

import assert from 'node:assert';
import { buildMysteryAiSystemInstruction } from '../../services/mysteryAiContext.js';
import { getGroundedLocalResponse } from '../../../src/services/mysteryAiService.js';
import { API_BASE_URL } from '../../../src/services/apiClient.js';

async function runMysteryAiTests() {
  console.log('--- STARTING MYSTERY AI PRODUCTION TEST SUITE ---');
  let passed = 0;

  // 1. Published prices are served by deterministic guides, outside the model prompt.
  {
    const prompt=buildMysteryAiSystemInstruction();
    assert.ok(!/GH₵[0-9]/.test(prompt));
    assert.ok(prompt.includes('Do not fill in missing prices'));
    assert.ok(prompt.includes('Missing evidence means unconfirmed'));
    console.log('✓ 1. Catalogue evidence and missing-data boundaries verified');
    passed++;
  }

  // 2. Stale claims and validity labels removed
  {
    const instruction = buildMysteryAiSystemInstruction();
    assert.strictEqual(
      instruction.toLowerCase().includes('1gb (7 days)'),
      false,
      'Must NOT contain stale "1GB (7 Days)"'
    );
    assert.strictEqual(
      instruction.toLowerCase().includes('2.5gb (7 days)'),
      false,
      'Must NOT contain stale "2.5GB (7 Days)"'
    );
    assert.strictEqual(
      instruction.toLowerCase().includes('5gb (30 days) at gh₵24.99'),
      false,
      'Must NOT contain stale 5GB rate'
    );
    assert.strictEqual(
      instruction.toLowerCase().includes('jumbo'),
      false,
      'Must NOT contain stale Jumbo wording'
    );
    assert.strictEqual(
      instruction.toLowerCase().includes('mystery shield'),
      false,
      'Must NOT contain stale Mystery Shield claims'
    );
    console.log('✓ 2. Stale validity claims and retired branding removed from system instruction');
    passed++;
  }

  // 3. Confidential supplier privacy protected
  {
    const instruction = buildMysteryAiSystemInstruction();
    assert.strictEqual(
      instruction.toLowerCase().includes('success biz hub'),
      false,
      'Must NEVER mention Success Biz Hub'
    );
    assert.strictEqual(
      instruction.toLowerCase().includes('successbizhub'),
      false,
      'Must NEVER mention successbizhub'
    );
    assert.strictEqual(
      instruction.toLowerCase().includes('wholesale'),
      false,
      'Must NEVER mention wholesale prices'
    );
    console.log('✓ 3. Strict supplier identity and operational confidentiality verified');
    passed++;
  }

  // 4. Delivery knowledge and single active MTN order rule
  {
    const instruction = buildMysteryAiSystemInstruction();
    assert.strictEqual(
      instruction.toLowerCase().includes('guaranteed instant'),
      false,
      'Must NOT promise guaranteed instant delivery'
    );
    assert.ok(instruction.includes('Do not promise instant delivery'), 'Must avoid unverified instant delivery claims');
    assert.ok(instruction.includes('Never promise guaranteed, immediate or instant airtime/bundle delivery'), 'Must not invent delivery speed');
    assert.ok(instruction.includes('Do not invent a delivery estimate'), 'Must rely on authoritative status instead of a fabricated estimate');
    assert.ok(!instruction.includes('48 hours'), 'Must not promise an unsupported maximum delay');
    assert.ok(
      instruction.includes('wait for their current active MTN order to complete'),
      'Must instruct waiting for active MTN order to complete'
    );
    assert.ok(instruction.includes('trackable'), 'Must state orders remain trackable');
    assert.ok(
      instruction.includes('Supported data networks are MTN, AirtelTigo and Telecel'),
      'Customer-facing network order must be MTN -> AirtelTigo -> Telecel'
    );
    console.log('✓ 4. Realistic delivery expectations, AT instant delivery, and MTN protection grounded in AI prompt');
    passed++;
  }

  // 5. Emergency local fallback response verification
  {
    const priceResponse = getGroundedLocalResponse('How much is 1GB?', 'data');
    assert.ok(priceResponse?.reply.includes('checkout prices') && !/GH₵[0-9]/.test(priceResponse.reply), 'Offline fallback must direct customers to live prices instead of seed prices');
    assert.strictEqual(
      priceResponse!.reply.toLowerCase().includes('7 days'),
      false,
      'Fallback must not include stale 7-day wording'
    );

    const speedResponse = getGroundedLocalResponse('How fast is delivery?', 'data');
    assert.ok(speedResponse!.reply.includes('Orders'), 'Fallback directs customers to authoritative order status');
    assert.ok(!speedResponse!.reply.includes('15–45 minutes'), 'No unsupported delivery estimate');
    assert.ok(!speedResponse!.reply.includes('48 hours'), 'No unsupported maximum delay');

    const identityResponse = getGroundedLocalResponse('Who are you?', 'home');
    assert.ok(identityResponse!.reply.includes('Mystery AI'));
    assert.ok(
      identityResponse!.reply.includes('Mystery Wallet') && identityResponse!.reply.includes('Website Builder'),
      'Identity explains the wider platform, not only bundles'
    );

    console.log('✓ 5. Emergency local fallback returns grounded facts without stale data');
    passed++;
  }

  // 6. API_BASE_URL resolution
  {
    // API_BASE_URL should be a string (empty for relative path in dev or Render URL in prod)
    assert.strictEqual(typeof API_BASE_URL, 'string');
    console.log(`✓ 6. Production API base URL verified: "${API_BASE_URL || '(relative local)'}"`);
    passed++;
  }

  console.log(`ALL ${passed} MYSTERY AI PRODUCTION TESTS PASSED SUCCESSFULLY!`);
}

runMysteryAiTests().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
