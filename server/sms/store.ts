import type {PoolClient} from 'pg';
import {getPool} from '../db/connection.js';
import {FinanceError} from '../db/financeStore.js';
export const SMS='mysteryhub_sms';
export async function smsInstalled(){try{return !!getPool()&&(await getPool()!.query("SELECT CASE WHEN bool_and(to_regclass('mysteryhub_sms.'||name) IS NOT NULL) THEN 'installed' ELSE NULL END AS t FROM unnest(ARRAY['settings','templates','template_versions','consents','previews','campaigns','messages','attempts','delivery_events','consumed_events','guest_events']) name")).rows[0].t!==null;}catch{return false;}}
export async function smsTransaction<T>(fn:(c:PoolClient)=>Promise<T>){if(!await smsInstalled())throw new FinanceError('SMS storage migration is pending. Messaging remains disabled.',503);const c=await getPool()!.connect();try{await c.query('BEGIN');await c.query("SET LOCAL TIME ZONE 'UTC'");await c.query("SET LOCAL statement_timeout='5s'");await c.query("SET LOCAL lock_timeout='1s'");const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
