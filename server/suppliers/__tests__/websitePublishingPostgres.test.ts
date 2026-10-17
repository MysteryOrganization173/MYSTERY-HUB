/** Optional actual PostgreSQL/WASM regression. No external DB, filesystem DB or network socket. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import pg from 'pg';
import {WebsiteStore} from '../../db/websiteStore';
import {WEBSITE_PUBLISHING_SCHEMA as sql} from '../../db/websitePublishingSchema';
import {WEBSITE_CHECKPOINT_SCHEMA} from '../../db/websiteCheckpointSchema';
import {publicWebsiteContent,publicWebsiteSettings} from '../../services/websitePublication';
import {createWebsiteComposition} from '../../../src/config/websiteBuilder';
const modulePath=process.env.MYSTERY_TEST_PGLITE_PATH;
test('real embedded PostgreSQL migration, legacy isolation and transactional publication rollback',{skip:!modulePath},async()=>{
 assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
 const {PGlite}=createRequire(import.meta.url)(modulePath!);
 const repo=process.cwd(),originalQuery=pg.Pool.prototype.query,originalConnect=pg.Pool.prototype.connect;
 let database:any;
 try {
const db=new PGlite();database=db;let checks=0;const pass=(name:string)=>{checks++;console.log('PASS '+name);};
await db.exec('CREATE TABLE users(id VARCHAR(64) PRIMARY KEY); INSERT INTO users VALUES (\'legacy-owner\'),(\'current-owner\'); CREATE TABLE untouched_finance(id TEXT PRIMARY KEY,balance_minor INTEGER,ledger JSONB,orders JSONB); INSERT INTO untouched_finance VALUES (\'sentinel\',12345,\'["legacy-entry"]\',\'["legacy-order"]\');');
const schema=fs.readFileSync(path.join(repo,'server/db/schema.sql'),'utf8');const start=schema.indexOf('CREATE TABLE IF NOT EXISTS website_sites (');await db.exec(schema.slice(start,schema.indexOf('\n);',start)+4));
await db.exec(sql);await db.exec(WEBSITE_CHECKPOINT_SCHEMA);pass('empty website database migration succeeds');
const original:any={businessName:'Existing public business',tagline:'Existing headline',aboutText:'Existing body',heroImage:'/legacy-image.svg',logoUrl:'/legacy-logo.svg',phone:'0241234567',whatsapp:'0241234567',email:'fixture@example.test',location:'Accra',ctaLabel:'Contact',ctaTarget:'https://example.test/contact',items:[{id:'item-1',name:'Saved item',image:'/legacy-item.svg',price:'9.00',supplierSecret:'never-copy'}],stats:[{label:'Owner fact',value:'1',secret:'never-copy'}],social:{instagram:'existing',secret:'never-copy'},composition:createWebsiteComposition(['header','hero','about','footer']),privateNote:'never-copy'};
original.composition.sections[1].data={heading:'Saved section hero',body:'Existing section text',items:[{title:'Saved section item',secret:'never-copy'}],secret:'never-copy'};original.composition.sections[1].secret='never-copy';original.composition.secret='never-copy';
const settings={primaryColor:'#123456',accentColor:'#7c3aed',backgroundColor:'#ffffff',fontFamily:'font-serif',borderRadius:'rounded-lg',providerKey:'never-copy'};
for(const [id,status] of [['legacy-live','published'],['legacy-draft','draft'],['legacy-archived','archived']])await db.query('INSERT INTO website_sites(id,user_id,template_id,name,slug,status,content_json,settings_json,created_at,updated_at,published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)',[id,'legacy-owner','tmpl-start-blank','Legacy identity',id,status,JSON.stringify(original),JSON.stringify(settings),'2025-01-01T12:00:00Z',status==='published'?'2025-01-01T12:00:00Z':null]);
const before=(await db.query('SELECT * FROM website_sites ORDER BY id')).rows;const financial=(await db.query('SELECT * FROM untouched_finance')).rows;
await db.exec(sql);await db.exec(sql);const after=(await db.query('SELECT * FROM website_sites ORDER BY id')).rows;
for(let i=0;i<before.length;i++){assert.deepEqual({...after[i],published_snapshot_json:null},before[i]);if(after[i].status==='published'){assert.deepEqual(after[i].published_snapshot_json.content,publicWebsiteContent(original));assert.deepEqual(after[i].published_snapshot_json.settings,publicWebsiteSettings(settings));assert.ok(!JSON.stringify(after[i].published_snapshot_json).includes('never-copy'));}else assert.equal(after[i].published_snapshot_json,null);}
assert.deepEqual((await db.query('SELECT * FROM untouched_finance')).rows,financial);pass('legacy public content/identity/status/URLs/timestamps and unrelated finance preserved; private nested fields excluded');
const snapshot=after.find((row:any)=>row.status==='published').published_snapshot_json;await db.query('UPDATE website_sites SET content_json=$1,template_id=$2 WHERE id=$3',[JSON.stringify({...original,tagline:'Private later draft'}),'tmpl-buka-bistro','legacy-live']);await db.exec(sql);assert.deepEqual((await db.query('SELECT published_snapshot_json FROM website_sites WHERE id=$1',['legacy-live'])).rows[0].published_snapshot_json,snapshot);pass('repeat startup never replaces a live snapshot with a later draft');
let failAfterPublication=false;const query=async(sql:string,values:any[]=[])=>{const result=await db.query(sql,values);if(failAfterPublication&&sql.includes("SET status = 'published'"))throw Error('Injected failure after the write');return {rows:result.rows,rowCount:result.affectedRows};};
pg.Pool.prototype.query=query as any;pg.Pool.prototype.connect=(async()=>({query,release(){}})) as any;process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';
await db.query('UPDATE website_sites SET template_id=$1,content_json=$2,published_snapshot_json=NULL WHERE id=$3',['tmpl-start-blank',JSON.stringify(publicWebsiteContent(original)),'legacy-live']);const transitional=(await WebsiteStore.findSiteById('legacy-live'))!;await WebsiteStore.updateSite('legacy-live','legacy-owner',{expectedUpdatedAt:transitional.updated_at,content:{tagline:'Transitional private edit'}});assert.equal((await WebsiteStore.findPublishedSiteBySlug('legacy-live'))!.content_json.tagline,'Existing headline');pass('transitional legacy first save freezes pre-edit live content before mutation');
const {site}=await WebsiteStore.createSite('current-owner',{template_id:'tmpl-start-blank',name:'Actual SQL journey',content:{tagline:'SQL original'}});const first=(await WebsiteStore.publishSite(site.id,'current-owner',site.updated_at))!;const draft=(await WebsiteStore.updateSite(site.id,'current-owner',{expectedUpdatedAt:first.updated_at,content:{tagline:'SQL later draft'}}))!;assert.equal((await WebsiteStore.findPublishedSiteBySlug(site.slug))!.content_json.tagline,'SQL original');pass('actual WebsiteStore SQL save preserves published content');
const changed=await WebsiteStore.changeTemplate(site.id,'current-owner','tmpl-buka-bistro',draft.updated_at);assert.equal((await WebsiteStore.findPublishedSiteById(site.id))!.template_id,'tmpl-start-blank');failAfterPublication=true;await assert.rejects(()=>WebsiteStore.publishSite(site.id,'current-owner',changed.updated_at),/Injected failure/);failAfterPublication=false;assert.equal((await WebsiteStore.findPublishedSiteBySlug(site.slug))!.template_id,'tmpl-start-blank');assert.equal((await WebsiteStore.findSiteById(site.id))!.template_id,'tmpl-buka-bistro');pass('real PostgreSQL transaction rolls back a partially executed publication');
const published=(await WebsiteStore.publishSite(site.id,'current-owner',changed.updated_at))!;assert.equal((await WebsiteStore.findPublishedSiteBySlug(site.slug))!.template_id,'tmpl-buka-bistro');assert.deepEqual(await WebsiteStore.publishSite(site.id,'current-owner',changed.updated_at),published);pass('actual SQL publishes acknowledged template and safely retries it');
await WebsiteStore.unpublishSite(site.id,'current-owner',published.updated_at);assert.equal(await WebsiteStore.findPublishedSiteBySlug(site.slug),null);const hidden=(await WebsiteStore.findSiteById(site.id))!;assert.ok(hidden.published_snapshot_json);await WebsiteStore.publishSite(site.id,'current-owner',hidden.updated_at);assert.ok(await WebsiteStore.findPublishedSiteBySlug(site.slug));pass('actual SQL unpublish/republish retains both states');
assert.deepEqual((await db.query('SELECT * FROM untouched_finance')).rows,financial);pass('balances/ledger/order sentinel still unchanged after complete publication journey');
console.log('Embedded PostgreSQL/PGlite checks: '+checks+'/'+checks+' passed. No external server/network/provider was used. Cross-process lock behavior still requires staging PostgreSQL verification.');

 } finally {pg.Pool.prototype.query=originalQuery;pg.Pool.prototype.connect=originalConnect;delete process.env.DATABASE_URL;await database?.close();}
});
