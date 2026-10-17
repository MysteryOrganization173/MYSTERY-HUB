import type {PoolClient} from 'pg';
import {getPool} from './connection.js';
import {FinanceError} from './financeStore.js';
import {AdminAuditStore} from './adminAuditStore.js';
import {OrdersStore} from './ordersStore.js';
import type {AssistedQuote,AssistedDecision} from '../../shared/adminAssistedOrders.js';
let quotes:AssistedQuote[]=[],decisions:AssistedDecision[]=[],tail=Promise.resolve();
export class AdminAssistedStore {
 static async quote(id:string,client?:PoolClient):Promise<AssistedQuote|undefined>{const db=client||getPool();return db?(await db.query('SELECT snapshot FROM admin_assisted_quotes WHERE id=$1'+(client?' FOR UPDATE':''),[id])).rows[0]?.snapshot:structuredClone(quotes.find(q=>q.id===id));}
 static async addQuote(q:AssistedQuote){const db=getPool();if(db)await db.query('INSERT INTO admin_assisted_quotes(id,actor_id,snapshot,expires_at) VALUES($1,$2,$3,$4)',[q.id,q.actorId,JSON.stringify(q),q.expiresAt]);else{if(process.env.NODE_ENV==='production')throw new FinanceError('Database required for assisted orders.',503);quotes.push(structuredClone(q));}return q;}
 static async decision(input:{request?:string;quote?:string;order?:string},client?:PoolClient):Promise<AssistedDecision|undefined>{const db=client||getPool();return db?(await db.query('SELECT * FROM admin_assisted_orders WHERE request_id=$1 OR quote_id=$2 OR order_id=$3',[input.request||null,input.quote||null,input.order||null])).rows[0]:structuredClone(decisions.find(d=>d.request_id===input.request||d.quote_id===input.quote||d.order_id===input.order));}
 static async append(d:AssistedDecision,client?:PoolClient){if(client)await client.query('INSERT INTO admin_assisted_orders(order_id,quote_id,actor_id,source,request_id,input_hash,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[d.order_id,d.quote_id,d.actor_id,d.source,d.request_id,d.input_hash,JSON.stringify(d.snapshot)]);else{if(getPool())throw new Error('Assisted authorization requires transaction');decisions.push(structuredClone(d));}}
 static async transaction<T>(work:(client?:PoolClient)=>Promise<T>):Promise<T>{const db=getPool();if(db){const client=await db.connect();try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('admin:assisted-orders',0))");const r=await work(client);await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}if(process.env.NODE_ENV==='production')throw new FinanceError('Database required for assisted orders.',503);const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>{release=r;});await previous;const before=structuredClone(decisions),orders=OrdersStore.adminDevOrders();try{return await AdminAuditStore.withDevTransaction(()=>work());}catch(e){decisions=before;for(const o of OrdersStore.adminDevOrders())if(!orders.some(b=>b.id===o.id))OrdersStore.removeDevOrder(o.id);throw e;}finally{release();}}
 static reset(){quotes=[];decisions=[];}
}
