/** Real PostgreSQL migration/CRUD checks. Only a new, opted-in loopback *_test DB. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {MARKETPLACE_FLEXIBILITY_SCHEMA} from '../../db/marketplaceFlexibilitySchema.js';
import {MarketplaceStore} from '../../db/marketplaceStore.js';
import {validateProductInput} from '../../services/marketplaceProductPolicy.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {opsOrder} from './adminOperationsFixtures.js';

const url=process.env.MYSTERY_MARKETPLACE_POSTGRES_URL;
test('Marketplace V2 native additive migration, permissions and framing persistence',{skip:!url,timeout:60000},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);
 assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
 const observer=new pg.Pool({connectionString:url,ssl:false,max:1});let pool:pg.Pool|null=null;
 try{
  assert.equal((await observer.query("SELECT to_regclass('public.users') AS name")).rows[0].name,null,'new empty isolated DB required');
  const mirror=readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8');
  const addition='ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS image_framing VARCHAR(32);';
  assert.equal(mirror.split(addition).length,2,'exactly one nullable additive column');
  // Build the previous schema with its existing mirror; seed only synthetic rows.
  await observer.query(mirror.replace(addition,''));
  await observer.query("INSERT INTO users(id,name,password_hash,role) VALUES('mp_admin','Synthetic admin','fixture','admin')");
  await observer.query("INSERT INTO marketplace_products(id,slug,name,category,price_type,price_minor,availability,published,archived) VALUES('mp_legacy','legacy-laptop','Dell synthetic laptop','laptops_computers','fixed',125000,'available',true,false)");
  const legacy=(await observer.query("SELECT * FROM marketplace_products WHERE id='mp_legacy'")).rows[0];
  process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';pool=getPool()!;
  await t.test('old-schema reads tolerate absent nullable field; initialization runs twice without changing legacy product',async()=>{
   assert.equal((await MarketplaceStore.getPublicProducts())[0].imageFraming,undefined);
   await initDatabase();await initDatabase();
   const col=(await observer.query("SELECT data_type,character_maximum_length,is_nullable,column_default FROM information_schema.columns WHERE table_name='marketplace_products' AND column_name='image_framing'")).rows[0];
   assert.deepEqual(col,{data_type:'character varying',character_maximum_length:32,is_nullable:'YES',column_default:null});
   const row=(await observer.query("SELECT * FROM marketplace_products WHERE id='mp_legacy'")).rows[0];
   assert.equal(row.image_framing,null);for(const key of Object.keys(legacy))assert.deepEqual(row[key],legacy[key],key);
  });
  await t.test('restricted non-owner migration fails atomically; read-only transaction fails predictably',async()=>{
   const client=await observer.connect();
   try{
    await client.query('BEGIN READ ONLY');
    await assert.rejects(client.query(MARKETPLACE_FLEXIBILITY_SCHEMA),(e:any)=>e.code==='25006');
    await client.query('ROLLBACK');
   }finally{client.release();}
   // Companion role is provisioned only in the disposable test cluster.
   await observer.query('GRANT USAGE ON SCHEMA public TO marketplace_v2_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO marketplace_v2_reader');
   const readerUrl=new URL(url!);readerUrl.username='marketplace_v2_reader';readerUrl.password='';
   const reader=new pg.Pool({connectionString:readerUrl.href,ssl:false,max:1});
   try{assert.equal((await reader.query('SELECT count(*) FROM marketplace_products')).rows[0].count,'1');await assert.rejects(reader.query(MARKETPLACE_FLEXIBILITY_SCHEMA),(e:any)=>e.code==='42501');}finally{await reader.end();}
  });
  const input={name:'Synthetic framed laptop',category:'laptops_computers',priceType:'fixed',priceGhc:1500,availability:'available',productKind:'physical',fulfilmentMode:'delivery',deliveryAvailable:true,imageUrl:'https://images.example.com/laptop.jpg',description:'Synthetic description'};
  let product:any;
  await t.test('create, edit, duplicate, publish and image replacement preserve framing and commerce fields',async()=>{
   product=await MarketplaceStore.createProduct(await validateProductInput({...input,imageFraming:{x:25,y:75,zoom:1.5}}) as never,'mp_admin');
   assert.equal(product.image_framing,'25,75,1.5');assert.equal(product.published,false);
   product=await MarketplaceStore.updateProduct(product.id,await validateProductInput({imageFraming:'60,40,1.25'},product) as never,'mp_admin');
   assert.equal(product.image_framing,'60,40,1.25');assert.equal(product.price_minor,150000);assert.equal(product.published,false);
   const copy=await MarketplaceStore.duplicateProduct(product.id,'mp_admin');
   assert.equal(copy.image_framing,product.image_framing);assert.equal(copy.published,false);
   product=await MarketplaceStore.updateProduct(product.id,await validateProductInput({published:true,confirmWarnings:true},product) as never,'mp_admin');
   assert.deepEqual((await MarketplaceStore.getPublicProductBySlug(product.slug))!.imageFraming,{x:60,y:40,zoom:1.25});
   const before={...product};
   product=await MarketplaceStore.updateProduct(product.id,await validateProductInput({imageUrl:'https://images.example.com/replacement.jpg',confirmWarnings:true},product) as never,'mp_admin');
   assert.equal(product.image_framing,null);
   for(const field of ['price_minor','purchase_enabled','availability','published','slug','fulfilment_mode','referral_reward_minor'])assert.deepEqual(product[field],before[field],field);
   assert.equal((await MarketplaceStore.getPublicProducts()).some(p=>p.id===copy.id),false,'duplicate stays private');
  });
  await t.test('invalid framing fails before mutation; database VARCHAR bound and rollback preserve records',async()=>{
   const before=(await observer.query('SELECT * FROM marketplace_products ORDER BY id')).rows;
   for(const raw of [{x:-1,y:50,zoom:1},{x:50,y:50,zoom:2.01},{x:NaN,y:50,zoom:1},'50,50,1;DROP',[],42])await assert.rejects(validateProductInput({imageFraming:raw},product),/Invalid photo framing/);
   const c=await observer.connect();try{await c.query('BEGIN');await assert.rejects(c.query("UPDATE marketplace_products SET image_framing=$1 WHERE id=$2",['x'.repeat(33),product.id]),(e:any)=>e.code==='22001');await c.query('ROLLBACK');}finally{c.release();}
   assert.deepEqual((await observer.query('SELECT * FROM marketplace_products ORDER BY id')).rows,before);
  });
  await t.test('repeat startup preserves products, ledger, orders and audit history',async()=>{
   await OrdersStore.createOrder(opsOrder({id:'mp_order_sentinel',user_id:'mp_admin'}));
   await observer.query("INSERT INTO finance_accounts(user_id,wallet_minor) VALUES('mp_admin',700); INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor) VALUES('mp_money','mp_admin','topup','mp_money','completed',700); INSERT INTO finance_ledger(id,user_id,operation_id,bucket,delta_minor,balance_after_minor,description) VALUES('mp_entry','mp_admin','mp_money','wallet',700,700,'Synthetic preservation sentinel')");
   const tables=['marketplace_products','orders','finance_accounts','finance_ledger','finance_operations','admin_audit_log'];
   const rows=async(name:string)=>(await observer.query('SELECT * FROM '+name+' ORDER BY '+(name==='finance_accounts'?'user_id':'id'))).rows;
   const before=await Promise.all(tables.map(rows));assert.ok(before.every(group=>group.length>0),'all preservation groups contain synthetic records');
   await initDatabase();await initDatabase();
   for(let i=0;i<tables.length;i++)assert.deepEqual(await rows(tables[i]),before[i],tables[i]);
  });
 }finally{await pool?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.DATABASE_SSL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
