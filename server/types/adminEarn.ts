export interface EarnPeriod { period: 'today' | '7d' | '30d' | 'all' | 'custom'; start: string | null; end: string | null; timezone: 'UTC'; }
export interface EarnMetrics {
  rawClicks: number; uniqueVisitors: number; referredCustomers: number; lifetimeReferredCustomers: number;
  firstConversions: number; repeatConversions: number; qualifyingOrders: number; convertedCustomers: number;
  paidRevenueMinor: number; deliveredRevenueMinor: number; pendingRewardsMinor: number; approvedRewardsMinor: number;
  reversedRewardsMinor: number; rewardExpenseMinor: number; grossMarginMinor: number; costKnownOrders: number;
}
export interface EarnReferrer extends EarnMetrics {
  userId: string; name: string; email: string | null; phone: string | null; accountStatus: string;
  profileId: string; code: string; enabled: boolean; rank: number; conversionRate: number; signals: string[];
}
export interface EarnOverview { period: EarnPeriod; lifetimeProfiles: number; lifetimeEnabledProfiles: number; metrics: EarnMetrics; }
export interface EarnPage<T> { items: T[]; total: number; page: number; limit: number; }
export interface EarnLedgerRow { id: string; referrerId: string; referrerName: string; orderReference: string | null;
  service: string; stage: string; amountMinor: number; status: string; createdAt: string; approvedAt: string | null; reversedAt: string | null; reason: string; }
export interface EarnCustomerRow { id: string; name: string; email: string | null; phone: string | null; boundAt: string | null;
  firstOrder: string | null; latestOrder: string | null; }
export interface EarnDetail { period: EarnPeriod; referrer: EarnReferrer; customers: EarnPage<EarnCustomerRow>; ledger: EarnPage<EarnLedgerRow>; }
export interface EarnCustomerSummary { code: string; enabled: boolean; uniqueVisitors: number; peopleReferred: number; approvedRewardsMinor: number; }
