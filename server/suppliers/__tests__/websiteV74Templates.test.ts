import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEBSITE_TEMPLATES } from '../../../src/data/templates.js';
import { websiteStarter } from '../../../src/config/websiteStarters.js';

const source = (path: string) => readFileSync(path, 'utf8');
const T = (id: string) => WEBSITE_TEMPLATES.find(t => t.id === id)!;
const STARTERS = 'https://res.cloudinary.com/da6oeat7m/image/upload/';
const FILE: Record<string, string> = {
  jollof: 'mysteryhub/website-starters/food/jollof-grilled-chicken.jpg',
  tilapia: 'mysteryhub/website-starters/food/grilled-tilapia-banku.jpg',
  soup: 'mysteryhub/website-starters/food/light-soup-fufu.jpg',
  sobolo: 'mysteryhub/website-starters/food/sobolo.jpg',
};
const dishPhoto = (name: string) => /jollof/i.test(name) ? FILE.jollof : /tilapia/i.test(name) ? FILE.tilapia : /soup/i.test(name) ? FILE.soup : /sobolo/i.test(name) ? FILE.sobolo : '';

test('V7.4 B: every restaurant dish shows a photograph of that dish', () => {
  for (const id of ['tmpl-night-kitchen', 'tmpl-buka-bistro']) {
    const t = T(id);
    assert.ok(t.heroImage?.startsWith(STARTERS) && t.heroImage.includes('/website-starters/restaurant/'), id);
    for (const item of t.items || []) {
      const expected = dishPhoto(item.name);
      assert.ok(expected, `${id}: ${item.name} has a known dish`);
      assert.ok(item.image?.startsWith(STARTERS) && item.image.endsWith(expected), `${id}: ${item.name} -> ${item.image}`);
    }
  }
  // The starter examples a new owner receives point at the same, matching photographs.
  for (const id of ['tmpl-night-kitchen', 'tmpl-buka-bistro']) for (const item of websiteStarter(id, 'Test').content.items || []) {
    assert.ok(item.image?.endsWith(dishPhoto(item.name)), `${id} starter: ${item.name} -> ${item.image}`);
  }
});

test('V7.4 B: boutique pieces are pictured as named, and nothing invents a price', () => {
  const b = T('tmpl-boutique');
  const byName = Object.fromEntries((b.items || []).map(i => [i.name, i]));
  assert.ok(byName['Kente occasion set'].image?.endsWith('boutique/kente-occasion-set.jpg'));
  assert.ok(byName['Linen kaftan'].image?.endsWith('boutique/linen-kaftan.jpg'));
  assert.ok(byName['Ankara statement dress'].image?.endsWith('boutique/ankara-statement-dress.jpg'));
  assert.equal(byName['Ready-to-wear pieces'].price, '');
  assert.equal(byName['Ready-to-wear pieces'].label, undefined);
  assert.ok(b.heroImage?.endsWith('boutique/boutique-hero.jpg'));
  // Only the four refreshed designs changed: every other template keeps its imagery.
  for (const t of WEBSITE_TEMPLATES.filter(t => !['tmpl-night-kitchen', 'tmpl-buka-bistro', 'tmpl-boutique', 'tmpl-data-reseller', 'tmpl-start-blank'].includes(t.id))) {
    assert.ok(!t.heroImage?.includes('/website-starters/'), t.id);
  }
});

test('V7.4 B: an unpriced item reads "Price on request" in every shop and restaurant design', () => {
  for (const f of ['NightKitchenTemplateView', 'RestaurantTemplateView', 'EcommerceTemplateView', 'BoutiqueTemplateView']) {
    const s = source(`src/components/website/templates/${f}.tsx`);
    assert.match(s, /Price on request/, f);
    assert.doesNotMatch(s, /\|\| 'Ask'|'Ask for the price'/, f);
  }
});

test('V7.4 B: Night Kitchen menu is a card per dish, grouped by category, with a filled Add', () => {
  const s = source('src/components/website/templates/NightKitchenTemplateView.tsx');
  assert.match(s, /\.nk-hero\{position:relative;min-height:min\(68svh,560px\)/);
  assert.match(s, /\.nk-row\{display:flex;gap:14px;padding:12px;border-radius:20px;border:1px solid var\(--nk-line\);background:var\(--nk-card\)/);
  assert.match(s, /\.nk-add\{min-height:44px;min-width:84px/);
  assert.match(s, /style=\{\{ backgroundColor: accent, color: onAccent \}\} aria-label=\{`Add \$\{item\.name\} to your order`\}/);
  assert.match(s, /const groups = tab === 'All' && categories\.length > 2/);
  assert.match(s, /\.nk-groups\{columns:2;column-gap:24px\}/);
  assert.match(s, /sizes="\(min-width: 900px\) 120px, 104px" className="nk-thumb"/);
});

test('V7.4 B: Classic Kitchen keeps its warm serif identity with real categories, a clear hero and a compact phone header', () => {
  const s = source('src/components/website/templates/RestaurantTemplateView.tsx');
  assert.doesNotMatch(s, /'Main Grills', 'Soups & Swallows', 'Beverages'\]/);
  assert.match(s, /const categories = \['All', \.\.\.new Set\(/);
  assert.match(s, /className="ck-hero relative pt-36 pb-10 sm:py-24/);
  assert.match(s, /\.ck-hero-wash\{background:linear-gradient/);
  assert.match(s, /<span className="hidden sm:inline">\{template\.siteContent\?\.ctaLabel/);
  assert.match(s, /className="ck-add min-h-11 min-w-\[84px\]/);
  assert.match(s, /font-serif/);
  assert.doesNotMatch(s, /\.nk-row|nk-add/); // its own system, not Night Kitchen's
});

test('V7.4 B: Boutique cards hold their Add control inside the card; the shop note is calm, not urgent', () => {
  const b = source('src/components/website/templates/BoutiqueTemplateView.tsx');
  assert.match(b, /\.bq-item\{position:relative;display:flex;flex-direction:column;min-width:0\}/);
  assert.match(b, /className="bq-item"/);
  assert.match(b, /\.bq-add\{margin-top:10px;min-height:44px/);
  assert.match(b, /'Choose options' : 'Add to list'/);
  const e = source('src/components/website/templates/EcommerceTemplateView.tsx');
  assert.doesNotMatch(e, /<Flame/);
  assert.match(e, /bg-slate-900 text-slate-100 text-xs px-4 py-2/);
});

test('V7.4 B: ordering stays the shared WhatsApp order list; no payment, stock or cart backend appears', () => {
  for (const f of ['NightKitchenTemplateView', 'RestaurantTemplateView', 'EcommerceTemplateView', 'BoutiqueTemplateView']) {
    const s = source(`src/components/website/templates/${f}.tsx`);
    assert.match(s, /useOrderList\(\)/, f);
    assert.doesNotMatch(s, /paystack|checkout|stock\s*[:=]\s*\d|fetch\(/i, f);
  }
});
