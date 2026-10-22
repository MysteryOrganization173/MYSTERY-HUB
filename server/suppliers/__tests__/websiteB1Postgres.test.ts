/** Opt-in native PostgreSQL proof. Requires a NEW empty loopback *_test database.
 * Never reads application .env; never accepts an external hostname. See B1 documentation. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {WebsiteStore} from '../../db/websiteStore';
import {WebsiteCheckpointStore,WEBSITE_CHECKPOINT_LIMIT} from '../../db/websiteCheckpointStore';
import {WebsiteAssetStore} from '../../db/websiteAssetStore';
import {WEBSITE_CHECKPOINT_SCHEMA} from '../../db/websiteCheckpointSchema';
import {WEBSITE_PUBLISHING_SCHEMA} from '../../db/websitePublishingSchema';
import {WEBSITE_FREE_SCHEMA} from '../../db/websiteFreeSchema';
import {getPool} from '../../db/connection';
import {assertSafeTestDatabase} from '../../utils/environment';

const connection=process.env.MYSTERY_B1_POSTGRES_URL;
test('B1 native PostgreSQL: permissions, repeatability, atomic recovery, retention and real connection races',{skip:!connection},async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:connection,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const setup=new pg.Pool({connectionString:connection,ssl:false});
  let app:pg.Pool|null=null;
  try {
    assert.equal((await setup.query("SELECT to_regclass('public.website_sites') AS name")).rows[0].name,null,'Use a NEW empty disposable database, never a reused application database.');
    const role=(await setup.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
    await setup.query("CREATE TABLE users(id VARCHAR(64) PRIMARY KEY); INSERT INTO users VALUES('owner'),('other'),('collision-a'),('collision-b'); CREATE TABLE b1_finance_sentinel(id TEXT PRIMARY KEY,record JSONB); INSERT INTO b1_finance_sentinel VALUES('unchanged','{\"balance\":12345,\"ledger\":[1],\"orders\":[2],\"withdrawals\":[3]}');");
    const schema=readFileSync('server/db/schema.sql','utf8'),start=schema.indexOf('CREATE TABLE IF NOT EXISTS website_sites (');
    await setup.query(schema.slice(start,schema.indexOf('\n);',start)+4));
    await setup.query(WEBSITE_PUBLISHING_SCHEMA);await setup.query(WEBSITE_FREE_SCHEMA);
    await setup.query(WEBSITE_CHECKPOINT_SCHEMA);await setup.query(WEBSITE_CHECKPOINT_SCHEMA);
    const sentinel=(await setup.query('SELECT * FROM b1_finance_sentinel')).rows;
    process.env.NODE_ENV='test';process.env.DATABASE_URL=connection;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';
    app=getPool();assert.ok(app);

    await t.test('non-superuser backend owns/uses private history; public API roles have no schema or table privileges',async()=>{
      for(const role of ['anon','authenticated','public']){
        const r=(await setup.query("SELECT has_schema_privilege($1,'mysteryhub_builder_private','USAGE') AS schema,has_table_privilege($1,'mysteryhub_builder_private.website_draft_checkpoints','SELECT,INSERT,UPDATE,DELETE') AS table",[role])).rows[0];
        assert.equal(r.schema,false);assert.equal(r.table,false);
      }
      assert.equal((await setup.query("SELECT relrowsecurity FROM pg_class WHERE oid='mysteryhub_builder_private.website_draft_checkpoints'::regclass")).rows[0].relrowsecurity,true);
      assert.equal((await setup.query("SELECT count(*) FROM pg_policies WHERE schemaname='mysteryhub_builder_private'")).rows[0].count,'0');
    });
    const initial=(await WebsiteStore.createSite('owner',{template_id:'tmpl-buka-bistro',name:'Real owner',content:{whatsapp:'0241234567',tagline:'Live original',items:[{id:'food',name:'Owner item'}]}})).site;
    let site=(await WebsiteStore.publishSite(initial.id,'owner',initial.updated_at))!;
    const snapshot=structuredClone(site.published_snapshot_json),slug=site.slug;

    await t.test('two separate PostgreSQL connections serialize the same revision, exactly one design transition wins',async()=>{
      const [a,b]=await Promise.all([app!.connect(),app!.connect()]);
      try{assert.notEqual((await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);}finally{a.release();b.release();}
      const results=await Promise.allSettled([1,2].map(()=>WebsiteStore.transitionLayout(site.id,'owner','sections',site.updated_at)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
      assert.equal((await WebsiteCheckpointStore.forSite(site.id,'owner')).length,1);
      site=(await WebsiteStore.findSiteById(site.id))!;assert.deepEqual(site.published_snapshot_json,snapshot);
    });
    await t.test('post-write trigger failure rolls back the draft AND its captured checkpoint',async()=>{
      const before=await WebsiteStore.findSiteById(site.id),history=await WebsiteCheckpointStore.forSite(site.id,'owner');
      await setup.query("CREATE FUNCTION b1_fail_update() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected B1 failure'; END$$; CREATE TRIGGER b1_fail AFTER UPDATE ON website_sites FOR EACH ROW EXECUTE FUNCTION b1_fail_update();");
      try{await assert.rejects(()=>WebsiteStore.changeTemplate(site.id,'owner','tmpl-glow-salon',site.updated_at),/injected B1 failure/);}finally{await setup.query('DROP TRIGGER b1_fail ON website_sites; DROP FUNCTION b1_fail_update();');}
      assert.deepEqual(await WebsiteStore.findSiteById(site.id),before);assert.deepEqual(await WebsiteCheckpointStore.forSite(site.id,'owner'),history);
    });
    await t.test('template change and concurrent restoration preserve live snapshot, URL, owner and financial sentinel',async()=>{
      const before=structuredClone(site);site=await WebsiteStore.changeTemplate(site.id,'owner','tmpl-glow-salon',site.updated_at);
      const checkpoint=(await WebsiteCheckpointStore.forSite(site.id,'owner')).find(c=>c.reason==='template_change')!;
      const results=await Promise.allSettled([1,2].map(()=>WebsiteStore.restoreDraft(site.id,'owner',checkpoint.id,site.updated_at)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      site=(await WebsiteStore.findSiteById(site.id))!;assert.deepEqual(site.content_json,before.content_json);assert.deepEqual(site.settings_json,before.settings_json);
      assert.equal(site.slug,slug);assert.equal(site.status,'published');assert.equal(site.user_id,'owner');assert.deepEqual(site.published_snapshot_json,snapshot);
      await assert.rejects(()=>WebsiteStore.restoreDraft(site.id,'other',checkpoint.id,site.updated_at),/do not own/);
    });
    await t.test('checkpoint-only Cloudinary reference blocks deletion and remains restorable',async()=>{
      const id='asset_b1-test',publicId=`mysteryhub/websites/${site.id}/${id}`,url=`https://res.cloudinary.com/fixture/image/upload/v1/${publicId}.png`;
      await setup.query("INSERT INTO website_assets(id,website_id,user_id,public_id,original_filename,mime,bytes,secure_url,delivery_url,status,expires_at,created_at,updated_at) VALUES($1,$2,'owner',$3,'fixture.png','image/png',100,$4,$4,'ready',NOW(),NOW(),NOW())",[id,site.id,publicId,url]);
      site=(await WebsiteStore.updateSite(site.id,'owner',{expectedUpdatedAt:site.updated_at,content:{heroImage:url}}))!;
      site=await WebsiteStore.changeTemplate(site.id,'owner','tmpl-glow-salon',site.updated_at);
      assert.ok(!JSON.stringify(site.content_json).includes(url));assert.ok(!JSON.stringify(site.published_snapshot_json).includes(url));
      await assert.rejects(()=>WebsiteAssetStore.delete(site.id,'owner',id),/Recovery checkpoint/);
      assert.equal((await WebsiteAssetStore.find(id))!.status,'ready');
      const checkpoint=(await WebsiteCheckpointStore.forSite(site.id,'owner')).find(c=>c.document.content.heroImage===url)!;
      site=await WebsiteStore.restoreDraft(site.id,'owner',checkpoint.id,site.updated_at);assert.equal(site.content_json.heroImage,url);
    });
    await t.test('repeat schema preserves existing rows; final retention slot cannot overflow across connections',async()=>{
      const rows=(await setup.query('SELECT * FROM mysteryhub_builder_private.website_draft_checkpoints ORDER BY id')).rows;
      await setup.query(WEBSITE_CHECKPOINT_SCHEMA);assert.deepEqual((await setup.query('SELECT * FROM mysteryhub_builder_private.website_draft_checkpoints ORDER BY id')).rows,rows);
      while((await WebsiteCheckpointStore.forSite(site.id,'owner')).length<WEBSITE_CHECKPOINT_LIMIT-1)site=await WebsiteStore.transitionLayout(site.id,'owner',site.content_json.layoutMode==='template'?'sections':'template',site.updated_at);
      const mode=site.content_json.layoutMode==='template'?'sections':'template';
      const results=await Promise.allSettled([1,2].map(()=>WebsiteStore.transitionLayout(site.id,'owner',mode,site.updated_at)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await WebsiteCheckpointStore.forSite(site.id,'owner')).length,WEBSITE_CHECKPOINT_LIMIT);
      site=(await WebsiteStore.findSiteById(site.id))!;
      await assert.rejects(()=>WebsiteStore.changeTemplate(site.id,'owner','tmpl-vortex-tech',site.updated_at),/history is full/);
      assert.deepEqual(await WebsiteStore.findSiteById(site.id),site);
    });
    await t.test('actual unique-constraint collision retries safely without aborting creation transactions',async()=>{
      // Force BOTH preflight lookups to see the same available name. The real DB constraint must arbitrate.
      const original=WebsiteStore.isSlugTaken;let checks=0,release!:()=>void;
      const bothChecked=new Promise<void>(resolve=>{release=resolve;});
      WebsiteStore.isSlugTaken=async function(slug,exclude){if(slug==='same-business'&&checks<2){checks++;if(checks===2)release();await bothChecked;return false;}return original.call(this,slug,exclude);};
      try{
        const created=await Promise.all(['collision-a','collision-b'].map(user=>WebsiteStore.createSite(user,{template_id:'tmpl-glow-salon',name:'Ignored',businessName:'Same Business',starterVersion:1})));
        assert.notEqual(created[0].site.slug,created[1].site.slug);assert.equal(created.filter(c=>c.site.slug==='same-business').length,1);
      }finally{WebsiteStore.isSlugTaken=original;}
    });
    assert.deepEqual((await setup.query('SELECT * FROM b1_finance_sentinel')).rows,sentinel);
    assert.deepEqual((await WebsiteStore.findPublishedSiteBySlug(slug))!.published_snapshot_json,snapshot);
  }finally{
    if(app)await app.end();await setup.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;
  }
});
