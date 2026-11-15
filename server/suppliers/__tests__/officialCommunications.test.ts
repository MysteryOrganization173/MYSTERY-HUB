import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_CONFIG as business } from '../../../src/config/business.js';
import { readFileSync } from 'node:fs';

test('official support and announcement links preserve distinct destinations', () => {
  assert.equal(business.contact.supportPhone, '0594521108');
  assert.equal(business.contact.supportPhoneIntl, '+233594521108');
  assert.equal(business.contact.phoneLink, 'tel:+233594521108');
  // Temporary WhatsApp support (PR #118, owner-approved 14 Nov 2026); calls stay on 059 452 1108; SMS is a separate line.
  assert.equal(business.contact.supportWhatsAppUrl, 'https://wa.me/233242836323');
  assert.equal(business.contact.supportSms, '0592066298');
  assert.equal(business.contact.supportSmsIntl, '+233592066298');
  assert.equal(business.contact.smsLink, 'sms:+233592066298');
  assert.equal(business.contact.supportPhoneDisplay, '059 452 1108');
  assert.equal(business.contact.supportSmsDisplay, '059 206 6298');
  assert.equal(business.contact.supportWhatsAppDisplay, '024 283 6323');
  assert.equal(business.contact.supportEmail, 'aryeeteyemmanuel852@gmail.com');
  // Official WhatsApp Channel replaced in Mystery Hub 3.4; the old channel must not survive anywhere first-party.
  assert.equal(business.contact.whatsappChannelUrl, 'https://whatsapp.com/channel/0029Vb97gokADTOKgN8Nzr0s');
  assert.equal(business.socials.whatsappChannel, business.contact.whatsappChannelUrl);
  assert.equal(business.getWhatsAppChannelUrl(), business.contact.whatsappChannelUrl);
  assert.equal(business.contact.telegramChannelUrl, 'https://t.me/mysteryhubapp');
});

test('every support generator targets the official number and safely encodes contextual text', () => {
  const message = 'Help & questions? #my order';
  const links = [business.getGeneralWhatsAppUrl(message), business.getOrderSupportWhatsAppUrl('example', '0240000000'), business.getCheckoutSupportWhatsAppUrl('2GB', 'MTN'), business.getMarketplaceInquiryWhatsAppUrl('Item & service', message)];
  for (const link of links) {
    const url = new URL(link);
    assert.equal(url.origin + url.pathname, business.contact.supportWhatsAppUrl);
    assert.ok(url.searchParams.get('text'));
    assert.equal(url.hash, '');
  }
  assert.equal(new URL(links[0]).searchParams.get('text'), message);
});

test('public support shortcuts use central configuration; footer has both announcement actions', () => {
  for (const path of ['src/components/data/DataPage.tsx', 'src/components/marketplace/MarketplacePage.tsx', 'src/components/marketplace/MarketplaceInquiryModal.tsx']) {
    const source = readFileSync(path, 'utf8');
    // 059 206 6298 is the SMS line only: never a WhatsApp or call destination.
    assert.doesNotMatch(source, /wa\.me\/233592066298|Call: 0592066298/);
    assert.match(source, /BUSINESS_CONFIG/);
  }
  const footer = readFileSync('src/components/common/Footer.tsx', 'utf8');
  assert.match(footer, />WhatsApp Channel</);
  assert.match(footer, />Telegram</);
  assert.match(footer, /contact.whatsappChannelUrl/);
  assert.match(footer, /contact.telegramChannelUrl/);
});
