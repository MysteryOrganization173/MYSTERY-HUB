/** Backend contract v1. Provider acceptance is not evidence of device display or viewing. */
export type NotificationCategory='transactional'|'marketing';
export type NotificationKind='payment_confirmed'|'order_processing'|'order_delivered'|'delivery_attention'|'refund_update'|'maintenance'|'new_service'|'special_offer';
export interface NotificationTemplate {id:string;title:string;body:string;category:NotificationCategory;enabled:boolean;version:number;locked:boolean}
export interface NotificationPreferences {transactional:boolean;marketing:boolean;marketingOptedOut?:boolean}
export type NotificationPurpose='transactional'|'marketing';
/** One explicit first-party choice, recorded per purpose with the version of the words the person saw. */
export interface NotificationConsentInput {purposes:NotificationPurpose[];copyVersion:string}
export interface SubscriptionInput {endpoint:string;expirationTime?:number|null;keys:{p256dh:string;auth:string}}
export interface NotificationConfig {enabled:boolean;publicKey:string|null;workerPath:'/push-sw.js';guests?:boolean;paused?:boolean}
export type NotificationDeliveryState='queued'|'retry'|'provider_accepted'|'invalid'|'failed'|'skipped';
export const NOTIFICATION_PLACEHOLDERS=['appName','eventLabel'] as const;
export interface NotificationSubscriptionRequest {subscription:SubscriptionInput;consent?:NotificationConsentInput}
export interface NotificationDevice {id:string;created_at:string;updated_at:string;current_session:boolean}
/** Where an announcement may open. Fixed list: no arbitrary URLs ever reach a phone or the inbox. */
export const ANNOUNCEMENT_DESTINATIONS=['/','/data','/services','/marketplace','/earn'] as const;
export type AnnouncementDestination=typeof ANNOUNCEMENT_DESTINATIONS[number];
export type NotificationAudienceKind='members'|'guests'|'everyone';
/** `destination` says what it is (an order update or news); `opens` is the approved page an announcement opens. */
export interface NotificationInboxItem {id:string;createdAt:string;title:string;body:string;destination:'/orders'|'/app';opens?:AnnouncementDestination}
export interface NotificationAudienceRequest {templateId:string;userId?:string;audience?:NotificationAudienceKind;destination?:AnnouncementDestination}
/** Devices are counted separately from people: one customer may have several phones; a guest browser is one device. */
export interface NotificationAudiencePreview {success:true;previewId:string;audience:NotificationAudienceKind;destination:AnnouncementDestination;eligibleDevices:number;eligibleCustomers:number;eligibleCustomerDevices:number;eligibleGuests:number;expiresInSeconds:600;enabled:boolean}
/** The operator's own test: only their own signed-in devices. A plain test uses the private account path. */
export interface NotificationTestRequest {requestId:string;templateId?:string;destination?:AnnouncementDestination}
export interface NotificationTestResult {success:true;eventId:string;devices:number;duplicate:boolean}
export type NotificationHistoryKind='announcement'|'test'|'order';
/** One row per announcement, test or order update, with the push service's answers per device. Never endpoints. */
export interface NotificationHistoryItem {id:string;kind:NotificationHistoryKind;createdAt:string;actorId:string|null;title:string;body:string;
 audience:NotificationAudienceKind|'self'|'account';singleCustomer:boolean;destination:string|null;orderId:string|null;targeted:number;
 states:Partial<Record<NotificationDeliveryState,number>>;waiting:boolean;openedAt:string|null}
export interface NotificationCampaignRequest {previewId:string;requestId:string;confirmed:true}
export interface NotificationCampaignResult {success:true;campaignId:string;eligibleDevices:number;duplicate:boolean}
export type NotificationDraftMode='shorten'|'clarify'|'grammar'|'professional'|'friendly'|'titles'|'variation';
export interface NotificationDraftRequest {mode:NotificationDraftMode;templateId:NotificationKind}
export interface NotificationDraftResult {success:true;draft:{title:string;body:string};source:'gemini';basedOn:'server-approved generic template';requiresReview:true;sent:false}
