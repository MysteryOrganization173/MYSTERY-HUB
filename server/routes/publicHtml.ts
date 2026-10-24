import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { injectSocialHead } from '../../src/utils/socialHtml.js';
import { resolvePublicSocialMetadata, publicMetadataReaders, type PublicMetadataReaders } from '../services/publicSocialMetadata.js';

export { injectSocialHead };

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
      if (head.noindex) res.set('X-Robots-Tag', 'noindex, nofollow');
      res.status(status).type('html').send(injectSocialHead(index, head, customerSite));
    } catch {
      // Never serve stale owner/product metadata or leak internal errors/PII in responses or logs.
      res.status(503).set('Retry-After', '30').type('html').send('<!doctype html><html><head><meta name="robots" content="noindex"><title>Page temporarily unavailable</title></head><body>Please try again shortly.</body></html>');
    }
  });
  return router;
}
