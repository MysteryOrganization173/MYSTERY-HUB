import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { WEBSITE_TEMPLATES } from '../../../src/data/templates.js';
import { mergeSiteWithTemplate, renderTemplateLayout } from '../../../src/utils/templateRendererUtils.js';
import {
  addOrderLine, displayItemPrice, formatOrderGhs, orderMessage, orderTotalMinor, orderTotals, setOrderQuantity,
  whatsappDigits, whatsappOrderUrl, withDisplayPrices, PRICE_ON_REQUEST, ORDER_LIST_LIMITS, priceHint,
} from '../../../src/utils/websiteOrderList.js';
import { hasWorkingWhatsApp } from '../../../src/utils/websiteReadiness.js';

import { publicWebsiteContent } from '../../../server/services/websitePublication.js';
import type { SiteContent, TemplateItem } from '../../../src/types/index.js';

const source = (path: string) => readFileSync(path, 'utf8');
const byId = (id: string) => WEBSITE_TEMPLATES.find(t => t.id === id)!;
const render = (id: string, content: Partial<SiteContent>) => renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(byId(id), { businessName: 'Fixture Kitchen', tagline: 't', aboutText: 'a', location: 'Osu', phone: '', whatsapp: '0241234567', email: '', logoUrl: '', heroImage: '', ctaLabel: '', ctaTarget: '', social: {}, items: [], stats: [], features: [], ...content } as SiteContent)));
const FOUR = ['tmpl-night-kitchen', 'tmpl-buka-bistro', 'tmpl-makola-mart', 'tmpl-boutique'];

test('V7.5: one price rule everywhere: bare numbers are cedis, words stay as written, empty is "Price on request"', () => {
  assert.equal(displayItemPrice('45'), 'GH₵ 45.00');
  assert.equal(displayItemPrice(' 1,200.5 '), 'GH₵ 1,200.50');
  assert.equal(displayItemPrice('GH₵ 85.00'), 'GH₵ 85.00');
  assert.equal(displayItemPrice('From GH₵ 40'), 'From GH₵ 40');
  assert.equal(displayItemPrice('   '), '');
  assert.equal(displayItemPrice(undefined), '');
  assert.equal(formatOrderGhs(1518000), 'GH₵ 15,180.00');
  assert.equal(PRICE_ON_REQUEST, 'Price on request');
  // Groups are trimmed, so look-alike filter tabs can't appear.
  assert.deepEqual(withDisplayPrices([{ name: 'a', category: ' Mains ', price: '20' }, { name: 'b', category: '  ' }] as TemplateItem[]).map(i => [i.category, i.price]), [['Mains', 'GH₵ 20.00'], [undefined, '']]);
  // The editor says exactly what customers will see.
  assert.match(priceHint(''), /Price on request/);
  assert.match(priceHint('45'), /Customers see “GH₵ 45\.00”\. It is added up/);
  assert.match(priceHint('From 40'), /as written\. Words aren’t added up/);
  assert.doesNotMatch(source('src/components/website/editor/WebsiteItemPanel.tsx'), /Leave empty to hide the price/);
  for (const f of ['src/components/website/storefront/OrderList.tsx', ...['NightKitchen', 'Restaurant', 'Ecommerce', 'Boutique'].map(t => `src/components/website/templates/${t}TemplateView.tsx`)]) {
    assert.doesNotMatch(source(f), /Ask for the price|\|\| 'Ask'/, f);
  }
});

test('V7.5: quantities, options and mixed prices give an honest WhatsApp message', () => {
  const jollof = { id: 'j', name: 'Jollof', price: 'GH₵ 65' }, sobolo = { id: 's', name: 'Sobolo', price: 'GH₵ 20' }, special = { id: 'x', name: 'Chef special', price: '' };
  let lines = addOrderLine([], jollof, 'Large');
  lines = addOrderLine(lines, jollof, 'Large');
  lines = addOrderLine(lines, jollof, 'Regular');
  lines = addOrderLine(lines, sobolo);
  assert.equal(lines.length, 3, 'the same dish with another option is its own line, never merged or duplicated');
  assert.equal(lines[0].quantity, 2);
  let text = orderMessage('Fixture Kitchen', lines, 'https://example.test/sites/fixture');
  assert.equal(text, [
    "Hello Fixture Kitchen, I'd like to order:",
    '• 2 × Jollof (Large) · GH₵ 65 each (GH₵ 130.00)',
    '• Jollof (Regular) · GH₵ 65',
    '• Sobolo · GH₵ 20',
    'Total at your listed prices: GH₵ 215.00',
    'Please confirm availability, the final price, delivery and payment.',
    'https://example.test/sites/fixture',
  ].join('\n'));
  assert.equal(orderTotalMinor(lines), 21500);
  // An unpriced item: no total, the known part is labelled, and the item says it needs a price.
  const mixed = addOrderLine(lines, special);
  text = orderMessage('Fixture Kitchen', mixed);
  assert.ok(text.includes('• Chef special · price on request'));
  assert.ok(text.includes('Listed prices so far: GH₵ 215.00, plus 1 item for you to price'));
  assert.doesNotMatch(text, /Total at your listed prices/);
  assert.equal(orderTotalMinor(mixed), null);
  assert.deepEqual(orderTotals(mixed), { knownMinor: 21500, unpriced: 1, complete: false });
  // Only unpriced: no sums at all.
  assert.doesNotMatch(orderMessage('K', addOrderLine([], special)), /Total|so far/);
  // One priced item ordered twice shows its total; once, no redundant total line.
  assert.match(orderMessage('K', setOrderQuantity(addOrderLine([], sobolo), 's::', 3)), /3 × Sobolo · GH₵ 20 each \(GH₵ 60\.00\)\nTotal at your listed prices: GH₵ 60\.00/);
  assert.doesNotMatch(orderMessage('K', addOrderLine([], sobolo)), /Total/);
  // Removing and the quantity cap.
  assert.equal(setOrderQuantity(lines, lines[0].key, 0).length, 2);
  assert.equal(setOrderQuantity(lines, lines[0].key, 999)[0].quantity, ORDER_LIST_LIMITS.quantity);
  // The optional note is plain text, capped, and never markup.
  text = orderMessage('K', lines, undefined, '  less pepper <b>please</b> ' + 'x'.repeat(300));
  assert.match(text, /\nNote: less pepper bplease\/b x+\n/);
  assert.ok(text.split('\n').find(l => l.startsWith('Note:'))!.length <= 'Note: '.length + ORDER_LIST_LIMITS.note);
  // Promises nothing, and encodes cleanly for wa.me.
  assert.doesNotMatch(text, /paid|confirmed order|reserved|guarantee/i);
  const url = whatsappOrderUrl('0241234567', text)!;
  assert.equal(decodeURIComponent(url.split('?text=')[1]), text);
});

test('V7.5: WhatsApp numbers: every Ghana form works, a missing number never invents one', () => {
  for (const n of ['024 123 4567', '+233 24 123 4567', '233241234567', '00233241234567', '24 123 4567', '(024) 123-4567']) assert.equal(whatsappDigits(n), '233241234567', n);
  assert.equal(whatsappDigits('+44 7911 123456'), '447911123456');
  for (const n of ['', '12', 'call me', undefined]) assert.equal(whatsappDigits(n as string), '', String(n));
  assert.equal(whatsappOrderUrl('', 'hi'), null);
  // Readiness keeps accepting everything it accepted before (no published site becomes "broken").
  for (const n of ['0241234567', '+233241234567', '241234567', '123456789']) assert.ok(hasWorkingWhatsApp(n), n);
  assert.ok(!hasWorkingWhatsApp('12345'));
  // Every builder in these designs uses the one rule.
  for (const f of ['src/components/website/SiteContactDetails.tsx', 'src/components/website/BusinessEnquiry.tsx', 'src/components/website/templates/NightKitchenTemplateView.tsx']) {
    assert.match(source(f), /whatsappDigits\(/, f);
    assert.doesNotMatch(source(f), /\.replace\(\/\^0\/, ?'233'\)/, f);
  }
});

test('V7.5: without a WhatsApp number the order can be copied; quantities can be removed at one; a note can be added', () => {
  const s = source('src/components/website/storefront/OrderList.tsx');
  assert.match(s, /Copy my order/);
  assert.match(s, /navigator\.clipboard\.writeText\(message\)/);
  assert.match(s, /aria-label=\{l\.quantity > 1 \? `One less \$\{l\.name\}` : `Remove \$\{l\.name\}`\}/);
  assert.match(s, /<label htmlFor="ol-note">Add a note \(optional\)<\/label>/);
  assert.match(s, /\.ol-qty button\{width:44px;height:44px;/);
  assert.match(s, /' · price to confirm'/);
  for (const t of ['NightKitchen', 'Restaurant', 'Ecommerce', 'Boutique']) {
    const v = source(`src/components/website/templates/${t}TemplateView.tsx`);
    assert.match(v, /note=\{order\.note\} onNote=\{order\.setNote\}/, t);
    assert.match(v, /withDisplayPrices\(template\.items \|\| \[\]\)/, t);
  }
});

test('V7.5: owners get group suggestions and honest option wording', () => {
  const panel = source('src/components/website/editor/WebsiteItemPanel.tsx');
  assert.match(panel, /<datalist id=\{`\$\{id\}-suggestions`\}>/);
  assert.match(panel, /suggestions=\{groups\.filter\(g => g !== item\.category\)\}/);
  assert.match(source('src/components/website/editor/WebsiteEditor.tsx'), /groups=\{\[\.\.\.new Set\(items\.map\(i=>\(i\.category\|\|''\)\.trim\(\)\)\.filter\(Boolean\)\)\]\}/);
  assert.match(source('src/components/website/editor/WebsiteV5Controls.tsx'), /Every choice has this/);
});

test('V7.5: publication keeps the catalogue fields, drops unreviewed examples, and adds nothing new', () => {
  const items = [
    { id: 'a', name: 'Jollof', price: '65', category: 'Mains', desc: 'd', image: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg', images: ['https://res.cloudinary.com/x/image/upload/v1/b.jpg'], options: ['Regular', 'Large'], label: 'Popular', pinned: true },
    { id: 'b', name: 'Example dish', isExample: true },
  ];
  const pub = publicWebsiteContent({ businessName: 'K', layoutMode: 'template', items } as any);
  assert.equal(pub.items!.length, 1);
  assert.deepEqual(pub.items![0], items[0]);
  // The item allowlist is unchanged: the customer's note lives only in their browser and their message.
  assert.ok(source('server/services/websitePublication.ts').includes("['id','name','price','category','tag','desc','image','images','label','pinned','alt','focal','options']"));
});

test('V7.5: older saved catalogues still render in all four designs (no id, no price, no options, padded group)', () => {
  const legacy = [{ name: 'Old dish', category: ' Mains ' }, { name: 'Priced', price: '30', category: 'Mains' }, { name: 'Words', price: 'Ask us' }] as TemplateItem[];
  for (const id of FOUR) {
    const html = render(id, { items: legacy });
    assert.ok(html.includes('Old dish'), id);
    assert.ok(html.includes('Price on request'), `${id}: empty price`);
    assert.ok(html.includes('GH₵ 30.00'), `${id}: bare number shown as cedis`);
    assert.ok(html.includes('Ask us'), `${id}: words kept`);
    assert.ok(!/>Mains <|Mains <\/button>/.test(html) || !html.includes('> Mains'), `${id}: group trimmed`);
    assert.equal((html.match(/>Mains</g) || []).length >= 1, true, id);
  }
});

test('V7.5: a live order list without a usable WhatsApp number offers Copy, never a made-up wa.me link', async () => {
  const { OrderListSheet } = await import('../../../src/components/website/storefront/OrderList.js');
  const lines = addOrderLine([], { id: 'a', name: 'Jollof', price: 'GH₵ 65' });
  for (const whatsapp of ['', '12345']) {
    const html = renderToStaticMarkup(React.createElement(OrderListSheet, { lines, contact: { businessName: 'K', whatsapp, demo: false, onContact: () => {} }, onQuantity: () => {}, onClear: () => {}, onClose: () => {} }));
    assert.ok(html.includes('Copy my order'), whatsapp);
    assert.ok(!html.includes('wa.me'), whatsapp);
  }
  const ok = renderToStaticMarkup(React.createElement(OrderListSheet, { lines, contact: { businessName: 'K', whatsapp: '024 123 4567', demo: false }, onQuantity: () => {}, onClear: () => {}, onClose: () => {} }));
  assert.ok(ok.includes('https://wa.me/233241234567?text='));
  // The gallery demo never opens WhatsApp at all.
  const demo = renderToStaticMarkup(React.createElement(OrderListSheet, { lines, contact: { businessName: 'K', whatsapp: '0241234567', demo: true }, onQuantity: () => {}, onClear: () => {}, onClose: () => {} }));
  assert.ok(!demo.includes('wa.me'));
});

test('V7.5: Night Kitchen asks about a table or a group, not about dishes; example badges never cover the dish name', () => {
  const nk = source('src/components/website/templates/NightKitchenTemplateView.tsx');
  assert.match(nk, /guestsLabel="Number of guests" topics=\{\["a table", "a group or event", "catering"\]\}/);
  assert.match(nk, /<ExampleTag item=\{item\} corner=\{item\.image \? "left" : "right"\} \/>/);
  assert.match(nk, /\.nk-row-tagged \.nk-row-body\{padding-top:20px\}/);
  assert.match(source('src/components/website/editor/WebsiteItemPanel.tsx'), /Change the name, price and photo to something you really offer/);
  assert.match(source('src/components/website/storefront/OrderList.tsx'), /\.ol-photos\.single>\*\{flex-basis:100%;aspect-ratio:1\/1;max-height:min\(50svh,420px\)\}/);
});
