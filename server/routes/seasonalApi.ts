import { Router } from 'express';
import { parseSeasonSetting, serverSeasonStatus } from '../../shared/seasonal.js';
import { greetingCreationAvailable, greetingCreationOffered } from '../services/experienceService.js';

/**
 * Seasonal Experience status. Public and read-only: it says whether the seasonal presentation is switched on for
 * everyone and which calendar phase today is in Accra. The switch is the API service's SEASONAL_EXPERIENCE setting
 * (for example "christmas-2026"); without it the answer is always "off". Nothing here can be changed by a request,
 * and no preview, query parameter or account can turn it on for other visitors.
 */
export const seasonalRouter = Router();

seasonalRouter.get('/status', async (_req, res) => {
  try {
  // Short public caching: a change of the setting reaches visitors within minutes, and every visitor sees the same answer.
  // While greetings are switched on, within about a minute, so a storage change (or a brief hiccup) never lingers.
  res.setHeader('Cache-Control', greetingCreationOffered() ? 'public, max-age=60' : 'public, max-age=300');
  const now = new Date();
  const { active, pack, phase, date, daysToChristmas, daysToNewYear, source } = serverSeasonStatus(process.env.SEASONAL_EXPERIENCE, now);
  // 3.6.4: which pack the setting has switched on, even before its first day or after its last, so a page left open on
  // 30 November changes on its own at midnight (an inactive answer is not proof that the season is off); and the
  // server's clock, so a phone whose clock is wrong still changes on the right Accra day. Presentation facts only.
  const scheduledPack = parseSeasonSetting(process.env.SEASONAL_EXPERIENCE);
  // Mystery Greetings creator: reported only while a new greeting would really be accepted: both greeting gates on
  // (MYSTERY_GREETING_LINKS_ENABLED and MYSTERY_GREETINGS_ENABLED), the abuse secret configured, the optional schema
  // installed and retention clean-up not overdue. Until then both seasonal homepages say "Coming soon". Never throws.
  const greetings = { createPath: await greetingCreationAvailable().catch(() => false) ? '/greetings' : null };
  res.json({ active, pack, phase, date, daysToChristmas, daysToNewYear, source, scheduledPack, serverTime: now.toISOString(), greetings });
  } catch {
    res.status(503).set('Cache-Control', 'no-store').json({ error: 'Seasonal status is unavailable.' });
  }
});
