import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_CONFIG as business } from '../../../src/config/business.js';
import { readFileSync } from 'node:fs';

test('official support and announcement links preserve distinct destinations', () => {
  assert.equal(business.contact.supportPhone, '0594521108');
  assert.equal(business.contact.supportPhoneIntl, '+233594521108');
  assert.equal(business.contact.phoneLink, 'tel:+233594521108');
  assert.equal(business.contact.supportWhatsAppUrl, 'https://wa.me/233594521108');
  assert.equal(business.contact.supportEmail, 'aryeeteyemmanuel852@gmail.com');
  assert.equal(business.contact.whatsappChannelUrl, 'https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l');
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
    assert.doesNotMatch(source, /wa\.me\/233592066298|Call: 0592066298/);
    assert.match(source, /BUSINESS_CONFIG/);
  }
  const footer = readFileSync('src/components/common/Footer.tsx', 'utf8');
  assert.match(footer, /Join WhatsApp Channel/);
  assert.match(footer, /Join Telegram Channel/);
  assert.match(footer, /contact.telegramChannelUrl/);
});
