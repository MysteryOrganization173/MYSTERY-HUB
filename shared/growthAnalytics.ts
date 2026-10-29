/** Public, bounded analytics vocabulary. Financial outcomes cannot be submitted here. */
export const GROWTH_EVENTS=['page_view','identity','checkout_opened','marketplace_product','marketplace_inquiry','install_action','install_prompt','install_accepted','install_dismissed','installed','standalone_launch'] as const;
export type GrowthEvent=typeof GROWTH_EVENTS[number];
export const GROWTH_PAGES=['home','data','airtime','instant','afa','website','marketplace','earn','wallet','orders','services','app','about','help'] as const;
export type GrowthPage=typeof GROWTH_PAGES[number];
export const GROWTH_SOURCES=['direct','whatsapp','facebook','instagram','google','bing','tiktok','youtube','x','email','referral','other'] as const;
export const GROWTH_MEDIA=['none','message','social','organic','cpc','email','referral','qr','other'] as const;
export interface GrowthMetadata {page:GrowthPage;source?:string;medium?:string;campaign?:string;display?:'web'|'standalone';promptSupport?:'yes'|'no';productId?:string}
export interface GrowthInput {event:GrowthEvent;visitorId:string;sessionId:string;metadata:GrowthMetadata}
export interface GrowthReport {
 range:number;start:string;end:string;generatedAt:string;warnings:string[];
 traffic:null|{views:number;sessions:number;visitors:number;returningVisitors:number;authenticatedUsers:number;firstObserved:string|null;trend:{day:string;views:number;sessions:number}[];pages:{page:string;views:number;visitors:number}[];engagement:{event:string;page:string;count:number}[]};
 adoption:null|{appVisits:number;actions:number;prompts:number;accepted:number;dismissed:number;installed:number;standaloneSessions:number;returningAppBrowsers:number;promptCapableSessions:number};
 campaigns:null|{source:string;medium:string;campaign:string;sessions:number;visitors:number;linkedAccounts:number;registrations:number;buyers:number;paidOrders:number;salesMinor:number;conversion:number|null}[];
 business:null|{registrations:number;ordersCreated:number;pendingOrders:number;awaitingFulfilment:number;failedOrders:number;paidOrders:number;paidBuyers:number;grossPaidMinor:number;deliveredOrders:number;deliveredSalesMinor:number;verifiedRefunds:number;verifiedRefundMinor:number;refundPending:number;unverifiedRefundFlags:number;recordedSupplierCostMinor:number|null;costCoverage:number;operatorRecorded:number;complimentary:number;services:{service:string;paidOrders:number;salesMinor:number}[]};
 builder:null|{starts:number;previews:number;created:number;publishedNow:number;firstPublished:number;publishedSites:number;ultraEnquiries:number;publicSiteViews:number;publicCheckoutStarts:number};
 referrals:null|{participants:number;referredAccounts:number;paidReferredOrders:number};
 earnings:null|{sellerReleasedMinor:number};
}
export function growthPeriod(range:unknown,now=new Date()) {
 if(range!==undefined&&typeof range!=='string'&&typeof range!=='number')throw Error('Choose 7, 30 or 90 days.');
 const days=Number(range??30);if(![7,30,90].includes(days)||String(range??'30')!==String(days))throw Error('Choose 7, 30 or 90 days.');
 const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(days-1)));
 return {range:days,start:start.toISOString(),end:now.toISOString()}; // Africa/Accra is UTC, no DST.
}
export function campaignSlug(value:unknown):string|null {
 if(typeof value!=='string'||!value||value.length>40||! /^[a-z0-9][a-z0-9_-]*$/i.test(value)||/\d{7}/.test(value))return null;
 return value.toLowerCase();
}
