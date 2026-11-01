import {randomUUID} from 'node:crypto';
import {SALES_SERVICES,SALES_THRESHOLD,SALES_WINDOW_MS,SALES_STALE_MS,isSalesFailure,incidentState,type SalesObservation,type SalesIncident,type SalesReliabilityView} from '../../shared/salesReliability.js';

/** Pure incident rules; no supplier, payment, order or notification operations. */
export function advanceSalesIncidents(existing:SalesIncident[],recent:SalesObservation[],added:SalesObservation[]):SalesIncident[] {
  const incidents=structuredClone(existing);
  for(const event of [...added].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){
    if(isSalesFailure(event.category)){
      let open=incidents.find(i=>i.service===event.service&&i.stage===event.stage&&i.recoveredAt===null);
      if(!open){
        const lastRecovered=Math.max(0,...incidents.filter(i=>i.service===event.service&&i.stage===event.stage).map(i=>i.recoveredAt??0));
        const failures=recent.filter(r=>r.service===event.service&&r.stage===event.stage&&isSalesFailure(r.category)&&(r.at<event.at||r.at===event.at&&r.id<=event.id)&&r.at>lastRecovered&&r.at>event.at-SALES_WINDOW_MS);
        if(failures.length<SALES_THRESHOLD)continue;
        open={id:randomUUID(),service:event.service,stage:event.stage,category:event.category,firstFailureAt:Math.min(...failures.map(r=>r.at)),lastFailureAt:event.at,affectedAttempts:failures.length,blockedAttempts:failures.filter(r=>r.blocked).length,firstRecoveryAt:null,lastRecoveryAt:null,recoveredAt:null};
        incidents.push(open);
      }else{
        open.affectedAttempts++;open.blockedAttempts+=Number(event.blocked);
        // A late persisted failure must never move the diagnostic clock backwards.
        open.firstFailureAt=Math.min(open.firstFailureAt,event.at);
        if(event.at>=open.lastFailureAt){open.lastFailureAt=event.at;open.category=event.category;open.firstRecoveryAt=null;open.lastRecoveryAt=null;}
      }
    }else if(event.category==='passed'){
      for(const incident of incidents.filter(i=>i.service===event.service&&i.recoveredAt===null)){
        const evidence=event.fresh[incident.stage];
        // Only a fresh positive response for THIS stage, within a successful preflight,
        // can heal it. Cached responses, Admin wallet probes and older in-flight checks cannot.
        if(!evidence||evidence<=incident.lastFailureAt||evidence<=Number(incident.lastRecoveryAt))continue;
        if(incident.firstRecoveryAt===null){incident.firstRecoveryAt=evidence;incident.lastRecoveryAt=evidence;}
        else if(evidence-incident.firstRecoveryAt>=60_000){incident.lastRecoveryAt=evidence;incident.recoveredAt=evidence;}
      }
    }
  }
  return incidents;
}

export function salesView(observations:SalesObservation[],incidents:SalesIncident[],now:number,storage:SalesReliabilityView['storage'],collector:SalesReliabilityView['collector']):SalesReliabilityView {
  const recent=observations.filter(e=>e.at>now-SALES_WINDOW_MS&&e.at<=now);
  const fresh=recent.filter(e=>e.category==='passed'&&e.fresh.services);
  const lastFreshPassAt=fresh.length?Math.max(...fresh.map(e=>e.fresh.services!)):null;
  const states=incidents.map(i=>({...i,state:incidentState(i,now)}));
  const history=[...states].sort((a,b)=>Number(a.recoveredAt!==null)-Number(b.recoveredAt!==null)||b.lastFailureAt-a.lastFailureAt).slice(0,30);
  let state:SalesReliabilityView['state']='insufficient_evidence';
  if(states.some(i=>i.state==='active'))state='active';
  else if(states.some(i=>i.state==='recovering'))state='recovering';
  else if(states.some(i=>i.recoveredAt===null))state='insufficient_evidence';
  else if(recent.some(e=>isSalesFailure(e.category)&&!incidents.some(i=>i.service===e.service&&i.stage===e.stage&&i.recoveredAt!==null&&i.recoveredAt>=e.at)))state='insufficient_evidence';
  else if(lastFreshPassAt&&now-lastFreshPassAt<=SALES_STALE_MS)state=history.some(i=>i.recoveredAt!==null&&now-i.recoveredAt<SALES_STALE_MS)?'recovered':'healthy';
  if(storage==='unavailable'||collector.writeFailed||collector.dropped>0||recent.length>=5000)state=state==='active'?'active':'insufficient_evidence';
  return {checkedAt:now,state,storage,collector,recent:{attempts:recent.length,passed:recent.filter(e=>e.category==='passed').length,validation:recent.filter(e=>e.category==='validation').length,unverified:recent.filter(e=>e.category==='unverified').length,failures:recent.filter(e=>isSalesFailure(e.category)).length,blocked:recent.filter(e=>e.blocked).length,lastObservedAt:recent.length?Math.max(...recent.map(e=>e.at)):null,lastFreshPassAt,categories:[...new Set(recent.map(e=>e.category))].map(category=>({category,count:recent.filter(e=>e.category===category).length})),byService:SALES_SERVICES.map(service=>({service,attempts:recent.filter(e=>e.service===service).length,lastFreshPassAt:fresh.some(e=>e.service===service)?Math.max(...fresh.filter(e=>e.service===service).map(e=>e.fresh.services!)):null}))},incidents:history,externalAlerts:'admin_only'};
}
