import {useLayoutEffect,useRef,useState} from 'react';
import {Mic,Square,X} from 'lucide-react';
import {AiVoiceSession,speechConstructor,type NativeSpeech,type VoiceStatus} from '../../utils/mysteryAiSpeech';

export function MysteryAiVoice({available,scope,remaining,onTranscript,onActivity}:{
  available:boolean;scope:string;remaining:number;onTranscript:(value:string)=>void;onActivity:(active:boolean)=>void;
}) {
  const [voice,setVoice]=useState<{status:VoiceStatus;preview?:string;error?:string}>({status:'idle'});
  const actions=useRef({onTranscript,onActivity});
  actions.current={onTranscript,onActivity};
  const controller=useRef<AiVoiceSession|undefined>(undefined);
  if(!controller.current)controller.current=new AiVoiceSession(state=>{
    setVoice(state);
    actions.current.onActivity(state.status!=='idle');
  },text=>actions.current.onTranscript(text));
  useLayoutEffect(()=>{if(!available)controller.current?.cancel();return ()=>controller.current?.cancel();},[available,scope]);
  useLayoutEffect(()=>{
    const cancel=()=>controller.current?.cancel();
    const visibility=()=>{if(document.hidden)cancel();};
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',cancel);
    return ()=>{
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('pagehide',cancel);
    };
  },[]);
  const browser=window as Window&{SpeechRecognition?:new()=>NativeSpeech;webkitSpeechRecognition?:new()=>NativeSpeech};
  const Recognition=window.isSecureContext?speechConstructor(browser):undefined;
  const active=voice.status!=='idle';
  const control='min-h-11 rounded-xl border border-slate-700 px-2.5 text-xs font-semibold text-slate-200 disabled:opacity-50';
  if(!Recognition)return null;
  return <div className="space-y-1">
    <div className="flex flex-wrap items-center gap-1.5">
      {!active&&<button type="button" disabled={!available||remaining<=0} className={control} onClick={()=>controller.current?.start(Recognition,remaining)}>
        <Mic className="mr-1 inline h-4 w-4" aria-hidden="true"/> Use microphone
      </button>}
      {active&&<>
        <button type="button" disabled={voice.status!=='listening'} className={control} onClick={()=>controller.current?.stop()}><Square className="mr-1 inline h-3 w-3" aria-hidden="true"/>Stop</button>
        <button type="button" className={control} onClick={()=>controller.current?.cancel()}><X className="mr-1 inline h-3 w-3" aria-hidden="true"/>Cancel voice</button>
      </>}
      <p className="text-[11px] text-slate-400">Your browser may send audio to its speech service. Review and edit the text before sending.</p>
    </div>
    {active&&<p role="status" className="text-xs text-emerald-300">{voice.status==='requesting'?'Waiting for microphone permission…':voice.status==='listening'?'Listening…':'Finishing transcription…'}</p>}
    {voice.preview&&<p className="max-h-20 overflow-y-auto break-words text-xs text-slate-200">{voice.preview}</p>}
    {voice.error&&<p role="status" className="text-xs text-amber-200">{voice.error}</p>}
  </div>;
}
