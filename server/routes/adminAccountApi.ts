import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { accountFailure } from './accountApi.js';
import { AccountError, resetCustomerPassword, revokeAccountSessions, updateAccountProfile } from '../services/accountSecurity.js';

/** Mounted below the existing adminRouter RBAC middleware. */
export const adminAccountRouter = Router();
const limit = createRateLimiter({ windowMs: 15 * 60_000, max: 5, key: req => `admin-account:${req.user!.id}:${req.params.id}` });
adminAccountRouter.post('/users/:id/reset-password', limit, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.body?.confirm !== true) throw new AccountError(400, 'Confirm the customer password reset.');
    res.json(await resetCustomerPassword(req.user!.id, req.params.id));
  } catch (error) { accountFailure(res, error); }
});
adminAccountRouter.post('/users/:id/revoke-sessions', limit, async (req, res) => {
  try {
    if (req.body?.confirm !== true) throw new AccountError(400, 'Confirm signing out all customer devices.');
    res.json(await revokeAccountSessions(req.params.id, { adminId: req.user!.id }));
  } catch (error) { accountFailure(res, error); }
});
adminAccountRouter.patch('/users/:id/profile', limit, async (req, res) => {
  try { res.json(await updateAccountProfile(req.params.id, req.body ?? {}, { adminId: req.user!.id })); }
  catch (error) { accountFailure(res, error); }
});
