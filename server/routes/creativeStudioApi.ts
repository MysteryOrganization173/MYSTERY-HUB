import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { getPool } from '../db/connection.js';
import { MarketplaceControlStore } from '../db/marketplaceControlStore.js';
import { CREATIVE_INQUIRY_TYPE, CreativeBriefError, creativeLeadMessage, creativeLeadSubject, validateCreativeBrief } from '../../shared/creativeStudio.js';

/**
 * Mystery Creative Studio briefs. Guests are welcome (no account is needed to ask for a quote). A brief is stored as a
 * Marketplace enquiry of type "creative_studio", so it appears in Admin → Marketplace → Enquiries with the existing
 * follow-up workflow. The client's requestId becomes the enquiry id, so a retried submission never makes a second lead.
 * Brief contents are never logged.
 */
export const creativeStudioRouter = Router();
creativeStudioRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const limiter = createRateLimiter({ windowMs: 600_000, max: 8, message: 'Too many briefs from this connection. Please wait a few minutes or message us on WhatsApp.', key: req => req.ip || req.socket.remoteAddress || 'unknown' });

creativeStudioRouter.post('/enquiries', limiter, async (req, res) => {
  let brief;
  try { brief = validateCreativeBrief(req.body); }
  catch (error) {
    if (error instanceof CreativeBriefError) { res.status(400).json({ error: error.message, field: error.field || undefined }); return; }
    res.status(400).json({ error: 'We could not read this brief. Please try again.' }); return;
  }
  // A brief is only acknowledged once it is durably stored; the in-memory store is for local development only.
  if (!getPool() && process.env.NODE_ENV === 'production') { res.status(503).json({ error: 'We could not save your brief just now. Please try again, or message us on WhatsApp.' }); return; }
  try {
    const saved = await MarketplaceControlStore.createInquiry({
      id: `inq_cs_${brief.requestId.replace(/-/g, '')}`,
      productName: creativeLeadSubject(brief),
      customerName: brief.name,
      customerPhone: brief.phone,
      customerEmail: brief.email || undefined,
      inquiryType: CREATIVE_INQUIRY_TYPE,
      message: creativeLeadMessage(brief),
      budget: brief.budget || undefined,
    });
    res.status(saved.duplicate ? 200 : 201).json({ success: true, reference: brief.reference, receivedAt: saved.createdAt, service: brief.service.name });
  } catch {
    console.error('[Creative Studio] Brief could not be saved');
    res.status(503).json({ error: 'We could not save your brief just now. Please try again, or message us on WhatsApp.' });
  }
});
