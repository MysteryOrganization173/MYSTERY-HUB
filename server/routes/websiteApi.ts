/**
 * Website Builder API Routes
 * Endpoints for site creation, editing, live previewing, saving, publishing, and public display.
 */

import { Router, Request, Response } from 'express';
import { WebsiteStore } from '../db/websiteStore.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { PublicWebsiteSite, sanitizeString, isValidTemplateId } from '../types/website.js';

export const websiteRouter = Router();

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

    res.status(result.alreadyExists ? 200 : 201).json({
      success: true,
      site: result.site,
      alreadyExists: Boolean(result.alreadyExists),
    });
  } catch (err) {
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
    const { name, content, settings } = req.body || {};

    const updated = await WebsiteStore.updateSite(req.params.id, user.id, {
      name,
      content,
      settings,
    });

    if (!updated) {
      res.status(404).json({ error: 'Website project not found.' });
      return;
    }

    res.json({ success: true, site: updated });
  } catch (err: any) {
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
