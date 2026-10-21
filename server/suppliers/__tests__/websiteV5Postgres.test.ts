/** Synthetic-only native PostgreSQL. Explicit opt-in, new empty loopback *_test database. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {AuthStore} from '../../db/authStore.js';
import {FinanceStore} from '../../db/financeStore.js';
import {WebsiteDeletionService} from '../../services/websiteDeletion.js';
import {WebsiteBusinessService as Business} from '../../services/websiteBusinessService.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {opsOrder} from './adminOperationsFixtures.js';
import {WebsiteAssetStore} from '../../db/websiteAssetStore.js';

const url=process.env.MYSTERY_V5_POSTGRES_URL;
test('V5 native PostgreSQL: archive concurrency, finance retention, search and rollback',{skip:!url},async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const setup=new pg.Pool({connectionString:url,ssl:false});
  let pool:pg.Pool|null=null;
  try{
    assert.equal((await setup.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null,'A NEW empty disposable database is required.');
    process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';
    pool=getPool();await initDatabase();await initDatabase();
    for(const id of ['owner','buyer','clear','rollback','other'])await AuthStore.createUser({id,name:id,email:`${id}@fixture.test`,phone:null,passwordHash:'fixture',role:'customer'});
    const make=async(owner:string)=>{const s=(await WebsiteStore.createSite(owner,{template_id:'tmpl-boutique',name:owner})).site;return (await WebsiteStore.publishSite(s.id,owner,s.updated_at))!;};
    const site=await make('owner');
    await t.test('real SQL reservations serialize the final Free image slot at 60 and survive archival',async()=>{
      const names=['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','WEBSITE_FREE_MAX_ASSETS'];const before=names.map(n=>process.env[n]);
      try{
        process.env.CLOUDINARY_CLOUD_NAME='synthetic';process.env.CLOUDINARY_API_KEY='fixture';process.env.CLOUDINARY_API_SECRET='fixture';process.env.WEBSITE_FREE_MAX_ASSETS='60';
        const media=await make('other');
        for(let i=0;i<59;i++)await WebsiteAssetStore.reserve(media.id,'other',{filename:`fixture-${i}.png`,mime:'image/png',bytes:5000});
        const results=await Promise.allSettled([1,2].map(()=>WebsiteAssetStore.reserve(media.id,'other',{filename:'last.png',mime:'image/png',bytes:5000})));
        assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await WebsiteAssetStore.forSite(media.id)).length,60);
        await WebsiteDeletionService.archive(media.id,'other','other');assert.equal((await WebsiteAssetStore.forSite(media.id)).length,60);
      }finally{names.forEach((n,i)=>{if(before[i]===undefined)delete process.env[n];else process.env[n]=before[i];});}
    });
    await t.test('archive waits for separate-connection settlement, then refuses newly available money without writes',async()=>{
      let release!:()=>void,started!:()=>void;const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>started=r);
      const settlement=FinanceStore.transaction('owner',async tx=>{const op=await tx.create('store_sale','v5-sale',100,{siteId:site.id,availableAt:'2026-10-21'},'available');await tx.append(op,'store',100,'Synthetic earning');started();await gate;});
      await ready;
      const archive=WebsiteDeletionService.archive(site.id,'owner','owner');
      try{
        let waiting=false;
        for(let i=0;i<50;i++){waiting=(await setup.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%pg_advisory_xact_lock%' AND pid<>pg_backend_pid() AND state='active'")).rows.length>0;if(waiting)break;await new Promise(r=>setTimeout(r,10));}
        assert.ok(waiting,'Archive must wait on the owner finance lock held by another connection');
      }finally{release();}
      await settlement;await assert.rejects(archive,/earnings ready to withdraw/);
      assert.equal((await WebsiteStore.findSiteById(site.id))?.status,'published');assert.equal((await FinanceStore.read('owner',tx=>tx.storeEarnings())).availableMinor,100);
    });
    await t.test('actual SQL search is site-bound, parameterized, bounded, masked and owner-authorized',async()=>{
      for(const [id,phone,store] of [['hit','+233241239876',site.id],['miss','0241231111',site.id],['foreign','0241239876','another-site']])await OrdersStore.createOrder(opsOrder({id,public_reference:`MH-${id}`,payment_reference:`v5-${id}`,recipient_phone:phone,status:'pending_payment',payment_status:'pending',store_context:{channel:'website_store',siteId:store,ownerId:'owner',earningMinor:100} as any}));
      assert.deepEqual((await Business.siteOrders(site.id,0,'9876')).map(o=>o.id),['hit']);
      const summary=await Business.ownerSummary(site.id,'owner',0,undefined,'9876');assert.equal(summary.orders.length,1);assert.ok(!JSON.stringify(summary).includes('+233241239876'));
      await assert.rejects(Business.ownerSummary(site.id,'other',0,undefined,'9876'),/own|not found/i);
      await assert.rejects(Business.siteOrders(site.id,0,"9876' OR TRUE"),/four/);
      assert.deepEqual(await Business.siteOrders(site.id,100000,'9876'),[]);
    });
    await t.test('post-archive SQL failure rolls back website state and leaves all financial records unchanged',async()=>{
      const s=await make('rollback');
      const money=(await setup.query('SELECT * FROM finance_ledger ORDER BY id')).rows;
      await setup.query("CREATE FUNCTION v5_archive_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='archived' AND NEW.user_id='rollback' THEN RAISE EXCEPTION 'Synthetic archive failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER v5_failure AFTER UPDATE ON website_sites FOR EACH ROW EXECUTE FUNCTION v5_archive_failure()");
      await assert.rejects(WebsiteDeletionService.archive(s.id,'rollback','rollback'),/Synthetic archive failure/);
      assert.equal((await WebsiteStore.findSiteById(s.id))?.status,'published');assert.deepEqual((await setup.query('SELECT * FROM finance_ledger ORDER BY id')).rows,money);
    });
    await t.test('concurrent archival is idempotent; retained snapshot and old address survive recreation',async()=>{
      const s=await make('clear');const results=await Promise.all([1,2].map(()=>WebsiteDeletionService.archive(s.id,'clear','clear')));
      assert.equal(results.filter(r=>r.alreadyDeleted).length,1);
      assert.deepEqual((await WebsiteStore.findSiteRecordById(s.id))?.published_snapshot_json,s.published_snapshot_json);
      const replacement=(await WebsiteStore.createSite('clear',{template_id:'tmpl-night-kitchen',name:'clear'})).site;
      assert.notEqual(replacement.id,s.id);assert.notEqual(replacement.slug,s.slug);assert.equal(await WebsiteStore.findPublishedSiteBySlug(s.slug),null);
    });
  }finally{await pool?.end();await setup.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
