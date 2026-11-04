import React,{useEffect,useState} from 'react';
import {CAMPAIGN_PATHS} from '../../../shared/campaigns';
/** Render static-site SPA fallback. Canonical Web Service handles /c directly. */
export function CampaignRedirect({code}:{code:string}){
 const [error,setError]=useState(''),[fallback,setFallback]=useState('/');
 useEffect(()=>{let live=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);const base=(import.meta.env?.VITE_API_BASE_URL||'').replace(/\/$/,'');
  if(!/^[A-Za-z0-9_-]{6}$/.test(code)){setError('This campaign link is unavailable.');clearTimeout(timer);return;}
  fetch(base+'/api/campaigns/resolve/'+encodeURIComponent(code),{signal:controller.signal,cache:'no-store'}).then(async r=>{const value=await r.json();if(!r.ok)throw Error('unavailable');return value.data;}).then(data=>{if(!live)return;const target=new URL(data.destination);if(target.origin!=='https://mysterybundlehub.com'||!((CAMPAIGN_PATHS as readonly string[]).includes(target.pathname)||/^\/sites\/[a-z0-9][a-z0-9-]{0,99}$/.test(target.pathname)))throw Error('Invalid destination');setFallback(target.toString());if(data.active)location.replace(target.toString());else setError('This campaign is not active. You can still visit its website without campaign tracking.');}).catch(()=>{if(live)setError('This campaign link is unavailable. Please try again later or visit Mystery Hub.');}).finally(()=>clearTimeout(timer));
  return()=>{live=false;controller.abort();clearTimeout(timer);};
 },[code]);
 return <main className="mx-auto max-w-lg space-y-4 p-6 text-slate-100"><h1 className="text-2xl font-bold">{error?'Link unavailable':'Opening your destination…'}</h1><p role={error?'alert':'status'}>{error||'Please wait a moment.'}</p>{error&&<a className="mh-button" href={fallback}>Continue to the website</a>}</main>;
}
