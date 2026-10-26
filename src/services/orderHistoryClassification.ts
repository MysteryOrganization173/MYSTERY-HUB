import type { SafePublicOrderDetails } from '../../server/types/orders';

/**
 * Historical order classification, owned by Codex: the server decides which old pre-launch records were never paid
 * (for example MH-20261001-858321) and so must not appear to the customer as an urgent delivery failure.
 *
 * Reads only the reviewed backend classification field. No reference, date or status heuristics.
 */
export type HistoricalOrderClass = 'historical_unpaid';
export type HistoricalOrderClassifier = (order: SafePublicOrderDetails) => HistoricalOrderClass | null;

export const historicalOrderClass: HistoricalOrderClassifier = order => order.classification === 'unpaid_attempt' ? 'historical_unpaid' : null;
