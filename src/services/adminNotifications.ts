/** Reviewed backend HTTP integration. Pending clients remain injectable offline fallbacks only; production uses the live adapters below. */

/** Per-recipient delivery states as reported by the server. */
export type NotificationDeliveryState = 'pending' | 'sent' | 'accepted' | 'retrying' | 'failed' | 'invalid' | 'skipped';
export const DELIVERY_STATES: NotificationDeliveryState[] = ['pending', 'sent', 'accepted', 'retrying', 'failed', 'invalid', 'skipped'];

export type NotificationCategory = 'transactional' | 'service' | 'marketing';

export interface NotificationAudience {
  id: string;
  /** Which consenting group the server counts: customers with accounts, guest browsers, or both. */
  kind?: 'members' | 'guests' | 'everyone';
  /** One customer, by account ID (within customers who chose news and offers). */
  single?: boolean;
  /** People, where the server can say; devices are counted separately (one person may have several phones). */
  people?: number | null;
  /** False when the server would refuse this audience right now, with the reason in plain words. */
  available?: boolean;
  unavailableReason?: string;
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

export type NotificationHistoryKind = 'announcement' | 'test' | 'order';

export interface NotificationSendSummary {
  id: string;
  kind?: NotificationHistoryKind;
  /** The operator's own test was opened from its notification on a signed-in device (tests only). */
  openedAt?: string | null;
  /** Order updates saved while sending was paused, not yet sent to any device. */
  waiting?: boolean;
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

export interface NotificationDeviceResult {
  id: string;
  /** A guest browser rather than a customer's signed-in device. Never an endpoint or a person. */
  guest: boolean;
  state: NotificationDeliveryState;
  code: string | null;
  updatedAt: string;
  attempts: Array<{ attempt: number; code: string; startedAt: string; finishedAt: string | null }>;
}

export interface NotificationSendDetail extends NotificationSendSummary {
  destination: string | null;
  errors: Array<{ code: string; message: string; count: number }>;
  devices?: NotificationDeviceResult[];
}

/** Plain-language readiness facts from the server. Never keys, endpoints or people. */
export interface NotificationReadiness {
  keysValid: boolean;
  switchOn: boolean;
  guestNews: boolean;
  liveDevices: number;
  liveAccounts: number;
  signedOutDevices: number;
  announcementCustomers: number;
  announcementDevices: number;
  guestBrowsers: number;
  ownDevices: number;
  waitingEvents: number;
  last7Days: Partial<Record<NotificationDeliveryState, number>>;
  commonProblem: string | null;
  lastTest: { id: string; createdAt: string; openedAt: string | null; states: Partial<Record<NotificationDeliveryState, number>> } | null;
  /** When the viewer last opened a test from its notification (last 30 days): the phone check that allows resuming. */
  phoneCheckedAt: string | null;
}

export interface NotificationOverview {
  sendingEnabled?:boolean;
  paused?:boolean;
  savedEvents?:number;
  queuedDeliveries?:number;
  providerAccepted?:number;
  deliveryAttempts?:number;
  worker?:{running:boolean;lastCompletedAt:string|null;lastErrorAt?:string|null;lastResult:string|null};
  readiness?: NotificationReadiness;
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

export interface AudiencePreview { previewId: string; eligibleDevices: number; eligibleCustomers?: number; eligibleCustomerDevices?: number; eligibleGuests?: number }
export type TestSendResult = { ok: true; devices: number; duplicate: boolean } | { ok: false; message: string };

export interface AdminNotificationsClient {
  prepareAudience?(token:string,input:{templateId:string;userId?:string;audience?:'members'|'guests'|'everyone';destination?:string}):Promise<AudiencePreview>;
  /** Sends a test to the signed-in operator's own devices only. Works while sending is paused. */
  testSelf?(token: string, input: { requestId: string; templateId?: string; destination?: string }): Promise<TestSendResult>;
  /** Pause or resume all customer sending, with a reason for the audit log. */
  setPaused?(token: string, paused: boolean, reason: string): Promise<{ ok: true; paused: boolean } | { ok: false; message: string }>;
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
  sends(token: string, query: { page: number; limit: number; kind?: NotificationHistoryKind; state?: string | null }): Promise<{ items: NotificationSendSummary[]; page: number; totalPages: number }>;
  send(token: string, id: string, kind?: NotificationHistoryKind): Promise<NotificationSendDetail>;
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
import {ANNOUNCEMENT_DESTINATIONS} from '../../shared/notifications';
const request=(token:string,path:string,method='GET',body?:unknown)=>notificationHttp(token,'admin/notifications/'+path,method,body);
const names:Record<string,string>={payment_confirmed:'Payment confirmation',order_processing:'Order processing',order_delivered:'Delivery confirmation',delivery_attention:'Delivery needs attention',refund_update:'Refund update',maintenance:'Maintenance',new_service:'New service',special_offer:'Current offers'};
const mapTemplate=(t:any):NotificationTemplate=>({id:t.id,name:names[t.id]||t.title,category:t.category,title:t.title,body:t.body,destination:t.category==='transactional'?'/orders':'/',updatedAt:t.updated_at,version:String(t.version),locked:!!t.locked,enabled:!!t.enabled});
const counts=()=>({pending:0,sent:0,accepted:0,retrying:0,failed:0,invalid:0,skipped:0});
const STATE:Record<string,NotificationDeliveryState>={queued:'pending',retry:'retrying',provider_accepted:'accepted',failed:'failed',invalid:'invalid',skipped:'skipped'};
const SERVER_STATE:Record<NotificationDeliveryState,string|null>={pending:'queued',sent:null,accepted:'provider_accepted',retrying:'retry',failed:'failed',invalid:'invalid',skipped:'skipped'};
const mapStates=(raw:Record<string,number>|null|undefined)=>{const c=counts();for(const [k,v] of Object.entries(raw||{}))if(STATE[k]&&Number.isInteger(v))c[STATE[k]]+=v;return c;};
/** The approved pages an announcement can open, in the customer's words. */
export const DESTINATION_LABELS:Record<string,string>={'/':'Home','/data':'Data bundles','/services':'All services','/marketplace':'Marketplace','/earn':'Mystery Earn','/orders':'Orders, after sign-in'};
/** What a push-service code means, for the founder. Codes come from the server; nothing here is invented per device. */
export const PROBLEM_LABELS:Record<string,string>={
 endpoint_expired:'The phone or browser is no longer subscribed, so it was removed.',
 subscription_invalid:'The saved subscription could not be used, so it was removed.',
 provider_rejected:'The push service refused this message.',
 retry_exhausted:'The push service did not take it after 5 tries.',
 provider_rate_limit:'The push service asked to slow down; it will be tried again.',
 provider_unavailable:'The push service did not answer; it will be tried again.',
 ineligible:'Not sent: the person signed out or changed their choice, the browser left guest news, or sending was paused.',
 accepted:'Accepted by the push service.',
 started:'Being sent.',
};
const problem=(code:string)=>PROBLEM_LABELS[code]||String(code).replaceAll('_',' ');
const statusOf=(c:Record<NotificationDeliveryState,number>,waiting=false):NotificationSendStatus=>{
 const total=Object.values(c).reduce((a,b)=>a+b,0);
 if(waiting||total===0||c.pending===total)return 'queued';
 if(c.pending||c.retrying)return 'sending';
 const bad=c.failed+c.invalid;
 return bad===0?'completed':c.accepted>0?'completed_with_errors':'failed';
};
const AUDIENCE_LABELS:Record<string,string>={members:'Customers who chose news and offers',guests:'Visitors who chose news',everyone:'Everyone who chose news',self:'Your own devices',account:'The customer concerned'};
export function notificationHistoryItem(i:any):NotificationSendSummary&{destination:string|null}{
 const c=mapStates(i.states),kind=(['announcement','test','order'].includes(i.kind)?i.kind:'order') as NotificationHistoryKind;
 return {id:i.id,kind,createdAt:i.createdAt,createdBy:i.actorId??null,title:i.title,body:i.body,category:kind==='order'||kind==='test'&&i.destination==='/orders'?'transactional':'marketing',
  audienceLabel:i.singleCustomer?'One customer who chose news and offers':AUDIENCE_LABELS[i.audience]||'Customers',recipients:Number(i.targeted)||0,status:statusOf(c,!!i.waiting),counts:c,
  openedAt:i.openedAt??null,waiting:!!i.waiting,destination:i.destination??null};
}
export function notificationDeliverySummary(d:any):NotificationSendDetail{
 const state=STATE[d.state]||'failed',c=counts();c[state]=1;
 return {id:d.id,createdAt:d.created_at,createdBy:null,title:d.template_snapshot?.title||'Account update',body:d.template_snapshot?.body||'Open Mystery Hub for the update.',category:d.template_snapshot?.category||'transactional',audienceLabel:'One account device',recipients:1,status:state==='pending'?'queued':state==='retrying'?'sending':state==='accepted'||state==='skipped'?'completed':'failed',counts:c,destination:d.template_snapshot?.category==='marketing'?'/':'/orders',errors:(d.history||[]).filter((a:any)=>a.code!=='accepted'&&a.code!=='started').map((a:any)=>({code:a.code,message:`Attempt ${a.attempt}: ${problem(a.code)}`,count:1}))};
}
const num=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
export function notificationReadiness(h:any):NotificationReadiness{
 return {keysValid:!!h.configuration?.valid,switchOn:!!h.configuration?.switchOn,guestNews:!!h.configuration?.guestNews,liveDevices:num(h.liveDevices),liveAccounts:num(h.liveAccounts),signedOutDevices:num(h.signedOutDevices),
  announcementCustomers:num(h.announcementCustomers),announcementDevices:num(h.announcementDevices),guestBrowsers:num(h.guestBrowsers),ownDevices:num(h.ownDevices),waitingEvents:num(h.waitingEvents),
  last7Days:Object.fromEntries(Object.entries(mapStates(h.deliveries7Days)).filter(([,v])=>v>0)),commonProblem:h.commonProblem?problem(h.commonProblem):null,
  lastTest:h.lastTest?{id:h.lastTest.id,createdAt:h.lastTest.createdAt,openedAt:h.lastTest.openedAt??null,states:Object.fromEntries(Object.entries(mapStates(h.lastTest.states)).filter(([,v])=>v>0))}:null,
  phoneCheckedAt:h.phoneCheckedAt??null};
}
const failure=(e:unknown)=>e instanceof Error?e.message:'The server did not answer. Nothing was changed.';
// The overview and the audience counts load together; they share one status read while it is in flight. A read
// that has finished is never reused, so a reload right after pause, resume or a send shows the new state.
let healthRead:{token:string;value:Promise<any>}|null=null;
function readHealth(token:string){
 if(healthRead&&healthRead.token===token)return healthRead.value;
 const value=request(token,'health');healthRead={token,value};
 const done=()=>{if(healthRead?.value===value)healthRead=null;};value.then(done,done);return value;
}
export const httpAdminNotificationsClient:AdminNotificationsClient={
 available:true,
 async overview(token){const h=await readHealth(token);return {subscribedDevices:h.devices,marketingConsented:h.marketingConsented??null,sendsLast7Days:h.eventsLast7Days??null,failedLast7Days:h.failedLast7Days??null,sendingEnabled:h.configuration.enabled,paused:h.paused,savedEvents:h.savedEvents,queuedDeliveries:h.pending,providerAccepted:h.providerAccepted,deliveryAttempts:h.deliveryAttempts,worker:h.worker,readiness:notificationReadiness(h)};},
 async audiences(token){const h=await readHealth(token);const r=notificationReadiness(h);const off='Guest news is off (WEB_PUSH_GUEST_NEWS), so visitors without an account cannot receive announcements.';
  return [
   {id:'marketing',kind:'members',label:'Customers who chose news and offers',description:'Signed-in customers who turned on news and offers. Each of their registered devices receives it.',eligibleCount:r.announcementDevices,people:r.announcementCustomers,available:true,marketingConsentOnly:true,allowedCategories:['marketing'],consentNote:'Only customers who chose news and offers. Order-update permission is never enough.'},
   {id:'guests',kind:'guests',label:'Visitors who chose news',description:'Browsers without an account that turned on news and offers.',eligibleCount:r.guestBrowsers,people:null,available:r.guestNews,unavailableReason:r.guestNews?undefined:off,marketingConsentOnly:true,allowedCategories:['marketing'],consentNote:'Only browsers that chose news. Each browser counts once.'},
   {id:'everyone',kind:'everyone',label:'Everyone who chose news',description:'Customers who chose news and offers, plus visitor browsers that chose news.',eligibleCount:r.announcementDevices+r.guestBrowsers,people:null,available:r.guestNews,unavailableReason:r.guestNews?undefined:off,marketingConsentOnly:true,allowedCategories:['marketing'],consentNote:'Consent only, from both groups. A browser that is also signed in is counted once.'},
   {id:'customer',kind:'members',single:true,label:'One customer who chose news and offers',description:'Enter the customer account ID from Customers; the server checks their choice.',eligibleCount:null,people:null,available:true,marketingConsentOnly:true,allowedCategories:['marketing'],consentNote:'Choosing a customer never bypasses their news-and-offers choice.'},
  ];},
 async countAudience(){throw Error('Choose a saved marketing template and prepare its audience.');},
 async prepareAudience(token,input){const h=await request(token,'health');if(!h.configuration.enabled||h.paused)throw Error(h.configuration.enabled?'Sending is paused. Send a test to your own devices instead, or resume sending first.':'Web Push is not configured, so nothing can be sent. Templates and history are available.');
  const r=await request(token,'audiences/preview','POST',input);if(r.success!==true||!Number.isInteger(r.eligibleDevices)||!r.previewId)throw Error('Invalid audience preview. Nothing can be sent.');return r;},
 async testSelf(token,input){try{const r=await request(token,'test','POST',input);if(r.success!==true||!Number.isInteger(r.devices))throw Error('The test was not confirmed by the server.');return {ok:true,devices:r.devices,duplicate:!!r.duplicate};}catch(e){return {ok:false,message:failure(e)};}},
 async setPaused(token,paused,reason){try{const r=await request(token,'settings','PUT',{paused,confirmed:true,reason});if(typeof r.paused!=='boolean')throw Error('The change was not confirmed by the server.');return {ok:true,paused:r.paused};}catch(e){return {ok:false,message:failure(e)};}},
 async placeholders(){return [{token:'{{appName}}',label:'Application name',sample:'Mystery Hub'},{token:'{{eventLabel}}',label:'Server event label',sample:'Service announcement'}];},
 async destinations(){return ANNOUNCEMENT_DESTINATIONS.map(value=>({value,label:DESTINATION_LABELS[value]}));},
 async limits(){return {titleMax:80,bodyMax:240};},
 async templates(token){return (await request(token,'templates')).templates.map(mapTemplate);},
 async saveTemplate(token,input){try{if(input.category!=='marketing')throw Error('Automatic order templates are server-owned. Custom templates are marketing only.');
  const id=input.id||'notice_'+crypto.randomUUID().replaceAll('-','_');
  const row=await request(token,'templates'+(input.id?'/'+encodeURIComponent(input.id):''),input.id?'PUT':'POST',{...(input.id?{expectedVersion:Number(input.expectedVersion)}:{id}),title:input.title,body:input.body,category:'marketing',enabled:input.enabled!==false});return {ok:true,template:mapTemplate(row)};
 }catch(e){return {ok:false,code:e instanceof NotificationHttpError&&e.status===409?'version_conflict':'invalid',message:(e as Error).message};}},
 async sends(token,query){const kind=query.kind||'announcement',state=query.state?SERVER_STATE[query.state as NotificationDeliveryState]||query.state:null;
  const r=await request(token,`history?kind=${encodeURIComponent(kind)}&offset=${(query.page-1)*25}${state?'&state='+encodeURIComponent(state):''}`);
  return {items:r.items.map(notificationHistoryItem),page:query.page,totalPages:Math.max(1,Math.ceil(r.total/25))};},
 async send(token,id,kind='announcement'){const r=await request(token,`history/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
  const devices:NotificationDeviceResult[]=r.deliveries.map((d:any)=>({id:d.id,guest:!!d.guest,state:STATE[d.state]||'failed',code:d.lastCode??null,updatedAt:d.updatedAt,attempts:(d.history||[]).map((a:any)=>({attempt:a.attempt,code:a.code,startedAt:a.startedAt,finishedAt:a.finishedAt??null}))}));
  const c=counts();for(const d of devices)c[d.state]++;
  return {id,kind,createdAt:devices[0]?.updatedAt??new Date().toISOString(),createdBy:null,title:'',body:'',category:kind==='order'?'transactional':'marketing',audienceLabel:'',recipients:devices.length,status:statusOf(c),counts:c,destination:null,
   errors:r.problems.map((p:any)=>({code:p.code,message:problem(p.code),count:p.count})),devices};},
 async createSend(token,input){try{
  if(input.category!=='marketing'||!input.templateId||!input.previewId)throw Error('Prepare a saved marketing template and confirm its audience first.');
  const t=(await this.templates(token)).find(t=>t.id===input.templateId);if(!t||t.locked||!t.enabled||t.title!==input.title||t.body!==input.body)throw Error('Save and review the exact enabled marketing template before sending.');
  const r=await request(token,'campaigns','POST',{previewId:input.previewId,requestId:input.idempotencyKey,confirmed:true});if(r.success!==true||!r.campaignId||!Number.isInteger(r.eligibleDevices))throw Error('Campaign outcome unconfirmed. Retry only with the same request key.');const c=counts();c.pending=r.eligibleDevices;
  return {ok:true,duplicate:r.duplicate,send:{id:r.campaignId,kind:'announcement',createdAt:new Date().toISOString(),createdBy:null,title:t.title,body:t.body,category:'marketing',audienceLabel:input.audienceId==='customer'?'One customer who chose news and offers':AUDIENCE_LABELS[input.audienceId==='marketing'?'members':input.audienceId]||AUDIENCE_LABELS.members,recipients:r.eligibleDevices,status:'queued',counts:c}};
 }catch(e){const error=e as NotificationHttpError;
  // A changed audience or template needs a fresh preview; a duplicate or a pause is explained in the server's words.
  const stale=error.status===409&&!/already (queued|sent)|paused|turned off/i.test(error.message||'');
  return {ok:false,code:stale?'count_changed':[401,403].includes(error.status)?'forbidden':error.status===503?'unavailable':'invalid',message:error.message};}}
};
