import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {formatGhanaCardInput, afaJourney} from '../../../src/utils/afaForm';
import {normalizeGhanaCard} from '../../../shared/afa';

const page = readFileSync('src/components/services/AfaRegistrationPage.tsx', 'utf8');

test('Ghana Card typing help produces the format the shared validator accepts', () => {
  assert.equal(formatGhanaCardInput('1234567890'), 'GHA-123456789-0');
  assert.equal(formatGhanaCardInput('gha1234'), 'GHA-1234');
  assert.equal(formatGhanaCardInput('GHA-123456789-0'), 'GHA-123456789-0');
  assert.equal(formatGhanaCardInput('G'), 'G');
  assert.equal(formatGhanaCardInput('GHA-'), 'GHA');
  assert.equal(formatGhanaCardInput('x'), '');
  assert.equal(formatGhanaCardInput('12345678901234'), 'GHA-123456789-0');
  assert.equal(normalizeGhanaCard(formatGhanaCardInput(' 123 456 789 0 ')), 'GHA-123456789-0');
});

test('registration progress follows server status and never shows Registered early', () => {
  assert.deepEqual(afaJourney('pending_payment'), {stopped: false, reached: 0, registered: false});
  assert.equal(afaJourney('queued').reached, 1);
  assert.equal(afaJourney('processing').reached, 2);
  assert.deepEqual(afaJourney('delivered'), {stopped: false, reached: 3, registered: true});
  assert.equal(afaJourney('delivered', true).registered, false);
  assert.equal(afaJourney('failed').stopped, true);
  assert.equal(afaJourney('processing', true).stopped, true);
});

test('AFA packages stay information about MTN, not a Mystery Hub product', () => {
  const packages = page.slice(page.indexOf('id="afa-packages"'));
  assert.match(packages, /Bought on MTN, not here/);
  assert.match(packages, /on MTN · \{pkg.validity\}/);
  assert.doesNotMatch(packages.slice(0, packages.indexOf('</section>')), /onClick=\{\(\) => (openCheckout|handleSubmit)|mh-buy|Buy/);
});

test('identity fields stay out of autofill, storage and URLs; only the POST body carries them', () => {
  assert.match(page, /id=\{ghanaCardId\} autoComplete="off"/);
  assert.match(page, /id=\{dobId\} autoComplete="off"/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|indexedDB|console\.|history\.(push|replace)State|searchParams\.set/);
  assert.match(page, /normalizeGhanaCard\(value\)/);
  assert.match(page, /validateAfaPayload\(\{ name:formData.fullName/);
});

test('payment starts only from a valid submit and the button locks while it starts', () => {
  assert.match(page, /disabled=\{isSubmitting \|\| isPriceLoading \|\| !priceAvailable\}/);
  assert.match(page, /requestKey.current \|\|= crypto.randomUUID\(\)/);
  assert.match(page, /url.hostname !== 'checkout.paystack.com'/);
  assert.match(page, /Registration starts only after the payment is confirmed/);
});
