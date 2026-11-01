import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminWhatsAppUrl,adminMailtoUrl,adminPublishedWebsiteUrl} from '../../../src/utils/adminWebsiteContacts.js';
for(const value of ['024 123 4567','024-123-4567','(024)1234567','233241234567','+233241234567','00233241234567','241234567'])test(`Ghana WhatsApp formatting: ${value}`,()=>assert.equal(adminWhatsAppUrl(value),'https://wa.me/233241234567'));
for(const value of [null,undefined,'','123','+233123','02412345678','call 0241234567','https://wa.me/233241234567','0241234567?text=secret','000233241234567'])test(`invalid/missing contact has no WhatsApp action: ${String(value)}`,()=>assert.equal(adminWhatsAppUrl(value),null));
test('explicit international numbers remain usable without guessing their country',()=>{assert.equal(adminWhatsAppUrl('+1 (202) 555-0123'),'https://wa.me/12025550123');assert.equal(adminWhatsAppUrl('12025550123'),null);});
test('email links are validated and cannot inject mail headers',()=>{assert.equal(adminMailtoUrl('owner@fixture.test'),'mailto:owner%40fixture.test');assert.equal(adminMailtoUrl('invalid'),null);assert.equal(adminMailtoUrl('owner@fixture.test\r\nBcc:other@fixture.test'),null);assert.equal(adminMailtoUrl(null),null);});
test('only a published site opens the canonical public domain',()=>{
  assert.equal(adminPublishedWebsiteUrl({status:'published',slug:'real-site',publicUrl:'/sites/real-site'}),'https://mysterybundlehub.com/sites/real-site');
  assert.equal(adminPublishedWebsiteUrl({status:'draft',slug:'private',publicUrl:'/sites/private'}),null);
});
