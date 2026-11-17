import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {canonicalGhanaPhone} from '../utils/phone.js';
export type SmsFailure='CONFIGURATION'|'AUTH'|'CREDIT'|'GATEWAY'|'VALIDATION'|'RATE_LIMIT'|'PROVIDER'|'UNCERTAIN';
export class ArkeselError extends Error {constructor(public code:SmsFailure,public uncertain=false,public details?:{httpStatus:number;fields:string[]}){super('SMS provider '+code.toLowerCase().replaceAll('_',' ')+'.');}}
export const providerId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export const deliveryStates=['SUBMITTED','QUEUED','DELIVERED','NOT_DELIVERED','EXPIRED','PROHIBITED'] as const;
export function normalizeStatus(v:unknown){return typeof v==='string'&&(deliveryStates as readonly string[]).includes(v)?v:'UNKNOWN';}
export function arkeselConfig(env=process.env){
 const sender=env.ARKESEL_SENDER_ID||'',key=env.ARKESEL_API_KEY||'',secret=env.ARKESEL_WEBHOOK_SECRET||'';
 const sandbox=env.ARKESEL_SANDBOX_MODE!=='false';const enabled=env.ARKESEL_SMS_ENABLED==='true';
 const senderValid=/^[A-Za-z0-9 ._-]{1,11}$/.test(sender),approved=env.ARKESEL_SENDER_APPROVED==='true';
 const live=enabled&&!sandbox&&env.ARKESEL_LIVE_APPROVED==='true'&&approved&&!!secret;
 const testNumbers=(env.ARKESEL_TEST_NUMBERS||'').split(',').map(canonicalGhanaPhone).filter((x):x is string=>!!x),testOnly=env.ARKESEL_TEST_ONLY!=='false';
 const sendAllowed=enabled&&!!key&&senderValid&&(sandbox||live)&&(!testOnly||testNumbers.length===1);
 const n=(k:string,d:number,max:number)=>{const x=Number(env[k]||d);return Number.isSafeInteger(x)&&x>0&&x<=max?x:0;};
 return {key,sender,secret,previousSecret:env.ARKESEL_PREVIOUS_WEBHOOK_SECRET||'',previousUntil:Date.parse(env.ARKESEL_PREVIOUS_SECRET_UNTIL||''),sandbox,enabled,approved,senderValid,sendAllowed,worker:env.ARKESEL_WORKER_ENABLED==='true',auto:env.ARKESEL_AUTO_SMS_ENABLED==='true',daily:n('ARKESEL_DAILY_CREDITS',200,10000),autoDaily:n('ARKESEL_AUTO_DAILY_CREDITS',100,5000),campaignLimit:n('ARKESEL_CAMPAIGN_LIMIT',100,1000),campaignCredits:n('ARKESEL_CAMPAIGN_CREDITS',200,10000),lowCredits:n('ARKESEL_LOW_CREDITS',10,10000),testNumbers,testOnly};
}
export const senderFingerprint=(config=arkeselConfig())=>createHash('sha256').update(JSON.stringify([config.key,config.secret,config.sender])).digest('hex');
export const senderBlocked=(value:any,config=arkeselConfig())=>value?.sender===config.sender&&value?.sourceFingerprint===senderFingerprint(config)&&(['pending','rejected','block'].includes(value?.status)||value?.documentsRequired===true);
export const signingFingerprint=(config=arkeselConfig())=>createHash('sha256').update(JSON.stringify([config.key,config.secret])).digest('hex');
export class ArkeselClient {
 private active=0;private calls:number[]=[];
 constructor(private config=arkeselConfig,private http:typeof fetch=fetch,private now=()=>Date.now()){}
 private async request(path:string,method='GET',body?:unknown,submission=false){
  const c=this.config();if(process.env.NODE_ENV==='test'&&this.http===fetch)throw new ArkeselError('CONFIGURATION');if(!c.key)throw new ArkeselError('CONFIGURATION');if(this.active>=2)throw new ArkeselError('RATE_LIMIT');this.calls=this.calls.filter(t=>this.now()-t<60000);if(this.calls.length>=30)throw new ArkeselError('RATE_LIMIT');this.calls.push(this.now());this.active++;
  try{const r=await this.http('https://sms.arkesel.com'+path,{method,redirect:'error',headers:{'api-key':c.key,'Content-Type':'application/json','Accept':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
   if(!r.ok){const code:SmsFailure=({401:'AUTH',402:'CREDIT',403:'GATEWAY',422:'VALIDATION',429:'RATE_LIMIT'} as Record<number,SmsFailure>)[r.status]||'PROVIDER';let fields:string[]=[];if(r.status===422){try{const reader=r.body?.getReader();if(reader){let size=0,body='';const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>128000){await reader.cancel();break;}body+=decoder.decode(part.value,{stream:true});}if(size<=128000)fields=validationFields(JSON.parse(body+decoder.decode()));}}catch{}}throw new ArkeselError(code,submission&&r.status>=500,{httpStatus:r.status,fields});}
   if(!r.headers.get('content-type')?.includes('application/json'))throw new ArkeselError(submission?'UNCERTAIN':'PROVIDER',submission);
   const reader=r.body?.getReader();if(!reader)throw new ArkeselError(submission?'UNCERTAIN':'PROVIDER',submission);let size=0,text='';const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128000){await reader.cancel();throw new ArkeselError(submission?'UNCERTAIN':'PROVIDER',submission);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();const data=JSON.parse(text);if(data?.status!=='success')throw new ArkeselError(submission?'UNCERTAIN':'PROVIDER',submission);return data;
  }catch(e){if(e instanceof ArkeselError)throw e;throw new ArkeselError(submission?'UNCERTAIN':'PROVIDER',submission);}finally{this.active--;}
 }
 async balance(){const r=await this.request('/api/v2/clients/balance-details');const raw=r.data?.sms_balance;const credits=typeof raw==='number'?raw:typeof raw==='string'&&/^\d+(\.\d+)?$/.test(raw)?Number(raw):NaN;if(!Number.isFinite(credits)||credits<0||typeof r.data?.main_balance!=='string'||!/^GHS\s+\d+(\.\d{1,4})?$/.test(r.data.main_balance))throw new ArkeselError('PROVIDER');return {smsCredits:credits,mainBalance:r.data.main_balance,observedAt:new Date(this.now()).toISOString()};}
 async send(message:string,recipients:string[],personalized?:Record<string,Record<string,string>>){
  const c=this.config();if(c.testOnly&&(recipients.length!==1||!c.testNumbers.includes(recipients[0])))throw new ArkeselError('CONFIGURATION');if(!c.sendAllowed||!message.trim()||message.length>1600||recipients.length<1||recipients.length>100||new Set(recipients).size!==recipients.length||recipients.some(p=>canonicalGhanaPhone(p)!==p))throw new ArkeselError('CONFIGURATION');
  if(personalized&&(c.sandbox||process.env.ARKESEL_TEMPLATE_QUALIFIED!=='true'))throw new ArkeselError('CONFIGURATION');
  if(personalized&&(Object.keys(personalized).sort().join()!==recipients.map(p=>p.slice(1)).sort().join()||JSON.stringify(personalized).length>32000))throw new ArkeselError('VALIDATION');
  const payload={sender:c.sender,message,recipients:personalized||recipients.map(p=>p.slice(1)),sandbox:c.sandbox,callback_url:'https://mysteryhub-api.onrender.com/api/sms/arkesel/callback'};
  const r=await this.request(personalized?'/api/v2/sms/template/send':'/api/v2/sms/send','POST',payload,true);
  return recipients.map(phone=>{const rows=Array.isArray(r.data)?r.data.filter((d:any)=>canonicalGhanaPhone(d?.recipient)===phone):[];const invalid=Array.isArray(r.data)&&r.data.some((d:any)=>Array.isArray(d?.['invalid numbers'])&&d['invalid numbers'].some((p:any)=>canonicalGhanaPhone(p)===phone));
   if(rows.length===1&&providerId(rows[0].id)&&r.data.filter((d:any)=>d?.id===rows[0].id).length===1&&!invalid)return {phone,id:rows[0].id as string,state:'accepted' as const};return {phone,id:null,state:invalid&&rows.length===0?'rejected' as const:'uncertain' as const};});
 }
 async senderStatus(){
  const c=this.config();if(!c.senderValid)throw new ArkeselError('CONFIGURATION');
  try{const response=await this.request('/api/v3/sender-ids/'+encodeURIComponent(c.sender)+'/status');const data=response.data;
   if(data?.sender_id!==c.sender||!['pending','approved','rejected','block'].includes(data?.verification_status))throw new ArkeselError('PROVIDER');
   return {sourceFingerprint:senderFingerprint(c),sender:c.sender,status:data.verification_status as string,documentsRequired:/^Your sender ID is approved but requires further documentation\./i.test(String(data.verification_message||'')),checkedAt:new Date(this.now()).toISOString()};
  }catch(error){if(error instanceof ArkeselError)return {sourceFingerprint:senderFingerprint(c),sender:c.sender,status:'unverified',reason:error.details?.httpStatus===404?'not_found_or_shared':error.code,documentsRequired:null,checkedAt:new Date(this.now()).toISOString()};throw error;}
 }
 async webhookConfiguration(){const configuration=this.config();const r=await this.request('/api/v2/webhooks/secret');if(typeof r.data?.configured!=='boolean')throw new ArkeselError('PROVIDER');const secret=r.data.secret,local=configuration.secret;if(r.data.configured&&(typeof secret!=='string'||secret.length<16||secret.length>256))throw new ArkeselError('PROVIDER');const a=Buffer.from(typeof secret==='string'?secret:''),b=Buffer.from(local);return {configurationFingerprint:signingFingerprint(configuration),configured:r.data.configured,matchesLocalSecret:!!local&&a.length===b.length&&timingSafeEqual(a,b),checkedAt:new Date(this.now()).toISOString()};}
 async reports(ids:string[]){if(!ids.length||ids.length>100||ids.some(id=>!providerId(id)))throw new ArkeselError('VALIDATION');const r=await this.request('/api/v2/sms/message-reports','POST',{msg_ids:ids});return ids.map(id=>this.report(id,r.data?.[id]));}
 async detail(id:string){if(!providerId(id))throw new ArkeselError('VALIDATION');const r=await this.request('/api/v2/sms/'+encodeURIComponent(id));if(r.data?.ID!==id)throw new ArkeselError('PROVIDER');return this.report(id,r.data);}
 private report(id:string,d:any){const phone=canonicalGhanaPhone(d?.recipient);return {id,phone,status:normalizeStatus(d?.status),segments:Number.isSafeInteger(d?.message_count)&&d.message_count>0?d.message_count:null};}
}
/** Matches the official PHP JSON_UNESCAPED_SLASHES recipe, including escaped UTF16 units. */
export function canonicalCallback(value:unknown):string {
 const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
 return JSON.stringify(sorted(value)).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
export function verifyArkeselCallback(query:unknown,headers:{timestamp?:unknown;signature?:unknown;id?:unknown},config=arkeselConfig(),now=Date.now()){
 if(!config.secret||typeof headers.timestamp!=='string'||!/^\d{10}$/.test(headers.timestamp)||Math.abs(now/1000-Number(headers.timestamp))>300||!providerId(headers.id)||typeof headers.signature!=='string'||headers.signature.length>300)throw new ArkeselError('AUTH');
 const payload=headers.timestamp+'.'+canonicalCallback(query),signatures=headers.signature.split(',').map(s=>s.trim()).filter(s=>/^v1=[a-f0-9]{64}$/i.test(s)).map(s=>Buffer.from(s.slice(3),'hex'));
 const keys=[config.secret,...(config.previousSecret&&Number.isFinite(config.previousUntil)&&now<config.previousUntil&&config.previousUntil-now<=86400000?[config.previousSecret]:[])];
 if(!keys.some(key=>{const expected=createHmac('sha256',key).update(payload).digest();return signatures.some(s=>timingSafeEqual(s,expected));}))throw new ArkeselError('AUTH');
 return {id:headers.id,timestamp:Number(headers.timestamp),digest:createHash('sha256').update(payload).digest('hex')};
}

/** Never persist provider prose, phone numbers, message bodies, keys or account metadata. */
export function validationFields(payload:any){
 const allowed=['sender','message','recipients','callback_url','sandbox','use_case','scheduled_date'];
 const fields=new Set<string>();
 if(payload?.errors&&typeof payload.errors==='object')for(const key of Object.keys(payload.errors)){const base=key.split('.')[0];if(allowed.includes(base))fields.add(base);}
 const message=typeof payload?.message==='string'?payload.message:'';
 for(const field of allowed)if(new RegExp('\\b'+field.replace('_','[ _]')+'\\b','i').test(message))fields.add(field);
 return [...fields].sort();
}
