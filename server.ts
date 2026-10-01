import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGeminiClient } from './server/services/geminiClient.js';
import { apiRouter, handlePaystackWebhook, handleSuccessBizHubWebhook } from './server/routes/api.js';
import { adminRouter } from './server/routes/adminApi.js';
import { initDatabase } from './server/db/connection.js';
import { bootstrapAdminAccount } from './server/services/adminBootstrap.js';
import { buildMysteryAiSystemInstruction } from './server/services/mysteryAiContext.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed browser origins for production & development
const ALLOWED_ORIGINS = [
  'https://mysteryhub.netlify.app',
  'https://mysterybundlehub.com',
  'https://www.mysterybundlehub.com',
  'https://mystery-hub.onrender.com',
];

const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow server-to-server calls, Paystack webhooks, curl
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Localhost development origins
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  // Cloud Run / AI Studio preview environments
  if (/^https:\/\/ais-(dev|pre)-.*\.run\.app$/.test(origin)) return true;
  return false;
};

// Production CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-paystack-signature, x-webhook-signature, x-sbh-signature'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

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
  try {
    const { message, activePage, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const aiClient = getGeminiClient();

    if (!aiClient) {
      res.json({
        fallback: true,
        reply: null,
        source: 'fallback',
        reason: 'no_api_key',
      });
      return;
    }

    const systemInstruction = buildMysteryAiSystemInstruction();
    const pageContext = activePage
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

    // Try reliable standard Gemini models in sequence
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let textResponse: string | null = null;
    let usedModel: string | null = null;

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout calling Gemini model ${modelName}`)), 7000)
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
        console.warn(`Model ${modelName} returned error:`, err);
      }
    }

    if (textResponse) {
      res.json({
        reply: textResponse,
        fallback: false,
        source: 'gemini',
        model: usedModel,
      });
    } else {
      res.json({
        fallback: true,
        reply: null,
        source: 'fallback',
        reason: 'model_unavailable',
      });
    }
  } catch (error) {
    console.error('Mystery AI Server Error:', error);
    res.json({
      fallback: true,
      reply: null,
      source: 'fallback',
      reason: 'server_error',
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
}

startServer();
