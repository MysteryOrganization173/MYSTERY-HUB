import { Router, type RequestHandler } from 'express';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { ShieldStore } from '../db/shieldStore.js';
import { shieldPolicy } from '../services/shieldPolicy.js';
import { ShieldService } from '../services/shieldService.js';

const privateResponse: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
};

export function createShieldRouter(service = new ShieldService(), visible = () => shieldPolicy().visible) {
  const router = Router();
  router.use(privateResponse, (_req, res, next) => {
    if (!visible()) {
      res.sendStatus(404);
      return;
    }
    next();
  }, createRateLimiter({ windowMs: 60_000, max: 60 }), requireAuth);
  const handle = (claim: boolean): RequestHandler => async (req, res) => {
    const reference = String(req.params.reference);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(reference) || req.user?.role !== 'customer') {
      res.sendStatus(404);
      return;
    }
    if (claim && req.body && Object.keys(req.body).length) {
      res.status(400).json({ error: 'The claim uses the original order details.' });
      return;
    }
    try {
      const view = await service.check(reference, req.user.id, claim);
      if (!view) res.sendStatus(404);
      else res.json(view);
    } catch {
      res.status(503).json({ state: 'unavailable' });
    }
  };
  router.get('/:reference', createRateLimiter({ windowMs: 60_000, max: 8, key: req => req.user!.id }), handle(false));
  router.post('/:reference/claim', createRateLimiter({ windowMs: 60_000, max: 4, key: req => req.user!.id }), handle(true));
  return router;
}

export const shieldAdminRouter = Router();
shieldAdminRouter.use(privateResponse, requireAdmin, createRateLimiter({
  windowMs: 60_000, max: 15, key: req => req.user!.id,
}));
shieldAdminRouter.get('/', async (_req, res) => {
  try {
    res.json(await ShieldStore.admin(shieldPolicy()));
  } catch {
    res.status(503).json({ error: 'Shield diagnostics are unavailable.' });
  }
});
shieldAdminRouter.post('/pause', async (req, res) => {
  try {
    if (!await ShieldStore.ready()) {
      res.sendStatus(409);
      return;
    }
    await ShieldStore.pause(req.user!.id);
    res.json({ paused: true });
  } catch {
    res.status(503).json({ error: 'Shield pause could not be confirmed.' });
  }
});
