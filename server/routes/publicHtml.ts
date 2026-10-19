import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { socialHeadEntries, type SocialHead } from '../../src/utils/socialMetadata.js';
import { resolvePublicSocialMetadata, publicMetadataReaders, type PublicMetadataReaders } from '../services/publicSocialMetadata.js';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function injectSocialHead(html: string, head: SocialHead, customerSite = false): string {
  let result = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["'](?:canonical|icon|apple-touch-icon)["'][^>]*>/gi, '');
  // The static platform graph must not claim ownership of a hosted business.
  if (customerSite) result = result.replace(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*rel\s*=\s*["']manifest["'][^>]*>/gi, '');
  const tags = [`<title>${escapeHtml(head.title)}</title>`, ...socialHeadEntries(head).filter(([, , value]) => value).map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`),
    `<link rel="canonical" href="${escapeHtml(head.url)}" />`, `<link rel="icon" href="${escapeHtml(head.icon || 'data:,')}" />`];
  return result.replace(/<\/head>/i, `${tags.join('\n    ')}\n  </head>`);
}

/** People and crawlers get the same HTML. Mount after API/webhook routers.
 * This does not activate routing on Render's separate static frontend; see the release guide.
 */
export function createPublicHtmlRouter(distDirectory: string, readers: PublicMetadataReaders = publicMetadataReaders) {
  const router = express.Router();
  const index = readFileSync(path.join(distDirectory, 'index.html'), 'utf8');
  router.use('/api', (_req, res) => { res.status(404).set('Cache-Control', 'no-store').json({ error: 'API route not found.' }); });
  const staticFiles = express.static(distDirectory, { index: false, redirect: false, dotfiles: 'deny', setHeaders(res, file) {
    res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  } });
  router.use((req, res, next) => req.path === '/index.html' ? next() : staticFiles(req, res, next));
  router.get('*', async (req, res) => {
    res.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff');
    if ((/\.[^/]+$/.test(req.path) && !req.path.endsWith('/index.html')) || req.path.startsWith('/assets/')) {
      res.status(404).type('text').send('Not found'); return;
    }
    try {
      const { head, status, customerSite } = await resolvePublicSocialMetadata(req.originalUrl, readers);
      res.status(status).type('html').send(injectSocialHead(index, head, customerSite));
    } catch {
      // Never serve stale owner/product metadata or leak internal errors/PII in responses or logs.
      res.status(503).set('Retry-After', '30').type('html').send('<!doctype html><html><head><meta name="robots" content="noindex"><title>Page temporarily unavailable</title></head><body>Please try again shortly.</body></html>');
    }
  });
  return router;
}
