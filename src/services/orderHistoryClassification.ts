import type { SafePublicOrderDetails } from '../../server/types/orders';

/**
 * Historical order classification, owned by Codex: the server decides which old pre-launch records were never paid
 * (for example MH-20261001-858321) and so must not appear to the customer as an urgent delivery failure.
 *
 * Contract status (checked 2026-10-25 on main and every remote branch): no field carries that decision yet, so
 * `historicalOrderClass` returns null for every order and Home behaves exactly as before. When Codex adds the field,
 * read it here and nowhere else. The frontend never guesses this from status or dates.
 */
export type HistoricalOrderClass = 'historical_unpaid';
export type HistoricalOrderClassifier = (order: SafePublicOrderDetails) => HistoricalOrderClass | null;

export const historicalOrderClass: HistoricalOrderClassifier = () => null;
