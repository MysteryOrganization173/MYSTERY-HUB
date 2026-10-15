import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = (file: string) => readFileSync(file, 'utf8');
const home = (name: string) => source(`src/components/home/${name}`);

test('homepage V2 keeps prices and offers on their authoritative sources', () => {
  const data = home('HomeFeaturedData.tsx');
  assert.match(data, /useDirectCatalog\(\)/);
  assert.match(data, /useWelcomeOffer\(DATA_BUNDLES\)/);
  assert.match(data, /CompactBundleRow/);
  assert.match(data, /openCheckout\(bundle\)/);
  assert.match(data, /openDataPage\('data', selectedNetwork\)/);
  // No hardcoded cedi amounts or delivery guarantees in homepage copy.
  for (const file of ['Hero.tsx', 'QuickServicesBar.tsx', 'HomeFeaturedData.tsx', 'HomeWebsiteSection.tsx', 'WhyMysteryHub.tsx', 'HomeComingSoonSection.tsx']) {
    const text = home(file);
    assert.doesNotMatch(text, /GH₵\s?\d/, file);
    assert.doesNotMatch(text, /instant(ly)? deliver|guarantee/i, file);
  }
  // The shared BundleCard purchase component is not used or restyled by the homepage.
  assert.doesNotMatch(data, /BundleCard/);
  assert.doesNotMatch(home('homepage.css'), /home-bundle-grid/);
});

test('service directory lists only live services with honest status labels', () => {
  const services = home('QuickServicesBar.tsx');
  for (const id of ['data', 'airtime', 'website', 'earn', 'afa', 'marketplace']) assert.match(services, new RegExp(`id: '${id}'`));
  assert.match(services, /tag: 'Free plan'/);
  assert.match(services, /tag: 'Enquiry'/);
  assert.match(services, /tag: 'Check Status'/);
  assert.doesNotMatch(services, /coming_soon|Coming Soon/);
  const future = home('HomeComingSoonSection.tsx');
  assert.match(future, /status === 'coming_soon'/);
  assert.match(future, /Not available yet/);
});

test('builder showcase uses real templates and the real design count', () => {
  const builder = home('HomeWebsiteSection.tsx');
  assert.match(builder, /orderedWebsiteTemplates\(\)\.filter\(t => t\.id !== 'tmpl-start-blank'\)/);
  assert.match(builder, /\{designs\.length\} ready-made designs/);
  assert.match(builder, /openTemplatePreview\(t\)/);
  assert.match(builder, /Sample design and content/);
});

test('help sits beside the FAQ and keeps real support destinations', () => {
  const page = home('HomePage.tsx');
  assert.match(page, /<div className="home-container home-help">\s*<WhyMysteryHub \/>\s*<HomeFaqPreview \/>/);
  const help = home('WhyMysteryHub.tsx');
  assert.match(help, /supportWhatsAppUrl/);
  assert.match(help, /setActivePage\('orders'\)/);
  assert.match(help, /MoMo PIN/);
});
