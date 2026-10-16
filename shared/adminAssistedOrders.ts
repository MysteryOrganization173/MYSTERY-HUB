export type AssistedSource='complimentary'|'admin_external';
export interface AssistedProduct {id:string;name:string;network:'mtn'|'telecel'|'airteltigo';size:string;retailMinor:number;supplierCostMinor:number;offerRef:string;pricingRevision:string}
export interface AssistedQuote {id:string;actorId:string;product:AssistedProduct;source:AssistedSource;customerId:string|null;customerName:string;customerPhone:string;customerEmail:string;recipient:string;reason:string;externalReference:string|null;expiresAt:string;createdAt:string}
export interface AssistedDecision {order_id:string;quote_id:string;actor_id:string;source:AssistedSource;request_id:string;input_hash:string;snapshot:AssistedQuote;created_at:string}
