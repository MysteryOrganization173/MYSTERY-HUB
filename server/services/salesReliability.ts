import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import type {RequestHandler} from 'express';
import {SalesReliabilityStore} from '../db/salesReliabilityStore.js';
import {salesView} from './salesReliabilityRules.js';
import {type SalesService,type SalesStage,type SalesCategory,type SalesObservation,type SalesIncident} from '../../shared/salesReliability.js';

type Signal={stage:SalesStage;category:SalesCategory;at:number;phase:SalesObservation['phase']};
type Context={service:SalesService;fresh:SalesObservation['fresh'];cached:Set<SalesStage>;signals:Signal[];completed:boolean;blocked:boolean};
const context=new AsyncLocalStorage<Context>();
const frame=(service:SalesService):Context=>({service,fresh:{},cached:new Set(),signals:[],completed:false,blocked:false});
const stageFor=(endpoint:string):SalesStage|null=>endpoint==='/services'?'services':endpoint==='/catalog'||endpoint==='/instant-bundles'?'catalog':endpoint==='/wallet'?'wallet':endpoint==='/beneficiary-check'?'beneficiary':null;

/** No raw error messages, URLs, headers, request bodies or provider data are retained. */
export function noteSupplierResponse(endpoint:string,source:'network'|'cache',body:unknown,status:number){
  const current=context.getStore(),stage=stageFor(endpoint);if(!current||!stage)return;
  if(status>=400){noteSalesFailure(stage,[401,403].includes(status)?'authorization':'http_error');return;}
  // HTTP success is not eligibility evidence. The semantic parser records denial/unknown/success separately.
  if(endpoint==='/beneficiary-check')return;
  const success=(body as {success?:unknown})?.success;
  if(success===false){noteSalesFailure(stage,'supplier_response');return;}
  if(source==='cache')current.cached.add(stage);
  // Missing legacy envelope fields remain unverified; this does not change supplier parsing.
  if(source==='network'&&success===true)current.fresh[stage]=Date.now();
}
export function noteBeneficiaryOutcome(outcome:'eligible'|'ineligible'|'unknown'){
 const current=context.getStore();if(!current)return;
 if(outcome==='unknown')noteSalesFailure('beneficiary','supplier_response');
 else if(outcome==='eligible')current.fresh.beneficiary=Date.now();
 // Ordinary recipient rejection is not an operational incident or outage recovery.
}
export function noteSupplierError(endpoint:string,error:unknown,phase:SalesObservation['phase']){
  const stage=stageFor(endpoint);if(!stage)return;
  const e=error as {isTimeout?:boolean;name?:string;statusCode?:number};
  noteSalesFailure(stage,e?.isTimeout||e?.name==='AbortError'?'timeout':[401,403].includes(e?.statusCode??0)?'authorization':e?.statusCode?'http_error':'connection',false,phase);
}
export function noteSalesFailure(stage:SalesStage,category:SalesCategory,blocked=false,phase:SalesObservation['phase']='unknown'){
  const current=context.getStore();if(!current)return;
  // At most one transport signal per endpoint plus a small number of explicit preflight decisions.
  if(current.signals.length<12)current.signals.push({stage,category,at:Date.now(),phase});
  if(blocked){current.completed=true;current.blocked=true;}
}
export function completeSalesPreflight(allowed:boolean){const current=context.getStore();if(current){current.completed=true;current.blocked=!allowed;}}

function observation(current:Context,status?:number):SalesObservation {
  // Transport evidence takes precedence over a generic unavailable decision or legacy customer error.
  const signal=current.signals.find(s=>!['service_unavailable','internal_error'].includes(s.category))??current.signals[0];
  let category:SalesCategory='unverified';
  if(signal)category=signal.category;
  else if(current.completed&&current.blocked)category='validation';
  else if(status&&status>=500)category='application_error';
  else if(status&&status>=400)category='validation';
  else if(current.completed&&(Object.keys(current.fresh).length||current.cached.size))category='passed';
  const now=Date.now();
  const fresh={...current.fresh};if(category==='passed'&&(!status||status<400))fresh.application=now;
  return {id:randomUUID(),at:signal?.at??now,service:current.service,stage:signal?.stage??'application',category,blocked:current.blocked,phase:signal?.phase??'unknown',fresh,cached:[...current.cached]};
}
function emit(current:Context,status?:number){try{salesCollector.enqueue(observation(current,status));}catch{/* Monitoring must never change checkout. */}}

/** Existing preflight entry points also serve Wallet/storefront callers without HTTP middleware. */
export async function observeSalesPreflight<T extends {allowed:boolean;code?:string}>(service:SalesService,work:()=>Promise<T>):Promise<T>{
  const parent=context.getStore();
  const run=async()=>{try{const result=await work();completeSalesPreflight(result.allowed);return result;}catch(error){noteSalesFailure('application','internal_error');throw error;}};
  if(parent)return run();
  const current=frame(service);
  return context.run(current,async()=>{try{return await run();}finally{emit(current);}});
}

/** Only server outcomes are observed; client network diagnostics are never accepted. */
export const observeSalesRequest=(service:SalesService|((body:any)=>SalesService|null)):RequestHandler=>(req,res,next)=>{
  const kind=typeof service==='function'?service(req.body):service;if(!kind){next();return;}
  const current=frame(kind);
  res.once('finish',()=>emit(current,res.statusCode));
  context.run(current,next);
};
export function salesCheckoutKind(body:any):SalesService|null {
  if(body?.serviceType==='marketplace'||body?.serviceType==='afa')return null;
  const product=typeof body?.productId==='string'?body.productId:'';
  if(product.startsWith('mp_')||product==='afa-registration')return null;
  if(body?.serviceType==='instant_bundle'||product.startsWith('instant-'))return 'instant_bundle';
  if(body?.serviceType==='airtime'||product.startsWith('airtime-')||product==='airtime')return 'airtime';
  return 'data';
}

/** Bounded, best-effort writer. No request awaits it and it yields when the pool is busy. */
export class SalesCollector {
  private queue:SalesObservation[]=[];
  private writing=false;
  private dropped=0;
  private writeFailed=false;
  private lastPersistedAt:number|null=null;
  private since=Date.now();
  private lastMaintenance=0;
  private lastState:{observations:SalesObservation[];incidents:SalesIncident[]}={observations:[],incidents:[]};
  constructor(private store=SalesReliabilityStore){}
  enqueue(event:SalesObservation){if(this.queue.length>=1000){this.dropped++;return;}this.queue.push(event);}
  async flush(now=Date.now()){
    if(this.writing||!this.store.canFlush())return;
    if(!this.queue.length&&now-this.lastMaintenance<3600_000)return;
    this.writing=true;
    const batch=this.queue.splice(0,100);
    try{await this.store.save(batch,now);this.lastPersistedAt=Date.now();this.lastMaintenance=now;this.writeFailed=false;}
    catch(error){
      if((error as {monitorCommitUncertain?:boolean})?.monitorCommitUncertain)this.dropped+=batch.length;
      else{const retained=[...batch,...this.queue];this.dropped+=Math.max(0,retained.length-1000);this.queue=retained.slice(0,1000);}
      this.writeFailed=true;
    }
    finally{this.writing=false;}
  }
  async view(now=Date.now()){
    let storage:'durable'|'unavailable'='durable';
    try{this.lastState=await this.store.read(undefined,now);}catch{storage='unavailable';}
    return salesView(this.lastState.observations,this.lastState.incidents,now,storage,{pending:this.queue.length,dropped:this.dropped,writeFailed:this.writeFailed,lastPersistedAt:this.lastPersistedAt,since:this.since});
  }
}
export const salesCollector=new SalesCollector();
export function startSalesReliabilityMonitor(){
  console.info('[Sales reliability] Passive checkout monitor started; alerts are Admin-only.');
  const timer=setInterval(()=>{void salesCollector.flush().catch(()=>{});},5000);timer.unref();
  return ()=>{clearInterval(timer);void salesCollector.flush().catch(()=>{});};
}
