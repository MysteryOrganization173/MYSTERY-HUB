import { isChristmasPhase, type SeasonStatus } from '../../shared/seasonal';

/** What the Orders page and the receipt need to know about the season: whether a pack applies to this visitor at all. */
export interface OrdersSeasonInput { shellActive: boolean; status: SeasonStatus }

/** The look Orders and the receipt wear on a given day of the season (the Data page's calendar, not a new one). */
export type OrdersLook = 'christmas' | 'christmas-day' | 'new-year';
export const ordersLook = (status: SeasonStatus): OrdersLook =>
  status.phase === 'christmas-day' ? 'christmas-day' : isChristmasPhase(status.phase) || status.phase === 'before' ? 'christmas' : 'new-year';

/**
 * Attributes for the Orders page root and the receipt sheet while a season applies, for guests and members alike
 * (`shellActive`, the shared header and footer rule, so signing in or out never changes the look). The seasonal
 * stylesheet reads only these, so removing them, or the season ending on 6 January, restores the ordinary design
 * exactly. Absent when no season applies.
 */
export function ordersSeasonAttributes(season: OrdersSeasonInput): Record<string, string> {
  if (!season.shellActive || season.status.pack !== 'christmas-2026') return {};
  return { 'data-or-season': 'christmas', 'data-or-look': ordersLook(season.status), 'data-or-phase': season.status.phase };
}
