import {useEffect,useState} from 'react';
import {getInstantQuote,type InstantQuote} from '../services/apiClient';

/** New quotes always require another explicit Pay tap; never retry payment automatically. */
export function useInstantQuote(productId:string|undefined,amount:number,refresh:number) {
  const identity=productId+':'+amount+':'+refresh;
  const [state,setState]=useState<{identity:string;quote:InstantQuote|null;error:string}>({identity:'',quote:null,error:''});
  useEffect(()=>{
    if(!productId)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    setState({identity,quote:null,error:''});
    getInstantQuote(productId,amount,controller.signal).then(quote=>{
      if(controller.signal.aborted)return;
      setState({identity,quote,error:''});
      timer=setTimeout(()=>setState({identity,quote:null,error:'Price expired. Refresh and review the total before paying.'}),Math.max(0,quote.expiresAt-Date.now()));
    }).catch(error=>{if(!controller.signal.aborted)setState({identity,quote:null,error:error.message});});
    return()=>{controller.abort();if(timer)clearTimeout(timer);};
  },[identity]);
  return state.identity===identity ? state : {identity,quote:null,error:''};
}
