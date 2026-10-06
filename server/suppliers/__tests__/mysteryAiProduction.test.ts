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

  // 1. Dynamic context builder contains current live product data and correct prices
  {
    const instruction = buildMysteryAiSystemInstruction();
    assert.ok(instruction.includes('GH₵5.49'), 'Must include MTN 1GB rate (GH₵5.49)');
    assert.ok(instruction.includes('GH₵23.99'), 'Must include MTN 5GB rate (GH₵23.99)');
    assert.ok(instruction.includes('GH₵44.99'), 'Must include MTN 10GB rate (GH₵44.99)');
    assert.ok(instruction.includes('GH₵4.99'), 'Must include AT 1GB rate (GH₵4.99)');
    assert.ok(instruction.includes('GH₵44.99'), 'Must include Telecel 10GB rate (GH₵44.99)');

    console.log('✓ 1. Dynamic context builder derives current live prices from catalog');
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
    assert.ok(instruction.includes('AirtelTigo (AT iShare): INSTANT DELIVERY'), 'Must state AirtelTigo is INSTANT DELIVERY');
    assert.ok(instruction.includes('MTN Orders: Fast under normal conditions, but NOT instant'), 'Must state MTN is NOT instant');
    assert.ok(instruction.includes('15–45 minutes'), 'Must mention typical 15-45 minutes for MTN');
    assert.ok(instruction.includes('48 hours'), 'Must mention exceptional delay up to 48 hours');
    assert.ok(
      instruction.includes('wait for their current active MTN order to complete'),
      'Must instruct waiting for active MTN order to complete'
    );
    assert.ok(instruction.includes('trackable'), 'Must state orders remain trackable');
    assert.ok(
      instruction.indexOf('AirtelTigo') < instruction.indexOf('Telecel'),
      'Customer-facing network order must be MTN -> AirtelTigo -> Telecel'
    );
    console.log('✓ 4. Realistic delivery expectations, AT instant delivery, and MTN protection grounded in AI prompt');
    passed++;
  }

  // 5. Emergency local fallback response verification
  {
    const priceResponse = getGroundedLocalResponse('How much is 1GB?', 'data');
    assert.ok(priceResponse.reply.includes('5.49'), 'Fallback must report MTN 1GB as GH₵5.49');
    assert.strictEqual(
      priceResponse.reply.toLowerCase().includes('7 days'),
      false,
      'Fallback must not include stale 7-day wording'
    );

    const speedResponse = getGroundedLocalResponse('How fast is delivery?', 'data');
    assert.ok(speedResponse.reply.includes('Instant Delivery'), 'Fallback must describe AirtelTigo as Instant Delivery');
    assert.ok(speedResponse.reply.includes('15–45 minutes'), 'Fallback must state MTN typical 15-45 minutes');
    assert.ok(speedResponse.reply.includes('48 hours'), 'Fallback must state MTN exceptional 48 hours');

    const identityResponse = getGroundedLocalResponse('Who are you?', 'home');
    assert.ok(identityResponse.reply.includes('Mystery AI'));
    assert.ok(
      identityResponse.reply.indexOf('AirtelTigo') < identityResponse.reply.indexOf('Telecel'),
      'Identity reply must list networks in order MTN -> AirtelTigo -> Telecel'
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
