/** Opt-in native PostgreSQL tests. Only a NEW disposable loopback *_test database is allowed. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {BACKEND_RLS_SCHEMA} from '../../db/backendRlsSchema.js';
import {AuthStore} from '../../db/authStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {ReferralStore} from '../../db/referralStore.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {MarketplaceStore} from '../../db/marketplaceStore.js';
import {FinanceService} from '../../services/financeService.js';
import {hashPassword,verifyPassword} from '../../utils/crypto.js';
import {opsOrder} from './adminOperationsFixtures.js';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

const connection=process.env.MYSTERY_RLS_POSTGRES_URL;
test('backend-only tables have RLS and no client privileges on native PostgreSQL',{skip:!connection},async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:connection,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const observer=new pg.Pool({connectionString:connection,ssl:false});
  try {
    assert.equal((await observer.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null,'Requires a NEW empty test database.');
    const role=(await observer.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
    process.env.NODE_ENV='test';process.env.DATABASE_URL=connection;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';
    await initDatabase();
    const unsecured=await observer.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity ORDER BY relname");
    assert.deepEqual(unsecured.rows,[],'Every application table must be explicitly protected; new tables require a security decision.');
    const tables=(await observer.query("SELECT n.nspname AS schema,c.relname AS name,(SELECT attname FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped ORDER BY attnum LIMIT 1) AS column FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' OR n.nspname LIKE 'mysteryhub_%') AND c.relkind='r' ORDER BY 1,2")).rows;
    const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
    await t.test('all 45 application tables are private and non-FORCE, with no permissive policies',async()=>{
      assert.equal(tables.length,45);
      assert.deepEqual((await observer.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' OR n.nspname LIKE 'mysteryhub_%') AND c.relkind='r' AND (NOT c.relrowsecurity OR c.relforcerowsecurity OR EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid))")).rows,[]);
    });
    await t.test('anonymous and authenticated roles cannot SELECT, INSERT, UPDATE, DELETE or TRUNCATE any application table',async()=>{
      const client=await observer.connect();
      try {for(const role of ['anon','authenticated'])for(const row of tables){
        const table=quote(row.schema)+'.'+quote(row.name),column=quote(row.column);
        for(const statement of [`SELECT * FROM ${table}`,`INSERT INTO ${table} DEFAULT VALUES`,`UPDATE ${table} SET ${column}=${column} WHERE false`,`DELETE FROM ${table} WHERE false`,`TRUNCATE ${table} CASCADE`]){
          await client.query('BEGIN');
          try {await client.query(`SET LOCAL ROLE ${role}`);await assert.rejects(client.query(statement),{code:'42501'},`${role}: ${statement}`);}
          finally {await client.query('ROLLBACK');}
        }
      }} finally{client.release();}
    });
    await t.test('custom login/session, account and admin stores retain owner access',async()=>{
      const password=await hashPassword('Synthetic password for local test');
      for(const id of ['owner','other','admin'])await AuthStore.createUser({id,name:id,email:`${id}@fixture.test`,phone:null,passwordHash:password,role:id==='admin'?'admin':'customer'});
      const owner=await AuthStore.findUserByIdentifier('owner@fixture.test');
      assert.ok(owner);assert.ok(await verifyPassword('Synthetic password for local test',owner.password_hash));
      await AuthStore.createSession(owner.id,'synthetic-session');
      assert.equal((await AuthStore.findSessionByToken('synthetic-session'))?.session.user_id,owner.id);
      assert.equal((await AuthStore.findUserById('admin'))?.role,'admin');
      assert.equal(await AuthStore.countCustomers(),2);
    });
    await t.test('order creation, tracking, payment persistence, single dispatch claim and webhook deduplication remain functional',async()=>{
      const order=opsOrder({user_id:'owner',status:'pending_payment',payment_status:'pending',supplier_order_id:null,paid_at:null,submitted_at:null,delivered_at:null});
      await OrdersStore.createOrder(order);
      assert.equal((await OrdersStore.findOrder(order.payment_reference))?.payment_status,'pending');
      await OrdersStore.markOrderPaid(order.payment_reference,new Date().toISOString());
      const claims=await Promise.all(Array.from({length:10},()=>OrdersStore.claimOrderForSupplierDispatch(order.id)));
      assert.equal(claims.filter(Boolean).length,1);
      assert.equal((await OrdersStore.findOrdersByUserId('owner')).length,1);
      assert.equal((await OrdersStore.findOrdersByUserId('other')).length,0);
      assert.equal(await OrdersStore.recordSupplierWebhookEvent('synthetic-event','order.status.updated',{}),true);
      assert.equal(await OrdersStore.recordSupplierWebhookEvent('synthetic-event','order.status.updated',{}),false);
      assert.ok(Number((await observer.query('SELECT count(*) FROM mysteryhub_notifications.events')).rows[0].count)>0);
    });
    await t.test('Wallet journal/audit, referral tracking, Website Builder and Marketplace retain backend access',async()=>{
      const input={amountMinor:1000,requestId:randomUUID(),confirmed:true,direction:'credit',reason:'Local synthetic test'};
      await FinanceService.adjustment('admin','owner',input);await FinanceService.adjustment('admin','owner',input);
      assert.equal((await FinanceService.summary('owner')).walletMinor,1000);
      assert.equal((await FinanceService.summary('other')).walletMinor,0);
      await assert.rejects(observer.query('DELETE FROM finance_ledger'),/immutable/i);
      const profile=await ReferralStore.getOrCreateProfile('owner');
      await ReferralStore.recordClick({profileId:profile.id,referrerUserId:'owner',referralCode:profile.referral_code,visitorKey:'synthetic'});
      assert.equal(await ReferralStore.countClicksByReferrer('owner'),1);
      const site=(await WebsiteStore.createSite('owner',{template_id:'tmpl-boutique',name:'Synthetic site'})).site;
      assert.ok(await WebsiteStore.findSiteById(site.id));
      await assert.rejects(WebsiteStore.updateSite(site.id,'other',{expectedUpdatedAt:site.updated_at,content:{tagline:'unauthorized'}}),/Forbidden/);
      await observer.query("INSERT INTO marketplace_products(id,slug,name,category,published) VALUES('synthetic-product','synthetic-product','Synthetic','general',true)");
      assert.ok(await MarketplaceStore.getProductById('synthetic-product'));
      assert.ok(await MarketplaceStore.getPublicProductBySlug('synthetic-product'));
    });
    await t.test('RLS denies cross-customer access even if CRUD grants are accidentally restored',async()=>{
      const client=await observer.connect();
      try {for(const role of ['anon','authenticated']){
        await client.query('BEGIN');
        try {
          await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.users TO ${role}`);
          await client.query(`SET LOCAL ROLE ${role}`);
          await client.query("SELECT set_config('request.jwt.claim.sub','owner',true)");
          assert.equal((await client.query('SELECT * FROM public.users')).rows.length,0);
          assert.equal((await client.query("UPDATE public.users SET name='unauthorized' WHERE id='other'")).rowCount,0);
          assert.equal((await client.query("DELETE FROM public.users WHERE id='other'")).rowCount,0);
          await assert.rejects(client.query("INSERT INTO public.users(id,name,password_hash) VALUES('attacker','attacker','invalid')"),{code:'42501'});
        }finally{await client.query('ROLLBACK');}
      }}finally{client.release();}
    });
    await t.test('repeat migration preserves rows, triggers, policies and trusted service grants; removes residual/default client privileges',async()=>{
      const before=(await observer.query('SELECT row_to_json(u) AS row FROM users u ORDER BY id')).rows;
      const triggers=(await observer.query("SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal ORDER BY definition")).rows;
      await observer.query('GRANT TRUNCATE,REFERENCES,TRIGGER ON users,orders,finance_ledger TO anon,authenticated; GRANT REFERENCES ON users TO service_role; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated');
      const service=(await observer.query("SELECT has_table_privilege('service_role','users','REFERENCES') AS allowed")).rows;
      await initDatabase();await observer.query(BACKEND_RLS_SCHEMA);
      assert.deepEqual((await observer.query('SELECT row_to_json(u) AS row FROM users u ORDER BY id')).rows,before);
      assert.deepEqual((await observer.query("SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal ORDER BY definition")).rows,triggers);
      assert.deepEqual((await observer.query("SELECT has_table_privilege('service_role','users','REFERENCES') AS allowed")).rows,service);
      assert.deepEqual((await observer.query("SELECT c.relname,r.role FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated'))r(role) WHERE n.nspname='public' AND c.relkind='r' AND has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')")).rows,[]);
      await observer.query('CREATE TABLE public.future_privilege_fixture(id text)');
      assert.equal((await observer.query("SELECT has_table_privilege('anon','future_privilege_fixture','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS allowed")).rows[0].allowed,false);
      await observer.query('DROP TABLE public.future_privilege_fixture');
    });
    await t.test('incompatible ownership aborts the entire hardening statement without partial security changes',async()=>{
      const client=await observer.connect();
      try {
        await client.query('BEGIN');await client.query('ALTER TABLE admin_audit_log DISABLE ROW LEVEL SECURITY; ALTER TABLE users FORCE ROW LEVEL SECURITY');
        await client.query('SAVEPOINT before_hardening');
        await assert.rejects(client.query(BACKEND_RLS_SCHEMA),/Backend RLS requires/);
        await client.query('ROLLBACK TO SAVEPOINT before_hardening');
        assert.equal((await client.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.admin_audit_log'::regclass")).rows[0].relrowsecurity,false);
      }finally{await client.query('ROLLBACK');client.release();}
    });
  } finally {await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});

test('canonical schema includes the exact startup security migration',()=>{
  assert.ok(readFileSync('server/db/schema.sql','utf8').includes(BACKEND_RLS_SCHEMA));
  const source=readFileSync('server/db/connection.ts','utf8');
  assert.ok(source.indexOf('await client.query(BACKEND_RLS_SCHEMA)')>source.indexOf('await client.query(NOTIFICATION_SCHEMA)'));
});
