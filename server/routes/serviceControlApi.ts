import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { FinanceError } from '../db/financeStore.js';
import { ServiceControlService } from '../services/serviceControlService.js';

/**
 * Mystery Hub 3.6.3 Release B · Service Control Center routes.
 * Public: GET /api/service-status, customer words only, briefly cacheable (the server also caches for 15 s).
 * Admin (mounted under the Admin router, which requires an administrator session): read, change a service's
 * operating state, and manage announcements. Every write is validated, version-checked and audited on the server;
 * the browser is never trusted for any of it.
 */
export const serviceStatusRouter = Router();
serviceStatusRouter.get('/', createRateLimiter({ windowMs: 60_000, max: 120 }), async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(await ServiceControlService.publicStatus());
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Service status is temporarily unavailable.' });
  }
});

const handle = (fn: (req: any) => Promise<unknown>) => async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await fn(req)); }
  catch (e) { res.status(e instanceof FinanceError ? e.status : 503).json({ error: e instanceof FinanceError ? e.message : 'The Service Control Center is temporarily unavailable. Nothing was changed.' }); }
};
export const adminServiceControlRouter = Router();
adminServiceControlRouter.get('/', handle(() => ServiceControlService.admin()));
adminServiceControlRouter.post('/control', createRateLimiter({ windowMs: 60_000, max: 20 }), handle((req) => ServiceControlService.saveControl(req.user.id, req.body)));
adminServiceControlRouter.post('/announcement', createRateLimiter({ windowMs: 60_000, max: 30 }), handle((req) => ServiceControlService.saveAnnouncement(req.user.id, req.body)));
