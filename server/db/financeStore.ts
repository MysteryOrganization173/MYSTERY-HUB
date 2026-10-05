import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from './connection.js';
import { ReferralStore } from './referralStore.js';
import { AdminAuditStore } from './adminAuditStore.js';
import { MAX_MONEY_MINOR } from '../../shared/money.js';

export interface FinanceOperation { id:string; user_id:string; kind:string; idempotency_key:string; state:string; amount_minor:number; payload:Record<string,any>; created_at:string; updated_at:string }
export interface FinanceEntry { id:string; user_id:string; operation_id:string; bucket:'wallet'|'earn'; delta_minor:number; balance_after_minor:number|null; description:string; created_at:string }
interface Memory { accounts:Record<string,{wallet_minor:number;restricted:boolean}>; operations:FinanceOperation[]; ledger:FinanceEntry[]; config:Record<string,any> }
let memory:Memory={accounts:{},operations:[],ledger:[],config:{}};
let tail = Promise.resolve();
export class FinanceError extends Error { constructor(message:string, public status=400){super(message);} }
export class FinanceTx {
  constructor(public userId:string, public client?:PoolClient, private state?:Memory) {}
  async account() {
    if(this.client) {
      await this.client.query('INSERT INTO finance_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING',[this.userId]);
      const row=(await this.client.query('SELECT * FROM finance_accounts WHERE user_id=$1 FOR UPDATE',[this.userId])).rows[0];
      return {wallet_minor:Number(row.wallet_minor),restricted:row.restricted};
    }
    return this.state!.accounts[this.userId] ||= {wallet_minor:0,restricted:false};
  }
  async restrict() {
    await this.account();
    if(this.client) await this.client.query('UPDATE finance_accounts SET restricted=TRUE WHERE user_id=$1',[this.userId]);
    else this.state!.accounts[this.userId].restricted=true;
  }
  async clearRestriction() {
    if((await this.operations()).some(x=>['manual_review','reversal_review'].includes(x.state)))throw new FinanceError('Unresolved reconciliation cases remain.',409);
    if(this.client)await this.client.query('UPDATE finance_accounts SET restricted=FALSE WHERE user_id=$1',[this.userId]);
    else (await this.account()).restricted=false;
  }
  async operations() {
    if(!this.client) return [...this.state!.operations].reverse().filter(x=>x.user_id===this.userId);
    return (await this.client.query('SELECT * FROM finance_operations WHERE user_id=$1 ORDER BY created_at DESC',[this.userId])).rows.map(normalizeOperation);
  }
  async find(key:string) {return (await this.operations()).find(x=>x.idempotency_key===key);}
  async create(kind:string,key:string,amount:number,payload:Record<string,any>,state='completed') {
    if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(key)) throw new FinanceError('Invalid operation key.');
    const row:FinanceOperation={id:`fin_${randomUUID()}`,user_id:this.userId,kind,idempotency_key:key,state,amount_minor:amount,payload,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    if(this.client) await this.client.query(`INSERT INTO finance_operations(id,user_id,kind,idempotency_key,state,amount_minor,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)`,[row.id,row.user_id,kind,key,state,amount,JSON.stringify(payload),row.created_at]);
    else this.state!.operations.push(row);
    return row;
  }
  async update(row:FinanceOperation,state:string,payload=row.payload) {
    const now=new Date().toISOString();
    if(this.client) await this.client.query('UPDATE finance_operations SET state=$1,payload=$2,updated_at=$3 WHERE id=$4 AND user_id=$5',[state,JSON.stringify(payload),now,row.id,this.userId]);
    Object.assign(row,{state,payload,updated_at:now});return row;
  }
  async ledger() {
    return this.client ? (await this.client.query('SELECT * FROM finance_ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC',[this.userId])).rows.map((r:any)=>({...r,delta_minor:Number(r.delta_minor),balance_after_minor:r.balance_after_minor==null?null:Number(r.balance_after_minor)})) as FinanceEntry[] : [...this.state!.ledger].reverse().filter(x=>x.user_id===this.userId);
  }
  async earn() {
    // Lock the existing authoritative reward rows. A reversal cannot race consumption.
    const rewards=this.client ? (await this.client.query('SELECT * FROM reward_ledger WHERE referrer_user_id=$1 FOR UPDATE',[this.userId])).rows : ReferralStore.adminDevSnapshot().ledger.filter(x=>x.referrer_user_id===this.userId);
    const approved=rewards.filter(x=>x.status==='approved'&&!x.reversal_of_id).reduce((s,x)=>s+Number(x.amount_minor),0);
    const pending=rewards.filter(x=>x.status==='pending').reduce((s,x)=>s+Number(x.amount_minor),0);
    const consumed=-(await this.ledger()).filter(x=>x.bucket==='earn').reduce((s,x)=>s+x.delta_minor,0);
    const operations=await this.operations();
    const reserved=operations.filter(x=>x.kind==='withdrawal'&&['pending_review','approved'].includes(x.state)).reduce((s,x)=>s+x.amount_minor,0);
    const withdrawn=operations.filter(x=>x.kind==='withdrawal'&&x.state==='paid').reduce((s,x)=>s+x.amount_minor,0);
    return {availableMinor:Math.max(0,approved-consumed),pendingMinor:pending,reservedMinor:reserved,lifetimeMinor:rewards.filter(x=>!x.reversal_of_id&&(x.status==='approved'||x.status==='reversed'&&x.approved_at)).reduce((s,x)=>s+Number(x.amount_minor),0),withdrawnMinor:withdrawn,reconciliationRequired:approved<consumed};
  }
  async append(operation:FinanceOperation,bucket:'wallet'|'earn',delta:number,description:string) {
    if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>MAX_MONEY_MINOR) throw new FinanceError('Invalid ledger movement.');
    const previous=(await this.ledger()).find(x=>x.operation_id===operation.id&&x.bucket===bucket);
    if(previous) return previous;
    let balance:number|null=null;
    if(bucket==='wallet') {
      const account=await this.account();balance=account.wallet_minor+delta;
      if(balance<0||balance>MAX_MONEY_MINOR) throw new FinanceError('Insufficient Wallet balance or balance limit exceeded.',409);
      if(delta<0&&account.restricted) throw new FinanceError('Wallet requires Admin reconciliation before spending.',409);
      if(this.client) await this.client.query('UPDATE finance_accounts SET wallet_minor=$1 WHERE user_id=$2',[balance,this.userId]);
      else account.wallet_minor=balance;
    }
    const entry:FinanceEntry={id:`led_${randomUUID()}`,user_id:this.userId,operation_id:operation.id,bucket,delta_minor:delta,balance_after_minor:balance,description,created_at:new Date().toISOString()};
    if(this.client) await this.client.query('INSERT INTO finance_ledger(id,user_id,operation_id,bucket,delta_minor,balance_after_minor,description,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[entry.id,this.userId,operation.id,bucket,delta,balance,description,entry.created_at]);
    else this.state!.ledger.push(entry);
    return entry;
  }
  async audit(adminId:string,action:string,entityId:string,metadata:Record<string,unknown>) {
    await AdminAuditStore.record({adminUserId:adminId,action,entityType:'finance',entityId,metadata},this.client);
  }
  async config(id:string) {return this.client ? (await this.client.query('SELECT value FROM finance_config WHERE id=$1',[id])).rows[0]?.value : this.state!.config[id];}
  async saveConfig(id:string,value:unknown) {
    if(this.client) await this.client.query('INSERT INTO finance_config(id,value) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()',[id,JSON.stringify(value)]);
    else this.state!.config[id]=value;
  }
}
const normalizeOperation=(row:any):FinanceOperation=>({...row,amount_minor:Number(row.amount_minor),created_at:new Date(row.created_at).toISOString(),updated_at:new Date(row.updated_at).toISOString()});
export class FinanceStore {
  static async readConfig(id:string) {
    const pool=getPool();
    if(!pool&&process.env.NODE_ENV==='production')throw new FinanceError('Financial database unavailable.',503);
    return pool?(await pool.query('SELECT value FROM finance_config WHERE id=$1',[id])).rows[0]?.value:structuredClone(memory.config[id]);
  }
  static async transaction<T>(userId:string,work:(tx:FinanceTx)=>Promise<T>):Promise<T> {
    const pool=getPool();
    if(!pool&&process.env.NODE_ENV==='production') throw new FinanceError('Financial database unavailable.',503);
    if(pool) {
      const client=await pool.connect();
      try {await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`finance:${userId}`]);const tx=new FinanceTx(userId,client);await tx.account();const result=await work(tx);await client.query('COMMIT');return result;}
      catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    // A copy commits only on success, providing actual rollback semantics in isolated tests.
    const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;
    const draft=structuredClone(memory);
    try {const result=await work(new FinanceTx(userId,undefined,draft));memory=draft;return structuredClone(result);}finally{release();}
  }
  static async ownerOf(id:string,kind?:string) {
    const pool=getPool();
    const row=pool ? (await pool.query('SELECT * FROM finance_operations WHERE id=$1 OR (kind=\'topup\' AND payload->>\'reference\'=$1)',[id])).rows[0] : memory.operations.find(x=>x.id===id||(x.kind==='topup'&&x.payload.reference===id));
    if(!row||kind&&row.kind!==kind) return null;return normalizeOperation(row);
  }
  static async adminOperations(kind?:string,limit=50,offset=0) {
    const pool=getPool();
    if(pool) return (await pool.query('SELECT o.*,u.name AS customer_name FROM finance_operations o JOIN users u ON u.id=o.user_id WHERE ($1::text IS NULL OR kind=$1) ORDER BY o.created_at DESC LIMIT $2 OFFSET $3',[kind||null,limit,offset])).rows.map(normalizeOperation);
    return [...memory.operations].reverse().filter(x=>!kind||x.kind===kind).slice(offset,offset+limit);
  }
  static async metrics() {
    const pool=getPool();
    const ledger:FinanceEntry[]=pool?(await pool.query('SELECT bucket,delta_minor,description FROM finance_ledger')).rows.map((x:any)=>({...x,delta_minor:Number(x.delta_minor)})):memory.ledger;
    const operations:FinanceOperation[]=pool?(await pool.query('SELECT * FROM finance_operations')).rows.map(normalizeOperation):memory.operations;
    const approved=pool?Number((await pool.query("SELECT COALESCE(SUM(amount_minor),0) AS total FROM reward_ledger WHERE status='approved' AND reversal_of_id IS NULL")).rows[0].total):ReferralStore.adminDevSnapshot().ledger.filter(x=>x.status==='approved'&&!x.reversal_of_id).reduce((s,x)=>s+x.amount_minor,0);
    const total=(kind:string,state?:string)=>operations.filter(x=>x.kind===kind&&(!state||x.state===state)).reduce((s,x)=>s+x.amount_minor,0);
    return {walletLiabilityMinor:ledger.filter(x=>x.bucket==='wallet').reduce((s,x)=>s+x.delta_minor,0),availableEarnLiabilityMinor:Math.max(0,approved+ledger.filter(x=>x.bucket==='earn').reduce((s,x)=>s+x.delta_minor,0)),walletDepositsMinor:total('topup','credited')+total('topup','reversed')+total('topup','reversal_review'),walletSpendingMinor:total('purchase'),walletRefundsMinor:total('refund'),earnTransfersMinor:total('transfer'),achievementCreditsMinor:total('achievement'),reservedWithdrawalsMinor:operations.filter(x=>x.kind==='withdrawal'&&['approved','pending_review'].includes(x.state)).reduce((s,x)=>s+x.amount_minor,0),paidWithdrawalsMinor:operations.filter(x=>x.kind==='withdrawal'&&x.state==='paid').reduce((s,x)=>s+x.payload.netMinor,0),withdrawalFeesMinor:operations.filter(x=>x.kind==='withdrawal'&&x.state==='paid').reduce((s,x)=>s+x.payload.feeMinor,0),referralCreditsMinor:approved,rewardReversalsMinor:operations.filter(x=>x.kind==='reversal'&&x.payload.rewardId).reduce((s,x)=>s+x.amount_minor,0)};
  }
  static _reset(){memory={accounts:{},operations:[],ledger:[],config:{}};}
}
