import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = (file: string) => readFileSync(file, 'utf8');

test('member homepage does not append guest marketing while guest P1 composition survives', () => {
  const home = source('src/components/home/HomePage.tsx');
  const member = home.slice(home.indexOf('if (user) {'), home.lastIndexOf('return ('));
  assert.match(member, /<MemberHome \/>/);
  assert.doesNotMatch(member, /<HomeFeaturedData|<HomeWebsiteSection|<HomeMarketplaceSection/);
  for (const section of ['Hero', 'QuickServicesBar', 'HomeFeaturedData', 'HomeWebsiteSection', 'HomeMarketplaceSection', 'WhyMysteryHub']) {
    assert.match(home.slice(home.lastIndexOf('return (')), new RegExp(`<${section} />`));
  }
  assert.match(home, /import '\.\/homepage\.css'/);
});

test('assistant preserves account and forced-password exclusions and P1 navigation entry', () => {
  const assistant = source('src/components/ai/MysteryAiAssistant.tsx');
  const exclusions = assistant.slice(assistant.indexOf('const isAnyModalActive'), assistant.indexOf('const chatAvailable'));
  for (const guard of ['isCheckoutOpen', 'isStatusModalOpen', 'isAuthModalOpen', 'isAccountOpen', 'user?.mustChangePassword', 'selectedTemplatePreview', 'marketplaceInquiryProduct']) {
    assert.ok(exclusions.includes(guard), guard);
  }
  assert.match(source('src/components/common/MobileNav.tsx'), /id: 'earn', label: 'Earn'/);
  assert.match(source('src/components/common/Navbar.tsx'), /aria-label="Open Mystery AI Assistant"/);
});

test('header retains member account focus return and viewport-bounded P1 search', () => {
  const nav = source('src/components/common/Navbar.tsx');
  assert.match(nav, /whitespace-nowrap/);
  assert.match(nav, /fixed left-3 right-3/);
  assert.match(nav, /aria-label="Account navigation"/);
  assert.match(nav, /accountTrigger\.current\?\.focus\(\)/);
  assert.match(nav, /aria-controls="mobile-menu"/);
  assert.match(nav, /max-h-\[calc\(100dvh-5rem\)\] overflow-auto/);
  for (const destination of ['My Orders', 'Website Builder', 'Mystery Wallet', 'Mystery Earn']) assert.ok(nav.includes(destination));
});

test('main reseller activation guidance survives P0 copy integration', () => {
  const pricing = source('src/components/website/WebsiteBundlePricing.tsx');
  assert.match(pricing, /!catalog\.policy\?\.enabled/);
  assert.match(pricing, /Online checkout is not enabled for reseller stores yet/);
  assert.match(pricing, /No bundles are ready for customers yet/);
  assert.match(pricing, /Estimated earnings per sale allow for bundle costs and payment processing/);
});
