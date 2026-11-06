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
/**
 * The visitor a brief comes from. The API runs behind Render's proxy without `trust proxy`, so `req.ip` is the proxy
 * for everyone; the first X-Forwarded-For address separates visitors instead. That header can be forged, which only
 * lets a sender spread their own briefs over several buckets, so a site-wide ceiling below still bounds the total.
 */
export function creativeVisitorKey(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return (/^[0-9a-f:.]{3,45}$/i.test(first) ? first : '') || req.ip || req.socket?.remoteAddress || 'unknown';
}
const perVisitor = createRateLimiter({ windowMs: 600_000, max: 8, message: 'Too many briefs from this connection. Please wait a few minutes or message us on WhatsApp.', key: creativeVisitorKey });
const siteWide = createRateLimiter({ windowMs: 600_000, max: 120, message: 'We are receiving a lot of briefs right now. Please try again in a few minutes or message us on WhatsApp.', key: () => 'creative-studio' });

creativeStudioRouter.post('/enquiries', perVisitor, siteWide, async (req, res) => {
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
  } catch (error) {
    // Only the database error code and constraint, never the brief or the customer's details.
    const { code, constraint } = (error || {}) as { code?: string; constraint?: string };
    console.error('[Creative Studio] Brief could not be saved', { code: code || 'unknown', constraint: constraint || undefined });
    res.status(503).json({ error: 'We could not save your brief just now. Please try again, or message us on WhatsApp.' });
  }
});
