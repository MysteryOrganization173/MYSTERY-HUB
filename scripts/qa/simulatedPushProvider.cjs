// LOCAL QA ONLY. A simulated push service for a local review server, so nothing ever leaves this machine:
//   NODE_OPTIONS="--require ./scripts/qa/simulatedPushProvider.cjs" QA_PUSH_LOG=/path/push.log npx tsx server.ts
// It replaces web-push's network send. Each payload the server would have handed to a push service is appended to
// QA_PUSH_LOG instead; an endpoint containing "GONE" answers 410 like an unsubscribed browser. Simulated acceptance
// proves the server's logic, never delivery to a phone. It refuses to load unless the database is a disposable
// *_test database on this machine, so it cannot be preloaded into production by mistake.
const url = (() => { try { return new URL(process.env.DATABASE_URL || ''); } catch { return null; } })();
if (!url || !['127.0.0.1', 'localhost'].includes(url.hostname) || !/_test$/.test(url.pathname)) {
  throw new Error('simulatedPushProvider: refused. Only for a local, disposable *_test database.');
}
const fs = require('fs');
const webPush = require('web-push');
webPush.sendNotification = async (subscription, payload) => {
  const endpoint = String(subscription?.endpoint || '');
  if (process.env.QA_PUSH_LOG) fs.appendFileSync(process.env.QA_PUSH_LOG, JSON.stringify({ at: new Date().toISOString(), endpointTail: endpoint.slice(-14), payload: JSON.parse(payload) }) + '\n');
  if (endpoint.includes('GONE')) throw Object.assign(new Error('simulated: this browser unsubscribed'), { statusCode: 410 });
  return { statusCode: 201, body: '', headers: {} };
};
console.warn('[QA] Simulated push provider active: no notification leaves this machine.');
