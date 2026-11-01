/** Finite operational vocabulary. Never put provider messages or customer identifiers here. */
export const SALES_SERVICES=['data','airtime','instant_bundle'] as const;
export const SALES_STAGES=['services','catalog','wallet','beneficiary','application'] as const;
export const SALES_CATEGORIES=['passed','validation','unverified','timeout','authorization','connection','http_error','supplier_response','service_unavailable','wallet_low','configuration','internal_error','application_error'] as const;
export type SalesService=typeof SALES_SERVICES[number];
export type SalesStage=typeof SALES_STAGES[number];
export type SalesCategory=typeof SALES_CATEGORIES[number];
export type SalesState='active'|'recovering'|'recovered'|'insufficient_evidence'|'healthy';
export const SALES_WINDOW_MS=10*60_000;
export const SALES_STALE_MS=15*60_000;
export const SALES_THRESHOLD=3;
export interface SalesObservation {
  id:string; at:number; service:SalesService; stage:SalesStage; category:SalesCategory;
  blocked:boolean; phase:'headers'|'body'|'unknown';
  fresh:Partial<Record<SalesStage,number>>; cached:SalesStage[];
}
export interface SalesIncident {
  id:string; service:SalesService; stage:SalesStage; category:SalesCategory;
  firstFailureAt:number; lastFailureAt:number; affectedAttempts:number; blockedAttempts:number;
  firstRecoveryAt:number|null; lastRecoveryAt:number|null; recoveredAt:number|null;
}
export interface SalesReliabilityView {
  checkedAt:number; state:SalesState; storage:'durable'|'unavailable';
  collector:{pending:number;dropped:number;writeFailed:boolean;lastPersistedAt:number|null;since:number};
  recent:{attempts:number;passed:number;validation:number;unverified:number;failures:number;blocked:number;lastObservedAt:number|null;lastFreshPassAt:number|null;categories:Array<{category:SalesCategory;count:number}>;byService:Array<{service:SalesService;attempts:number;lastFreshPassAt:number|null}>};
  incidents:Array<SalesIncident & {state:SalesState}>;
  externalAlerts:'admin_only';
}
export const salesServiceLabel:Record<SalesService,string>={data:'Data (including storefronts)',airtime:'Airtime',instant_bundle:'Instant Bundles'};
export const salesCategoryLabel:Record<SalesCategory,string>={passed:'Preflight passed',validation:'Customer or package validation',unverified:'Unverified checkout evidence',timeout:'Supplier request timeout',authorization:'Supplier authorization failure',connection:'Supplier connection error',http_error:'Supplier HTTP error / rate limit',supplier_response:'Unsuccessful supplier response',service_unavailable:'Service availability rejected',wallet_low:'Supplier wallet insufficient',configuration:'Supplier configuration missing',internal_error:'Unexpected application exception',application_error:'Checkout server error · cause unconfirmed'};
export const isSalesFailure=(category:SalesCategory)=>!['passed','validation','unverified'].includes(category);
export function incidentState(incident:SalesIncident,now:number):SalesState {
  if(incident.recoveredAt!==null)return 'recovered';
  if(now-(incident.lastRecoveryAt??incident.lastFailureAt)>SALES_STALE_MS)return 'insufficient_evidence';
  return incident.firstRecoveryAt!==null?'recovering':'active';
}
