import { WebsiteInputError } from '../services/websiteValidation.js';
import { websiteMediaRouter, websiteActionsRouter, websiteFreeHandler } from './websiteFreeApi.js';
import { WebsiteAssetStore } from '../db/websiteAssetStore.js';
import { WebsiteAnalyticsStore } from '../db/websiteAnalyticsStore.js';
import { withWebsiteLock } from '../db/websiteTransaction.js';
import { WebsiteOperationError } from '../services/websiteCloudinary.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { resolveWebsitePlan, showWebsiteAttribution } from '../../src/config/websiteBuilder.js';
import { ultraRouter } from './websiteUltraApi.js';
/**
 * Website Builder API Routes
 * Endpoints for site creation, editing, live previewing, saving, publishing, and public display.
 */

import { Router, Request, Response } from 'express';
import { WebsiteStore } from '../db/websiteStore.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { PublicWebsiteSite, sanitizeString, isValidTemplateId } from '../types/website.js';

export const websiteRouter = Router();
websiteRouter.use("/ultra", ultraRouter);
websiteRouter.use('/:siteId/assets', websiteMediaRouter);
websiteRouter.use(websiteActionsRouter);

/**
 * 1. POST /api/websites
 * Creates a new website project or returns existing site for user (V1 1-site limit)
 */
websiteRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { templateId, name, content, settings } = req.body || {};

    if (!templateId || typeof templateId !== 'string' || !isValidTemplateId(templateId)) {
      res.status(400).json({ error: 'Valid templateId is required.' });
      return;
    }

    const siteName = sanitizeString(name || 'My Business Website', 128);

    const result = await WebsiteStore.createSite(user.id, {
      template_id: templateId,
      name: siteName,
      content,
      settings,
    });

    if (!result.alreadyExists) await WebsiteAnalyticsStore.action('website_created', user.id, result.site.id, result.site.template_id);
    res.status(result.alreadyExists ? 200 : 201).json({
      success: true,
      site: result.site,
      alreadyExists: Boolean(result.alreadyExists),
    });
  } catch (err) {
    if (err instanceof WebsiteOperationError) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof WebsiteInputError) { res.status(400).json({ error: err.message }); return; }
    console.error('[Website API] Error creating site:', err);
    res.status(500).json({ error: 'Failed to create website project.' });
  }
});

/**
 * 2. GET /api/websites/mine
 * Retrieves all websites owned by the authenticated user
 */
websiteRouter.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const sites = await WebsiteStore.findSitesByUserId(user.id);
    res.json({ success: true, sites });
  } catch (err) {
    console.error('[Website API] Error fetching user sites:', err);
    res.status(500).json({ error: 'Failed to fetch your websites.' });
  }
});

/**
 * 3. GET /api/websites/:id
 * Retrieves a specific website project with ownership check
 */
websiteRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const site = await WebsiteStore.findSiteById(req.params.id);

    if (!site) {
      res.status(404).json({ error: 'Website project not found.' });
      return;
    }

    if (site.user_id !== user.id) {
      res.status(403).json({ error: 'Forbidden: You do not own this website.' });
      return;
    }

    res.json({ success: true, site });
  } catch (err) {
    console.error('[Website API] Error fetching site by id:', err);
    res.status(500).json({ error: 'Failed to retrieve website project.' });
  }
});

/**
 * 4. PATCH /api/websites/:id
 * Updates site content, settings, or name with ownership check
 */
websiteRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { name, content, settings, expectedUpdatedAt } = req.body || {};
    if (req.body?.templateId !== undefined || req.body?.template_id !== undefined) throw new WebsiteInputError('Use the confirmed Change Template action.');

    const updated = await WebsiteStore.updateSite(req.params.id, user.id, {
      name,
      content,
      settings,
      expectedUpdatedAt,
    });

    if (!updated) {
      res.status(404).json({ error: 'Website project not found.' });
      return;
    }

    res.json({ success: true, site: updated });
  } catch (err: any) {
    if (err instanceof WebsiteOperationError) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof WebsiteInputError) { res.status(400).json({ error: err.message }); return; }
    if (err.message && err.message.includes('Forbidden')) {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error('[Website API] Error updating site:', err);
    res.status(500).json({ error: 'Failed to save website changes.' });
  }
});

/**
 * 5. POST /api/websites/:id/publish
 * Publishes the website and sets public live availability
 */
websiteRouter.post('/:id/publish', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const published = await WebsiteStore.publishSite(req.params.id, user.id);

    if (!published) {
      res.status(404).json({ error: 'Website project not found.' });
      return;
    }

    await WebsiteAnalyticsStore.action('website_published', user.id, published.id, published.template_id);
    res.json({
      success: true,
      site: published,
      publicUrl: `/sites/${published.slug}`,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Forbidden')) {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error('[Website API] Error publishing site:', err);
    res.status(500).json({ error: 'Failed to publish website.' });
  }
});

/**
 * 6. POST /api/websites/:id/unpublish
 * Unpublishes the website (returns status to draft)
 */
websiteRouter.post('/:id/unpublish', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const unpublished = await WebsiteStore.unpublishSite(req.params.id, user.id);

    if (!unpublished) {
      res.status(404).json({ error: 'Website project not found.' });
      return;
    }

    await WebsiteAnalyticsStore.action('website_unpublished', user.id, unpublished.id, unpublished.template_id);
    res.json({ success: true, site: unpublished });
  } catch (err: any) {
    if (err.message && err.message.includes('Forbidden')) {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error('[Website API] Error unpublishing site:', err);
    res.status(500).json({ error: 'Failed to unpublish website.' });
  }
});

/**
 * 7. DELETE /api/websites/:id
 * Permanently deletes a website project with ownership check.
 * Releases the 1-site free limit immediately.
 */
websiteRouter.delete('/:id', requireAuth, createRateLimiter({windowMs:60_000,max:5,key:req=>req.user!.id}), websiteFreeHandler(async (req, res) => {
  const userId = req.user!.id;
  const { site, assetIds } = await withWebsiteLock(userId, async () => {
    const site = await WebsiteAssetStore.ownedSite(req.params.id, userId);
    if (typeof req.body?.confirmation !== 'string' || ![site.name, site.slug].includes(req.body.confirmation)) throw new WebsiteOperationError('Type the website name or slug to confirm deletion.');
    const assetIds = (await WebsiteAssetStore.forSite(site.id)).map(asset => asset.id);
    await WebsiteStore.deleteSite(site.id, userId);
    return { site, assetIds };
  });
  // Database commit precedes remote destruction. Failed provider cleanup keeps durable tombstones.
  const cleanup = await Promise.all(assetIds.map(id => WebsiteAssetStore.cleanup(id)));
  await WebsiteAnalyticsStore.action('website_deleted', userId, site.id, site.template_id);
  res.json({success:true,message:'Website deleted successfully.',cleanupPending:cleanup.some(success=>!success)});
}));

/**
 * 7. GET /api/public/sites/:slug
 * Public endpoint to fetch a published website by its slug.
 * Returns safe public data only (no user_id, no email, no internal metadata).
 */
export async function handlePublicSiteBySlug(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    if (!slug) {
      res.status(400).json({ error: 'Slug is required.' });
      return;
    }

    const site = await WebsiteStore.findPublishedSiteBySlug(slug);

    if (!site) {
      res.status(404).json({ error: 'Website not found or not published.' });
      return;
    }

    const publicData: PublicWebsiteSite = {
      showAttribution: showWebsiteAttribution(resolveWebsitePlan(site.user_id)),
      id: site.id,
      template_id: site.template_id,
      name: site.name,
      slug: site.slug,
      content: site.content_json,
      settings: site.settings_json,
      published_at: site.published_at,
    };

    res.json({ success: true, site: publicData });
  } catch (err) {
    console.error('[Website API] Error fetching public site:', err);
    res.status(500).json({ error: 'Failed to load website.' });
  }
}
