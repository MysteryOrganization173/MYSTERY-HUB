import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {MARKETPLACE_ASSET_SCHEMA} from '../../db/marketplaceAssetSchema.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {MarketplaceAssetStore} from '../../db/marketplaceAssetStore.js';
import {WebsiteCloudinary} from '../../services/websiteCloudinary.js';

// Dedicated opt-in only. Never use inherited application credentials or an external host.
const target=process.env.ADMIN_MEDIA_TEST_DATABASE_URL;
const enabled=Boolean(target);let bootstrap:pg.Client;
before(async()=>{
 if(!target)return;
 const url=new URL(target);
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.match(url.pathname,/\/\w+_test$/);assert.equal(url.search,'');
 bootstrap=new pg.Client({connectionString:target,ssl:false});await bootstrap.connect();
 await bootstrap.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='media_owner') THEN CREATE ROLE media_owner LOGIN BYPASSRLS; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$; GRANT CREATE,USAGE ON SCHEMA public TO media_owner; ALTER DEFAULT PRIVILEGES FOR ROLE media_owner IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated");
 url.username='media_owner';process.env.NODE_ENV='test';process.env.DATABASE_URL=url.href;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';
 process.env.CLOUDINARY_CLOUD_NAME='synthetic-cloud';process.env.CLOUDINARY_API_KEY='fixture';process.env.CLOUDINARY_API_SECRET='fixture';
 await initDatabase();await getPool()!.query("INSERT INTO users (id,name,email,password_hash,role,status,created_at) VALUES ('media-admin','Fixture','media@example.test','fixture','admin','active',NOW())");
});
after(async()=>{if(enabled){await getPool()?.end();await bootstrap?.end();}});
test('real PostgreSQL additive schema repeats without changing existing application rows',{skip:!enabled},async()=>{
 const pool=getPool()!;
 const signature=async()=>{const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'marketplace_assets' ORDER BY tablename")).rows;const out=[];for(const {tablename} of tables){assert.match(tablename,/^[a-z_]+$/);out.push([tablename,(await pool.query(`SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS fingerprint FROM ${tablename} t`)).rows[0].fingerprint]);}return out;};
 const before=await signature();await pool.query(MARKETPLACE_ASSET_SCHEMA);await pool.query(MARKETPLACE_ASSET_SCHEMA);assert.deepEqual(await signature(),before);
 const mirror=readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');assert.ok(mirror.includes(MARKETPLACE_ASSET_SCHEMA.trim()));
});
test('non-superuser deployment owner can use private media; public roles have no grants, including TRUNCATE',{skip:!enabled},async()=>{
 const pool=getPool()!;assert.equal((await pool.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper,false);
 assert.equal((await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='marketplace_assets'::regclass")).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await pool.query("SELECT has_table_privilege($1,'marketplace_assets',$2) AS allowed",[role,privilege])).rows[0].allowed,false,role+privilege);
 for(const role of ['anon','authenticated']){try{await bootstrap.query('BEGIN');await bootstrap.query(`SET LOCAL ROLE ${role}`);await assert.rejects(()=>bootstrap.query('SELECT * FROM marketplace_assets'),(error:any)=>error.code==='42501');}finally{await bootstrap.query('ROLLBACK');}}
});
test('separate PostgreSQL connections enforce atomic reservation quota and rollback rejected requests',{skip:!enabled},async()=>{
 const outcomes=await Promise.all(Array.from({length:32},()=>MarketplaceAssetStore.reserve('media-admin',{filename:'fixture.jpg',mime:'image/jpeg',bytes:100}).then(()=>201,(error:any)=>error.status)));
 assert.equal(outcomes.filter(s=>s===201).length,24);assert.equal(outcomes.filter(s=>s===429).length,8);assert.ok(getPool()!.totalCount>1);
 assert.equal((await getPool()!.query('SELECT count(*)::int AS n FROM marketplace_assets')).rows[0].n,24);
});
test('PostgreSQL concurrent finalize binds one asset and one audit event',{skip:!enabled},async()=>{
 const pool=getPool()!,asset=(await pool.query('SELECT id,public_id FROM marketplace_assets ORDER BY id LIMIT 1')).rows[0];const inspect=WebsiteCloudinary.inspect;
 WebsiteCloudinary.inspect=async()=>({public_id:asset.public_id,resource_type:'image',type:'upload',format:'jpg',bytes:100,width:10,height:10,version:1,secure_url:'https://untrusted.invalid/x'});
 try{const results=await Promise.all(Array.from({length:8},()=>MarketplaceAssetStore.finalize('media-admin',asset.id)));assert.ok(results.every(a=>a.status==='ready'));}
 finally{WebsiteCloudinary.inspect=inspect;}
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM admin_audit_log WHERE action='marketplace_image_uploaded'")).rows[0].n,1);
});
test('PostgreSQL rejects invalid asset state and late provider finalization',{skip:!enabled},async()=>{
 const pool=getPool()!;await assert.rejects(()=>pool.query("UPDATE marketplace_assets SET status='public' WHERE status='pending'"),(error:any)=>error.code==='23514');
 const asset=(await pool.query("SELECT * FROM marketplace_assets WHERE status='pending' LIMIT 1")).rows[0],inspect=WebsiteCloudinary.inspect,now=Date.now;
 Date.now=()=>new Date(asset.expires_at).getTime()-1;
 WebsiteCloudinary.inspect=async()=>{Date.now=()=>new Date(asset.expires_at).getTime()+1;return {public_id:asset.public_id,resource_type:'image',type:'upload',format:'jpg',bytes:100,width:10,height:10,version:1,secure_url:''};};
 try{await assert.rejects(()=>MarketplaceAssetStore.finalize('media-admin',asset.id),(error:any)=>error.status===409);}finally{Date.now=now;WebsiteCloudinary.inspect=inspect;}
 assert.equal((await MarketplaceAssetStore.find(asset.id))!.status,'pending');
});
