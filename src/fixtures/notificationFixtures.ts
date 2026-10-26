/**
 * TEST AND QA FIXTURES ONLY. Never imported by application code (a regression test enforces this).
 *
 * In-memory stand-ins for Codex's future notification, AI-drafting and push-subscription backends, used to
 * exercise the UI before the real contracts exist. Audience names, counts and rules here are invented for
 * testing and are not the server's.
 */
import type { AdminNotificationsClient, NotificationAudience, NotificationSendSummary, NotificationTemplate } from '../services/adminNotifications';
import type { AdminAiDraftingClient } from '../services/adminAiDrafting';
import type { CustomerNotificationsClient, NotificationPreferences } from '../services/customerNotifications';

const zero = { pending: 0, sent: 0, accepted: 0, retrying: 0, failed: 0, invalid:0,skipped:0 };

export function createFixtureNotificationsClient(options: { delayMs?: number; countDrift?: number } = {}) {
  const wait = () => new Promise(resolve => setTimeout(resolve, options.delayMs ?? 0));
  const audiences: NotificationAudience[] = [
    { id: 'all-alerts', label: 'Everyone with alerts on', description: 'Customers who turned on phone alerts.', eligibleCount: 412, marketingConsentOnly: false, allowedCategories: ['service'], consentNote: 'Service notices only. No promotions.' },
    { id: 'recent-buyers', label: 'Bought in the last 30 days', description: 'Customers with a paid order in the last 30 days and alerts on.', eligibleCount: 168, marketingConsentOnly: false, allowedCategories: ['transactional', 'service'], consentNote: 'Order updates and service notices.' },
    { id: 'promo-optin', label: 'Agreed to news and offers', description: 'Customers who opted in to promotional updates.', eligibleCount: 97, marketingConsentOnly: true, allowedCategories: ['marketing', 'service'], consentNote: 'Only people who chose “News and offers”.' },
  ];
  let templates: NotificationTemplate[] = [
    { id: 'tpl-delay-mtn', name: 'MTN delay apology', category: 'transactional', title: 'MTN bundles are slower today', body: 'Sorry, {{first_name}}. MTN is delivering bundles slowly today. Order {{order_reference}} is safe; please don’t pay again.', destination: '/orders', updatedAt: '2026-10-20T10:00:00Z', version: 't1' },
  ];
  const sends: NotificationSendSummary[] = [
    { id: 's2', createdAt: '2026-10-24T18:10:00Z', createdBy: 'founder@example.test', title: 'Short maintenance on Sunday', body: 'Mystery Hub will be unavailable from 1:00 to 1:30 am for maintenance.', category: 'service', audienceLabel: 'Everyone with alerts on', recipients: 405, status: 'completed_with_errors', counts: { ...zero, accepted: 391, failed: 9, retrying: 5 } },
    { id: 's1', createdAt: '2026-10-22T09:00:00Z', createdBy: 'founder@example.test', title: 'New on Mystery Hub: AFA registration', body: 'You can now register for MTN AFA on Mystery Hub. Open the app to try it.', category: 'marketing', audienceLabel: 'Agreed to news and offers', recipients: 88, status: 'completed', counts: { ...zero, accepted: 88 } },
  ];
  const keys = new Map<string, NotificationSendSummary>();
  const calls: string[] = [];
  let drift = options.countDrift ?? 0;
  const client: AdminNotificationsClient & { calls: string[] } = {
    available: true, calls,
    async overview() { await wait(); return { subscribedDevices: 412, marketingConsented: 97, sendsLast7Days: sends.length, failedLast7Days: 9 }; },
    async audiences() { await wait(); return audiences; },
    async countAudience(_t, id) { calls.push(`count ${id}`); await wait(); const base = audiences.find(a => a.id === id)!.eligibleCount!; const d = drift; drift = 0; return base + d; },
    async placeholders() { await wait(); return [{ token: '{{first_name}}', label: 'First name', sample: 'Ama' }, { token: '{{order_reference}}', label: 'Order reference', sample: 'MH-20261025-104233' }, { token: '{{product}}', label: 'Product', sample: 'MTN 5GB' }]; },
    async destinations() { await wait(); return [{ value: '/orders', label: 'My Orders' }, { value: '/data', label: 'Data & Airtime' }, { value: '/wallet', label: 'Wallet' }]; },
    async limits() { return { titleMax: 65, bodyMax: 240 }; },
    async templates() { await wait(); return templates; },
    async saveTemplate(_t, input) {
      await wait();
      const existing = input.id ? templates.find(t => t.id === input.id) : null;
      if (existing && existing.version !== input.expectedVersion) return { ok: false, code: 'version_conflict', message: 'Changed elsewhere.' };
      const saved: NotificationTemplate = { ...input, id: input.id || `tpl-${templates.length + 1}`, updatedAt: new Date().toISOString(), version: `t${Date.now()}` };
      templates = [saved, ...templates.filter(t => t.id !== saved.id)];
      return { ok: true, template: saved };
    },
    async sends(_t, q) { await wait(); return { items: sends.slice((q.page - 1) * q.limit, q.page * q.limit), page: q.page, totalPages: Math.max(1, Math.ceil(sends.length / q.limit)) }; },
    async send(_t, id) {
      await wait(); const s = sends.find(x => x.id === id)!;
      return { ...s, destination: null, errors: s.counts.failed ? [{ code: 'subscription_expired', message: 'The phone’s alert registration has expired.', count: s.counts.failed }] : [] };
    },
    async createSend(_t, input) {
      calls.push(`send ${input.idempotencyKey} ${input.confirmedRecipients}`); await wait();
      const prior = keys.get(input.idempotencyKey);
      if (prior) return { ok: true, send: prior, duplicate: true };
      const audience = audiences.find(a => a.id === input.audienceId)!;
      if (input.confirmedRecipients !== audience.eligibleCount) return { ok: false, code: 'count_changed', message: 'Count changed.' };
      const send: NotificationSendSummary = { id: `s${sends.length + 1}`, createdAt: new Date().toISOString(), createdBy: 'founder@example.test', title: input.title, body: input.body, category: input.category, audienceLabel: audience.label, recipients: input.confirmedRecipients, status: 'queued', counts: { ...zero, pending: input.confirmedRecipients } };
      sends.unshift(send); keys.set(input.idempotencyKey, send);
      return { ok: true, send, duplicate: false };
    },
  };
  return client;
}

export function createFixtureAiDraftingClient(mode: 'ok' | 'down' = 'ok', delayMs = 0): AdminAiDraftingClient {
  return {
    available: true,
    async propose(_t, input, signal) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (mode === 'down') return { ok: false, message: 'AI help is unavailable right now. Your message is unchanged.' };
      if (input.action === 'shorter') return { ok: true, proposals: [{ title: input.title.slice(0, 32).trim(), body: 'Order {{order_reference}} is delayed. Please don’t pay again; we’ll update you soon.' }] };
      return { ok: true, proposals: [
        { title: 'Your order is taking a little longer', body: 'Sorry, {{first_name}}. Order {{order_reference}} is taking longer than usual. Our team is on it; please don’t pay again.' },
        { title: 'Update on order {{order_reference}}', body: 'Hi {{first_name}}, your order is delayed by the network. We’re following up and will let you know as soon as it’s done.' },
      ] };
    },
  };
}

/** A customer backend plus a fake browser push stack, so subscribe/unsubscribe can run end to end. */
export function createFixtureCustomerNotifications(options: { refuseRegister?: boolean; confirm?: boolean } = {}) {
  let prefs: NotificationPreferences = { transactional: true, promotional: false, version: 'p1' };
  const registered = new Set<string>();
  let current: { endpoint: string; toJSON(): unknown; unsubscribe(): Promise<boolean> } | null = null;
  const pushManager = {
    async getSubscription() { return current; },
    async subscribe() { current = { endpoint: 'https://push.example.test/device-1', toJSON: () => ({ endpoint: 'https://push.example.test/device-1', expirationTime: null, keys: { p256dh: 'k', auth: 'a' } }), unsubscribe: async () => { current = null; return true; } }; return current; },
  };
  const env = { navigator: { serviceWorker: { getRegistration: async () => ({ pushManager }) } }, PushManager: class {} };
  const client: CustomerNotificationsClient = {
    available: true,
    async publicKey() { return 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'; },
    async deviceStatus(_t, endpoint) { return { subscribed: options.confirm !== false && registered.has(endpoint) }; },
    async register(_t, sub) { if (options.refuseRegister) return { ok: false, message: 'This phone could not be registered.' }; registered.add(sub.endpoint); return { ok: true, value: undefined }; },
    async unregister(_t, endpoint) { registered.delete(endpoint); return { ok: true, value: undefined }; },
    async preferences() { return prefs; },
    async savePreferences(_t, input) { if (input.expectedVersion !== prefs.version) return { ok: false, message: 'Changed on another device.' }; prefs = { transactional: input.transactional, promotional: input.promotional, version: `p${Number(prefs.version.slice(1)) + 1}` }; return { ok: true, value: prefs }; },
  };
  return { client, env, registered };
}
