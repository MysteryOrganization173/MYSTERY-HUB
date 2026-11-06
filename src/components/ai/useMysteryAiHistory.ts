import {useLayoutEffect,useRef,useState} from 'react';
import type {AiReplyStyle} from '../../../shared/mysteryAiPrivacy';
import {aiHistory,type SavedChat,type SavedTurn,type TurnToSave} from '../../services/mysteryAiHistory';

export function useMysteryAiHistory(token:string|null,accountId:string|null,onOpen:(turns:SavedTurn[])=>void) {
  const [visible,setVisible]=useState(false);
  const [chats,setChats]=useState<SavedChat[]>([]);
  const [current,setCurrent]=useState<SavedChat|null>(null);
  const [style,setStyle]=useState<AiReplyStyle|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [unsaved,setUnsaved]=useState<TurnToSave|null>(null);
  const request=useRef<AbortController|undefined>(undefined);
  const pendingCreate=useRef<string|undefined>(undefined);
  const saving=useRef(false);
  const writeController=useRef<AbortController|undefined>(undefined);
  const generation=useRef(0);
  useLayoutEffect(()=>{
    generation.current++;
    request.current?.abort();
    request.current=undefined;
    pendingCreate.current=undefined;
    saving.current=false;
    setVisible(false);setChats([]);setCurrent(null);setStyle(null);setBusy(false);setError('');setUnsaved(null);
    return ()=>{generation.current++;request.current?.abort();writeController.current?.abort();};
  },[token,accountId]);

  const run=async(work:(t:string,s:AbortSignal)=>Promise<void>)=>{
    if(!token||request.current||saving.current)return;
    const controller=new AbortController();
    request.current=controller;setBusy(true);setError('');
    try {await work(token,controller.signal);}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not access saved chats.');}
    finally {if(request.current===controller){request.current=undefined;setBusy(false);}}
  };
  const reload=()=>run(async(t,s)=>{
    const result=await aiHistory.list(t,s);
    if(!s.aborted){setChats(result.conversations);setStyle(result.style);}
  });
  const show=()=>{setVisible(true);void reload();};
  const hide=()=>{setVisible(false);};
  const open=async(id:string)=>run(async(t,s)=>{
    const result=await aiHistory.read(t,id,s);
    if(!s.aborted){setCurrent({id:result.id,title:result.title});setUnsaved(null);onOpen(result.turns);hide();}
  });
  const create=()=>run(async(t,s)=>{
    pendingCreate.current??=crypto.randomUUID();
    const result=await aiHistory.create(t,pendingCreate.current,s);
    if(!s.aborted){pendingCreate.current=undefined;setCurrent(result);setUnsaved(null);onOpen([]);hide();}
  });
  const rename=(id:string,title:string)=>run(async(t,s)=>{
    const result=await aiHistory.rename(t,id,title,s);
    if(!s.aborted){setChats(prev=>prev.map(c=>c.id===id?{...c,title:result.title}:c));setCurrent(c=>c?.id===id?{...c,title:result.title}:c);}
  });
  const remove=(id:string)=>run(async(t,s)=>{
    await aiHistory.remove(t,id,s);
    if(!s.aborted){setChats(prev=>prev.filter(c=>c.id!==id));if(current?.id===id){setCurrent(null);setUnsaved(null);onOpen([]);}}
  });
  const preference=(value:AiReplyStyle|null)=>run(async(t,s)=>{
    const result=await aiHistory.preference(t,value,s);
    if(!s.aborted)setStyle(result.style);
  });
  const saveTurn=async(turn:TurnToSave)=>{
    if(!token||!current||saving.current)return;
    const epoch=generation.current;
    const controller=new AbortController();
    writeController.current=controller;
    saving.current=true;
    setBusy(true);
    try{
      await aiHistory.append(token,current.id,turn,controller.signal);
      if(epoch===generation.current){setUnsaved(null);setError('');}
    }catch(e){
      if(epoch===generation.current){setUnsaved(turn);setError(e instanceof Error?e.message:'This reply was not saved.');}
    }finally{
      if(epoch===generation.current){writeController.current=undefined;saving.current=false;setBusy(false);}
    }
  };
  const temporary=()=>{
    if(request.current||saving.current)return false;
    setCurrent(null);setUnsaved(null);setError('');return true;
  };
  return {visible,chats,current,style,busy,error,unsaved,show,hide,reload,open,create,rename,remove,preference,saveTurn,temporary};
}
