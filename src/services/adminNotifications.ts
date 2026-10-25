/**
 * Admin Notification Center: the frontend's view of Codex's notification backend (templates, audiences with
 * consent rules, sending and delivery outcomes). Frontend side only.
 *
 * Contract status (checked 2026-10-25 on main, every remote branch and open PRs): Codex has not published the
 * notification routes yet. `pendingAdminNotificationsClient` therefore reports `available: false` and calls
 * nothing; the Admin can draft and preview messages but sending, audiences, saved templates and history say they
 * are waiting for the server. When the contract lands, write an HTTP client that maps the real responses onto
 * these types; the UI does not change. No endpoint is named here because none has been agreed.
 *
 * Delivery wording rule: a push service accepting a message is not proof that anyone saw it. These types have no
 * "delivered", "read" or "seen" state, and the UI must never imply one.
 */

/** Per-recipient delivery states as reported by the server. */
export type NotificationDeliveryState = 'pending' | 'sent' | 'accepted' | 'retrying' | 'failed';
export const DELIVERY_STATES: NotificationDeliveryState[] = ['pending', 'sent', 'accepted', 'retrying', 'failed'];

export type NotificationCategory = 'transactional' | 'service' | 'marketing';

export interface NotificationAudience {
  id: string;
  label: string;
  description: string;
  /** The server's current count of devices that may receive this message; null when it cannot say. */
  eligibleCount: number | null;
  /** True when only people who opted in to promotional updates are included. */
  marketingConsentOnly: boolean;
  /** Which message categories the server allows for this audience. */
  allowedCategories: NotificationCategory[];
  /** Plain-language consent rule from the server, shown beside the audience. */
  consentNote: string;
}

export interface NotificationPlaceholder { token: string; label: string; sample: string }
export interface NotificationDestination { value: string; label: string }

export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  title: string;
  body: string;
  destination: string | null;
  updatedAt: string | null;
  /** Opaque concurrency token for saving edits. */
  version: string | null;
}

export interface NotificationLimits { titleMax: number; bodyMax: number }

export type NotificationSendStatus = 'queued' | 'sending' | 'completed' | 'completed_with_errors' | 'failed';

export interface NotificationSendSummary {
  id: string;
  createdAt: string;
  createdBy: string | null;
  title: string;
  body: string;
  category: NotificationCategory;
  audienceLabel: string;
  recipients: number;
  status: NotificationSendStatus;
  counts: Record<NotificationDeliveryState, number>;
}

export interface NotificationSendDetail extends NotificationSendSummary {
  destination: string | null;
  errors: Array<{ code: string; message: string; count: number }>;
}

export interface NotificationOverview {
  subscribedDevices: number | null;
  marketingConsented: number | null;
  sendsLast7Days: number | null;
  failedLast7Days: number | null;
}

export interface NotificationSendInput {
  /** Same key for the same draft: the server must treat a repeat as the original send, never a second one. */
  idempotencyKey: string;
  templateId: string | null;
  category: NotificationCategory;
  title: string;
  body: string;
  destination: string | null;
  audienceId: string;
  /** The recipient count the founder confirmed; the server refuses if it no longer matches. */
  confirmedRecipients: number;
}

export type NotificationSendResult =
  | { ok: true; send: NotificationSendSummary; duplicate: boolean }
  | { ok: false; code: 'count_changed' | 'consent' | 'invalid' | 'forbidden' | 'unavailable' | 'error'; message: string };

export type TemplateSaveResult = { ok: true; template: NotificationTemplate } | { ok: false; code: 'version_conflict' | 'invalid' | 'error'; message: string };

export interface AdminNotificationsClient {
  readonly available: boolean;
  overview(token: string): Promise<NotificationOverview>;
  audiences(token: string): Promise<NotificationAudience[]>;
  /** Fresh count for one audience, read again right before confirming a send. */
  countAudience(token: string, audienceId: string): Promise<number>;
  placeholders(token: string): Promise<NotificationPlaceholder[]>;
  destinations(token: string): Promise<NotificationDestination[]>;
  limits(token: string): Promise<NotificationLimits>;
  templates(token: string): Promise<NotificationTemplate[]>;
  saveTemplate(token: string, input: Omit<NotificationTemplate, 'id' | 'updatedAt' | 'version'> & { id: string | null; expectedVersion: string | null }): Promise<TemplateSaveResult>;
  sends(token: string, query: { page: number; limit: number }): Promise<{ items: NotificationSendSummary[]; page: number; totalPages: number }>;
  send(token: string, id: string): Promise<NotificationSendDetail>;
  createSend(token: string, input: NotificationSendInput): Promise<NotificationSendResult>;
}

export const NOTIFICATIONS_UNAVAILABLE = 'Sending notifications is waiting for the server. You can draft and preview messages now; nothing can be sent yet.';

const unavailable = (): Promise<never> => Promise.reject(new Error(NOTIFICATIONS_UNAVAILABLE));
export const pendingAdminNotificationsClient: AdminNotificationsClient = {
  available: false,
  overview: unavailable, audiences: unavailable, countAudience: unavailable, placeholders: unavailable,
  destinations: unavailable, limits: unavailable, templates: unavailable, saveTemplate: unavailable,
  sends: unavailable, send: unavailable, createSend: unavailable,
};
