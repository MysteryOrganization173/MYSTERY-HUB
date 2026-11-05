export type ShieldState =
  | 'unavailable' | 'not_covered' | 'waiting' | 'unverifiable' | 'review'
  | 'completed' | 'excluded' | 'eligible' | 'budget_exhausted'
  | 'reserved' | 'submitted' | 'uncertain' | 'delivered' | 'failed';

export interface ShieldView {
  state: ShieldState;
  eligibleAt?: string;
}

export interface ShieldAdminView {
  visible: boolean;
  intakeRequested: boolean;
  fulfillmentRequested: boolean;
  notificationsRequested: boolean;
  storageReady: boolean;
  paused: boolean;
  startsAt: string | null;
  endsAt: string | null;
  totalLimitMinor: number | null;
  dailyLimitMinor: number | null;
  perClaimLimitMinor: number | null;
  reservedMinor: number;
  reservedTodayMinor: number;
  confirmedSpendMinor: number;
  claims: { reference: string; state: ShieldState; reservedMinor: number; createdAt: string }[];
  counts: Partial<Record<ShieldState, number>>;
}
