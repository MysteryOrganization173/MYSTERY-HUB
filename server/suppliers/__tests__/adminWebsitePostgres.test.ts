import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {WebsiteStore} from '../../db/websiteStore.js';
import {AuthStore} from '../../db/authStore.js';
import {AdminWebsiteStore} from '../../db/adminWebsiteStore.js';
import {WebsiteAnalyticsStore} from '../../db/websiteAnalyticsStore.js';
import {AdminAuditStore} from '../../db/adminAuditStore.js';
import type {WebsiteSiteRecord} from '../../types/website.js';
const url=process.env.MYSTERY_ADMIN_WEBSITE_POSTGRES_URL;
test('native Admin website query accuracy, contact privacy, pagination and unchanged publishing safeguards',{skip:!url},async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const observer=new pg.Pool({connectionString:url,ssl:false});
  try{
    assert.equal((await observer.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null,'Use a NEW empty disposable database');
    Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true'});await initDatabase();
    const sites:WebsiteSiteRecord[]=[];
    for(let i=0;i<31;i++){
      const id='fixture-owner-'+i;
      await AuthStore.createUser({id,name:i===28?'Owner %_28':`Owner ${i}`,email:`private-owner-${i}@fixture.test`,phone:i===0?'0591111111':null,passwordHash:'SYNTHETIC_PRIVATE_HASH'});
      let site=(await WebsiteStore.createSite(id,{name:`Project ${i}`,template_id:i%2?'tmpl-boutique':'tmpl-legon-consult',content:{businessName:`Business ${i}`,whatsapp:i===1?'':'0242222222',phone:'0203333333',email:'business@fixture.test'}})).site;
      if(i===1)site=(await WebsiteStore.updateSite(site.id,id,{expectedUpdatedAt:site.updated_at,content:{whatsapp:''}}))!;
      if(i%2===0)site=(await WebsiteStore.publishSite(site.id,id,site.updated_at))!;
      await WebsiteAnalyticsStore.action('website_created',id,site.id,site.template_id);sites.push(site);
    }
    await observer.query("UPDATE website_sites SET created_at=NOW()-interval '40 days' WHERE id=$1",[sites[30].id]);
    await t.test('current project/status counts use rows and creation dates, not repeated publication events',async()=>{
      for(let i=0;i<5;i++)await WebsiteAnalyticsStore.action('website_published',sites[0].user_id,sites[0].id,sites[0].template_id);
      const visitorId=randomUUID(),sessionId=randomUUID();for(let i=0;i<4;i++)await WebsiteAnalyticsStore.ingest({event:'website_template_previewed',visitorId,sessionId,metadata:{templateId:sites[0].template_id}});
      const all=await WebsiteAnalyticsStore.summary({range:'all'});assert.deepEqual(all.metrics,{total:31,published:16,draft:15,free:31});assert.equal(all.funnel.published,5);assert.equal(all.funnel.previews,4);assert.equal(all.funnel.uniqueVisitors,0);
      const month=await WebsiteAnalyticsStore.summary({range:'30'});assert.deepEqual(month.metrics,{total:30,published:15,draft:15,free:30});assert.equal(month.recentPublished.length,5);assert.ok(month.recentPublished.some(s=>s.id===sites[30].id),'recent publication uses publication date independently of old creation');
    });
    await t.test('SQL pagination, status/template/owner search and literal wildcard search match the filtered records',async()=>{
      const first=await AdminWebsiteStore.projects({range:'all'}),second=await AdminWebsiteStore.projects({range:'all',offset:25});assert.equal(first.sites.length,25);assert.equal(second.sites.length,6);assert.ok(!second.sites.some(s=>first.sites.some(f=>f.id===s.id)));
      const owner=await AdminWebsiteStore.projects({range:'all',search:'Owner 29'});assert.equal(owner.total,1);assert.equal(owner.sites[0].id,sites[29].id);
      const literal=await AdminWebsiteStore.projects({range:'all',search:'%_'});assert.equal(literal.total,1);assert.equal(literal.sites[0].id,sites[28].id);
      const none=await AdminWebsiteStore.projects({range:'all',status:'published',template:'tmpl-boutique'});assert.equal(none.total,0);assert.equal(none.metrics.published,16);
      const draft=await AdminWebsiteStore.projects({range:'all',status:'draft'});assert.equal(draft.total,15);assert.ok(draft.sites.every(s=>s.status==='draft'&&s.publicUrl===null));
      const attempts=await AdminWebsiteStore.projects({range:'all',search:"' OR 1=1 --"});assert.equal(attempts.total,0);
    });
    await t.test('one narrow contact query is inspect-only; bulk reports never select or return account contacts',async()=>{
      const pool=getPool()!,original=pool.query;const statements:string[]=[];
      pool.query=((sql:any,...args:any[])=>{statements.push(String(sql));return (original as any).call(pool,sql,...args);}) as any;
      try{
        const report=await WebsiteAnalyticsStore.summary({range:'all'});assert.equal(statements.length,2,'one project report plus existing analytics, independent of site count');
        assert.ok(!statements.some(s=>s.includes('u.email')||s.includes('u.phone')||/SELECT \* FROM users/i.test(s)));
        assert.ok(!JSON.stringify(report).includes('private-owner-'));assert.ok(!JSON.stringify(report).includes('SYNTHETIC_PRIVATE_HASH'));assert.ok(!JSON.stringify(report).includes('+233591111111'));
        statements.length=0;const details=await AdminWebsiteStore.inspect(sites[0].id);assert.equal(statements.length,1);assert.equal(details.owner.phone,'+233591111111');assert.equal(details.owner.email,'private-owner-0@fixture.test');assert.equal(details.businessContact.phone,'0203333333');assert.equal(details.businessContact.whatsapp,'0242222222');assert.ok(!JSON.stringify(details).includes('SYNTHETIC_PRIVATE_HASH'));
        const missing=await AdminWebsiteStore.inspect(sites[1].id);assert.equal(missing.owner.phone,null);assert.equal(missing.businessContact.whatsapp,null);assert.equal(missing.publicUrl,null);
      }finally{pool.query=original;}
    });
    await t.test('new inspection and list reads cannot mutate customer/financial state or alter RLS',async()=>{
      for(const name of ['orders','finance_accounts','finance_operations','finance_ledger'])assert.equal((await observer.query(`SELECT count(*) FROM ${name}`)).rows[0].count,'0');
      assert.equal((await observer.query("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity")).rows[0].count,'0');
      assert.equal((await observer.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0].rolsuper,false);
    });
    await t.test('force-unpublish retains exact confirmation, content and audited owner transaction',async()=>{
      await AuthStore.createUser({id:'fixture-admin',name:'Admin',email:null,phone:null,passwordHash:'fixture',role:'admin'});
      await assert.rejects(WebsiteStore.forceUnpublish(sites[0].id,'fixture-admin','wrong'),/slug/);
      const before=(await WebsiteStore.findSiteById(sites[0].id))!;await WebsiteStore.forceUnpublish(before.id,'fixture-admin',before.slug);
      const after=(await WebsiteStore.findSiteById(before.id))!;assert.equal(after.status,'draft');assert.deepEqual(after.content_json,before.content_json);assert.equal((await AdminWebsiteStore.inspect(before.id)).publicUrl,null);
      assert.ok((await AdminAuditStore.findRecent()).some(a=>a.entity_id===before.id&&a.action==='website_admin_unpublished'));
    });
  }finally{await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
