import assert from 'node:assert/strict';
import {test} from 'node:test';
import {OrdersStore} from '../../db/ordersStore.js';
import {getPool,initDatabase} from '../../db/connection.js';
import {assertSafeTestDatabase} from '../../utils/environment.js';
import type {OrderRecord} from '../../types/orders.js';

// Explicit opt-in only. The ordinary test runner never inherits application DATABASE_URL.
const url=process.env.CONNECTIVITY_TEST_DATABASE_URL;
test('real PostgreSQL separate-connection cancellation/expiry cannot overwrite committed payment or dispatch', {skip:!url},async()=>{
  process.env.NODE_ENV='test';process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';process.env.MYSTERY_TEST_DATABASE_OPT_IN='true';
  assertSafeTestDatabase();const db=getPool()!;
  try {
    await initDatabase();
    for(const action of ['cancelOrder','expireOrder'] as const) {
      const id=`pg_safety_${action}`,now=new Date().toISOString();
      const order:OrderRecord={id,public_reference:`MH-${id}`,payment_reference:`PAY-${id}`,customer_name:'Synthetic',customer_email:'fixture@example.com',customer_phone:'+233201234567',recipient_phone:'+233201234567',network:'telecel',service_type:'instant_bundle',product_id:'fixture',product_name_snapshot:'Fixture',bundle_size_snapshot:'1GB',amount:1000,currency:'GHS',status:'pending_payment',payment_provider:'paystack',payment_status:'pending',supplier_provider:'success_biz_hub',supplier_order_id:null,supplier_response:null,supplier_cost_minor:null,supplier_offer_ref:null,supplier_last_checked_at:null,failure_reason:null,created_at:now,updated_at:now,paid_at:null,submitted_at:null,delivered_at:null};
      await OrdersStore.createOrder(order);
      const blocker=await db.connect(),observer=await db.connect();
      try {
        await blocker.query('BEGIN');await blocker.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE',[id]);
        // The application UPDATE sees the old pending row, then waits behind this independent transaction.
        const operation=OrdersStore[action](id);
        let waiting=false;
        for(let attempt=0;attempt<100;attempt++) {
          const result=await observer.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%UPDATE orders SET status=$1%' ");
          if(result.rowCount){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
        }
        assert.equal(waiting,true,'must exercise a real blocked UPDATE, not a timing-only mock');
        await blocker.query("UPDATE orders SET payment_status='success',status='submitted',paid_at=NOW(),supplier_order_id='SYNTHETIC-once',submitted_at=NOW() WHERE id=$1",[id]);
        await blocker.query('COMMIT');
        const result=await operation;assert.equal(result.alreadyPaid,true);
        const saved=(await db.query('SELECT * FROM orders WHERE id=$1',[id])).rows[0];assert.equal(saved.payment_status,'success');assert.equal(saved.status,'submitted');assert.equal(saved.supplier_order_id,'SYNTHETIC-once');assert.equal(saved.payment_closed_at,null);
      } finally {await blocker.query('ROLLBACK');blocker.release();observer.release();}
    }
  } finally {await db.end();delete process.env.DATABASE_URL;delete process.env.MYSTERY_TEST_DATABASE_OPT_IN;}
});
