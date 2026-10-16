export type AdminPeriodName='today'|'last7'|'week'|'previous_week'|'month'|'all'|'custom';
export interface AdminPeriod {name:AdminPeriodName;from:string|null;to:string;timezone:'Africa/Accra'}
export type ReportMetric='external_receipts'|'wallet_redemptions'|'completed_sales'|'known_cost'|'unknown_cost'|'customer_refunds';
export interface AdminFinancialReport {
 period:AdminPeriod;externalReceiptsMinor:number;walletRedemptionsMinor:number;completedSalesMinor:number;completedCount:number;
 recordedSupplierCostMinor:number;costKnownSalesMinor:number;completedKnownCostMinor:number;grossMarginMinor:number;
 unknownCostSalesMinor:number;unknownCostCount:number;confirmedRefundsMinor:number;pendingRemedyMinor:number;
 basis:string[];
}
