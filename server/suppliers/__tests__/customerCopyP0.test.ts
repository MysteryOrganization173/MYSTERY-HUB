import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIGITAL_SERVICES } from '../../../src/data/services';
import { serviceNotices } from '../../../src/config/serviceNotices';
const source = (name: string) => readFileSync(name, 'utf8');
test('homepage retains brand headline and working CTA destinations', () => {
  const hero = source('src/components/home/Hero.tsx');
  assert.match(hero, /Everything digital\./); assert.match(hero, /One trusted place\./);
  assert.match(hero, /href="\/website-builder"/); assert.match(hero, /href="\/data"/);
  assert.match(hero, /Create a Free Website/); assert.match(hero, /Buy Data/);
});
test('future services remain coming soon with explicit unavailable descriptions', () => {
  for (const id of ['srv-ecg', 'srv-water', 'srv-tv', 'srv-results', 'srv-bizreg', 'srv-ai', 'srv-esim']) {
    const service = DIGITAL_SERVICES.find(s => s.id === id)!;
    assert.equal(service.status, 'coming_soon'); assert.match(service.description, /not available yet/i);
  }
  assert.match(source('src/components/home/HomeComingSoonSection.tsx'), /openWaitlist\(svc.title\)/);
  assert.match(source('src/components/home/QuickServicesBar.tsx'), /Check Status/);
});
test('checkout retains recipient, receipt, confirmation, wrong-number, total and support protection', () => {
  const checkout = source('src/components/checkout/CheckoutModal.tsx');
  for (const copy of ['Confirm your order', 'Receipt email', 'Check this number before paying.', 'Total', 'WhatsApp', 'WalletPaymentChoice']) {
    assert.ok(checkout.toLowerCase().includes(copy.toLowerCase()), copy);
  }
  assert.match(checkout, /Please wait for your current order/);
  assert.ok(!checkout.includes('delivered immediately after successful payment'));
});
test('delivery and support copy avoids guarantees while keeping MTN processing warning', () => {
  assert.match(serviceNotices.mtn.message, /15–45 minutes/); assert.match(serviceNotices.mtn.message, /48 hours/);
  assert.match(serviceNotices.mtn.duplicatePolicyNote, /wait/);
  const data = source('src/components/data/DataPage.tsx');
  assert.ok(!data.includes('24/7 Support')); assert.ok(!data.includes('immediate resolution'));
  assert.match(data, /Delivered bundles may not be recoverable/);
  const status = source('src/components/checkout/OrderStatusModal.tsx');
  assert.match(status, /Payment confirmation does not mean it has been delivered/);
  assert.match(status, /Refund Pending/);
});
test('Wallet disclosure remains visible and transfer remains explicitly irreversible', () => {
  const wallet = source('src/components/finance/FinancialPanel.tsx');
  assert.match(wallet, /Wallet funds cannot be withdrawn/);
  assert.match(wallet, /cannot be withdrawn back to Mobile Money/);
  assert.match(wallet, /This transfer is irreversible/);
  assert.match(wallet, /payout destination and fee/);
  assert.match(wallet, /Wallet Activity/);
});
test('referral copy distinguishes browsers, pending and approved rewards without lifetime guarantees', () => {
  const earn = source('src/components/earn/MysteryEarnPage.tsx');
  for (const copy of ['Distinct browsers', 'Pending Rewards', 'Total approved rewards', 'active reward rules', 'Share a Service']) assert.ok(earn.includes(copy), copy);
  assert.ok(!earn.includes('MYSTERY EARN · LIFETIME REFERRALS'));
  assert.ok(!earn.includes('immutable rewards are credited directly'));
});
test('Marketplace enquiry wording matches enquiry action and avoids unverified distributor claims', () => {
  const inquiry = source('src/components/marketplace/MarketplaceInquiryModal.tsx');
  assert.match(inquiry, /does not place an order or require payment/);
  assert.match(inquiry, /Continue on WhatsApp/);
  assert.ok(!inquiry.includes('authorized Ghana distributors'));
  assert.match(source('src/components/home/HomeMarketplaceSection.tsx'), /Ask About This Item/);
});
test('metadata describes live services and keeps future utilities unavailable', () => {
  for (const file of ['index.html', 'src/components/common/SEOHead.tsx']) {
    const text = source(file);
    assert.match(text, /Digital Services Marketplace in Ghana/);
    assert.match(text, /data and airtime/); assert.match(text, /free business website/);
    assert.ok(!text.includes('website in minutes'));
  }
  assert.match(source('src/components/common/SEOHead.tsx'), /results-checker services are not yet available/);
});
test('account recovery keeps ownership and password protections; AFA retains fee scope and privacy', () => {
  const auth = source('src/components/auth/AuthModal.tsx');
  assert.match(auth, /confirm ownership/); assert.match(auth, /Never send your password/);
  const afa = source('src/components/services/AfaRegistrationPage.tsx');
  assert.match(afa, /registration only/); assert.match(afa, /Never provide a PIN, password, card photo or selfie/);
  assert.match(afa, /Unresolved cases remain encrypted/);
});
