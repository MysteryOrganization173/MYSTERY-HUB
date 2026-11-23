import { isChristmasPhase, type SeasonStatus } from '../../shared/seasonal';

/** What the Data page needs to know about the season: whether a pack applies to this visitor at all. */
export interface DataStoreSeasonInput { shellActive: boolean; status: SeasonStatus }

/** The look the Data page wears on a given day of the season. */
export type DataStoreLook = 'christmas' | 'christmas-day' | 'new-year';
export const dataStoreLook = (status: SeasonStatus): DataStoreLook =>
  status.phase === 'christmas-day' ? 'christmas-day' : isChristmasPhase(status.phase) || status.phase === 'before' ? 'christmas' : 'new-year';

/**
 * Attributes for the Data page's own root while a season applies, for guests and members alike (`shellActive`, the
 * same rule as the shared header and footer, so signing in or out never changes the page's look). The seasonal
 * stylesheet reads only these, scoped to the page, so removing them, or the season ending on 6 January, restores the
 * ordinary Data page exactly. Absent when no season applies.
 */
export function dataStoreSeasonAttributes(season: DataStoreSeasonInput): Record<string, string> {
  if (!season.shellActive || season.status.pack !== 'christmas-2026') return {};
  return { 'data-ds-season': 'christmas', 'data-ds-look': dataStoreLook(season.status), 'data-ds-phase': season.status.phase };
}
