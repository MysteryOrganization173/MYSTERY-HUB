import type { RequestHandler } from 'express';

/**
 * Admission for the public countdown clock (GET /api/experiences/countdown, 3.7.1): a database-free read of the
 * server's time that many visitors may ask for at once on New Year's Eve.
 *
 * Fixed one-minute windows with one number per visitor key, all cleared when the window turns, so memory stays small
 * and no visitor is ever refused because others came first (unlike a store that stops taking new keys when full). Two
 * bounds apply: a budget per visitor network and a ceiling for the whole process. When ingress is unqualified, every
 * visitor shares one key, so that key is held only to the process ceiling. Refusals say when to come back.
 */
export interface ClockAdmissionOptions {
  /** Requests a minute for one visitor network. */
  perVisitor: number;
  /** Requests a minute for the whole process (and for the one shared key of unqualified ingress). */
  total: number;
  /** Distinct visitor keys tracked in one window; beyond it new keys are admitted under the process ceiling only. */
  maxKeys?: number;
  windowMs?: number;
  identify: (req: Parameters<RequestHandler>[0]) => { key: string; established: boolean };
  now?: () => number;
}

export function createClockAdmission({ perVisitor, total, maxKeys = 50_000, windowMs = 60_000, identify, now = Date.now }: ClockAdmissionOptions): RequestHandler {
  let windowStart = now(), all = 0;
  let counts = new Map<string, number>();
  return (req, res, next) => {
    const at = now();
    if (at - windowStart >= windowMs || at < windowStart) { windowStart = at; all = 0; counts = new Map(); }
    const { key, established } = identify(req);
    const used = counts.get(key) ?? 0;
    const bound = established ? perVisitor : total;
    if (all >= total || used >= bound) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((windowStart + windowMs - at) / 1000))))
        .status(429).json({ error: { code: 'RATE_LIMITED' } });
      return;
    }
    all++;
    if (used > 0 || counts.size < maxKeys) counts.set(key, used + 1);
    next();
  };
}
