/** Reviewed backend HTTP integration. Pending clients remain injectable offline fallbacks only; production uses the live adapters below. */

/** Per-recipient delivery states as reported by the server. */
export type NotificationDeliveryState = 'pending' | 'sent' | 'accepted' | 'retrying' | 'failed' | 'invalid' | 'skipped';
export const DELIVERY_STATES: NotificationDeliveryState[] = ['pending', 'sent', 'accepted', 'retrying', 'failed', 'invalid', 'skipped'];

export type NotificationCategory = 'transactional' | 'service' | 'marketing';

export interface NotificationAudience {
  id: string;
  label: string;
  description: string;
  /** The server's current count of devices that may receive this message; null when it cannot say. */
  eligibleCount: number | null;
  /** True when only people who opted in to promotional updates are included. */
  marketingConsentOnly: boolean;
  /** Which message categories the server allows for this audience. */
  allowedCategories: NotificationCategory[];
  /** Plain-language consent rule from the server, shown beside the audience. */
  consentNote: string;
}

export interface NotificationPlaceholder { token: string; label: string; sample: string }
export interface NotificationDestination { value: string; label: string }

export interface NotificationTemplate {
  locked?:boolean;
  enabled?:boolean;
  id: string;
  name: string;
  category: NotificationCategory;
  title: string;
  body: string;
  destination: string | null;
  updatedAt: string | null;
  /** Opaque concurrency token for saving edits. */
  version: string | null;
}

export interface NotificationLimits { titleMax: number; bodyMax: number }

export type NotificationSendStatus = 'queued' | 'sending' | 'completed' | 'completed_with_errors' | 'failed';

export interface NotificationSendSummary {
  id: string;
  createdAt: string;
  createdBy: string | null;
  title: string;
  body: string;
  category: NotificationCategory;
  audienceLabel: string;
  recipients: number;
  status: NotificationSendStatus;
  counts: Record<NotificationDeliveryState, number>;
}

export interface NotificationSendDetail extends NotificationSendSummary {
  destination: string | null;
  errors: Array<{ code: string; message: string; count: number }>;
}

export interface NotificationOverview {
  sendingEnabled?:boolean;
  paused?:boolean;
  savedEvents?:number;
  queuedDeliveries?:number;
  providerAccepted?:number;
  deliveryAttempts?:number;
  worker?:{running:boolean;lastCompletedAt:string|null;lastResult:string|null};
  subscribedDevices: number | null;
  marketingConsented: number | null;
  sendsLast7Days: number | null;
  failedLast7Days: number | null;
}

export interface NotificationSendInput {
  previewId?:string;
  /** Same key for the same draft: the server must treat a repeat as the original send, never a second one. */
  idempotencyKey: string;
  templateId: string | null;
  category: NotificationCategory;
  title: string;
  body: string;
  destination: string | null;
  audienceId: string;
  /** The recipient count the founder confirmed; the server refuses if it no longer matches. */
  confirmedRecipients: number;
}

export type NotificationSendResult =
  | { ok: true; send: NotificationSendSummary; duplicate: boolean }
  | { ok: false; code: 'count_changed' | 'consent' | 'invalid' | 'forbidden' | 'unavailable' | 'error'; message: string };

export type TemplateSaveResult = { ok: true; template: NotificationTemplate } | { ok: false; code: 'version_conflict' | 'invalid' | 'error'; message: string };

export interface AdminNotificationsClient {
  prepareAudience?(token:string,input:{templateId:string;userId?:string}):Promise<{previewId:string;eligibleDevices:number}>;
  readonly available: boolean;
  overview(token: string): Promise<NotificationOverview>;
  audiences(token: string): Promise<NotificationAudience[]>;
  /** Fresh count for one audience, read again right before confirming a send. */
  countAudience(token: string, audienceId: string): Promise<number>;
  placeholders(token: string): Promise<NotificationPlaceholder[]>;
  destinations(token: string): Promise<NotificationDestination[]>;
  limits(token: string): Promise<NotificationLimits>;
  templates(token: string): Promise<NotificationTemplate[]>;
  saveTemplate(token: string, input: Omit<NotificationTemplate, 'id' | 'updatedAt' | 'version'> & { id: string | null; expectedVersion: string | null }): Promise<TemplateSaveResult>;
  sends(token: string, query: { page: number; limit: number }): Promise<{ items: NotificationSendSummary[]; page: number; totalPages: number }>;
  send(token: string, id: string): Promise<NotificationSendDetail>;
  createSend(token: string, input: NotificationSendInput): Promise<NotificationSendResult>;
}

export const NOTIFICATIONS_UNAVAILABLE = 'Sending notifications is waiting for the server. You can draft and preview messages now; nothing can be sent yet.';

const unavailable = (): Promise<never> => Promise.reject(new Error(NOTIFICATIONS_UNAVAILABLE));
export const pendingAdminNotificationsClient: AdminNotificationsClient = {
  available: false,
  overview: unavailable, audiences: unavailable, countAudience: unavailable, placeholders: unavailable,
  destinations: unavailable, limits: unavailable, templates: unavailable, saveTemplate: unavailable,
  sends: unavailable, send: unavailable, createSend: unavailable,
};

import {notificationHttp,NotificationHttpError} from './notificationHttp';
const request=(token:string,path:string,method='GET',body?:unknown)=>notificationHttp(token,'admin/notifications/'+path,method,body);
const names:Record<string,string>={payment_confirmed:'Payment confirmation',order_processing:'Order processing',order_delivered:'Delivery confirmation',delivery_attention:'Delivery needs attention',refund_update:'Refund update',maintenance:'Maintenance',new_service:'New service',special_offer:'Current offers'};
const mapTemplate=(t:any):NotificationTemplate=>({id:t.id,name:names[t.id]||t.title,category:t.category,title:t.title,body:t.body,destination:t.category==='transactional'?'/orders':'/app',updatedAt:t.updated_at,version:String(t.version),locked:!!t.locked,enabled:!!t.enabled});
const counts=()=>({pending:0,sent:0,accepted:0,retrying:0,failed:0,invalid:0,skipped:0});
export function notificationDeliverySummary(d:any):NotificationSendDetail{
 const mapping:Record<string,NotificationDeliveryState>={queued:'pending',retry:'retrying',provider_accepted:'accepted',failed:'failed',invalid:'invalid',skipped:'skipped'};
 const state=mapping[d.state]||'failed',c=counts();c[state]=1;
 return {id:d.id,createdAt:d.created_at,createdBy:null,title:d.template_snapshot?.title||'Account update',body:d.template_snapshot?.body||'Open Mystery Hub for the update.',category:d.template_snapshot?.category||'transactional',audienceLabel:'One account device',recipients:1,status:state==='pending'?'queued':state==='retrying'?'sending':state==='accepted'||state==='skipped'?'completed':'failed',counts:c,destination:d.template_snapshot?.category==='marketing'?'/app':'/orders',errors:(d.history||[]).filter((a:any)=>a.code!=='accepted'&&a.code!=='started').map((a:any)=>({code:a.code,message:`Attempt ${a.attempt}: ${String(a.code).replaceAll('_',' ')}`,count:1}))};
}
export const httpAdminNotificationsClient:AdminNotificationsClient={
 available:true,
 async overview(token){const h=await request(token,'health');return {subscribedDevices:h.devices,marketingConsented:h.marketingConsented??null,sendsLast7Days:h.eventsLast7Days??null,failedLast7Days:h.failedLast7Days??null,sendingEnabled:h.configuration.enabled,paused:h.paused,savedEvents:h.savedEvents,queuedDeliveries:h.pending,providerAccepted:h.providerAccepted,deliveryAttempts:h.deliveryAttempts,worker:h.worker};},
 async audiences(){return [{id:'marketing',label:'Opted-in customers',description:'Active subscribed customers who chose news and offers.',eligibleCount:null,marketingConsentOnly:true,allowedCategories:['marketing'],consentNote:'Explicit marketing opt-in is required, including maintenance and service announcements.'},{id:'customer',label:'One opted-in customer',description:'Choose a customer account ID below; eligibility is checked by the server.',eligibleCount:null,marketingConsentOnly:true,allowedCategories:['marketing'],consentNote:'Selecting a customer never bypasses their marketing preference.'}];},
 async countAudience(){throw Error('Choose a saved marketing template and prepare its audience.');},
 async prepareAudience(token,input){const h=await request(token,'health');if(!h.configuration.enabled||h.paused)throw Error('Real sending is disabled or paused until push configuration and founder-device acceptance are complete. Templates and history are available.');const r=await request(token,'audiences/preview','POST',input);if(r.success!==true||!Number.isInteger(r.eligibleDevices)||!r.previewId)throw Error('Invalid audience preview. Nothing can be sent.');return r;},
 async placeholders(){return [{token:'{{appName}}',label:'Application name',sample:'Mystery Hub'},{token:'{{eventLabel}}',label:'Server event label',sample:'Service announcement'}];},
 async destinations(){return [{value:'/app',label:'Mystery Hub after sign-in'}];},
 async limits(){return {titleMax:80,bodyMax:240};},
 async templates(token){return (await request(token,'templates')).templates.map(mapTemplate);},
 async saveTemplate(token,input){try{if(input.category!=='marketing')throw Error('Automatic order templates are server-owned. Custom templates are marketing only.');if(input.destination&&input.destination!=='/app')throw Error('Announcements open Mystery Hub after authenticated lookup.');
  const id=input.id||'notice_'+crypto.randomUUID().replaceAll('-','_');
  const row=await request(token,'templates'+(input.id?'/'+encodeURIComponent(input.id):''),input.id?'PUT':'POST',{...(input.id?{expectedVersion:Number(input.expectedVersion)}:{id}),title:input.title,body:input.body,category:'marketing',enabled:input.enabled!==false});return {ok:true,template:mapTemplate(row)};
 }catch(e){return {ok:false,code:e instanceof NotificationHttpError&&e.status===409?'version_conflict':'invalid',message:(e as Error).message};}},
 async sends(token,query){const r=await request(token,'deliveries?offset='+((query.page-1)*50));return {items:r.deliveries.map(notificationDeliverySummary),page:query.page,totalPages:Math.max(1,Math.ceil(r.total/50))};},
 async send(token,id){return notificationDeliverySummary((await request(token,'deliveries/'+encodeURIComponent(id))).delivery);},
 async createSend(token,input){try{
  if(input.category!=='marketing'||!input.templateId||!input.previewId)throw Error('Prepare a saved marketing template and confirm its audience first.');
  const t=(await this.templates(token)).find(t=>t.id===input.templateId);if(!t||t.locked||!t.enabled||t.title!==input.title||t.body!==input.body)throw Error('Save and review the exact enabled marketing template before sending.');
  const r=await request(token,'campaigns','POST',{previewId:input.previewId,requestId:input.idempotencyKey,confirmed:true});if(r.success!==true||!r.campaignId||!Number.isInteger(r.eligibleDevices))throw Error('Campaign outcome unconfirmed. Retry only with the same request key.');const c=counts();c.pending=r.eligibleDevices;
  return {ok:true,duplicate:r.duplicate,send:{id:r.campaignId,createdAt:new Date().toISOString(),createdBy:null,title:t.title,body:t.body,category:'marketing',audienceLabel:input.audienceId==='customer'?'One opted-in customer':'Opted-in customers',recipients:r.eligibleDevices,status:'queued',counts:c}};
 }catch(e){const error=e as NotificationHttpError;return {ok:false,code:error.status===409?'count_changed':[401,403].includes(error.status)?'forbidden':error.status===503?'unavailable':'invalid',message:error.message};}}
};
