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

test('phones get an art-directed crop of the approved hero artwork, in one request', async () => {
  const hero = home('Hero.tsx');
  assert.match(hero, /const HERO_ARTWORK = 'https:\/\/res\.cloudinary\.com\/da6oeat7m\/image\/upload\/v1790778037\/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst\.png';/);
  // A <picture> source swaps the phone crop in; the browser fetches one candidate, never both.
  assert.match(hero, /<picture>[\s\S]*<source media="\(max-width: 767px\)"[\s\S]*region: PHONE_REGION[\s\S]*<img[\s\S]*<\/picture>/);
  const match = hero.match(/PHONE_REGION = \{ x: (\d+), y: (\d+), width: (\d+), height: (\d+) \}/);
  assert.ok(match, 'phone crop region');
  const [x, y, width, height] = match!.slice(1).map(Number);
  assert.ok(x >= 0 && y >= 0 && x + width <= 1672 && y + height <= 941, 'crop stays inside the 1672 × 941 original');
  // The band is 64vw tall at most, so the crop matches it (≈1.56:1) and CSS barely re-crops.
  assert.ok(Math.abs(width / height - 1 / 0.64) < 0.01, 'phone crop matches the band');
  // Phone candidates never upscale past the crop's own pixels.
  const phoneWidths = hero.match(/getCloudinarySrcSet\(HERO_ARTWORK, \[([\d, ]+)\], \{ region/)![1].split(',').map(Number);
  assert.ok(Math.max(...phoneWidths) <= width);
  const { getCloudinaryUrl } = await import('../../../src/utils/cloudinary.ts');
  assert.equal(
    getCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v1/a.png', { width: 720, region: { x, y, width, height } }),
    `https://res.cloudinary.com/demo/image/upload/c_crop,h_${height},w_${width},x_${x},y_${y}/f_auto,q_auto,w_720/v1/a.png`,
  );
  // Image failure removes the empty band instead of leaving a dark block above the headline.
  assert.match(hero, /home-hero-no-art/);
  const css = home('homepage.css');
  assert.match(css, /\.home-hero-no-art \.home-hero-content \{ padding-top: 40px; \}/);
  assert.match(css, /--hero-art-h: clamp\(/);
});

test('network selector keeps distinct network colours on its selected state', () => {
  assert.match(home('HomeFeaturedData.tsx'), /'--network-color': GHANA_NETWORKS\[id\]\.brandColor/);
  assert.match(home('homepage.css'), /button\[aria-pressed="true"\] \{[^}]*var\(--network-color/);
});
