import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AiVoiceSession,speechConstructor,type NativeSpeech} from '../../../src/utils/mysteryAiSpeech';

class SpeechFixture implements NativeSpeech {
  static instance:SpeechFixture;
  lang='';continuous=true;interimResults=false;started=0;stopped=0;aborted=0;
  onstart:NativeSpeech['onstart']=null;onresult:NativeSpeech['onresult']=null;onend:NativeSpeech['onend']=null;onerror:NativeSpeech['onerror']=null;
  constructor(){SpeechFixture.instance=this;}
  start(){this.started++;}
  stop(){this.stopped++;}
  abort(){this.aborted++;}
}
const result=(transcript:string,isFinal:boolean)=>({isFinal,0:{transcript}});

test('native support detects both constructor names and leaves unsupported browsers typed',()=>{
  assert.equal(speechConstructor({}),undefined);
  assert.equal(speechConstructor({webkitSpeechRecognition:SpeechFixture}),SpeechFixture);
  assert.equal(speechConstructor({SpeechRecognition:SpeechFixture}),SpeechFixture);
});
test('recognition starts explicitly, previews interim text, and returns bounded editable text only when finished',()=>{
  const states:any[]=[], transcripts:string[]=[];
  const voice=new AiVoiceSession(s=>states.push(s),text=>transcripts.push(text));
  voice.start(SpeechFixture,10);
  const native=SpeechFixture.instance;
  assert.deepEqual([native.started,native.lang,native.continuous,native.interimResults],[1,'en-GH',false,true]);
  voice.start(SpeechFixture,10);
  assert.equal(SpeechFixture.instance,native);
  native.onstart?.();
  native.onresult?.({results:[result('an interim phrase',false)]});
  assert.equal(states.at(-1).preview,'an interim');
  assert.deepEqual(transcripts,[]);
  native.onresult?.({results:[result('a final sentence',true)]});
  voice.stop();
  assert.equal(native.stopped,1);
  native.onend?.();
  assert.deepEqual(transcripts,['a final se']);
  assert.equal(native.onresult,null);
});
test('cancel aborts recognition and invalidates old events; permission and network failures retain typing',()=>{
  const errors:string[]=[], transcripts:string[]=[];
  const voice=new AiVoiceSession(s=>{if(s.error)errors.push(s.error);},t=>transcripts.push(t));
  voice.start(SpeechFixture,100);
  const old=SpeechFixture.instance, delayed=old.onresult, delayedEnd=old.onend;
  voice.cancel();assert.equal(old.aborted,1);
  voice.start(SpeechFixture,100);
  delayed?.({results:[result('stale',true)]});delayedEnd?.();
  SpeechFixture.instance.onerror?.({error:'not-allowed'});
  assert.match(errors.at(-1)!,/denied/);
  voice.start(SpeechFixture,100);
  SpeechFixture.instance.onerror?.({error:'network'});
  assert.match(errors.at(-1)!,/connect/);
  assert.deepEqual(transcripts,[]);
});
test('a hung recognition stops at the limit then aborts without storing audio',async()=>{
  const voice=new AiVoiceSession(()=>{},()=>assert.fail('No final transcript'),10,10);
  voice.start(SpeechFixture,100);
  const native=SpeechFixture.instance;
  await new Promise(resolve=>setTimeout(resolve,45));
  assert.equal(native.stopped,1);
  assert.equal(native.aborted,1);
  assert.equal(native.onend,null);
});
