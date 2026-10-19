import assert from 'node:assert/strict';
import { test, before, after, mock } from 'node:test';
import pg from 'pg';
import { resolvePublicSocialMetadata, publicMetadataReaders } from '../../services/publicSocialMetadata.js';
import { getPool } from '../../db/connection.js';

// Exercise the actual public stores/SQL/projections. No PostgreSQL connection is opened.
let website: any, product: any;
const queries: {sql:string;values:any[]}[]=[];
before(()=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';
  mock.method(pg.Pool.prototype,'query',async(sql:string,values:any[]=[])=>{
    queries.push({sql,values}); assert.match(sql.trim(),/^SELECT\b/i,'Metadata must never mutate storage');
    if(sql.includes('FROM website_sites')){
      assert.match(sql,/slug = \$1 AND status = 'published'/);
      return {rows:website?.status==='published' && website.slug===values[0] ? [structuredClone(website)]:[]};
    }
    if(sql.includes('FROM marketplace_products')){
      assert.match(sql,/published = true AND archived = false/);
      assert.match(sql,/slug = \$1 OR id = \$1/);
      return {rows:product?.published && !product.archived && [product.id,product.slug].includes(values[0])?[structuredClone(product)]:[]};
    }
    if(sql.includes('marketplace_categories'))return {rows:[]};
    throw Error('Unexpected metadata SQL');
  });
});
after(async()=>{await getPool()?.end();delete process.env.DATABASE_URL;mock.restoreAll();});

const reset=()=>{
  website={id:'public-site',user_id:'PRIVATE OWNER ID',name:'PRIVATE DRAFT NAME',slug:'owner-site',template_id:'tmpl-start-blank',status:'published',content_json:{businessName:'PRIVATE DRAFT',heroImage:'https://images.example.com/private.jpg'},settings_json:{},published_at:'2026-10-01',created_at:'2026-10-01',updated_at:'2026-10-02',published_snapshot_json:{version:1,templateId:'tmpl-buka-bistro',name:'Published Cafe',content:{businessName:'Published Cafe',tagline:'Public description',heroImage:'https://images.example.com/public.jpg',internalSecret:'DO NOT LEAK'},settings:{},publishedAt:'2026-10-01'}};
  product={id:'mp_stored',slug:'stored-product',name:'Published Product',category:'laptops_computers',description:'Saved description',price_type:'fixed',price_minor:12345,availability:'available',published:true,archived:false,image_url:'https://images.example.com/product.jpg',admin_note:'PRIVATE ADMIN NOTE'};
  queries.length=0;
};
test('actual published-site reader uses snapshot and excludes raw record/editor/private fields',async()=>{
  reset();const before=structuredClone(website);const result=await publicMetadataReaders.site('owner-site');
  assert.equal(result!.content.businessName,'Published Cafe');assert.equal(result!.template_id,'tmpl-buka-bistro');
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|internalSecret|DO NOT LEAK|published_snapshot_json|user_id/);
  assert.deepEqual(website,before);assert.equal(queries.length,1);
});
test('actual metadata resolution performs bounded SELECTs and no writes to site or product',async()=>{
  reset();const before=structuredClone({website,product});const site=await resolvePublicSocialMetadata('/sites/owner-site');const p=await resolvePublicSocialMetadata('/marketplace?id=mp_stored&ref=MH-REF');
  assert.equal(site.head.title,'Published Cafe');assert.equal(p.head.title,'Published Product');assert.match(p.head.description,/GH₵123.45/);
  assert.doesNotMatch(JSON.stringify([site,p]),/PRIVATE|DO NOT LEAK/);assert.deepEqual({website,product},before);
  assert.equal(queries.filter(q=>q.sql.includes('website_sites')).length,1);assert.equal(queries.filter(q=>q.sql.includes('marketplace_products')).length,1);
});
test('unpublishing immediately removes metadata; republishing a snapshot exposes only that revision',async()=>{
  reset();assert.equal((await resolvePublicSocialMetadata('/sites/owner-site')).head.title,'Published Cafe');
  website.status='draft';const hidden=await resolvePublicSocialMetadata('/sites/owner-site');assert.equal(hidden.status,404);assert.doesNotMatch(JSON.stringify(hidden),/Published Cafe|public.jpg|PRIVATE/);
  website.status='published';website.published_snapshot_json.content.businessName='New Published Cafe';
  assert.equal((await resolvePublicSocialMetadata('/sites/owner-site')).head.title,'New Published Cafe');
});
test('actual legacy published record works without snapshot and is not backfilled by metadata reads',async()=>{
  reset();website.published_snapshot_json=null;website.name='Legacy Cafe';website.content_json={businessName:'Legacy Cafe',tagline:'Legacy words',heroImage:'https://images.example.com/legacy.jpg'};
  const before=structuredClone(website);assert.equal((await resolvePublicSocialMetadata('/sites/owner-site')).head.title,'Legacy Cafe');assert.deepEqual(website,before);
});
test('draft/archived products are excluded by the actual store query; updates use fresh data',async()=>{
  reset();product.published=false;assert.equal((await resolvePublicSocialMetadata('/marketplace?product=stored-product')).status,404);
  product.published=true;product.archived=true;assert.equal((await resolvePublicSocialMetadata('/marketplace?product=stored-product')).status,404);
  product.archived=false;product.name='Updated public product';assert.equal((await resolvePublicSocialMetadata('/marketplace?product=stored-product')).head.title,'Updated public product');
});
