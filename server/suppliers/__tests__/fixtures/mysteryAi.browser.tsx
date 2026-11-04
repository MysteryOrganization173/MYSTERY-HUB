/** Synthetic responses only; no provider, account, payment or supplier traffic. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MysteryAiAssistant} from '../../../../src/components/ai/MysteryAiAssistant';
import {MockProvider} from './mysteryAi.context';
import '../../../../src/index.css';
const fixture={requests:[] as any[],navigation:[] as any[],mode:'success',release:()=>{},open:()=>{},setPage:(_p:string)=>{}};
(window as any).__aiFixture=fixture;
const json=(body:any,status=200,headers:any={})=>new Response(JSON.stringify(body),{status,headers});
window.fetch=async(input,options)=>{
 if(!String(input).endsWith('/api/mystery-ai/chat'))throw Error('Unexpected network request in AI fixture');
 const body=JSON.parse(String(options?.body));fixture.requests.push(body);
 if(fixture.mode==='quota')return json({code:'QUOTA',retryable:true,retryAfterSeconds:2},429,{'Retry-After':'2'});
 if(fixture.mode==='configuration')return json({code:'CONFIGURATION',retryable:false},503);
 if(fixture.mode==='slow')await new Promise<void>(resolve=>{fixture.release=resolve;}); // Intentionally ignores cancellation.
 return json({reply:fixture.mode==='long'?('Here is a useful explanation. '.repeat(50)):'Helpful answer. Mystery Hub offers data bundles, Website Builder and order tracking.',source:'gemini',fallback:false});
};
createRoot(document.getElementById('root')!).render(<MockProvider><main><h1>Mystery Hub — synthetic chat</h1><button onClick={()=>fixture.open()}>Open test chat</button></main><MysteryAiAssistant/></MockProvider>);
