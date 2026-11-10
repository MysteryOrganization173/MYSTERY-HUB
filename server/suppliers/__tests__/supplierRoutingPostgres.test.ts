import assert from 'node:assert/strict';
import {test} from 'node:test';
import pg from 'pg';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import {getPool, initDatabase} from '../../db/connection.js';
import {OrdersStore} from '../../db/ordersStore.js';
import {routingOrder} from './fixtures/routingOrder.js';

const url=process.env.MYSTERY_ROUTING_POSTGRES_URL;
test('native PostgreSQL supplier namespaces, immutable snapshots and webhook isolation',{skip:!url},async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  assertSafeTestDatabase({NODE_ENV:'test',DATABASE_URL:url,MYSTERY_TEST_DATABASE_OPT_IN:'true'});
  const observer=new pg.Pool({connectionString:url,ssl:false});
  try {
    assert.equal((await observer.query("SELECT to_regclass('public.orders') AS name")).rows[0].name,null,'Requires empty disposable database');
    Object.assign(process.env,{DATABASE_URL:url,DATABASE_SSL:'false',MYSTERY_TEST_DATABASE_OPT_IN:'true',NODE_ENV:'test'});await initDatabase();
    const before=(await observer.query('SELECT count(*)::int AS n FROM finance_ledger')).rows[0].n;
    await t.test('status and uncertainty writes retain supplier identity, including null legacy',async()=>{
      for(const supplier_provider of ['success_biz_hub','telcogh',null]) {
        const order=routingOrder({supplier_provider});await OrdersStore.createOrder(order);
        const results=await Promise.all([OrdersStore.saveSupplierUncertainSubmission(order.id,'Synthetic timeout'),OrdersStore.saveSupplierSubmission(order.id,`reference-${order.id}`,100,'offer','submitted')]);
        for(const result of results)assert.equal(result?.supplier_provider,supplier_provider);
        const stored=await OrdersStore.findOrder(order.id);assert.equal(stored?.supplier_provider,supplier_provider);assert.equal(stored?.payment_status,'success');
      }
    });
    await t.test('provider reference collisions target only SBH; duplicate SBH matches roll back the event',async()=>{
      const sbh=routingOrder({supplier_order_id:'cross-provider-id',status:'submitted'}),telco=routingOrder({supplier_provider:'telcogh',supplier_order_id:'cross-provider-id',status:'submitted'});
      await OrdersStore.createOrder(sbh);await OrdersStore.createOrder(telco);
      assert.equal((await OrdersStore.findOrderBySupplierOrderId('cross-provider-id'))?.id,sbh.id);
      assert.equal((await OrdersStore.findOrderBySupplierOrderId('cross-provider-id',undefined,'telcogh'))?.id,telco.id);
      await OrdersStore.processSupplierWebhookEvent('routing-event','status',{},[{supplierOrderId:'cross-provider-id',status:'processing',response:'{"status":"processing"}'}]);
      assert.equal((await OrdersStore.findOrder(sbh.id))?.status,'processing');assert.equal((await OrdersStore.findOrder(telco.id))?.status,'submitted');
      await OrdersStore.createOrder(routingOrder({supplier_order_id:'cross-provider-id',supplier_provider:null,status:'submitted'}));
      assert.equal(await OrdersStore.findOrderBySupplierOrderId('cross-provider-id'),null);
      await assert.rejects(()=>OrdersStore.processSupplierWebhookEvent('routing-ambiguous','status',{},[{supplierOrderId:'cross-provider-id',status:'delivered',response:'{}'}]));
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM supplier_webhook_events WHERE event_id='routing-ambiguous'")).rows[0].n,0);
      assert.equal((await OrdersStore.findOrder(sbh.id))?.status,'processing');
    });
    await t.test('null legacy Airtime/Instant resolve identically; manual Marketplace is excluded',async()=>{
      for(const product_id of ['airtime-old','instant-old']){
        const order=routingOrder({supplier_provider:null,service_type:undefined,product_id,supplier_order_id:`legacy-${product_id}`});await OrdersStore.createOrder(order);
        assert.equal((await OrdersStore.findOrderBySupplierOrderId(`legacy-${product_id}`))?.id,order.id);
      }
      const manual=routingOrder({supplier_provider:null,service_type:'marketplace',supplier_order_id:'manual'});await OrdersStore.createOrder(manual);assert.equal(await OrdersStore.findOrderBySupplierOrderId('manual'),null);
    });
    assert.equal((await observer.query('SELECT count(*)::int AS n FROM finance_ledger')).rows[0].n,before);
    const plan=await observer.query("EXPLAIN SELECT id FROM orders WHERE supplier_order_id=$1 AND supplier_provider=$2 LIMIT 2",['cross-provider-id','success_biz_hub']);assert.ok(plan.rows.length);
  } finally {await getPool()?.end();await observer.end();delete process.env.DATABASE_URL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
