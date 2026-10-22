import { websiteBusinessRouter } from './websiteBusinessApi.js';
import {websiteB1Router} from './websiteB1Api.js';
import { WebsiteInputError } from '../services/websiteValidation.js';
import { websiteMediaRouter, websiteActionsRouter, websiteFreeHandler } from './websiteFreeApi.js';
import { WebsiteAssetStore } from '../db/websiteAssetStore.js';
import { WebsiteAnalyticsStore } from '../db/websiteAnalyticsStore.js';
import { withWebsiteLock } from '../db/websiteTransaction.js';
import { WebsiteOperationError } from '../services/websiteCloudinary.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { resolveWebsitePlan, showWebsiteAttribution } from '../../src/config/websiteBuilder.js';
import { ultraRouter } from './websiteUltraApi.js';
import { WebsiteDeletionService, WebsiteDeletionBlockedError } from '../services/websiteDeletion.js';
/**
 * Website Builder API Routes
 * Endpoints for site creation, editing, live previewing, saving, publishing, and public display.
 */

import { Router, Request, Response } from 'express';
import { WebsiteStore,WebsiteReviewRequiredError } from '../db/websiteStore.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { PublicWebsiteSite, sanitizeString, isValidTemplateId } from '../types/website.js';

export const websiteRouter = Router();
websiteRouter.use("/ultra", ultraRouter);
websiteRouter.use(websiteB1Router);
websiteRouter.use('/:siteId/assets', websiteMediaRouter);
websiteRouter.use(websiteBusinessRouter);
websiteRouter.use(websiteActionsRouter);

/**
 * 1. POST /api/websites
 * Creates a new website project or returns existing site for user (V1 1-site limit)
 */
websiteRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { templateId, name, businessName, starterVersion, content, settings } = req.body || {};

    if (!templateId || typeof templateId !== 'string' || !isValidTemplateId(templateId)) {
      res.status(400).json({ error: 'Valid templateId is required.' });
      return;
    }

    const siteName = sanitizeString(name || 'My Business Website', 128);

    const result = await WebsiteStore.createSite(user.id, {
      template_id: templateId,
      name: siteName,
      businessName,
      starterVersion,
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

    const updated = await withWebsiteLock(user.id, async()=>{
      await WebsiteAssetStore.ownedSite(req.params.id,user.id);
      if(typeof expectedUpdatedAt!=='string' || !expectedUpdatedAt || expectedUpdatedAt.length>40)throw new WebsiteInputError('Reload the website before saving its current draft.');
      return WebsiteStore.updateSite(req.params.id, user.id, {
      name,
      content,
      settings,
      expectedUpdatedAt,
      });
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
    await WebsiteAssetStore.ownedSite(req.params.id,user.id);
    const expectedUpdatedAt=req.body?.expectedUpdatedAt;
    if(typeof expectedUpdatedAt!=='string' || !expectedUpdatedAt || expectedUpdatedAt.length>40)throw new WebsiteInputError('Reload the website and publish its current saved revision.');
    const published = await WebsiteStore.publishSite(req.params.id, user.id, expectedUpdatedAt);

    if (!published) {
      res.status(404).json({ error: 'Website project not found.' });
      return;
    }

    await WebsiteAnalyticsStore.action('website_published', user.id, published.id, published.template_id).catch(()=>console.warn('[Website] Publication analytics unavailable.'));
    res.json({
      success: true,
      site: published,
      publicUrl: `/sites/${published.slug}`,
    });
  } catch (err: any) {
    if(err instanceof WebsiteReviewRequiredError){res.status(err.status).json({error:err.message,code:err.code,review:err.review});return;}
    if(err instanceof WebsiteOperationError){res.status(err.status).json({error:err.message});return;}
    if(err instanceof WebsiteInputError){res.status(400).json({error:err.message});return;}
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
    const unpublished = await WebsiteStore.unpublishSite(req.params.id, user.id, req.body?.expectedUpdatedAt);

    if (!unpublished) {
      res.status(404).json({ error: 'Website project not found.' });
      return;
    }

    await WebsiteAnalyticsStore.action('website_unpublished', user.id, unpublished.id, unpublished.template_id).catch(()=>console.warn('[Website] Unpublish analytics unavailable.'));
    res.json({ success: true, site: unpublished });
  } catch (err: any) {
    if(err instanceof WebsiteOperationError){res.status(err.status).json({error:err.message});return;}
    if(err instanceof WebsiteInputError){res.status(400).json({error:err.message});return;}
    if (err.message && err.message.includes('Forbidden')) {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error('[Website API] Error unpublishing site:', err);
    res.status(500).json({ error: 'Failed to unpublish website.' });
  }
});

/**
 * 7. GET /api/websites/:id/deletion-check
 * Read-only: what deleting would remove and anything that must settle first.
 */
websiteRouter.get('/:id/deletion-check', requireAuth, websiteFreeHandler(async (req, res) => {
  const site = await WebsiteAssetStore.ownedSite(req.params.id, req.user!.id);
  res.set('Cache-Control', 'no-store').json({ success: true, ...await WebsiteDeletionService.check(site) });
}));

/**
 * 8. DELETE /api/websites/:id
 * Deletes (archives) a website after typed confirmation. Releases the Free slot immediately, keeps the
 * address reserved and every order, earning and image record intact. Repeating it succeeds.
 */
websiteRouter.delete('/:id', requireAuth, createRateLimiter({windowMs:60_000,max:5,key:req=>req.user!.id}), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const { site, alreadyDeleted } = await WebsiteDeletionService.archive(req.params.id, userId, req.body?.confirmation);
    if (!alreadyDeleted) await WebsiteAnalyticsStore.action('website_deleted', userId, site.id, site.template_id);
    res.set('Cache-Control', 'no-store').json({ success: true, deleted: true, alreadyDeleted, siteId: site.id, message: 'Website deleted.' });
  } catch (err) {
    if (err instanceof WebsiteDeletionBlockedError) { res.status(409).json({ error: err.message, code: err.code, blockers: err.blockers }); return; }
    if (err instanceof WebsiteOperationError) { res.status(err.status).json({ error: err.message }); return; }
    console.error('[Website API] Error deleting site:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'The website was not deleted. Try again.' });
  }
});

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
      // A deleted website shows a neutral closed page; existing buyers can still track their orders.
      const closed = await WebsiteDeletionService.closedSite(slug);
      res.status(closed ? 410 : 404).set('Cache-Control', 'no-store').json(closed ? { error: 'This website is no longer available.', ...closed } : { error: 'Website not found or not published.' });
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
