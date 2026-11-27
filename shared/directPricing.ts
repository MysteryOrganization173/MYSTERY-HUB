/** Founder-approved expansion against the authenticated iShare standard data catalogue. */
export const AIRTELTIGO_ISHARE_ADDITIONS = [6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 100].map(gb => ({
  id: `at-${gb}gb`,
  dataAmount: `${gb}GB`,
  retailMinor: 450 * gb + 49,
}));

/** Approved launch retail seeds only. Supplier costs are never seeded here. */
export const DIRECT_RETAIL_MINOR: Record<string, number> = {
  'mtn-1gb':549,'mtn-2gb':1049,'mtn-3gb':1499,'mtn-4gb':1949,'mtn-5gb':2399,'mtn-6gb':2849,'mtn-8gb':3699,'mtn-10gb':4499,'mtn-15gb':6699,'mtn-20gb':8899,'mtn-25gb':11099,'mtn-30gb':13299,'mtn-40gb':17699,
  'at-1gb':499,'at-2gb':949,'at-3gb':1399,'at-4gb':1849,'at-5gb':2299,
  ...Object.fromEntries(AIRTELTIGO_ISHARE_ADDITIONS.map(({id,retailMinor}) => [id,retailMinor])),
  'telecel-10gb':4499,'telecel-15gb':6699,'telecel-20gb':8899,'telecel-25gb':11099,'telecel-30gb':12299,'telecel-40gb':16399,'telecel-50gb':20399,'telecel-100gb':39999,
};
export interface CommercialSnapshot {
  regularMinor:number; discountMinor:number; paidMinor:number; pricingRevision:string;
  promotionId:'welcome-v1'|null; promotionRevision:string|null; buyerPhone:string|null;
  supplierCostMinor:number|null; reserveMinor:number|null; normalReserveMinor?:number|null; contributionMinor:number|null;
  /** Campaign sales only (absent on every other and every earlier order): the price before the campaign, and the campaign. */
  standardMinor?:number; priceCampaignId?:string; priceCampaignRevision?:string;
}
