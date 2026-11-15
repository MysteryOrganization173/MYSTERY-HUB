// LOCAL QA ONLY. A simulated push service for a local review server, so nothing ever leaves this machine:
//   NODE_OPTIONS="--require ./scripts/qa/simulatedPushProvider.cjs" QA_PUSH_LOG=/path/push.log npx tsx server.ts
// It replaces web-push's network send. Each payload the server would have handed to a push service is appended to
// QA_PUSH_LOG instead; an endpoint containing "GONE" answers 410 like an unsubscribed browser. Simulated acceptance
// proves the server's logic, never delivery to a phone. It refuses to load unless the database is a disposable
// *_test database on this machine, so it cannot be preloaded into production by mistake.
// The same rules as the server's test-database guard (server/utils/environment.ts): loopback host, a name ending in
// _test, and no connection parameter that could redirect the driver to another host or database.
const localTestDatabase = value => {
  let url; try { url = new URL(value || ''); } catch { return false; }
  return ['postgres:', 'postgresql:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && /^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) && [...url.searchParams.keys()].every(key => ['sslmode', 'connect_timeout', 'application_name'].includes(key));
};
if (!localTestDatabase(process.env.DATABASE_URL)) throw new Error('simulatedPushProvider: refused. Only for a local, disposable *_test database.');
const fs = require('fs');
module.exports = { localTestDatabase };
const webPush = require('web-push');
webPush.sendNotification = async (subscription, payload) => {
  const endpoint = String(subscription?.endpoint || '');
  if (process.env.QA_PUSH_LOG) fs.appendFileSync(process.env.QA_PUSH_LOG, JSON.stringify({ at: new Date().toISOString(), endpointTail: endpoint.slice(-14), payload: JSON.parse(payload) }) + '\n');
  if (endpoint.includes('GONE')) throw Object.assign(new Error('simulated: this browser unsubscribed'), { statusCode: 410 });
  return { statusCode: 201, body: '', headers: {} };
};
// A marker the review script checks before it starts: which live process (the server) has the simulated provider.
// Only the process running server.ts writes it, and it removes its own marker when it exits.
const marker = process.env.QA_PUSH_LOG ? `${process.env.QA_PUSH_LOG}.active` : null;
if (marker && process.argv.some(arg => /server\.ts$/.test(arg))) {
  fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  process.on('exit', () => { try { if (JSON.parse(fs.readFileSync(marker, 'utf8')).pid === process.pid) fs.unlinkSync(marker); } catch {} });
}
console.warn('[QA] Simulated push provider active: no notification leaves this machine.');
