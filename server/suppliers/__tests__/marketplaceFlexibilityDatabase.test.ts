import assert from 'node:assert/strict';
import {test,before,beforeEach,after} from 'node:test';
import pg from 'pg';
import {MarketplaceStore} from '../../db/marketplaceStore.js';
import {MarketplaceControlStore} from '../../db/marketplaceControlStore.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {initDatabase} from '../../db/connection.js';
import {MARKETPLACE_FLEXIBILITY_SCHEMA} from '../../db/marketplaceFlexibilitySchema.js';
import type {OrderRecord} from '../../types/orders.js';
const originalQuery=pg.Pool.prototype.query,originalConnect=pg.Pool.prototype.connect;
let statements:{sql:string;values:any[]}[],product:any,category:any,inquiry:any;
function columns(sql:string,values:any[]) {
 const match=sql.match(/INSERT INTO \w+\s*\(([\s\S]*?)\)\s*VALUES/i)!;
 return Object.fromEntries(match[1].split(',').map((c,i)=>[c.trim(),values[i]]));
}
async function query(sql:string,values:any[]=[]):Promise<any>{
 statements.push({sql,values});
 if(sql.includes('INSERT INTO marketplace_products')){product=columns(sql,values);return {rows:[structuredClone(product)]};}
 if(sql.includes('UPDATE marketplace_products SET')){for(const [,column,index] of sql.matchAll(/(\w+) = \$(\d+)/g))product[column]=values[Number(index)-1];return {rows:[structuredClone(product)]};}
 if(sql.includes('SELECT * FROM marketplace_products'))return {rows:product?[structuredClone(product)]:[]};
 if(sql.includes('SELECT id FROM marketplace_products'))return {rows:[]};
 if(sql.startsWith('SELECT * FROM marketplace_categories'))return {rows:category?[category]:[{slug:'digital_products',label:'Digital Products',active:true,sort_order:0}]};
 if(sql.startsWith('INSERT INTO marketplace_categories')){category=columns(sql,values);return {rows:[]};}
 if(sql.startsWith('UPDATE marketplace_categories')){[category.label,category.active,category.sort_order,category.updated_at]=values.slice(1);return {rows:[]};}
 if(sql.startsWith('INSERT INTO marketplace_inquiries')){inquiry=columns(sql,values);return {rows:[]};}
 if(sql.startsWith('UPDATE marketplace_inquiries')){inquiry.status=values[1]||inquiry.status;if(values[2])inquiry.admin_note=values[3];if(values[1]==='contacted')inquiry.contacted_at||=new Date().toISOString();return {rows:[inquiry]};}
 if(sql.includes('COUNT(*) AS total FROM marketplace_inquiries'))return {rows:[{total:inquiry?1:0}]};
 if(sql.startsWith('SELECT * FROM marketplace_inquiries'))return {rows:inquiry?[inquiry]:[]};
 return {rows:[],rowCount:0};
}
before(()=>{assert.equal(process.env.DATABASE_URL,undefined);pg.Pool.prototype.query=query as any;pg.Pool.prototype.connect=(async()=>({query,release(){}})) as any;process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';});
after(()=>{pg.Pool.prototype.query=originalQuery;pg.Pool.prototype.connect=originalConnect;delete process.env.DATABASE_URL;});
beforeEach(()=>{statements=[];product=null;category=null;inquiry=null;});
const create=()=>MarketplaceStore.createProduct({name:'Cloud Subscription',category:'digital_products',productKind:'digital',priceType:'fixed',priceMinor:19900,availability:'available',fulfilmentMode:'manual_activation',fulfilmentNote:'Manual after payment',fulfilmentIdentifierLabel:'Account email',fulfilmentIdentifierPlaceholder:'name@example.com',fulfilmentIdentifierRequired:true,adminNote:'Private note'},'admin');
test('PostgreSQL create persists every new product field with matching bind positions',async()=>{await create();assert.equal(product.product_kind,'digital');assert.equal(product.fulfilment_note,'Manual after payment');assert.equal(product.fulfilment_identifier_label,'Account email');assert.equal(product.fulfilment_identifier_placeholder,'name@example.com');assert.equal(product.fulfilment_identifier_required,true);assert.equal(product.admin_note,'Private note');const write=statements.find(s=>s.sql.includes('INSERT INTO marketplace_products'))!;assert.equal(write.values.length,37);assert.equal(product.published,false);});
test('PostgreSQL update persists new fields without changing price or slug',async()=>{const original=await create();await MarketplaceStore.updateProduct(original.id,{productKind:'service',fulfilmentNote:'Updated requirement',fulfilmentIdentifierLabel:'Username',fulfilmentIdentifierPlaceholder:'username',fulfilmentIdentifierRequired:false,adminNote:''},'admin');assert.equal(product.product_kind,'service');assert.equal(product.fulfilment_note,'Updated requirement');assert.equal(product.fulfilment_identifier_label,'Username');assert.equal(product.fulfilment_identifier_required,false);assert.equal(product.admin_note,'');assert.equal(product.price_minor,19900);assert.equal(product.slug,original.slug);});
test('PostgreSQL categories persist create and edit without deletion',async()=>{await MarketplaceControlStore.saveCategory({slug:'business_services',label:'Services'},'admin');await MarketplaceControlStore.saveCategory({label:'Business Services',active:false,sortOrder:9},'admin','business_services');assert.equal(category.label,'Business Services');assert.equal(category.active,false);assert.equal(category.sort_order,9);assert.ok(!statements.some(s=>/DELETE/.test(s.sql)));});
test('PostgreSQL inquiry create, contact, note and pagination use bound parameters',async()=>{const row=await MarketplaceControlStore.createInquiry({productName:'Cloud subscription',customerPhone:'0241234567'});await MarketplaceControlStore.updateInquiry(row.id,{status:'contacted',adminNote:'Private follow up'},'admin');assert.equal(inquiry.status,'contacted');assert.equal(inquiry.admin_note,'Private follow up');assert.ok(inquiry.contacted_at);await MarketplaceControlStore.listInquiries({search:"' OR true;--",page:2,pageSize:10});const select=statements.find(s=>s.sql.startsWith('SELECT * FROM marketplace_inquiries'))!;assert.ok(!select.sql.includes("' OR true"));assert.deepEqual(select.values,["%' OR true;--%",10,10]);});
test('PostgreSQL order insert writes JSON snapshot without identifier in physical columns',async()=>{const context={productKind:'digital',fulfilmentMode:'manual_activation',identifierLabel:'Account email',identifierValue:'fixture@example.com',purchaseNote:'Original terms'};await OrdersStore.createOrder({id:'ord_fixture',marketplace_context:context,fulfilment_method:'manual_activation'} as unknown as OrderRecord);const write=statements.find(s=>s.sql.includes('INSERT INTO orders'))!;assert.equal(write.values.length,47);const saved=columns(write.sql,write.values);assert.deepEqual(JSON.parse(saved.marketplace_context),context);assert.equal(saved.delivery_city,null);assert.equal(saved.pickup_location_id,null);assert.equal(saved.fulfilment_method,'manual_activation');});
test('initialization repeats additive flexibility migration without rewriting existing products/orders/categories',async()=>{await initDatabase();await initDatabase();const schema=statements.filter(s=>s.sql.includes('CREATE TABLE IF NOT EXISTS marketplace_categories'));assert.equal(schema.length,2);assert.ok(schema.every(s=>s.sql.includes('ON CONFLICT (slug) DO NOTHING')));assert.ok(!schema.some(s=>/UPDATE marketplace_products|UPDATE orders|DELETE|DROP/.test(s.sql)));});
import {MARKETPLACE_LIMITS} from '../../../shared/marketplaceLimits.js';
import {readFileSync} from 'node:fs';
test('hardening: shared max lengths equal PostgreSQL varchar widths',()=>{const schema=readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8');const products=schema.split('CREATE TABLE IF NOT EXISTS marketplace_products (')[1].split(');')[0];const orders=readFileSync(new URL('../../db/connection.ts',import.meta.url),'utf8');const inquiries=schema.split('CREATE TABLE IF NOT EXISTS marketplace_inquiries (')[1].split(');')[0];for(const [sql,column,limit] of [[products,'name',MARKETPLACE_LIMITS.productName],[products,'availability_label',MARKETPLACE_LIMITS.availabilityLabel],[products,'badge',MARKETPLACE_LIMITS.badge],[orders,'delivery_area',MARKETPLACE_LIMITS.deliveryArea],[orders,'pickup_location_id',MARKETPLACE_LIMITS.pickupId],[orders,'variant_id',MARKETPLACE_LIMITS.variantId],[inquiries,'product_name',MARKETPLACE_LIMITS.inquiryProductName]] as const)assert.match(sql,new RegExp(`${column} VARCHAR\\(${limit}\\)`));});
test('hardening: PostgreSQL product bind values and inquiry preserve maximum valid strings',async()=>{await MarketplaceStore.createProduct({name:'n'.repeat(256),category:'digital_products',availability:'available',productKind:'digital',priceType:'fixed',priceMinor:19900,fulfilmentMode:'digital_delivery',availabilityLabel:'a'.repeat(64),badge:'b'.repeat(64),variants:[{id:'v'.repeat(64),name:'Option',priceMinor:19900,priceGhc:199,active:true}]},'admin');assert.equal(product.name.length,256);assert.equal(product.availability_label.length,64);assert.equal(product.badge.length,64);assert.equal(JSON.parse(product.variants)[0].id.length,64);await MarketplaceControlStore.createInquiry({productName:'n'.repeat(255)});assert.equal(inquiry.product_name.length,255);});
test('hardening: storage rejects one-over values before any SQL mutation',async()=>{for(const extra of [{name:'n'.repeat(257)},{badge:'b'.repeat(65)},{availabilityLabel:'a'.repeat(65)},{variants:[{id:'v'.repeat(65),name:'Option',priceMinor:19900,priceGhc:199,active:true}]}]){await assert.rejects(MarketplaceStore.createProduct({name:'Cloud',category:'digital_products',priceType:'fixed',availability:'available',...extra},'admin'));}await assert.rejects(MarketplaceControlStore.createInquiry({productName:'n'.repeat(256)}));assert.ok(!statements.some(s=>/INSERT INTO marketplace_products|INSERT INTO marketplace_inquiries/.test(s.sql)));});
test('hardening: legacy order snapshot limits match PostgreSQL columns',()=>{const schema=readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8');assert.match(schema,new RegExp(`product_name_snapshot VARCHAR\\(${MARKETPLACE_LIMITS.orderProductName}\\)`));assert.match(schema,new RegExp(`bundle_size_snapshot VARCHAR\\(${MARKETPLACE_LIMITS.orderOptionLabel}\\)`));});
test('integration cleanup: schema.sql and repeatable Marketplace migration definitions agree exactly',()=>{
 const schema=readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8');
 const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
 const passSql=schema.split('-- Marketplace flexibility pass (additive; no history rewrite)')[1];
 assert.equal(normalize(passSql),normalize(MARKETPLACE_FLEXIBILITY_SCHEMA));
 const connection=readFileSync(new URL('../../db/connection.ts',import.meta.url),'utf8');
 assert.ok(connection.includes('await client.query(MARKETPLACE_FLEXIBILITY_SCHEMA)'));
});
test('integration cleanup: all new field widths and JSON snapshot types match validation and persistence',()=>{
 const sql=MARKETPLACE_FLEXIBILITY_SCHEMA;
 const policy=readFileSync(new URL('../../services/marketplaceProductPolicy.ts',import.meta.url),'utf8');
 for(const [column,field,width] of [['fulfilment_note','fulfilmentNote',1000],['fulfilment_identifier_label','fulfilmentIdentifierLabel',100],['fulfilment_identifier_placeholder','fulfilmentIdentifierPlaceholder',150],['admin_note','adminNote',1000]] as const){assert.match(sql,new RegExp(`${column} VARCHAR\\(${width}\\)`));assert.ok(policy.includes(`${field}:${width}`));}
 assert.match(sql,/product_kind VARCHAR\(16\).*CHECK \(product_kind IN \('physical','digital','service'\)\)/);
 assert.match(sql,/fulfilment_identifier_required BOOLEAN NOT NULL DEFAULT FALSE/);
 assert.match(sql,/orders ADD COLUMN IF NOT EXISTS marketplace_context JSONB/);
});
