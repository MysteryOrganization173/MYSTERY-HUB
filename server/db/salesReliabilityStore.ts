import type {PoolClient} from 'pg';
import {getPool} from './connection.js';
import {SALES_WINDOW_MS,type SalesObservation,type SalesIncident} from '../../shared/salesReliability.js';
import {advanceSalesIncidents} from '../services/salesReliabilityRules.js';

const schema='mysteryhub_operations';
const date=(value:unknown)=>value===null?null:new Date(value as string).getTime();
const observation=(r:any):SalesObservation=>({id:r.id,at:date(r.observed_at)!,service:r.service,stage:r.stage,category:r.category,blocked:r.blocked,phase:r.phase,fresh:r.fresh,cached:r.cached});
const incident=(r:any):SalesIncident=>({id:r.id,service:r.service,stage:r.stage,category:r.category,firstFailureAt:date(r.first_failure_at)!,lastFailureAt:date(r.last_failure_at)!,affectedAttempts:r.affected_attempts,blockedAttempts:r.blocked_attempts,firstRecoveryAt:date(r.first_recovery_at),lastRecoveryAt:date(r.last_recovery_at),recoveredAt:date(r.recovered_at)});
const iso=(value:number|null)=>value===null?null:new Date(value).toISOString();

export class SalesReliabilityStore {
  /** Yield to business traffic; never open another pool or wait behind checkout queries. */
  static canFlush(){const pool=getPool();return Boolean(pool&&pool.waitingCount===0&&(pool.idleCount>=2||pool.totalCount<Math.max(1,Number(pool.options.max)-1)));}
  static async transaction<T>(work:(client:PoolClient)=>Promise<T>,readOnly=false):Promise<T>{
    const pool=getPool();if(!pool)throw Error('Monitoring storage unavailable');
    const c=await pool.connect();
    try{
      await c.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
      await c.query("SET LOCAL statement_timeout='500ms'; SET LOCAL lock_timeout='100ms'");
      // Two-key namespace is separate from the bigint locks used by financial operations.
      if(!readOnly&&!(await c.query('SELECT pg_try_advisory_xact_lock(1896941651,1) AS locked')).rows[0].locked)throw Error('Monitoring writer busy');
      const result=await work(c);
      try{await c.query('COMMIT');}catch{throw Object.assign(Error('Monitoring persistence outcome unknown'),{monitorCommitUncertain:true});}
      return result;
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }
  static async read(client?:PoolClient,now=Date.now()):Promise<{observations:SalesObservation[];incidents:SalesIncident[]}>{
    if(!client)return this.transaction(c=>this.read(c,now),true);
    const observations=(await client.query(`SELECT * FROM ${schema}.checkout_observations WHERE observed_at>$1 ORDER BY observed_at DESC,id LIMIT 5000`,[new Date(now-SALES_WINDOW_MS)])).rows.map(observation);
    const incidents=(await client.query(`SELECT * FROM ${schema}.checkout_incidents ORDER BY last_failure_at DESC LIMIT 100`)).rows.map(incident);
    return {observations,incidents};
  }
  static async save(events:SalesObservation[],now=Date.now()):Promise<void>{
    await this.transaction(async c=>{
      const payload=events.map(e=>({id:e.id,observed_at:iso(e.at),service:e.service,stage:e.stage,category:e.category,blocked:e.blocked,phase:e.phase,fresh:e.fresh,cached:e.cached}));
      const added=(await c.query(`INSERT INTO ${schema}.checkout_observations SELECT * FROM jsonb_populate_recordset(NULL::${schema}.checkout_observations,$1::jsonb) ON CONFLICT(id) DO NOTHING RETURNING *`,[JSON.stringify(payload)])).rows.map(observation);
      const state=await this.read(c,now);
      // Read includes newly inserted rows; IDs make retries safe after an uncertain COMMIT.
      const next=advanceSalesIncidents(state.incidents,state.observations,added);
      const before=new Map(state.incidents.map(i=>[i.id,JSON.stringify(i)]));
      for(const row of next){
        if(before.get(row.id)===JSON.stringify(row))continue;
        await c.query(`INSERT INTO ${schema}.checkout_incidents VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT(id) DO UPDATE SET category=EXCLUDED.category,first_failure_at=EXCLUDED.first_failure_at,last_failure_at=EXCLUDED.last_failure_at,affected_attempts=EXCLUDED.affected_attempts,blocked_attempts=EXCLUDED.blocked_attempts,first_recovery_at=EXCLUDED.first_recovery_at,last_recovery_at=EXCLUDED.last_recovery_at,recovered_at=EXCLUDED.recovered_at`,[row.id,row.service,row.stage,row.category,iso(row.firstFailureAt),iso(row.lastFailureAt),row.affectedAttempts,row.blockedAttempts,iso(row.firstRecoveryAt),iso(row.lastRecoveryAt),iso(row.recoveredAt)]);
      }
      // Exact hard bounds, including unresolved incidents; old evidence expires without claiming recovery.
      await c.query(`DELETE FROM ${schema}.checkout_observations WHERE observed_at<$1 OR id IN (SELECT id FROM ${schema}.checkout_observations ORDER BY observed_at DESC,id OFFSET 5000)`,[new Date(now-24*3600_000)]);
      await c.query(`DELETE FROM ${schema}.checkout_incidents WHERE last_failure_at<$1 OR id IN (SELECT id FROM ${schema}.checkout_incidents ORDER BY last_failure_at DESC,id OFFSET 100)`,[new Date(now-90*24*3600_000)]);
    });
  }
}
