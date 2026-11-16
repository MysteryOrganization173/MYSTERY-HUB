/** Reviewed backend HTTP integration. Pending clients remain injectable offline fallbacks only; production uses the live adapters below. */
import { ANNOUNCEMENT_DESTINATIONS, type AnnouncementDestination } from '../../shared/notifications';
export interface DeviceSubscriptionStatus { subscribed: boolean }

export interface NotificationPreferences {
  /** Order, payment and account updates. */
  transactional: boolean;
  /** News and offers: separate, explicit consent, off unless the customer turns it on. */
  promotional: boolean;
  /** The customer turned news and offers off before: an invitation must not offer them again. */
  marketingOptedOut?: boolean;
  version: string;
}

/**
 * `opens` is the approved page an announcement opens (news only); order updates open that order (`orderReference`,
 * the account's own order) or Orders. `category` is the kind of message (3.4.1), never a read or delivery state.
 */
export type NotificationCategory = 'orders' | 'announcements' | 'account';
export interface NotificationInboxEntry { id: string; createdAt: string; title: string; body: string; destination: '/orders' | '/app'; opens?: AnnouncementPage; category: NotificationCategory; orderReference?: string }
export type AnnouncementPage = AnnouncementDestination;
const announcementPage = (value: unknown): AnnouncementPage | undefined => ANNOUNCEMENT_DESTINATIONS.includes(value as AnnouncementPage) ? value as AnnouncementPage : undefined;

/** One explicit first-party choice, recorded on the server per purpose with the version of the words shown. */
export interface NotificationConsent { purposes: ('transactional' | 'marketing')[]; copyVersion: string }

export type ClientResult<T = undefined> = { ok: true; value: T } | { ok: false; message: string };

export interface PushSubscriptionPayload { endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string } }

export interface CustomerNotificationsClient {
  configuration?():Promise<{enabled:boolean;publicKey:string|null;workerPath:string;guests?:boolean;paused?:boolean}>;
  /** Signed-in history of this account's notifications (newest first). Not proof that a device displayed them. */
  inbox?(token: string, offset?: number, signal?: AbortSignal): Promise<NotificationInboxEntry[]>;
  readonly available: boolean;
  /** The server's public application key used to register this device (base64url). */
  publicKey(token: string): Promise<string>;
  /** Whether the server holds an active subscription for this device's endpoint. */
  deviceStatus(token: string, endpoint: string): Promise<DeviceSubscriptionStatus>;
  register(token: string, subscription: PushSubscriptionPayload, consent?: NotificationConsent): Promise<ClientResult<{ transactional: boolean; promotional: boolean } | undefined>>;
  unregister(token: string, endpoint: string): Promise<ClientResult>;
  preferences(token: string): Promise<NotificationPreferences>;
  savePreferences(token: string, input: { transactional: boolean; promotional: boolean; expectedVersion: string; source?: 'notification_invitation' }): Promise<ClientResult<NotificationPreferences>>;
}

export const CUSTOMER_NOTIFICATIONS_UNAVAILABLE = 'Mystery Hub is not sending phone notifications yet.';
const unavailable = (): Promise<never> => Promise.reject(new Error(CUSTOMER_NOTIFICATIONS_UNAVAILABLE));
export const pendingCustomerNotificationsClient: CustomerNotificationsClient = {
  available: false,
  publicKey: unavailable, deviceStatus: unavailable, register: unavailable, unregister: unavailable, preferences: unavailable, savePreferences: unavailable,
};

import {notificationHttp} from './notificationHttp';
async function endpointHash(endpoint:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
const request=(token:string,path:string,method='GET',body?:unknown)=>notificationHttp(token,'notifications/'+path,method,body);
const preferences=(p:any):NotificationPreferences=>{if(typeof p.transactional!=='boolean'||typeof p.marketing!=='boolean')throw Error('Invalid notification preferences. Refresh before changing them.');return {transactional:p.transactional,promotional:p.marketing,marketingOptedOut:p.marketingOptedOut===true,version:''};}; // Atomic last-write-wins PUTs, not versioned templates.
export const httpCustomerNotificationsClient:CustomerNotificationsClient={
 available:true,
 configuration:()=>notificationHttp(null,'notifications/config'),
 async publicKey(){const c=await this.configuration!();if(!c.enabled||!c.publicKey)throw Error('Real phone alerts are disabled pending verified push configuration. Your notification choices remain available.');return c.publicKey;},
 async deviceStatus(token,endpoint){const hash=await endpointHash(endpoint);const {devices}=await request(token,'subscriptions');return {subscribed:devices.some((d:any)=>d.endpoint_hash===hash&&d.current_session===true)};},
 async register(token,subscription,consent){try{const r=await request(token,'subscriptions','PUT',consent?{subscription,consent}:{subscription});if(r.success!==true||!r.deviceId)throw Error('Device registration was not confirmed.');
  return {ok:true,value:r.preferences&&typeof r.preferences.transactional==='boolean'&&typeof r.preferences.marketing==='boolean'?{transactional:r.preferences.transactional,promotional:r.preferences.marketing}:undefined};}catch(e){return {ok:false,message:(e as Error).message};}},
 async unregister(token,endpoint){try{const hash=await endpointHash(endpoint);const {devices}=await request(token,'subscriptions');for(const d of devices.filter((d:any)=>d.endpoint_hash===hash)){await request(token,'subscriptions/'+encodeURIComponent(d.id),'DELETE');}return {ok:true,value:undefined};}catch(e){return {ok:false,message:(e as Error).message};}},
 async preferences(token){return preferences(await request(token,'preferences'));},
 async savePreferences(token,input){try{const p=await request(token,'preferences','PUT',{transactional:input.transactional,marketing:input.promotional,...(input.source?{source:input.source}:{})});return {ok:true,value:preferences(p)};}catch(e){return {ok:false,message:(e as Error).message};}},
 async inbox(token,offset=0,signal){const r=await notificationHttp(token,'notifications/inbox?offset='+offset,'GET',undefined,signal);if(r.success!==true||!Array.isArray(r.items))throw Error('Your notifications could not be loaded.');
  return r.items.filter((i:any)=>typeof i?.id==='string'&&typeof i.title==='string'&&typeof i.body==='string'&&['/orders','/app'].includes(i.destination)).map((i:any)=>({id:i.id,createdAt:String(i.createdAt),title:i.title,body:i.body,destination:i.destination,
   category:(['orders','announcements','account'].includes(i.category)?i.category:i.destination==='/orders'?'orders':announcementPage(i.opens)?'announcements':'account') as NotificationCategory,
   ...(i.destination==='/orders'&&typeof i.orderReference==='string'&&/^[A-Za-z0-9_-]{4,64}$/.test(i.orderReference)?{orderReference:i.orderReference}:{}),
   ...(announcementPage(i.opens)?{opens:announcementPage(i.opens)}:{})}));}
};
export async function readNotificationInbox(token:string,id:string,signal?:AbortSignal,open?:string|null){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Invalid notification link.');
 const proof=open&&/^[A-Za-z0-9_-]{43}$/.test(open)?'?open='+encodeURIComponent(open):'';
 const result=await notificationHttp(token,'notifications/inbox/'+encodeURIComponent(id)+proof,'GET',undefined,signal);
 if(!result.notification||!['/orders','/app'].includes(result.notification.destination))throw Error('Invalid notification destination.');
 return {...result.notification,opens:announcementPage(result.notification.opens)} as {title:string;body:string;destination:'/orders'|'/app';opens?:AnnouncementPage};
}

/**
 * Guest news (no account): service news and occasional offers only, after an explicit choice. The browser keeps a
 * random credential from the server and sends it in a header; only its hash is stored. Order updates need an account.
 */
export interface GuestNotificationsClient {
  register(subscription: PushSubscriptionPayload, consent: NotificationConsent): Promise<{ credential: string }>;
  status(credential: string): Promise<{ subscribed: boolean; endpointHash: string | null }>;
  unregister(credential: string): Promise<void>;
}
const guestHeader = (credential: string) => ({ 'X-Guest-Notifications': credential });
export const httpGuestNotificationsClient: GuestNotificationsClient = {
  async register(subscription, consent) {
    const r = await notificationHttp(null, 'notifications/guest', 'PUT', { subscription, consent });
    if (r.success !== true || typeof r.credential !== 'string') throw Error('Notifications were not confirmed for this browser.');
    return { credential: r.credential };
  },
  async status(credential) {
    try { const r = await notificationHttp(null, 'notifications/guest', 'GET', undefined, undefined, guestHeader(credential)); return { subscribed: r.subscribed === true, endpointHash: typeof r.endpointHash === 'string' ? r.endpointHash : null }; }
    catch (error) { if ((error as { status?: number }).status === 404 || (error as { status?: number }).status === 401) return { subscribed: false, endpointHash: null }; throw error; }
  },
  async unregister(credential) { await notificationHttp(null, 'notifications/guest', 'DELETE', undefined, undefined, guestHeader(credential)); },
};
export { endpointHash as pushEndpointHash };
