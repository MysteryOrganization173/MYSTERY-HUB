import { Router } from 'express';
import { serverSeasonStatus } from '../../shared/seasonal.js';

/**
 * Seasonal Experience status. Public and read-only: it says whether the seasonal presentation is switched on for
 * everyone and which calendar phase today is in Accra. The switch is the API service's SEASONAL_EXPERIENCE setting
 * (for example "christmas-2026"); without it the answer is always "off". Nothing here can be changed by a request,
 * and no preview, query parameter or account can turn it on for other visitors.
 */
export const seasonalRouter = Router();

seasonalRouter.get('/status', (_req, res) => {
  // Short public caching: a change of the setting reaches visitors within minutes, and every visitor sees the same answer.
  res.setHeader('Cache-Control', 'public, max-age=300');
  const { active, pack, phase, date, daysToChristmas, daysToNewYear, source } = serverSeasonStatus(process.env.SEASONAL_EXPERIENCE);
  res.json({ active, pack, phase, date, daysToChristmas, daysToNewYear, source });
});
