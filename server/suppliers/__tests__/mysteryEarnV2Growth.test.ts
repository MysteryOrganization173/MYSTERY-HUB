import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { earnNextStep, earnShareTopics, personalReferralLink, referralShareMessage, referralWhatsAppUrl, shareReferralLink, type EarnSummary } from '../../../src/utils/earnExperience';
import { featuredMilestone, groupMilestones, milestoneLevel, milestoneMetricNotes, type EarnAchievement } from '../../../src/utils/earnMilestones';
import { dismissPostPurchaseInvite, postPurchaseInviteCopy, postPurchaseInviteEligible, postPurchaseInviteHidden, POST_PURCHASE_INVITE_KEY } from '../../../src/utils/postPurchaseInvite';
import { EarnMilestones } from '../../../src/components/earn/EarnMilestones';
import { EarnRules } from '../../../src/components/earn/EarnDetails';
import type { OrderRecord } from '../../../src/types';

const source = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const summary: EarnSummary = { code: 'MH-ABC123', shareUrl: 'https://mysterybundlehub.com/?ref=MH-ABC123', isEnabled: true, clicksCount: 47, rawClicksCount: 47, uniqueVisitorsCount: 41, referredCustomersCount: 4, pendingRewardsMinor: 10, pendingRewardsGhc: 0.1, approvedRewardsMinor: 69, approvedRewardsGhc: 0.69, totalRewardsMinor: 79, totalRewardsGhc: 0.79 };
const NOW = Date.parse('2026-10-18T20:00:00Z');
const order = (extra: Partial<OrderRecord> = {}): OrderRecord => ({ id: 'MH-1', publicReference: 'MH-20261018-000001', serviceType: 'data', journey: 'direct_checkout', status: 'delivered', serverStatus: 'delivered',
  bundle: { id: 'mtn-1gb', network: 'mtn', dataAmount: '1GB', dataBytesValue: 1024, validity: 'Non-expiry', validityCategory: 'Monthly', priceGhc: 5.49 } as OrderRecord['bundle'],
  recipientPhone: '0241234567', network: 'mtn', paymentMethod: 'paystack', amountGhc: 5.49, createdAt: '2026-10-18T19:50:00Z', updatedAt: '2026-10-18T19:55:00Z', ...extra });
const memory = () => { const store = new Map<string, string>(); return { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, store }; };
const badge = (id: string, metric: EarnAchievement['metric'], threshold: number, progress: number, claimed = false, rewardMinor = 0): EarnAchievement => ({ id, name: id, metric, threshold, progress, enabled: true, rewardMinor, claimed });
const roadmap = [badge('first-referral', 'successful_referrals', 1, 2, true), badge('community-starter', 'successful_referrals', 3, 2), badge('growing-connector', 'successful_referrals', 5, 2), badge('referral-champion', 'successful_referrals', 10, 2), badge('network-builder', 'successful_referrals', 25, 2),
  badge('afa-referral', 'afa_referrals', 1, 0), badge('afa-advocate', 'afa_referrals', 3, 0), badge('qualified-visitors', 'qualified_visitors', 10, 41), badge('growing-reach', 'qualified_visitors', 25, 41, true), badge('community-reach', 'qualified_visitors', 50, 41),
  badge('reward-explorer', 'lifetime_earnings', 500, 69), badge('reward-builder', 'lifetime_earnings', 2000, 69), badge('reward-veteran', 'lifetime_earnings', 5000, 69)];
const section = (rows: EarnAchievement[] | null, options: Record<string, unknown> = {}) => renderToStaticMarkup(React.createElement(EarnMilestones, { achievements: rows, restricted: false, stale: false, busy: false, claimingId: null, onClaim: () => {}, retry: () => {}, ...options }));

test('invitation appears only for a confirmed first-party delivery', () => {
  assert.equal(postPurchaseInviteEligible(order(), NOW), true);
  for (const extra of [{ journey: undefined }, { journey: 'account' as const }, { status: 'placed' as const, serverStatus: 'paid' }, { status: 'processing' as const, serverStatus: 'processing' },
    { status: 'failed' as const, serverStatus: 'refund_pending' }, { status: 'failed' as const, serverStatus: 'refunded' }, { serverStatus: undefined }, { manualReview: true },
    { customerResolution: 'manual_fulfillment' as OrderRecord['customerResolution'] }, { paymentBasis: 'complimentary' as const }, { serviceType: 'marketplace' as const },
    { createdAt: '2026-10-14T19:59:00Z' }, { createdAt: '2026-10-19T00:00:00Z' }, { createdAt: 'not a date' }])
    assert.equal(postPurchaseInviteEligible(order(extra), NOW), false, JSON.stringify(extra));
  assert.equal(postPurchaseInviteEligible(null, NOW), false);
});
test('dismissal hides that order and quiets new invitations without failing on bad storage', () => {
  const storage = memory();
  assert.equal(postPurchaseInviteHidden('MH-A', storage, NOW), false);
  dismissPostPurchaseInvite('MH-A', storage, NOW);
  assert.equal(postPurchaseInviteHidden('MH-A', storage, NOW + 30 * 86_400_000), true);
  assert.equal(postPurchaseInviteHidden('MH-B', storage, NOW + 86_400_000), true);
  assert.equal(postPurchaseInviteHidden('MH-B', storage, NOW + 15 * 86_400_000), false);
  storage.store.set(POST_PURCHASE_INVITE_KEY, '{broken');
  assert.equal(postPurchaseInviteHidden('MH-A', storage, NOW), false);
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.doesNotThrow(() => dismissPostPurchaseInvite('MH-A', throwing, NOW));
  assert.equal(postPurchaseInviteHidden('MH-A', null, NOW), false);
});
test('invitation is placed once, after tracking actions, and never fabricates a guest link', () => {
  const status = source('src/components/checkout/OrderStatusModal.tsx');
  assert.equal((status.match(/<PostPurchaseInvite /g) || []).length, 1);
  assert.ok(status.indexOf('<PostPurchaseInvite') > status.indexOf('All orders'));
  assert.ok(!source('src/components/checkout/CheckoutModal.tsx').includes('PostPurchaseInvite'));
  const invite = source('src/components/checkout/PostPurchaseInvite.tsx');
  assert.match(invite, /getMyReferralSummary\(sessionToken\)/); assert.match(invite, /personalReferralLink\(result.summary\)/);
  assert.match(invite, /member && state === 'ready' && message/); assert.match(invite, /when their purchases qualify/); assert.doesNotMatch(invite, /your (own )?(order|purchase) (earns|will earn)/i);
  assert.match(invite, /if \(!active\) return/); assert.match(invite, /Dismiss Mystery Earn invitation/);
  for (const forbidden of ['publicReference}', 'recipientPhone', 'window.open', 'location.assign']) assert.ok(!invite.includes(forbidden), forbidden);
  // Lookups by reference and recovered payments carry no first-party journey.
  assert.ok(!source('src/utils/checkoutRecovery.ts').includes('journey'));
  assert.match(source('src/context/AppContext.tsx'), /journey: 'direct_checkout'/);
});
test('published customer sites and Admin never render the platform footer or checkout invitation', () => {
  const app = source('src/App.tsx');
  const adminBranch = app.slice(app.indexOf("if (activePage === 'admin')"), app.indexOf('return (\n    <div className="mh-app'));
  assert.ok(!adminBranch.includes('<Footer')); assert.ok(!adminBranch.includes('<OrderStatusModal'));
  assert.ok(app.indexOf('return <PublicPublishedSite') < app.indexOf('<AppProvider>'));
  assert.ok(!source('src/components/website/PublicPublishedSite.tsx').includes('common/Footer'));
});
test('share topics keep canonical first-party attribution and honest, user-initiated messages', async () => {
  for (const topic of earnShareTopics) {
    const link = personalReferralLink(summary, topic.path, 'https://mysterybundlehub.com')!;
    assert.equal(new URL(link).searchParams.get('ref'), 'MH-ABC123'); assert.equal(new URL(link).host, 'mysterybundlehub.com');
    const message = referralShareMessage(topic, link);
    assert.ok(message.endsWith(link)); assert.doesNotMatch(message, /guarantee|free money|earn GH|income|cheapest/i);
    assert.equal(decodeURIComponent(referralWhatsAppUrl(message).split('?text=')[1]), message);
  }
  assert.equal(personalReferralLink({ ...summary, isEnabled: false }, '/data'), null);
  let shared: ShareData | null = null;
  assert.equal(await shareReferralLink(summary.shareUrl, async data => { shared = data; }, 'Custom text'), 'shared');
  assert.equal(shared!.text, 'Custom text'); assert.equal(shared!.url, summary.shareUrl);
  const sharing = source('src/components/earn/EarnSharing.tsx');
  assert.ok(!sharing.includes('window.open')); assert.match(sharing, /fieldset className="earn-topics" disabled=\{!url\}/);
});
test('achievement groups never overlap, hide disabled rows and keep one featured milestone', () => {
  const rows = [...roadmap, { ...badge('disabled', 'qualified_visitors', 1, 9), enabled: false }];
  const groups = groupMilestones(rows);
  const ids = [groups.featured?.id, ...groups.ready.map(r => r.id), ...groups.active.map(r => r.id), ...groups.collected.map(r => r.id)].filter(Boolean);
  assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, roadmap.length); assert.ok(!ids.includes('disabled'));
  assert.equal(groups.featured?.id, 'qualified-visitors');
  assert.deepEqual(groups.collected.map(r => r.id).sort(), ['first-referral', 'growing-reach']);
  assert.deepEqual(milestoneLevel(roadmap[2], roadmap), { level: 3, of: 5 });
  assert.equal(milestoneLevel({ ...roadmap[2], enabled: false }, roadmap.map(r => ({ ...r, enabled: r.id !== 'growing-connector' }))), null);
});
test('thirteen badge-only achievements stay compact, unique and never claimable while incomplete', () => {
  const html = section(roadmap);
  for (const row of roadmap) assert.equal((html.match(new RegExp(`data-milestone-id="${row.id}"`, 'g')) || []).length, 1, row.id);
  assert.match(html, /Show 7 more achievements/); assert.match(html, /2 \/ 13 collected/);
  assert.equal((html.match(/Claim Badge/g) || []).length, 1);
  assert.equal((html.match(/Badge collected/g) || []).length, 2);
  assert.ok(!html.includes('Wallet credit ·')); assert.ok(!html.includes('GH₵0.00 Wallet'));
  const stale = section(roadmap, { stale: true }); assert.ok(!stale.includes('Claim Badge')); assert.ok(!stale.includes('aria-valuenow'));
  const restricted = section(roadmap, { restricted: true }); assert.ok(!restricted.includes('Claim Badge'));
  const credit = section([badge('credit', 'successful_referrals', 1, 1, true, 100), badge('next', 'successful_referrals', 3, 1)]);
  assert.match(credit, /GH₵1.00 Wallet credit · Reward collected/);
});
test('metric notes are precise about what counts', () => {
  assert.match(milestoneMetricNotes.successful_referrals, /Each order counts, so one friend buying twice counts twice/); assert.match(milestoneMetricNotes.successful_referrals, /Visits and sign-ups do not count/);
  assert.match(milestoneMetricNotes.qualified_visitors, /not a count of people/); assert.match(milestoneMetricNotes.qualified_visitors, /Never paid/);
});
test('the dashboard next step reflects only confirmed data', () => {
  assert.match(earnNextStep(summary, roadmap, false), /1 badge ready to collect/);
  assert.match(earnNextStep(summary, [badge('a', 'successful_referrals', 3, 3, false, 150), badge('b', 'afa_referrals', 1, 1)], false), /GH₵1.50 in Wallet credit ready to claim/);
  assert.match(earnNextStep(summary, [badge('a', 'successful_referrals', 3, 2)], false), /Next: a, 1 more rewarded purchase to go/);
  assert.doesNotMatch(earnNextStep(summary, roadmap, true), /ready to/);
  assert.match(earnNextStep(summary, roadmap, false, true), /being reviewed/);
  assert.match(earnNextStep({ ...summary, isEnabled: false }, roadmap, false), /paused/);
  assert.match(earnNextStep({ ...summary, referredCustomersCount: 0 }, null, false), /Start with one friend/);
});
test('guest demo is labelled and invents no balances, counts or testimonials', () => {
  const page = source('src/components/earn/MysteryEarnPage.tsx');
  const preview = page.slice(page.indexOf('function EarnShareDemo()'), page.indexOf('function GuestEarn()'));
  assert.match(preview, />Demo</); assert.match(preview, /Example only/); assert.ok(!preview.includes('GH₵'));
  // Demo controls never pretend to share: sharing asks the guest to join.
  assert.ok(!preview.includes('wa.me') && !preview.includes('referralWhatsAppUrl') && !preview.includes('clipboard'));
  assert.match(preview, /onClick=\{\(\) => openAuth\('signup'\)\}>.*Create account to share/);
  const guest = page.slice(page.indexOf('function GuestEarn()'), page.indexOf('export const MysteryEarnPage'));
  assert.doesNotMatch(guest, /testimonial|customers trust|members earned|\d+,\d{3}\+/i);
  assert.match(guest, /<EarnRules \{\.\.\.rules\} \/>/);
});
test('Footer V2 keeps official contacts, dynamic copyright, 2024 history and honest navigation', () => {
  const footer = source('src/components/common/Footer.tsx');
  assert.match(footer, /new Date\(\)\.getFullYear\(\)/); assert.ok(!footer.includes('© 2026')); assert.match(footer, /since 2024/);
  for (const value of ['contact.whatsappChannelUrl', 'contact.supportWhatsAppUrl', 'contact.phoneLink', 'contact.emailLink', 'Staff Portal', 'MTN MoMo', 'Telecel Cash', 'AT Money']) assert.ok(footer.includes(value), value);
  assert.doesNotMatch(footer, /privacy|terms|instagram|facebook|twitter|licensed|registered since/i);
  assert.doesNotMatch(footer, /https:\/\/whatsapp\.com\/channel/);
  const coming = footer.slice(footer.indexOf('Coming soon'));
  assert.ok(!footer.slice(0, footer.indexOf('Coming soon')).includes('ECG Prepaid')); assert.match(coming, /ECG Prepaid Bills/);
});
test('no server, payment, reward or finance logic is part of the Earn V2 presentation', () => {
  const panel = source('src/components/finance/FinancialPanel.tsx');
  assert.match(panel, /if\(earnLayout\)return/); assert.ok(panel.includes('/achievements/${encodeURIComponent(row.id)}/claim'));
  for (const file of ['src/components/earn/MysteryEarnPage.tsx', 'src/components/earn/EarnSharing.tsx', 'src/components/earn/EarnMilestones.tsx', 'src/components/checkout/PostPurchaseInvite.tsx', 'src/components/common/Footer.tsx'])
    for (const forbidden of ['financeRequest', 'walletCheckout', 'paystack', '/claim', 'saveAchievements']) assert.ok(!source(file).toLowerCase().includes(forbidden.toLowerCase()) || (file.endsWith('Footer.tsx') && forbidden === 'paystack'), `${file} ${forbidden}`);
});

// V2.1 refinement
test('invitation copy is short, matches the order and shares the matching service', () => {
  assert.deepEqual(postPurchaseInviteCopy('data'), { heading: 'Know someone who needs data?', topicId: 'data' });
  assert.equal(postPurchaseInviteCopy('instant_bundle').topicId, 'data');
  assert.equal(postPurchaseInviteCopy('afa').topicId, 'afa');
  assert.match(postPurchaseInviteCopy('airtime').heading, /airtime/);
  for (const id of ['data', 'afa', 'general']) assert.ok(earnShareTopics.some(topic => topic.id === id));
  const invite = source('src/components/checkout/PostPurchaseInvite.tsx');
  assert.ok(!invite.includes('under the current rules'), 'policy text stays on the Earn page');
  assert.match(invite, /View rewards/); assert.match(invite, /Share my link/);
  // Still first-party only.
  const now = Date.parse('2026-10-18T20:00:00Z');
  assert.equal(postPurchaseInviteEligible(order(), now), true); assert.equal(postPurchaseInviteEligible(order({ journey: undefined }), now), false);
});
test('featured milestone favours a real Wallet credit over a closer badge, but claimable comes first', () => {
  const credit = badge('credit', 'successful_referrals', 10, 2, false, 100), close = badge('close', 'qualified_visitors', 10, 9);
  assert.equal(featuredMilestone([close, credit])?.id, 'credit');
  assert.equal(featuredMilestone([credit, badge('done', 'qualified_visitors', 1, 1)])?.id, 'credit');
  const html = renderToStaticMarkup(React.createElement(EarnMilestones, { achievements: [close, credit], restricted: false, stale: false, busy: false, claimingId: null, onClaim: () => {}, retry: () => {} }));
  assert.match(html, /Your next reward/); assert.match(html, /GH₵1.00<\/strong> Wallet credit/);
  assert.match(html, /GH₵1.00<\/strong> in Wallet credit still to earn/);
  const badgesOnly = renderToStaticMarkup(React.createElement(EarnMilestones, { achievements: [close], restricted: false, stale: false, busy: false, claimingId: null, onClaim: () => {}, retry: () => {} }));
  assert.match(badgesOnly, /Next badge/); assert.ok(!badgesOnly.includes('Your next reward')); assert.ok(!badgesOnly.includes('GH₵'));
});
test('sharing studio leads with WhatsApp and copy link, keeps copy message, and hides native share where unsupported', () => {
  const studio = source('src/components/earn/EarnSharing.tsx');
  assert.ok(studio.indexOf('Share on WhatsApp') < studio.indexOf("'Copy link'") && studio.indexOf("'Copy link'") < studio.indexOf("'Copy message'"));
  assert.match(studio, /What would you like to share\?/); assert.match(studio, /Here’s the message your friend will see/);
  assert.match(studio, /\{canNativeShare && <button/);
  const website = earnShareTopics.find(topic => topic.id === 'website')!, market = earnShareTopics.find(topic => topic.id === 'marketplace')!;
  assert.ok(!/plus|ai/i.test(website.message)); assert.ok(!/commission|reward|earn/i.test(market.message));
  for (const topic of earnShareTopics) assert.ok(!/reward|earn|commission|free money/i.test(topic.message), topic.id);
});
test('member hero shows the real available balance from the financial account without changing finance logic', () => {
  const page = source('src/components/earn/MysteryEarnPage.tsx');
  assert.match(page, /availableMinor=\{finance.availableMinor\}/); assert.match(page, /href="#earn-available"/);
  const panel = source('src/components/finance/FinancialPanel.tsx');
  assert.match(panel, /availableMinor:Number.isSafeInteger\(data\?\.earn\?\.availableMinor\)\?data.earn.availableMinor:null/);
  const guest = page.slice(page.indexOf('function GuestEarn()'), page.indexOf('export const MysteryEarnPage'));
  assert.ok(!guest.includes('achievementTypes') && !guest.includes('earn-stage-list'), 'guest page keeps three steps, not five stages');
});
test('Footer V2.1 keeps coming-soon services as text, not dead links, and uses the approved logo component', () => {
  const footer = source('src/components/common/Footer.tsx');
  const coming = footer.slice(footer.indexOf('>Coming soon<'), footer.indexOf('</nav>'));
  assert.match(coming, /ECG Prepaid Bills/); assert.ok(!/<a |href=/.test(coming), 'coming-soon services are not links');
  assert.match(footer, /Join our WhatsApp Channel/); assert.match(footer, /<BrandLogo size="md" \/>/);
  assert.ok(!/privacy|terms of/i.test(footer), 'no links to legal pages that do not exist');
  assert.ok(!/giveaway|friday|members/i.test(footer));
  assert.match(footer, /safe-area-inset-bottom/);
});

// V2.2
test('hero uses the approved Cloudinary artwork as decoration behind real HTML, with a phone crop and a fallback', async () => {
  const page = source('src/components/earn/MysteryEarnPage.tsx');
  assert.match(source('src/utils/earnHero.ts'), /https:\/\/res\.cloudinary\.com\/da6oeat7m\/image\/upload'[\s\S]*'v1792429490\/Neon_Fintech_Network_Over_City_Lights_yyxesi\.png'/);
  assert.match(page, /import \{ earnHeroImage \} from '\.\.\/\.\.\/utils\/earnHero'/);
  const { earnHeroImage } = await import('../../../src/utils/earnHero');
  assert.match(earnHeroImage.mobile, /c_crop,g_east,w_0\.62\/f_auto,q_auto,c_scale,w_480\//); assert.match(earnHeroImage.desktop, /w_1672\/v1792429490/);
  const art = page.slice(page.indexOf('function EarnHeroArt()'), page.indexOf('function EarnShareDemo()'));
  assert.match(art, /aria-hidden="true"/); assert.match(art, /alt=""/); assert.match(art, /onError=\{\(\) => setFailed\(true\)\}/); assert.match(art, /fetchPriority="high"/);
  const guest = page.slice(page.indexOf('function GuestEarn()'), page.indexOf('export const MysteryEarnPage'));
  assert.match(guest, /<h1 id="earn-guest-title">Share Mystery Hub\.<br \/><span>Earn real rewards\.<\/span><\/h1>/); assert.match(guest, /href="#earn-how"/);
});
test('Data, Airtime and AFA rules never advertise the fixed public amount as the effective reward', () => {
  const data = { id: 'standard_data_acquisition_v1', service_type: 'data', purchase_stage: 'acquisition', network: null, product_key: null, reward_type: 'fixed_minor', reward_minor: 50, reward_percent_bps: null, enabled: true } as const;
  const html = renderToStaticMarkup(React.createElement(EarnRules, { rules: [data, { ...data, id: 'r', purchase_stage: 'recurring', reward_minor: 10 }], error: false, retry: () => {} }));
  assert.ok(!html.includes('GH₵0.50') && !html.includes('GH₵0.10')); assert.match(html, /eligible margin/); assert.match(html, /not the price your friend pays/);
  const market = renderToStaticMarkup(React.createElement(EarnRules, { rules: [{ ...data, service_type: 'marketplace' }], error: false, retry: () => {} }));
  assert.match(market, /GH₵0.50/);
  // The effective percentages belong to a backend API that does not exist yet; nothing hardcodes them.
  for (const file of ['src/components/earn/EarnDetails.tsx', 'src/components/earn/MysteryEarnPage.tsx', 'src/utils/earnExperience.ts']) assert.ok(!/\b(45|20) ?%/.test(source(file)), file);
});
test('personal first-person share message style is preserved', () => {
  assert.equal(earnShareTopics[0].message, 'I buy my data and other digital services on Mystery Hub. Have a look.');
  assert.match(referralShareMessage(earnShareTopics[0], 'https://mysterybundlehub.com/?ref=MH-ABC123'), /Have a look\. Here's my link: https/);
  assert.deepEqual(earnShareTopics.map(topic => topic.short), ['Mystery Hub', 'Data', 'AFA', 'Websites', 'Marketplace']);
  for (const topic of earnShareTopics) assert.ok(!/^check out/i.test(topic.message), topic.id);
});
test('milestone headline follows real state, and ready badges stay secondary to Wallet credit', () => {
  const render = (rows: EarnAchievement[]) => renderToStaticMarkup(React.createElement(EarnMilestones, { achievements: rows, restricted: false, stale: false, busy: false, claimingId: null, onClaim: () => {}, retry: () => {} }));
  const ready = render([badge('credit', 'successful_referrals', 5, 5, false, 200)]);
  assert.match(ready, /GH₵2.00<\/strong> Wallet credit ready to claim/); assert.ok(!ready.includes('still to'));
  const upcoming = render([badge('credit', 'successful_referrals', 5, 2, false, 200)]);
  assert.match(upcoming, /GH₵2.00<\/strong> in Wallet credit still to earn/); assert.ok(!upcoming.includes('ready to claim'));
  const mixed = render([badge('credit', 'successful_referrals', 5, 2, false, 200), badge('visits', 'qualified_visitors', 10, 41)]);
  assert.match(mixed, /data-milestone-id="credit" data-state="in-progress" data-reward="credit"/);
  assert.match(mixed, /Badges ready to collect/); assert.match(mixed, /Claim Badge/);
  assert.equal(featuredMilestone([badge('visits', 'qualified_visitors', 10, 41), badge('credit', 'successful_referrals', 5, 2, false, 200)])?.id, 'credit');
});

test('restricted, stale and collected credits never advertise an available claim', () => {
  const render = (rows: EarnAchievement[], restricted = false, stale = false) => renderToStaticMarkup(React.createElement(EarnMilestones, { achievements: rows, restricted, stale, busy: false, claimingId: null, onClaim: () => {}, retry: () => {} }));
  const earned = badge('credit', 'successful_referrals', 5, 5, false, 200);
  for (const html of [render([earned], true), render([earned], false, true), render([{ ...earned, claimed: true }])]) {
    assert.ok(!html.includes('Wallet credit ready to claim'));
    assert.ok(!html.includes('>Claim Reward<'));
  }
  const reached = [earned, { ...earned, id: 'second-credit' }, badge('visits', 'qualified_visitors', 10, 12)];
  for (const html of [render(reached, true), render(reached, false, true)]) {
    assert.match(html, /Reached milestones/);
    assert.ok(!html.includes('Also ready to claim') && !html.includes('Badges ready to collect'));
  }
});

test('reward explanation preserves pending/reversal meaning and free joining does not promise fee-free cash-out', () => {
  const rule = { id: 'data', service_type: 'data', purchase_stage: 'acquisition', network: null, product_key: null, reward_type: 'fixed_minor', reward_minor: 50, reward_percent_bps: null, enabled: true } as const;
  const html = renderToStaticMarkup(React.createElement(EarnRules, { rules: [rule], error: false, retry: () => {} }));
  assert.match(html, /pending, approved or reversed/);
  assert.ok(!html.includes('history is final'));
  const hero = source('src/components/earn/MysteryEarnPage.tsx');
  assert.match(hero, /Free to join\. No reward for clicks alone/);
  assert.ok(!hero.includes('No fees.'));
});
