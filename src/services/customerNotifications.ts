/** Reviewed backend HTTP integration. Pending clients remain injectable offline fallbacks only; production uses the live adapters below. */
export interface DeviceSubscriptionStatus { subscribed: boolean }

export interface NotificationPreferences {
  /** Order, payment and account updates. */
  transactional: boolean;
  /** News and offers: separate, explicit consent, off unless the customer turns it on. */
  promotional: boolean;
  version: string;
}

export type ClientResult<T = undefined> = { ok: true; value: T } | { ok: false; message: string };

export interface PushSubscriptionPayload { endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string } }

export interface CustomerNotificationsClient {
  configuration?():Promise<{enabled:boolean;publicKey:string|null;workerPath:string}>;
  readonly available: boolean;
  /** The server's public application key used to register this device (base64url). */
  publicKey(token: string): Promise<string>;
  /** Whether the server holds an active subscription for this device's endpoint. */
  deviceStatus(token: string, endpoint: string): Promise<DeviceSubscriptionStatus>;
  register(token: string, subscription: PushSubscriptionPayload): Promise<ClientResult>;
  unregister(token: string, endpoint: string): Promise<ClientResult>;
  preferences(token: string): Promise<NotificationPreferences>;
  savePreferences(token: string, input: { transactional: boolean; promotional: boolean; expectedVersion: string }): Promise<ClientResult<NotificationPreferences>>;
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
const preferences=(p:any):NotificationPreferences=>{if(typeof p.transactional!=='boolean'||typeof p.marketing!=='boolean')throw Error('Invalid notification preferences. Refresh before changing them.');return {transactional:p.transactional,promotional:p.marketing,version:''};}; // Atomic last-write-wins PUTs, not versioned templates.
export const httpCustomerNotificationsClient:CustomerNotificationsClient={
 available:true,
 configuration:()=>notificationHttp(null,'notifications/config'),
 async publicKey(){const c=await this.configuration!();if(!c.enabled||!c.publicKey)throw Error('Real phone alerts are disabled pending verified push configuration. Your notification choices remain available.');return c.publicKey;},
 async deviceStatus(token,endpoint){const hash=await endpointHash(endpoint);const {devices}=await request(token,'subscriptions');return {subscribed:devices.some((d:any)=>d.endpoint_hash===hash&&d.current_session===true)};},
 async register(token,subscription){try{const r=await request(token,'subscriptions','PUT',{subscription});if(r.success!==true||!r.deviceId)throw Error('Device registration was not confirmed.');return {ok:true,value:undefined};}catch(e){return {ok:false,message:(e as Error).message};}},
 async unregister(token,endpoint){try{const hash=await endpointHash(endpoint);const {devices}=await request(token,'subscriptions');for(const d of devices.filter((d:any)=>d.endpoint_hash===hash)){await request(token,'subscriptions/'+encodeURIComponent(d.id),'DELETE');}return {ok:true,value:undefined};}catch(e){return {ok:false,message:(e as Error).message};}},
 async preferences(token){return preferences(await request(token,'preferences'));},
 async savePreferences(token,input){try{const p=await request(token,'preferences','PUT',{transactional:input.transactional,marketing:input.promotional});return {ok:true,value:preferences(p)};}catch(e){return {ok:false,message:(e as Error).message};}}
};
export async function readNotificationInbox(token:string,id:string,signal?:AbortSignal){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Invalid notification link.');
 const result=await notificationHttp(token,'notifications/inbox/'+encodeURIComponent(id),'GET',undefined,signal);
 if(!result.notification||!['/orders','/app'].includes(result.notification.destination))throw Error('Invalid notification destination.');
 return result.notification as {title:string;body:string;destination:'/orders'|'/app'};
}
