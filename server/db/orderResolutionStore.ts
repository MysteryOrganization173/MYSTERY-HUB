import {AdminAuditStore} from './adminAuditStore.js';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getPool} from './connection.js';
import {FinanceError,FinanceStore,FinanceTx} from './financeStore.js';
import {OrdersStore} from './ordersStore.js';
import type {OrderResolutionEvent} from '../types/orderResolution.js';
const events:OrderResolutionEvent[]=[];let tail=Promise.resolve();
export class OrderResolutionStore {
  static async history(orderId:string,client?:PoolClient):Promise<OrderResolutionEvent[]> {
    const db=client||getPool();return db?(await db.query('SELECT * FROM order_resolution_events WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[orderId])).rows:structuredClone(events.filter(e=>e.order_id===orderId).slice(-100).reverse());
  }
  static async request(orderId:string,requestId:string,client?:PoolClient):Promise<OrderResolutionEvent|undefined>{const db=client||getPool();return db?(await db.query('SELECT * FROM order_resolution_events WHERE order_id=$1 AND request_id=$2',[orderId,requestId])).rows[0]:structuredClone(events.find(e=>e.order_id===orderId&&e.request_id===requestId));}
  static async append(input:Omit<OrderResolutionEvent,'id'|'created_at'>,client?:PoolClient) {
    const row={...input,id:'ores_'+randomUUID(),created_at:new Date().toISOString()};
    if(client)await client.query('INSERT INTO order_resolution_events(id,order_id,request_id,input_hash,action,actor_id,result,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[row.id,row.order_id,row.request_id,row.input_hash,row.action,row.actor_id,JSON.stringify(row.result),row.created_at]);
    else {if(getPool())throw new Error('Resolution history requires transaction.');events.push(structuredClone(row));}
    return row;
  }
  static async transaction<T>(orderId:string,walletUserId:string|null,work:(client?:PoolClient,tx?:FinanceTx)=>Promise<T>):Promise<T> {
    const pool=getPool();if(!pool&&process.env.NODE_ENV==='production')throw new FinanceError('Resolution database unavailable.',503);
    if(pool&&walletUserId)return FinanceStore.transaction(walletUserId,tx=>work(tx.client,tx));
    if(pool){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
    const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;
    const before=structuredClone(await OrdersStore.findOrder(orderId)),length=events.length;
    try{return await AdminAuditStore.withDevTransaction(()=>walletUserId?FinanceStore.transaction(walletUserId,tx=>work(undefined,tx)):work());}
    catch(error){if(before)OrdersStore.restoreResolutionMemory(before);events.splice(length);throw error;}
    finally{release();}
  }
  static _reset(){events.length=0;}
}
