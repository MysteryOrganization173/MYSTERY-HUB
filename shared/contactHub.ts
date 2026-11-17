export const CONTACT_SEGMENTS=['all','no_purchases','one_time','repeat','recent','at_risk','inactive','high_value','frequent','formerly_active'] as const;
export const CONTACT_SORTS=['last','inactive','first','spending','spending_low','purchases','purchases_low','newest','oldest','name'] as const;
export type ContactPurpose='administrative'|'guest_reference'|'support_notice'|'marketing';
export type ContactSource='registered'|'guest'|'recipient'|'payer'|'directory';
export interface ContactFilters {
 source:'all'|'registered'|'guest'|'recipient'|'payer'; segment:typeof CONTACT_SEGMENTS[number]; sort:typeof CONTACT_SORTS[number]; q:string;
 inactiveDays:number; recentDays:number; page:number; limit:number; status:'all'|'active'|'disabled';
 phone:'all'|'valid'|'missing'|'invalid'; permission:'all'|'unknown'|'suppressed'|'service_notice_review';
 vip:'all'|'repeat'|'frequent'|'high_value'|'formerly_active'; network:string; service:string;
 minPurchases:number|null; maxPurchases:number|null; minSpending:number|null; maxSpending:number|null;
 firstFrom:string; firstTo:string; lastFrom:string; lastTo:string; minDays:number|null; maxDays:number|null;
}
export interface ContactRow {
 id:string; source:ContactSource; provenance:string[]; accountIds:string[]; searchAliases?:string[]; name:string|null; phone:string|null; rawPhone:string|null; email:string|null;
 status:string; registeredAt:string|null; purchases:number; spendingMinor:number; firstAt:string|null; lastAt:string|null;
 daysInactive:number|null; averageMinor:number|null; networks:string[]; services:string[];
 smsPermission:'unknown'|'sms_unsubscribed'; smsRestrictions?:('transactional'|'operational'|'marketing')[]; supportRestricted:boolean; supportReviewEligible:boolean;
 vip:string[]; segment:string; sharedPhoneRecords:number;
}
export interface ContactList {rows:ContactRow[]; total:number; page:number; totalPages:number; summary:{registered:number;buyers:number;oneTime:number;repeat:number;inactive:number;usablePhones:number}; observedAt:string; basis:string[]; quality?:{guestInvalidDeliveries:number;resellerOrdersExcluded:number}}
export interface ContactExportPreview {revision:string; total:number; withPhone:number; uniqueNumbers:number; duplicatesRemoved:number; invalid:number; missing:number; excluded:number; purpose:ContactPurpose; warning:string; maxRecords:number;resellerOrdersExcluded?:number;expiresAt?:string}
export interface ContactDetail {contact:ContactRow; orders:{reference:string;service:string;network:string;amountMinor:number;deliveredAt:string;archived:boolean}[]; historyPage:number;historyTotal:number;warning:string;relationships?:{id:string;source:ContactSource;label:string}[]}
export const DEFAULT_CONTACT_FILTERS:ContactFilters={source:'all',segment:'all',sort:'last',q:'',inactiveDays:30,recentDays:14,page:1,limit:25,status:'all',phone:'all',permission:'all',vip:'all',network:'all',service:'all',minPurchases:null,maxPurchases:null,minSpending:null,maxSpending:null,firstFrom:'',firstTo:'',lastFrom:'',lastTo:'',minDays:null,maxDays:null};
