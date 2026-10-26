/** Backend contract v1. Provider acceptance is not evidence of device display or viewing. */
export type NotificationCategory='transactional'|'marketing';
export type NotificationKind='payment_confirmed'|'order_processing'|'order_delivered'|'delivery_attention'|'refund_update'|'maintenance'|'new_service'|'special_offer';
export interface NotificationTemplate {id:string;title:string;body:string;category:NotificationCategory;enabled:boolean;version:number;locked:boolean}
export interface NotificationPreferences {transactional:boolean;marketing:boolean}
export interface SubscriptionInput {endpoint:string;expirationTime?:number|null;keys:{p256dh:string;auth:string}}
export interface NotificationConfig {enabled:boolean;publicKey:string|null;workerPath:'/push-sw.js'}
export type NotificationDeliveryState='queued'|'retry'|'provider_accepted'|'invalid'|'failed'|'skipped';
export const NOTIFICATION_PLACEHOLDERS=['appName','eventLabel'] as const;
export interface NotificationSubscriptionRequest {subscription:SubscriptionInput}
export interface NotificationDevice {id:string;created_at:string;updated_at:string;current_session:boolean}
export interface NotificationInboxItem {id:string;createdAt:string;title:string;body:string;destination:'/orders'|'/app'}
export interface NotificationAudienceRequest {templateId:string;userId?:string}
export interface NotificationAudiencePreview {success:true;previewId:string;eligibleDevices:number;eligibleCustomers:number;expiresInSeconds:600;enabled:boolean}
export interface NotificationCampaignRequest {previewId:string;requestId:string;confirmed:true}
export interface NotificationCampaignResult {success:true;campaignId:string;eligibleDevices:number;duplicate:boolean}
export type NotificationDraftMode='shorten'|'clarify'|'grammar'|'professional'|'friendly'|'titles'|'variation';
export interface NotificationDraftRequest {mode:NotificationDraftMode;templateId:NotificationKind}
export interface NotificationDraftResult {success:true;draft:{title:string;body:string};source:'gemini';basedOn:'server-approved generic template';requiresReview:true;sent:false}
