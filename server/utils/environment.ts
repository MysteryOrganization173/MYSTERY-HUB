import dotenv from 'dotenv';

/** Node's test workers stay tests even when a case exercises production behaviour. */
export function isTestRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'test' || Boolean(env.NODE_TEST_CONTEXT);
}

export function loadApplicationEnvironment(): void {
  // Imported operational scripts must not load the checkout's production .env in tests.
  if (!isTestRuntime()) dotenv.config();
}

export function assertSafeTestDatabase(env: NodeJS.ProcessEnv = process.env): void {
  if (!isTestRuntime(env) || !env.DATABASE_URL) return;
  const deny = () => { throw new Error('[DB] Test database access denied. Use in-memory fixtures, or explicitly opt in to a loopback database whose name ends in _test. External databases are never allowed in tests.'); };
  let url: URL;
  try { url = new URL(env.DATABASE_URL); } catch { return deny(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) return deny();
  // Reserved, non-resolving destination used by existing mocked pg suites only.
  if (url.hostname === 'fixture.invalid' && url.pathname === '/never-contacted') return;
  if (env.MYSTERY_TEST_DATABASE_OPT_IN !== 'true') return deny();
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return deny();
  if (!/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname)) return deny();
  // A connection string must not redirect libpq to another host/database.
  if ([...url.searchParams.keys()].some(key => !['sslmode', 'connect_timeout', 'application_name'].includes(key))) return deny();
}
