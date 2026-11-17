export type SmsPurpose='transactional'|'operational'|'marketing';
export type SmsState='draft'|'queued'|'submission_started'|'accepted'|'delivered'|'not_delivered'|'expired'|'prohibited'|'failed'|'uncertain'|'cancelled';
export const SMS_PRESETS=[
 {id:'payment_confirmed',title:'Order Payment Confirmed',purpose:'transactional',locked:true,body:'Mystery Hub: Payment verified for {{network}} {{bundle}} order {{reference}}. Delivery is separate. Track at {{site}}/track-order.'},
 {id:'order_processing',title:'Order Received / Processing',purpose:'transactional',locked:true,body:'Mystery Hub: Supplier acceptance is recorded for order {{reference}}. Track current progress at {{site}}/track-order.'},
 {id:'order_delivered',title:'Order Delivered',purpose:'transactional',locked:true,body:'Mystery Hub: Order {{reference}} is marked delivered by the recorded fulfillment evidence. Need help? {{site}}/help'},
 {id:'delivery_attention',title:'Order Needs Attention',purpose:'transactional',locked:true,body:'Mystery Hub: Order {{reference}} needs investigation. This is not a refund or delivery confirmation. Support: {{site}}/help'},
 {id:'refund_initiated',title:'Refund Processing',purpose:'transactional',locked:true,body:'Mystery Hub: A refund is being processed for order {{reference}}. Completion is not yet confirmed. Support: {{site}}/help'},
 {id:'refund_completed',title:'Refund Evidence Verified',purpose:'transactional',locked:true,body:'Mystery Hub: Completed refund evidence is recorded for order {{reference}}. Contact support if funds are not visible: {{site}}/help'},
 {id:'delay',title:'Delivery Delay / Investigation',purpose:'operational',locked:false,body:'Mystery Hub support: Please visit {{site}}/help for assistance with your order. No delivery time is guaranteed.'},
 {id:'support',title:'Official Support Contact Changed',purpose:'operational',locked:false,body:'Mystery Hub Update: Visit {{site}}/help for our current official support contacts. Thank you for your patience.'},
 {id:'maintenance',title:'Service Maintenance / Outage',purpose:'operational',locked:false,body:'Mystery Hub service notice: Please check {{site}}/help for current verified service information.'},
 {id:'restored',title:'Service Restored',purpose:'operational',locked:false,body:'Mystery Hub service update: Check current availability on {{site}}. Support is available at {{site}}/help.'},
 {id:'channel_notice',title:'Official WhatsApp Channel Announcement',purpose:'operational',locked:false,body:'MYSTERY HUB: We are still active! Our official contact channel has moved. Follow the new WhatsApp Channel for service updates and important announcements: {{channel_url}}'},
 {id:'channel',title:'New Official WhatsApp Channel',purpose:'marketing',locked:false,body:'Mystery Hub announcements: Visit {{site}} for our verified official community channels.'},
 {id:'welcome',title:'Welcome / First Purchase',purpose:'marketing',locked:false,body:'Welcome to Mystery Hub. Explore our current services at {{site}}. Thank you for choosing us.'},
 {id:'return',title:'Customer Return Reminder',purpose:'marketing',locked:false,body:'Hello from Mystery Hub. Explore current services at {{site}} whenever you need them.'},
 {id:'offer',title:'Special Offer / Discount Announcement',purpose:'marketing',locked:false,body:'Check current offers and their terms at {{site}}. Eligibility and availability apply.'},
 {id:'custom',title:'General Custom Message',purpose:'marketing',locked:false,body:'Write your reviewed message here.'}
] as const;
export const SMS_AI_MODES=['grammar','professional','friendly','urgent','shorten','clearer','alternatives','brief','cta','segments'] as const;
