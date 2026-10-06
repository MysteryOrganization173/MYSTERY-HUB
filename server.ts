import { corsMiddleware } from './server/middleware/cors.js';
import express from 'express';
import { loadApplicationEnvironment } from './server/utils/environment.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMysteryAiRouter } from './server/routes/mysteryAiApi.js';
import { apiRouter, handlePaystackWebhook, handleSuccessBizHubWebhook } from './server/routes/api.js';
import { adminRouter } from './server/routes/adminApi.js';
import { initDatabase } from './server/db/connection.js';
import { bootstrapAdminAccount } from './server/services/adminBootstrap.js';
import { OrdersStore } from './server/db/ordersStore.js';
import { FulfilmentService } from './server/services/fulfilmentService.js';

loadApplicationEnvironment();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(corsMiddleware);

// Root-level health check endpoint for monitoring & Render checks
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mysteryhub-api',
  });
});

// Paystack Webhook endpoint requires raw body for HMAC signature verification
app.post(
  '/api/webhooks/paystack',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    try {
      if (Buffer.isBuffer(req.body)) {
        (req as unknown as { rawBody: Buffer }).rawBody = req.body;
        req.body = JSON.parse(req.body.toString('utf8'));
      }
    } catch {
      // ignore JSON parse error for raw body capture
    }
    next();
  },
  handlePaystackWebhook
);

// Success Biz Hub Webhook endpoint requires raw body for HMAC SHA256 signature verification
app.post(
  '/api/webhooks/success-biz-hub',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    try {
      if (Buffer.isBuffer(req.body)) {
        (req as unknown as { rawBody: Buffer }).rawBody = req.body;
        req.body = JSON.parse(req.body.toString('utf8'));
      }
    } catch {
      // ignore JSON parse error for raw body capture
    }
    next();
  },
  handleSuccessBizHubWebhook
);

app.use(express.json({ limit: '1mb' }));

// Mount Core Payments & Orders API Router
app.use('/api', apiRouter);

// Mount Protected Admin V1 API Router
app.use('/api/admin', adminRouter);

// Bounded informational AI endpoint (no account or transaction tools).
app.use('/api/mystery-ai', createMysteryAiRouter());

// Setup Vite in development or static serving in production
async function startServer() {
  await initDatabase();
  await bootstrapAdminAccount();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Mystery Hub server running on http://localhost:${PORT}`);
  });

  // Schedule auto-reconciliation of stale pending payment attempts and active supplier orders
  setTimeout(async () => {
    try {
      const stats = await OrdersStore.reconcileStalePendingPayments();
      if (stats.scanned > 0) {
        console.info(`[Auto Reconciler] Initial startup run scanned ${stats.scanned} orders: paid=${stats.verifiedPaidCount}, cancelled=${stats.cancelledCount}, expired=${stats.expiredCount}`);
      }
      const supplierStats = await FulfilmentService.reconcileActiveSupplierOrders();
      if (supplierStats.scanned > 0) {
        console.info(`[Supplier Reconciler] Initial run scanned ${supplierStats.scanned} active orders, updated=${supplierStats.updatedCount}`);
      }
    } catch (err) {
      console.error('[Auto Reconciler] Initial reconciliation run failed:', err);
    }
  }, 10000); // 10 seconds post-startup

  setInterval(async () => {
    try {
      const stats = await OrdersStore.reconcileStalePendingPayments();
      if (stats.scanned > 0) {
        console.info(`[Auto Reconciler] Scheduled run scanned ${stats.scanned} orders: paid=${stats.verifiedPaidCount}, cancelled=${stats.cancelledCount}, expired=${stats.expiredCount}`);
      }
    } catch (err) {
      console.error('[Auto Reconciler] Scheduled reconciliation failed:', err);
    }
  }, 10 * 60 * 1000); // Every 10 minutes

  setInterval(async () => {
    try {
      const supplierStats = await FulfilmentService.reconcileActiveSupplierOrders();
      if (supplierStats.scanned > 0) {
        console.info(`[Supplier Reconciler] Scheduled run scanned ${supplierStats.scanned} active orders, updated=${supplierStats.updatedCount}`);
      }
    } catch (err) {
      console.error('[Supplier Reconciler] Scheduled reconciliation failed:', err);
    }
  }, 3 * 60 * 1000); // Every 3 minutes
}

startServer().catch((err) => {
  console.error('FATAL: Failed to start Mystery Hub server:', err);
  process.exit(1);
});
