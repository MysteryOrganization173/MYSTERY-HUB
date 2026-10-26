import React, {useEffect, useId, useRef, useState} from 'react';
import {BellRing, BellOff, CheckCircle2, X} from 'lucide-react';
import {httpCustomerNotificationsClient, type CustomerNotificationsClient} from '../../services/customerNotifications';
import {notificationOpportunity, activateNotificationOnboarding, acceptNotificationOffers, type OnboardingStep, type OnboardingOptions} from '../../pwa/notificationOnboarding';
import {marketingPromptAnswered, markMarketingPromptAnswered, readSnooze, recordDismissal, STORAGE_KEYS} from '../../pwa/launchPolicy';
import './pwa.css';

type Props = {token:string;accountId:string;allowOffers:boolean;onDone:()=>void;initialStep?:'enable'|'offers';variant?:'floating'|'inline';client?:CustomerNotificationsClient;environment?:OnboardingOptions['environment']};

/** Installed Home only; checking readiness never requests permission or subscribes. */
export function InstalledNotificationOnboarding({token,accountId,allowOffers}: Pick<Props,'token'|'accountId'|'allowOffers'>) {
  const [opportunity,setOpportunity]=useState<'enable'|'offers'|null>(null),[closed,setClosed]=useState(false);
  useEffect(()=>{
    const request=new AbortController();
    const timer=window.setTimeout(()=>{
      void notificationOpportunity(httpCustomerNotificationsClient,token,{allowOffers,offersAnswered:marketingPromptAnswered(accountId),signal:request.signal,snooze:readSnooze(STORAGE_KEYS.notificationOptIn),now:Date.now()})
        .then(next=>{if(!request.signal.aborted)setOpportunity(next);}).catch(()=>{});
    },2600);
    return()=>{window.clearTimeout(timer);request.abort();};
  },[token,accountId,allowOffers]);
  if(closed||!opportunity)return null;
  return <NotificationOptIn token={token} accountId={accountId} allowOffers={allowOffers} initialStep={opportunity} onDone={()=>setClosed(true)}/>;
}

/** Permission never implies marketing consent. The optional offers step follows registration immediately. */
export function NotificationOptIn({token,accountId,allowOffers,onDone,initialStep='enable',variant='floating',client=httpCustomerNotificationsClient,environment}:Props) {
  const [step,setStep]=useState<OnboardingStep>(initialStep),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
  const titleId=useId(),request=useRef<AbortController|null>(null),inFlight=useRef(false);
  useEffect(()=>{request.current=new AbortController();return()=>{request.current?.abort();};},[token,accountId]);
  const active=()=>Boolean(request.current&&!request.current.signal.aborted);
  const later=()=>{if(inFlight.current)return;if(step==='offers')markMarketingPromptAnswered(accountId);else recordDismissal(STORAGE_KEYS.notificationOptIn);onDone();};
  const enable=async()=>{
    if(inFlight.current||!active())return;inFlight.current=true;setBusy(true);setMessage(null);
    try{
      const result=await activateNotificationOnboarding(client,token,{allowOffers,offersAnswered:marketingPromptAnswered(accountId),signal:request.current!.signal,environment});
      if(!active())return;
      if(result.step==='dismissed')recordDismissal(STORAGE_KEYS.notificationOptIn);
      setStep(result.step);setMessage(result.message||null);
    }catch(error){if(active()){setStep('error');setMessage((error as Error).message);}}finally{inFlight.current=false;if(active())setBusy(false);}
  };
  const acceptOffers=async()=>{
    if(inFlight.current||!active())return;inFlight.current=true;setBusy(true);setMessage(null);
    try{await acceptNotificationOffers(client,token,request.current!.signal);if(!active())return;markMarketingPromptAnswered(accountId);onDone();}
    catch(error){if(active())setMessage((error as Error).message);}finally{inFlight.current=false;if(active())setBusy(false);}
  };
  const finish=()=>{if(!inFlight.current)onDone();};
  const close=step==='offers'||step==='enable'||step==='error'?later:finish;
  return <section aria-labelledby={titleId} className={`mh-notify-card mh-notify-card-${variant}`} data-overlay-exempt>
    <button type="button" disabled={busy} className="mh-app-sheet-close mh-compact-control" onClick={close} aria-label={step==='offers'?'Not now':'Close'}><X className="size-4" aria-hidden="true"/></button>
    <div className="mh-notify-body">
      {step==='denied'||step==='dismissed'?<BellOff className="mh-notify-icon text-slate-300" aria-hidden="true"/>:step==='registered'?<CheckCircle2 className="mh-notify-icon text-emerald-300" aria-hidden="true"/>:<BellRing className="mh-notify-icon text-emerald-300" aria-hidden="true"/>}
      <div>
        <h2 id={titleId}>{step==='offers'?'Want offers, discounts and news too?':step==='registered'?'This phone is registered':step==='denied'?'Notifications are blocked':step==='dismissed'?'No change made':step==='error'?'Alerts need another try':'Get your order updates on this phone'}</h2>
        <p>{step==='offers'?'Optional offers, discounts and service news. Choose yes to receive them. Your order and account settings stay unchanged; change any choice in My Account anytime.':step==='registered'?'Mystery Hub confirmed this device. Your account choices are saved; availability of alerts depends on the service.':step==='denied'?'You can allow Mystery Hub notifications later in your phone settings. Everything else still works.':step==='dismissed'?'Notifications were not enabled. You can try later in My Account.':step==='error'?'We could not confirm this device. Nothing here counts as a successful notification delivery.':'Tap below to allow alerts and register this device for your own order and account updates. Offers are a separate choice.'}</p>
        {message&&<p role="alert">{message}</p>}
      </div>
    </div>
    <div className="mh-notify-actions">
      {step==='offers'?<><button type="button" className="mh-button" disabled={busy} onClick={()=>{void acceptOffers();}}>{busy?'Saving your choice…':'Yes, send me offers'}</button><button type="button" disabled={busy} className="mh-install-later" onClick={later}>Not now</button></>
        :step==='enable'||step==='error'?<><button type="button" className="mh-button" disabled={busy} onClick={()=>{void enable();}}>{busy?'Setting up this phone…':step==='error'?'Try again':'Enable notifications'}</button><button type="button" disabled={busy} className="mh-install-later" onClick={later}>Not now</button></>
        :<button type="button" className="mh-button" onClick={finish}>Done</button>}
    </div>
  </section>;
}
