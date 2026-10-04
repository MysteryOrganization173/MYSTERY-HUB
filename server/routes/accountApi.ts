import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { AccountError, changeAccountPassword, updateAccountProfile, revokeAccountSessions } from '../services/accountSecurity.js';

export const accountRouter = Router();

const securityLimit = createRateLimiter({ windowMs: 15 * 60_000, max: 10, key: req => `account:${req.user!.id}` });
export function accountFailure(res: Response, error: unknown) {
  if (error instanceof AccountError) res.status(error.status).json({ error: error.message, code: error.code });
  else res.status(500).json({ error: 'Could not complete the account action. Please try again.' });
  // Do not log request bodies or database error objects containing credentials/contacts.
}
accountRouter.post('/change-password', requireAuth, securityLimit, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await changeAccountPassword(req.user!.id, req.sessionToken!, req.body ?? {})); }
  catch (error) { accountFailure(res, error); }
});
accountRouter.patch('/profile', requireAuth, securityLimit, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await updateAccountProfile(req.user!.id, req.body ?? {}, { token: req.sessionToken! })); }
  catch (error) { accountFailure(res, error); }
});
accountRouter.post('/logout-all', requireAuth, securityLimit, async (req, res) => {
  try { res.json(await revokeAccountSessions(req.user!.id, { token: req.sessionToken! })); }
  catch (error) { accountFailure(res, error); }
});
