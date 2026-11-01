import {useEffect,useRef,useState} from 'react';
import {freshLeadLinks,type LeadSummary} from '../../../shared/leadOperations';
import {getLeadSummary} from '../../services/leadOperations';
export function useLeadAlerts(token:string){
 const [state,setState]=useState<{token:string;data:LeadSummary|null;error:string;loading:boolean;fresh:ReturnType<typeof freshLeadLinks>}>({token,data:null,error:'',loading:true,fresh:[]});
 const refresh=useRef(()=>{});
 useEffect(()=>{let active=true,busy=false,again=false,previous:LeadSummary|null=null;const c=new AbortController();setState({token,data:null,error:'',loading:true,fresh:[]});
  const load=async()=>{if(!active||document.visibilityState==='hidden')return;if(busy){again=true;return;}busy=true;try{const data=await getLeadSummary(token,AbortSignal.any([c.signal,AbortSignal.timeout(10000)]));if(active){const fresh=freshLeadLinks(previous,data);previous=data;setState(s=>({token,data,error:'',loading:false,fresh:fresh.length?fresh:s.fresh}));}}catch{if(active)setState({token,data:null,error:'Lead counts unavailable. Retry without changing customer records.',loading:false,fresh:[]});}finally{busy=false;if(again&&active){again=false;void load();}}};
  refresh.current=()=>{void load();};void load();const interval=setInterval(load,60000),visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);window.addEventListener('mh-leads-changed',load);
  return()=>{active=false;c.abort();clearInterval(interval);document.removeEventListener('visibilitychange',visible);window.removeEventListener('mh-leads-changed',load);};
 },[token]);
 const safe=state.token===token?state:{token,data:null,error:'',loading:true,fresh:[]};
 return {...safe,refresh:()=>refresh.current(),dismiss:()=>setState(s=>({...s,fresh:[]}))};
}
