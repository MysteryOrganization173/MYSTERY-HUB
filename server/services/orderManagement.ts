import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getPool} from '../db/connection.js';
import {AdminAuditStore} from '../db/adminAuditStore.js';
import {FinanceError} from '../db/financeStore.js';
import {toAdminOrderDetails,type OrderRecord} from '../types/orders.js';
import {orderManagementEligibility} from './orderManagementPolicy.js';

const id=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(s);
function validate(input:Record<string,unknown>) {
  if(Object.keys(input).some(k=>!['action','confirmed','reason','expectedUpdatedAt','requestId'].includes(k)))throw new FinanceError('Unexpected management field.');
  if(!['archive','restore','delete_test'].includes(String(input.action))||input.confirmed!==true)throw new FinanceError('Explicitly confirm the requested action.');
  if(!id(input.requestId)||String(input.requestId).length<8||typeof input.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(input.expectedUpdatedAt)))throw new FinanceError('Reload the order and use a valid request ID.');
  if(typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500||/[<>\x00-\x1f]|Bearer\s|sk_(live|test)_/i.test(input.reason))throw new FinanceError('Provide a safe operational reason (5–500 characters).');
  return {action:input.action as 'archive'|'restore'|'delete_test',requestId:input.requestId as string,expectedUpdatedAt:input.expectedUpdatedAt as string,reason:input.reason.trim()};
}
async function read(client:PoolClient,reference:string,lock=false):Promise<OrderRecord>{
  const row=(await client.query('SELECT * FROM orders WHERE id=$1 OR public_reference=$1'+(lock?' FOR UPDATE':''),[reference])).rows[0];
  if(!row)throw new FinanceError('Order not found.',404);return row;
}
async function facts(client:PoolClient,o:OrderRecord) {
  const registered=(await client.query("SELECT 1 FROM order_test_fixtures WHERE order_id=$1 AND provenance='synthetic_no_gateway'",[o.id])).rowCount===1;
  // Inspect every incoming FK, including future schema additions. Refuse linked evidence even when its FK would cascade or SET NULL.
  const refs=await client.query(`SELECT ns.nspname AS schema,cl.relname AS table,att.attname AS column
    FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
    JOIN pg_attribute att ON att.attrelid=c.conrelid AND att.attnum=ANY(c.conkey)
    WHERE c.contype='f' AND c.confrelid='orders'::regclass`);
  let linked=false;
  for(const ref of refs.rows){if(ref.table==='order_test_fixtures')continue;
    const quote=(v:string)=>'"'+v.replaceAll('"','""')+'"';
    if((await client.query(`SELECT 1 FROM ${quote(ref.schema)}.${quote(ref.table)} WHERE ${quote(ref.column)}::text=$1 LIMIT 1`,[o.id])).rowCount){linked=true;break;}}
  if(!linked)linked=Boolean((await client.query(`SELECT 1 FROM finance_operations WHERE payload->>'orderId'=$1
    OR payload->>'reference'=$2 OR idempotency_key IN ($3,$4,$5,$6) LIMIT 1`,[o.id,o.payment_reference,'purchase:'+o.id,'refund:'+o.id,'store-sale:'+o.id,'direct-checkout:'+o.id])).rowCount);
  return orderManagementEligibility(o,registered,linked);
}
export class OrderManagement {
  static async details(reference:string){
    if(!id(reference))throw new FinanceError('Invalid order reference.');
    const db=getPool();if(!db)throw new FinanceError('Durable order management requires PostgreSQL.',503);
    const client=await db.connect();try{await client.query('BEGIN READ ONLY');const o=await read(client,reference);
      const eligibility=await facts(client,o);const history=(await client.query('SELECT action,reason,created_at,actor_id FROM order_management_events WHERE order_id=$1 ORDER BY created_at DESC LIMIT 100',[o.id])).rows;
      await client.query('COMMIT');return {success:true,order:{...toAdminOrderDetails(o),archived_at:o.archived_at||null},eligibility,history};
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  static async action(reference:string,actor:string,body:Record<string,unknown>){
    if(!id(reference))throw new FinanceError('Invalid order reference.');const input=validate(body);
    const hash=createHash('sha256').update(JSON.stringify([reference,actor,input.action,input.reason,input.expectedUpdatedAt])).digest('hex');
    const db=getPool();if(!db)throw new FinanceError('Durable order management requires PostgreSQL.',503);
    const client=await db.connect();try{await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['order-management:'+input.requestId]);
      const previous=(await client.query('SELECT input_hash,result FROM order_management_events WHERE request_id=$1',[input.requestId])).rows[0];
      if(previous){if(previous.input_hash!==hash)throw new FinanceError('Request ID was already used for another action.',409);await client.query('COMMIT');return previous.result;}
      const o=await read(client,reference,true);
      if(new Date(o.updated_at).toISOString()!==new Date(input.expectedUpdatedAt as string).toISOString())throw new FinanceError('Order changed. Reload before acting.',409);
      // Prevent evidence being added between eligibility inspection and DELETE, including JSON-only financial links.
      // SHARE ROW EXCLUSIVE serializes these rare staff actions with writers, not routine order reads.
      if(input.action==='delete_test')await client.query('LOCK TABLE finance_operations IN SHARE ROW EXCLUSIVE MODE');
      const eligibility=await facts(client,o);
      if(input.action==='archive'&&!eligibility.archive||input.action==='restore'&&!eligibility.restore||input.action==='delete_test'&&!eligibility.deleteTest)throw new FinanceError('Order is ineligible: '+eligibility.denials.join(', '),409);
      let archivedAt:string|null=o.archived_at?new Date(o.archived_at).toISOString():null;
      if(input.action==='delete_test'){
        await client.query('DELETE FROM order_test_fixtures WHERE order_id=$1',[o.id]);
        const deleted=await client.query('DELETE FROM orders WHERE id=$1',[o.id]);if(deleted.rowCount!==1)throw new FinanceError('Fixture deletion did not affect exactly one row.',409);
      }else{archivedAt=input.action==='archive'?new Date().toISOString():null;
        await client.query("UPDATE orders SET archived_at=$1,updated_at=GREATEST(NOW(),updated_at+interval '1 millisecond') WHERE id=$2",[archivedAt,o.id]);}
      const result={success:true,action:input.action,orderId:o.id,archivedAt,deleted:input.action==='delete_test'};
      await client.query('INSERT INTO order_management_events(id,order_id,actor_id,request_id,input_hash,action,reason,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),o.id,actor,input.requestId,hash,input.action,input.reason,JSON.stringify(result)]);
      await AdminAuditStore.record({adminUserId:actor,action:'order_'+input.action,entityType:'order',entityId:o.id,metadata:{reason:input.reason,public_reference:o.public_reference}},client);
      await client.query('COMMIT');return result;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
}
