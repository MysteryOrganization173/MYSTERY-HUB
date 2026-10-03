import { Router } from 'express';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { WebsiteUltraStore, type UltraEnquiryRecord } from '../db/websiteUltraStore.js';
import { WebsiteInputError } from '../services/websiteValidation.js';
import { BUSINESS_CONFIG } from '../../src/config/business.js';
export function ultraWhatsAppUrl(record: UltraEnquiryRecord): string {
  const message = `Ultra enquiry ${record.reference}: ${record.brief.businessName} (${record.brief.businessType}), ${record.brief.estimatedPages} pages. ${record.brief.featuresRequirements.slice(0, 240)}`;
  return `${BUSINESS_CONFIG.contact.supportWhatsAppUrl}?text=${encodeURIComponent(message)}`;
}
export const ultraRouter = Router();
const limiter = createRateLimiter({ windowMs: 600_000, max: 10, key: req => req.ip || req.socket.remoteAddress || 'unknown' });
// Guests are welcome. An invalid supplied session must not silently become an anonymous lead.
ultraRouter.post('/enquiries', limiter, optionalAuth, async (req, res) => {
  if (req.headers.authorization && !req.user) { res.status(401).json({ error: 'Please sign in again or submit without a session.' }); return; }
  try {
    const record = await WebsiteUltraStore.create(req.body, req.user?.id);
    res.status(201).json({ success: true, reference: record.reference, whatsappUrl: ultraWhatsAppUrl(record) });
  } catch (error) {
    if (error instanceof WebsiteInputError) { res.status(400).json({ error: error.message }); return; }
    console.error('[Website Ultra] Enquiry persistence failed');
    res.status(503).json({ error: 'Could not save your enquiry. Please try again.' });
  }
});
