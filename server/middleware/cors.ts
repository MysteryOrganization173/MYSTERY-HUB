import type { RequestHandler } from 'express';

export const ALLOWED_ORIGINS = [
  'https://mysteryhub.netlify.app',
  'https://mysterybundlehub.com',
  'https://www.mysterybundlehub.com',
  'https://mystery-hub.onrender.com',
];

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = origin && (ALLOWED_ORIGINS.includes(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    || /^https:\/\/ais-(dev|pre)-.*\.run\.app$/.test(origin));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-visitor-key, x-paystack-signature, x-webhook-signature, x-sbh-signature');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
};
