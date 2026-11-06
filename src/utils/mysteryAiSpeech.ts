type SpeechResult={isFinal:boolean;0?:{transcript:string}};
type SpeechEvent={results:ArrayLike<SpeechResult>};
export type NativeSpeech={
  lang:string;continuous:boolean;interimResults:boolean;
  onstart:(()=>void)|null;
  onresult:((event:SpeechEvent)=>void)|null;
  onend:(()=>void)|null;
  onerror:((event:{error:string})=>void)|null;
  start():void;stop():void;abort():void;
};
type SpeechConstructor=new()=>NativeSpeech;
type SpeechWindow={SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor};
export const speechConstructor=(surface:SpeechWindow)=>surface.SpeechRecognition??surface.webkitSpeechRecognition;
export type VoiceStatus='idle'|'requesting'|'listening'|'finishing';
type VoiceUpdate={status:VoiceStatus;preview?:string;error?:string};
const speechError=(kind:string)=>({
  'not-allowed':'Microphone permission was denied. You can still type your message.',
  'service-not-allowed':'Speech recognition is unavailable in this browser. You can still type.',
  'audio-capture':'No microphone was available. You can still type your message.',
  'no-speech':'No speech was detected. Try again or type your message.',
  network:'Speech recognition could not connect. Try again or type your message.',
} as Record<string,string>)[kind]??'Speech recognition was interrupted. You can still type.';

/** One explicitly started native recognition session. Never accesses raw audio. */
export class AiVoiceSession {
  private active?:NativeSpeech;
  private timer?:ReturnType<typeof setTimeout>;
  private finishTimer?:ReturnType<typeof setTimeout>;
  private finalText='';
  constructor(private update:(state:VoiceUpdate)=>void,private transcript:(value:string)=>void,
    private duration=25000,private finishGrace=3000){}
  private cleanup(abort:boolean){
    const active=this.active;
    this.active=undefined;
    clearTimeout(this.timer);clearTimeout(this.finishTimer);
    if(active){
      active.onstart=active.onresult=active.onend=active.onerror=null;
      if(abort)try{active.abort();}catch{/* Native session may already be closed. */}
    }
    this.finalText='';
  }
  private complete(active:NativeSpeech,abort=false){
    if(this.active!==active)return;
    const text=this.finalText;
    this.cleanup(abort);
    this.update({status:'idle',error:text?undefined:'No speech was transcribed. Try again or type your message.'});
    if(text)this.transcript(text);
  }
  start(Recognition:SpeechConstructor,maxChars:number){
    if(this.active||maxChars<1)return;
    let recognition:NativeSpeech;
    try{recognition=new Recognition();}catch{this.update({status:'idle',error:speechError('service-not-allowed')});return;}
    this.active=recognition;
    this.update({status:'requesting'});
    recognition.lang='en-GH';
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.onstart=()=>{if(this.active===recognition)this.update({status:'listening'});};
    recognition.onresult=({results})=>{
      if(this.active!==recognition)return;
      const final:string[]=[], interim:string[]=[];
      // Browser results are cumulative; cap both the number and size of fragments.
      for(let i=0;i<Math.min(results.length,32);i++){
        const result=results[i];
        const text=result?.[0]?.transcript?.trim().slice(0,maxChars);
        if(text)(result.isFinal?final:interim).push(text);
      }
      this.finalText=final.join(' ').slice(0,maxChars);
      this.update({status:this.finishTimer?'finishing':'listening',preview:[...final,...interim].join(' ').slice(0,maxChars)});
    };
    recognition.onerror=({error})=>{
      if(this.active!==recognition)return;
      this.cleanup(true);
      this.update({status:'idle',error:speechError(error)});
    };
    recognition.onend=()=>this.complete(recognition);
    this.timer=setTimeout(()=>this.stop(),this.duration);
    try{recognition.start();}catch{this.cleanup(true);this.update({status:'idle',error:speechError('not-allowed')});}
  }
  stop(){
    const recognition=this.active;
    if(!recognition||this.finishTimer)return;
    clearTimeout(this.timer);
    this.update({status:'finishing'});
    this.finishTimer=setTimeout(()=>this.complete(recognition,true),this.finishGrace);
    try{recognition.stop();}catch{this.complete(recognition,true);}
  }
  cancel(){
    this.cleanup(true);
    this.update({status:'idle'});
  }
}
