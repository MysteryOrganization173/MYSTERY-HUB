import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { apiRouter } from '../../routes/api.js';
import { adminRouter } from '../../routes/adminApi.js';
import { MarketplaceControlStore } from '../../db/marketplaceControlStore.js';
import { AuthStore } from '../../db/authStore.js';
import { validateGrowth as validateGrowthEvent } from '../../services/growthValidation.js';
import {
  CREATIVE_SERVICES, CreativeBriefError, creativeBriefProblems, creativeLeadMessage, creativeLink, creativePhone, creativeReference, validateCreativeBrief,
} from '../../../shared/creativeStudio.js';
import { CREATIVE_PROJECTS, CREATIVE_WORK } from '../../../src/data/creativeStudioWork.js';
import { creativeVisitorKey } from '../../routes/creativeStudioApi.js';
import { DIGITAL_SERVICES } from '../../../src/data/services.js';
import { serviceHref } from '../../../src/utils/serviceDirectory.js';
import { getPageFromPath, ROUTE_PATH_MAP } from '../../../src/utils/routing.js';
import { pageIndexingHead } from '../../../src/utils/socialMetadata.js';

const TODAY = '2026-11-05';
const ID = '3f2b8c1e-6d4a-4b7e-9c2d-1a2b3c4d5e6f';
const valid = (extra: Record<string, unknown> = {}) => ({
  requestId: ID, service: 'flyers', name: 'Synthetic Customer', phone: '024 123 4567', details: 'A flyer for our harvest service with the time and venue.',
  fields: { title: 'Harvest Thanksgiving 2026', format: 'A4 print' }, ...extra,
});
const fieldOf = (fn: () => unknown) => { try { fn(); } catch (e) { assert.ok(e instanceof CreativeBriefError, String(e)); return (e as CreativeBriefError).field; } assert.fail('expected a brief error'); };

let server: Server, base: string;
before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined, 'Isolated runner must remove inherited DB URL');
  const app = express(); app.use(express.json()); app.use('/api', apiRouter); app.use('/api/admin', adminRouter);
  server = await new Promise<Server>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(async () => {
  MarketplaceControlStore.resetMemory(); AuthStore._clearDevStore();
  for (const role of ['admin', 'customer'] as const) { await AuthStore.createUser({ id: role, name: role, email: `${role}@example.test`, phone: null, passwordHash: 'synthetic-unused-hash', role }); await AuthStore.createSession(role, `${role}-token`); }
});
const send = (body: unknown) => fetch(`${base}/api/creative-studio/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const adminInquiries = (token: string | null, query = '') => fetch(`${base}/api/admin/marketplace/inquiries${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('the V1 catalogue is four quoted services with service-aware questions and no prices or promises', () => {
  assert.deepEqual(CREATIVE_SERVICES.map(s => s.id), ['flyers', 'social', 'logo', 'banners']);
  for (const s of CREATIVE_SERVICES) {
    assert.ok(s.fields.some(f => f.required), `${s.id} asks at least one service question`);
    const words = JSON.stringify(s);
    assert.doesNotMatch(words, /GH₵|GHS|\bfree\b|unlimited|guarantee|24 ?hours|same day/i, `${s.id} makes no price or delivery promise`);
  }
  const page = readFileSync('src/components/creative/CreativeStudioPage.tsx', 'utf8') + readFileSync('src/components/creative/CreativeBriefForm.tsx', 'utf8');
  // V2: prices come only from the shared catalogue, never typed into the page, and custom projects are still quoted.
  assert.doesNotMatch(page, /Buy now|GH₵ ?\d|unlimited revisions|within \d+ (hours|days)|testimonial|★/i);
  assert.match(page, /sends a quote before any work starts/);
  assert.match(page, /not client projects/);
});

test('briefs are validated by one shared rule: contact, details, service questions, dates and links', () => {
  const brief = validateCreativeBrief(valid({ neededBy: '2026-11-20', links: ['instagram.com/p/abc', ''], email: 'synthetic@example.test' }), TODAY);
  assert.equal(brief.reference, 'CS-3F2B8C1E');
  assert.equal(brief.phone, '0241234567');
  assert.deepEqual(brief.links, ['https://instagram.com/p/abc']);
  assert.deepEqual(brief.fields.map(f => [f.field.id, f.value]), [['title', 'Harvest Thanksgiving 2026'], ['format', 'A4 print']]);
  assert.equal(creativePhone('+233 24 123 4567'), '0241234567');
  assert.equal(creativePhone('233541234567'), '0541234567');
  assert.equal(creativePhone('+44 7700 900123'), '+447700900123');
  for (const bad of ['12345', '0141234567', '024123456', '+233 14 123 4567', 'call me']) assert.equal(creativePhone(bad), null, bad);
  for (const bad of ['javascript:alert(1)', 'https://user:pass@example.com', 'http://localhost', 'ftp://example.com/file', 'https://exa mple.com']) assert.equal(creativeLink(bad), null, bad);

  assert.equal(fieldOf(() => validateCreativeBrief(valid({ name: '' }), TODAY)), 'name');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ phone: '12345' }), TODAY)), 'phone');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ email: 'not-an-email' }), TODAY)), 'email');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ details: 'Flyer' }), TODAY)), 'details');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ details: 'A flyer <script>alert(1)</script>' }), TODAY)), 'details');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ service: 'video' }), TODAY)), 'service');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ fields: { format: 'A4 print' } }), TODAY)), 'fields.title');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ fields: { title: 'X', format: 'Billboard' } }), TODAY)), 'fields.format');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ neededBy: '2026-11-04' }), TODAY)), 'neededBy');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ links: ['javascript:alert(1)'] }), TODAY)), 'links.0');
  assert.throws(() => validateCreativeBrief(valid({ fields: { title: 'X', businessName: 'Wrong service' } }), TODAY), /fields we do not accept/);
  assert.throws(() => validateCreativeBrief(valid({ admin_note: 'x' }), TODAY), /fields we do not accept/);
  assert.throws(() => validateCreativeBrief(valid({ website: 'https://spam.example' }), TODAY), /could not send/);
  assert.throws(() => validateCreativeBrief(valid({ requestId: 'not-a-uuid' }), TODAY), /Reload/);
  // The form lists every problem at once, in the order the fields appear on screen.
  assert.deepEqual(creativeBriefProblems({ requestId: ID, service: 'flyers', phone: '12345', links: ['javascript:x'] }, TODAY).map(p => p.field), ['fields.title', 'details', 'links.0', 'name', 'phone']);
  assert.deepEqual(creativeBriefProblems(valid(), TODAY), []);
  // The logo brief asks different questions from the flyer brief.
  const logo = validateCreativeBrief(valid({ service: 'logo', fields: { businessName: 'Ama Catering', businessType: 'Event catering in Kumasi', style: 'Elegant' } }), TODAY);
  assert.equal(logo.service.name, 'Logo & brand identity');
  // Review fixes: impossible dates are field errors, invisible characters are removed, 00 means +, punycode domains work.
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ neededBy: '2026-13-01' }), TODAY)), 'neededBy');
  assert.equal(fieldOf(() => validateCreativeBrief(valid({ neededBy: '2026-00-10' }), TODAY)), 'neededBy');
  assert.equal(validateCreativeBrief(valid({ name: 'Ama‮ Mensah​' }), TODAY).name, 'Ama Mensah');
  assert.equal(creativePhone('0044 7700 900123'), '+447700900123');
  assert.equal(creativeLink('https://пример.рф/p'), 'https://xn--e1afmkfd.xn--p1ai/p');
});

test('the Admin message never cuts a link or loses the quote line, even for the largest logo brief', () => {
  const brief = validateCreativeBrief(valid({ service: 'logo', details: 'd'.repeat(800), neededBy: '2026-12-01',
    fields: { businessName: 'b'.repeat(120), businessType: 't'.repeat(160), logoStatus: 'Refresh my current logo', style: 'Traditional', colours: 'c'.repeat(80) },
    links: [1, 2, 3].map(n => `https://site${n}.example/` + 'p'.repeat(170)) }), TODAY);
  const message = creativeLeadMessage(brief);
  assert.ok(message.length <= 2000, String(message.length));
  assert.match(message, /Quote required: no price or delivery date has been promised\.$/);
  const shown = message.split('\n').filter(line => line.startsWith('- https://'));
  for (const line of shown) assert.ok(brief.links.includes(line.slice(2)), 'every shown link is complete');
  assert.ok(shown.length < 3 && /more links? not shown: ask the customer/.test(message));
  assert.match(message, /d{800}/, 'the details are kept whole when dropping a link is enough');
});

test('rate limits separate visitors behind the proxy and the old enquiry route cannot forge Creative Studio leads', async () => {
  assert.equal(creativeVisitorKey({ headers: { 'x-forwarded-for': '41.66.1.2, 10.0.0.1' }, ip: '10.0.0.1' }), '41.66.1.2');
  assert.equal(creativeVisitorKey({ headers: { 'x-forwarded-for': '<script>' }, ip: '10.0.0.1' }), '10.0.0.1');
  assert.equal(creativeVisitorKey({ headers: {}, ip: '10.0.0.9' }), '10.0.0.9');
  const forged = await fetch(`${base}/api/marketplace/inquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productName: 'Creative Studio · Flyers & posters', inquiryType: 'Creative_Studio ', customerPhone: '0241234567' }) });
  assert.equal(forged.status, 400);
  assert.equal((await (await adminInquiries('admin-token')).json()).total, 0);
});

test('the lead Admin reads is plain text with the reference and an explicit quote-required line, within the column limit', () => {
  const brief = validateCreativeBrief(valid({ details: 'x'.repeat(800), neededBy: '2026-12-01', links: ['https://a.example/' + 'p'.repeat(170), 'https://b.example/' + 'p'.repeat(170), 'https://c.example/' + 'p'.repeat(170)] }), TODAY);
  const message = creativeLeadMessage(brief);
  assert.ok(message.length <= 2000, String(message.length));
  assert.match(message, /^Creative Studio brief CS-3F2B8C1E\nService: Flyers & posters\nEvent or business name: Harvest Thanksgiving 2026\nWhere will it be used: A4 print\nNeeded by: 2026-12-01\n\nWhat they need:/);
  assert.match(message, /Reference links \(not checked, open with care\):\n- https:\/\/a\.example\//);
  assert.match(message, /Quote required: no price or delivery date has been promised\.$/);
  assert.equal(creativeReference(ID.toUpperCase()), 'CS-3F2B8C1E');
});

test('a guest brief is saved as a Creative Studio lead, retries do not duplicate it, and only Admin can read it', async () => {
  const first = await send(valid());
  assert.equal(first.status, 201);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  const saved = await first.json();
  assert.deepEqual(Object.keys(saved).sort(), ['receivedAt', 'reference', 'service', 'success']);
  assert.equal(saved.reference, 'CS-3F2B8C1E');
  // A lost reply retried with the same request id: acknowledged, never a second lead.
  const retry = await send(valid());
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).reference, 'CS-3F2B8C1E');
  const list = await (await adminInquiries('admin-token')).json();
  assert.equal(list.total, 1);
  const lead = list.inquiries[0];
  assert.equal(lead.id, 'inq_cs_3f2b8c1e6d4a4b7e9c2d1a2b3c4d5e6f');
  assert.equal(lead.inquiry_type, 'creative_studio');
  assert.equal(lead.product_name, 'Creative Studio · Flyers & posters');
  assert.equal(lead.product_id, null);
  assert.equal(lead.customer_phone, '0241234567');
  assert.equal(lead.status, 'new');
  assert.match(lead.message, /Creative Studio brief CS-3F2B8C1E/);
  // Admin can find it by reference and move it through the existing workflow.
  assert.equal((await (await adminInquiries('admin-token', '?search=CS-3F2B8C1E')).json()).total, 1);
  const updated = await fetch(`${base}/api/admin/marketplace/inquiries/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' }, body: JSON.stringify({ expectedVersion: 0, status: 'contacted', adminNote: 'Synthetic follow-up' }) });
  assert.equal(updated.status, 200);
  // Customers and guests never see leads.
  for (const [token, status] of [[null, 401], ['invalid', 401], ['customer-token', 403]] as const) assert.equal((await adminInquiries(token)).status, status);
  // A different brief makes its own lead.
  assert.equal((await send(valid({ requestId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', service: 'social', fields: { promoting: 'December sale' } }))).status, 201);
  assert.equal((await (await adminInquiries('admin-token')).json()).total, 2);
});

test('invalid or hostile briefs are refused with a field and store nothing', async () => {
  const cases: [unknown, number, string | undefined][] = [
    [valid({ phone: 'abc' }), 400, 'phone'],
    [valid({ details: '<img src=x onerror=alert(1)>' }), 400, 'details'],
    [valid({ links: ['javascript:alert(1)'] }), 400, 'links.0'],
    [valid({ extra: true }), 400, undefined],
    [valid({ website: 'filled-by-bot' }), 400, undefined],
    [[], 400, undefined],
  ];
  for (const [body, status, field] of cases) {
    const res = await send(body);
    assert.equal(res.status, status);
    const json = await res.json();
    assert.equal(json.field, field);
    assert.equal(json.success, undefined);
  }
  assert.equal((await (await adminInquiries('admin-token')).json()).total, 0);
  // The ordinary Marketplace enquiry endpoint is unchanged and still makes its own random id.
  const product = await fetch(`${base}/api/marketplace/inquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productName: 'Fixture Laptop', customerPhone: '0241234567' }) });
  assert.equal(product.status, 200);
  assert.match((await product.json()).inquiryId, /^inq_[0-9a-f-]{36}$/);
  await assert.rejects(() => MarketplaceControlStore.createInquiry({ id: 'inq_<bad>', productName: 'x' }), /Invalid enquiry id/);
});

test('Creative Studio has one address, page metadata, a directory entry, analytics names and honest work samples', () => {
  assert.equal(getPageFromPath('/creative-studio'), 'creative');
  assert.equal(getPageFromPath('/Creative-Studio/'), 'creative');
  assert.equal(ROUTE_PATH_MAP.creative, '/creative-studio');
  assert.equal(getPageFromPath('/marketplace'), 'marketplace');
  const head = pageIndexingHead('/creative-studio');
  assert.match(head.title, /Mystery Creative Studio/);
  assert.equal(head.url, 'https://mysterybundlehub.com/creative-studio');
  assert.ok(!head.noindex);
  const entry = DIGITAL_SERVICES.find(s => s.id === 'srv-creative')!;
  assert.equal(entry.status, 'active');
  assert.equal(serviceHref(entry), '/creative-studio');
  const event = (name: string) => validateGrowthEvent({ event: name, visitorId: ID, sessionId: ID, metadata: { page: 'creative' } });
  for (const name of ['page_view', 'creative_service', 'creative_brief_started']) assert.doesNotThrow(() => event(name), name);
  // Every piece belongs to a labelled Studio Concept, is a versioned Cloudinary original and has real alt text.
  assert.ok(CREATIVE_WORK.length >= 6);
  for (const work of CREATIVE_WORK) {
    assert.ok(CREATIVE_PROJECTS.find(p => p.pieces.includes(work))!.owner === 'concept');
    assert.match(work.src, /^https:\/\/res\.cloudinary\.com\/da6oeat7m\/image\/upload\/v\d+\/mysteryhub\/creative-studio\/concepts\/[\w-]+\.jpg$/);
    assert.ok(work.alt.length > 30 && work.width > 0 && work.height > 0, work.id);
  }
  const entryPoints = ['src/components/marketplace/MarketplacePage.tsx', 'src/components/home/HomePage.tsx', 'src/components/common/Footer.tsx'].map(f => readFileSync(f, 'utf8'));
  assert.ok(entryPoints.every(source => /CreativeStudioEntry|page: 'creative'/.test(source)));
});

test('V1.1 portfolio: three different concept brands, honestly labelled, each leading to a real brief', () => {
  assert.deepEqual(CREATIVE_PROJECTS.map(p => p.sector), ['Restaurant', 'Skin care', 'Technology']);
  assert.equal(new Set(CREATIVE_WORK.map(w => w.src)).size, CREATIVE_WORK.length, 'no piece repeats');
  for (const project of CREATIVE_PROJECTS) {
    assert.equal(project.owner, 'concept');
    assert.ok(project.pieces.length >= 5, project.id);
    assert.ok(project.palette.length >= 4, project.id);
    assert.ok(CREATIVE_SERVICES.some(s => s.id === project.service), project.id);
    assert.ok(project.pieces.every(w => w.note.length > 5 && w.width >= 1000), project.id);
  }
  // Three different lead colours, so the portfolio cannot read as one company.
  assert.equal(new Set(CREATIVE_PROJECTS.map(p => p.palette[0])).size, 3);
  const page = readFileSync('src/components/creative/CreativeStudioPage.tsx', 'utf8');
  assert.match(page, /Studio Concepts/);
  assert.match(page, /Harmattan Table, Indigo Hour and Lonzero are fictional brands/);
  assert.match(page, /CREATIVE_OWNER_LABEL\[project\.owner\]/);
  // The page sells outcomes: no software statements, and no claim of traditional or human-only production either.
  assert.doesNotMatch(page, /\bAI\b|AI-assisted|hand-?made|hand-?drawn|no AI/i);
  // V2: every project and viewer leads to a real package (an order request), and nothing on the page takes payment.
  assert.match(page, /onOrder\(offer\.id\)/);
  assert.match(page, /openPackage\(packageForWork\(work\)\)/);
  assert.doesNotMatch(page, /Buy now|Pay now|paystack/i);
});
