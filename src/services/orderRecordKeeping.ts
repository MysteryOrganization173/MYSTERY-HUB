import {API_BASE_URL} from './apiClient';
/** Maps the reviewed backend contract; eligibility and mutation authority remain server-side. */

/** The server's current view of one order's record-keeping state. */
export interface OrderRecordState {
  reference: string;
  /** Opaque concurrency token. Every action sends back the version the operator reviewed. */
  version: string;
  archived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
  canArchive: boolean;
  archiveBlockedReason: string | null;
  canRestore: boolean;
  restoreBlockedReason: string | null;
  /** True only when the server has classified the order as a deletable test record. */
  canDeleteTest: boolean;
  deleteBlockedReason: string | null;
  /** Server classification: a real paid customer purchase is never deletable and stays easy to find. */
  paidCustomerPurchase: boolean;
}

export interface OrderRecordAuditEntry {
  id: string;
  action: 'archived' | 'restored' | 'test_deleted' | (string & {});
  actor: string | null;
  at: string;
  reason: string | null;
}

export interface ArchivedOrderSummary {
  reference: string;
  product: string;
  amountMinor: number | null;
  customer: string | null;
  status: string;
  archivedAt: string;
  archivedBy: string | null;
  reason: string | null;
}

export interface ArchivedOrderPage { items: ArchivedOrderSummary[]; page: number; totalPages: number; total: number }

export type RecordActionFailure = { ok: false; code: 'version_conflict' | 'not_eligible' | 'forbidden' | 'unavailable' | 'error'; message: string };
export type RecordActionResult = { ok: true; state: OrderRecordState } | RecordActionFailure;
export type RecordDeleteResult = { ok: true } | RecordActionFailure;

export interface OrderRecordClient {
  /** False until a verified backend contract is wired. The UI then shows a waiting state and calls nothing. */
  readonly available: boolean;
  getState(token: string, reference: string): Promise<OrderRecordState>;
  /** null when the server does not provide history for this order. */
  history(token: string, reference: string): Promise<OrderRecordAuditEntry[] | null>;
  archive(token: string, reference: string, input: { expectedVersion: string; reason: string }): Promise<RecordActionResult>;
  restore(token: string, reference: string, input: { expectedVersion: string; reason: string }): Promise<RecordActionResult>;
  deleteTest(token: string, reference: string, input: { expectedVersion: string; confirmReference: string; reason: string }): Promise<RecordDeleteResult>;
  listArchived(token: string, query: { q?: string; page: number; limit: number }): Promise<ArchivedOrderPage>;
}

export const RECORD_KEEPING_UNAVAILABLE = 'Archive and test deletion are waiting for the server. No order can be archived or deleted here yet.';

const unavailable = (): Promise<never> => Promise.reject(new Error(RECORD_KEEPING_UNAVAILABLE));
export const pendingOrderRecordClient: OrderRecordClient = {
  available: false,
  getState: unavailable,
  history: unavailable,
  archive: unavailable,
  restore: unavailable,
  deleteTest: unavailable,
  listArchived: unavailable,
};

class RecordHttpError extends Error {constructor(message:string,readonly status:number){super(message);}}
async function request(token:string,path:string,body?:unknown){
 if(!token)throw new RecordHttpError('Sign in to the staff portal.',401);
 const response=await fetch(`${API_BASE_URL}/api/admin/${path}`,{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new RecordHttpError(data?.error||'The server did not confirm this action. Reload before retrying.',response.status);
 if(data?.success!==true)throw new RecordHttpError('The server returned an incomplete response. Reload before retrying.',503);
 return data;
}
const managementPath=(reference:string)=>`order-management/${encodeURIComponent(reference)}`;
const actionNames:Record<string,OrderRecordAuditEntry['action']>={archive:'archived',restore:'restored',delete_test:'test_deleted'};
function mapHistory(data:any):OrderRecordAuditEntry[]{return (data.history||[]).map((e:any)=>({id:e.id,action:actionNames[e.action]||e.action,actor:e.actor_id,at:e.created_at,reason:e.reason}));}
function state(data:any):OrderRecordState{
 const o=data.order,e=data.eligibility;if(!o?.updated_at||!e)throw new RecordHttpError('Incomplete order eligibility response.',503);
 const archive=(data.history||[]).find((h:any)=>h.action==='archive');const reason=(e.denials||[]).join(', ');
 return {reference:o.public_reference,version:new Date(o.updated_at).toISOString(),archived:!!o.archived_at,archivedAt:o.archived_at||null,archivedBy:o.archived_at?archive?.actor_id||null:null,archiveReason:o.archived_at?archive?.reason||null:null,
 canArchive:e.archive===true,archiveBlockedReason:e.archive?null:reason||'The server does not allow archiving.',canRestore:e.restore===true,restoreBlockedReason:e.restore?null:'This order is not archived.',canDeleteTest:e.deleteTest===true,deleteBlockedReason:e.deleteTest?null:reason||'No trusted test provenance.',paidCustomerPurchase:!!(o.paid_at||o.payment_status==='success'||o.payment_basis||o.resolution)};
}
function failure(error:unknown):RecordActionFailure{const e=error as RecordHttpError;return {ok:false,code:e.status===409?(/changed|Request ID/.test(e.message)?'version_conflict':'not_eligible'):[401,403].includes(e.status)?'forbidden':e.status===503?'unavailable':'error',message:e.message||'Could not confirm the action. Reload before retrying.'};}
async function act(token:string,reference:string,action:string,input:{expectedVersion:string;reason:string}){
 return request(token,managementPath(reference),{action,confirmed:true,reason:input.reason,expectedUpdatedAt:input.expectedVersion,requestId:crypto.randomUUID()});
}
export const httpOrderRecordClient:OrderRecordClient={
 available:true,
 async getState(token,reference){return state(await request(token,managementPath(reference)));},
 async history(token,reference){return mapHistory(await request(token,managementPath(reference)));},
 async archive(token,reference,input){try{await act(token,reference,'archive',input);return {ok:true,state:await this.getState(token,reference)};}catch(e){return failure(e);}},
 async restore(token,reference,input){try{await act(token,reference,'restore',input);return {ok:true,state:await this.getState(token,reference)};}catch(e){return failure(e);}},
 async deleteTest(token,reference,input){if(input.confirmReference!==reference)return {ok:false,code:'not_eligible',message:'Type the exact order reference.'};try{await act(token,reference,'delete_test',input);return {ok:true};}catch(e){return failure(e);}},
 async listArchived(token,query){const params=new URLSearchParams({archived:'only',status:'all',readOnly:'true',page:String(query.page),limit:String(query.limit),...(query.q?{q:query.q}:{})});const data=await request(token,'orders?'+params);return {items:data.orders.map((o:any)=>({reference:o.public_reference,product:o.product_name_snapshot,amountMinor:o.amount,customer:o.customer_name||null,status:o.status,archivedAt:o.archived_at,archivedBy:null,reason:null})),...data.pagination};}
};
