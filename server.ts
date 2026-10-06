import { CommercialService } from './server/services/commercialService.js';
import { corsMiddleware } from './server/middleware/cors.js';
import express from 'express';
import { loadApplicationEnvironment } from './server/utils/environment.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGeminiClient } from './server/services/geminiClient.js';
import { apiRouter, handlePaystackWebhook, handleSuccessBizHubWebhook } from './server/routes/api.js';
import { adminRouter } from './server/routes/adminApi.js';
import { initDatabase } from './server/db/connection.js';
import { bootstrapAdminAccount } from './server/services/adminBootstrap.js';
import { buildMysteryAiSystemInstruction } from './server/services/mysteryAiContext.js';
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

// API endpoint for Mystery AI chat
app.post('/api/mystery-ai/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, activePage, history, editorContext } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Sanitize safe editor context (no secrets, no auth tokens, strict schema)
    let sanitizedEditorContext: any = null;
    if (editorContext && editorContext.experienceMode === 'website_editor') {
      sanitizedEditorContext = {
        experienceMode: 'website_editor',
        templateId: typeof editorContext.templateId === 'string' ? editorContext.templateId.slice(0, 50) : '',
        templateName: typeof editorContext.templateName === 'string' ? editorContext.templateName.slice(0, 100) : '',
        siteStatus: editorContext.siteStatus === 'published' ? 'published' : 'draft',
        activeEditorSection: typeof editorContext.activeEditorSection === 'string' ? editorContext.activeEditorSection.slice(0, 50) : 'General',
        previewDevice: ['desktop', 'tablet', 'mobile'].includes(editorContext.previewDevice) ? editorContext.previewDevice : 'mobile',
        hasUnsavedChanges: Boolean(editorContext.hasUnsavedChanges),
      };
    }

    const aiClient = getGeminiClient();

    if (!aiClient) {
      res.json({
        fallback: true,
        reply: null,
        source: 'fallback',
        reason: 'no_api_key',
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    const systemInstruction = buildMysteryAiSystemInstruction(sanitizedEditorContext,(await CommercialService.catalog()).products);
    const pageContext = sanitizedEditorContext
      ? `[Customer is currently in the Website Editor editing "${sanitizedEditorContext.templateName}" in section "${sanitizedEditorContext.activeEditorSection}"]`
      : activePage
      ? `[Customer is currently viewing the "${activePage}" page on Mystery Hub]`
      : '';

    const formattedHistory = Array.isArray(history)
      ? history.slice(-8).map((item: { role: string; content: string }) => ({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }],
        }))
      : [];

    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: `${pageContext}\nCustomer Question: ${message}` }],
      },
    ];

    // Classify query complexity deterministically
    const trimmedMessage = message.trim();
    const wordCount = trimmedMessage.split(/\s+/).filter(Boolean).length;
    const complexTriggers = [
      'rewrite', 're-write', 'compose', 'draft a', 'generate copy', 'headline ideas',
      'recommend a layout', 'structure my', 'compare', 'contrast', 'troubleshoot',
      'why might', 'explain why', 'critique', 'analyse', 'analyze', 'audit',
      'suggest a marketing strategy', 'optimise', 'optimize', 'copywriting',
      'sound premium', 'professional tone', 'persuade'
    ];
    const isComplex = wordCount > 25 || complexTriggers.some((t) => trimmedMessage.toLowerCase().includes(t));
    const routingClass = isComplex ? 'complex' : 'simple';

    // Model sequence and sensible per-model timeouts:
    // Simple query: Flash Lite first (~3500ms), fallback to Flash (~7000ms)
    // Complex query: Flash first (~7000ms), fallback to Flash Lite (~3500ms)
    const candidateModels = isComplex
      ? [
          { name: 'gemini-3.8-flash', timeout: 7000 },
          { name: 'gemini-3.1-flash-lite', timeout: 3500 },
        ]
      : [
          { name: 'gemini-3.1-flash-lite', timeout: 3500 },
          { name: 'gemini-3.8-flash', timeout: 7000 },
        ];

    let textResponse: string | null = null;
    let usedModel: string | null = null;

    for (const { name: modelName, timeout } of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout calling Gemini model ${modelName} after ${timeout}ms`)), timeout)
        );

        const generatePromise = aiClient.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            topP: 0.9,
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (response.text) {
          textResponse = response.text;
          usedModel = modelName;
          break;
        }
      } catch (err) {
        console.warn(`[Mystery AI] Model ${modelName} error or timeout:`, err);
      }
    }

    const latencyMs = Date.now() - startTime;

    if (textResponse) {
      res.json({
        reply: textResponse,
        fallback: false,
        source: 'gemini',
        model: usedModel,
        routingClass,
        latencyMs,
      });
    } else {
      res.json({
        fallback: true,
        reply: null,
        source: 'fallback',
        reason: 'model_unavailable',
        routingClass,
        latencyMs,
      });
    }
  } catch (error) {
    console.error('Mystery AI Server Error:', error);
    res.json({
      fallback: true,
      reply: null,
      source: 'fallback',
      reason: 'server_error',
      latencyMs: Date.now() - startTime,
    });
  }
});

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
