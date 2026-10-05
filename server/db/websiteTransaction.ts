import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';
import { getPool } from './connection.js';

const context = new AsyncLocalStorage<{ userId: string; client?: PoolClient }>();
const queues = new Map<string, Promise<void>>();
export function websiteDatabase() { return context.getStore()?.client || getPool(); }
export function websiteTransactionClient() { return context.getStore()?.client; }
/** Serializes all website mutations for an owner, including creation, media and moderation.
 * PostgreSQL is authoritative across processes; the queue is only the no-DB test/dev equivalent. */
export async function withWebsiteLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
  if (context.getStore()?.userId === userId) return action();
  const pool = getPool();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`website:${userId}`]);
      const result = await context.run({ userId, client }, action);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const previous = queues.get(userId) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  queues.set(userId, next);
  await previous;
  try { return await context.run({ userId }, action); }
  finally { release(); if (queues.get(userId) === next) queues.delete(userId); }
}
