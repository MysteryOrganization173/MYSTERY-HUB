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
  // Mystery Greetings creator: this server has none yet, so it reports none and both seasonal homepages say "Coming
  // soon". The greetings backend (PR #104, unmerged) sets this path from its own creation gates once its creator route
  // exists; nothing else may open it.
  const greetings = { createPath: null };
  res.json({ active, pack, phase, date, daysToChristmas, daysToNewYear, source, greetings });
});
