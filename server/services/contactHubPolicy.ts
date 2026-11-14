import {FinanceError} from '../db/financeStore.js';
import {qualifyingSale} from './adminReporting.js';
import type {OrderRecord} from '../types/orders.js';
import {canonicalGhanaPhone} from '../utils/phone.js';
import type {UserRecord,WaitlistRecord} from '../types/auth.js';
import {CONTACT_SEGMENTS,CONTACT_SORTS,type ContactFilters,type ContactRow,type ContactPurpose} from '../../shared/contactHub.js';

export const CONTACT_EXPORT_LIMIT=10000;
export const CONTACT_BASIS=[
 'Registered purchases use user_id only. Guest activity uses recipient_phone only and never identifies the purchaser.',
 'Lifetime completed spending is GHS customer spending, not platform revenue or profit. Network/service filters select identities; metrics remain lifetime.',
 'Paid Paystack/Wallet, delivered with valid timestamps; refunds, unresolved review and registered synthetic fixtures excluded. Archived purchases remain included.',
 'Repeat: 2+; frequent: 5+; high value: at/above the 90th spending percentile among registered buyers, including ties. Formerly active: repeat buyers with 30+ days since delivery. Recognition grants no discount.',
 'Account contacts are provided, not verified ownership or active-number evidence. SMS marketing consent is unknown; Web Push consent is separate.',
];
const one=(value:unknown,fallback:string,allowed:readonly string[])=>{const v=value===undefined?fallback:value;if(typeof v!=='string'||!allowed.includes(v))throw new FinanceError('Choose a supported contact filter.');return v;};
export function contactFilters(input:Record<string,unknown>):ContactFilters {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new FinanceError('Choose valid contact filters.');
 const allowed=['source','segment','sort','q','inactiveDays','recentDays','page','limit','status','phone','permission','vip','network','service','minPurchases','maxPurchases','minSpending','maxSpending','firstFrom','firstTo','lastFrom','lastTo','minDays','maxDays'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw new FinanceError('Unexpected contact filter.');
 const number=(key:string,fallback:number|null,max=100000000)=>{const raw=input[key];if(raw===undefined||raw===''||raw===null&&fallback===null)return fallback;if(typeof raw!=='string'&&typeof raw!=='number'||!/^\d+$/.test(String(raw)))throw new FinanceError('Use whole nonnegative filter values.');const n=Number(raw);if(!Number.isSafeInteger(n)||n>max)throw new FinanceError('Contact filter exceeds its supported limit.');return n;};
 const date=(key:string)=>{const v=input[key];if(v===undefined||v==='')return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw new FinanceError('Use valid calendar dates.');return v;};
 if(input.q!==undefined&&(typeof input.q!=='string'||input.q.length>100||/[\x00-\x1f]/.test(input.q)))throw new FinanceError('Use a search of at most 100 characters.');
 const f:ContactFilters={source:one(input.source,'registered',['registered','guest']) as any,segment:one(input.segment,'all',CONTACT_SEGMENTS) as any,sort:one(input.sort,'last',CONTACT_SORTS) as any,q:String(input.q||'').trim(),inactiveDays:number('inactiveDays',30,3650)!,recentDays:number('recentDays',14,3650)!,page:number('page',1,100000)!,limit:number('limit',25,100)!,status:one(input.status,'all',['all','active','disabled']) as any,phone:one(input.phone,'all',['all','valid','missing','invalid']) as any,permission:one(input.permission,'all',['all','unknown','suppressed','service_notice_review']) as any,vip:one(input.vip,'all',['all','repeat','frequent','high_value','formerly_active']) as any,network:one(input.network,'all',['all','mtn','telecel','airteltigo']),service:one(input.service,'all',['all','data','airtime','instant_bundle','afa','results_checker','marketplace']),minPurchases:number('minPurchases',null),maxPurchases:number('maxPurchases',null),minSpending:number('minSpending',null),maxSpending:number('maxSpending',null),firstFrom:date('firstFrom'),firstTo:date('firstTo'),lastFrom:date('lastFrom'),lastTo:date('lastTo'),minDays:number('minDays',null,100000),maxDays:number('maxDays',null,100000)};
 if(!f.page||!f.limit||!f.inactiveDays||!f.recentDays)throw new FinanceError('Page, size and intervals must be positive.');
 for(const [min,max] of [['minPurchases','maxPurchases'],['minSpending','maxSpending'],['minDays','maxDays'],['firstFrom','firstTo'],['lastFrom','lastTo']] as const)if(f[min]!==null&&f[max]!==null&&f[min]!==''&&f[max]!==''&&f[min]!>f[max]!)throw new FinanceError('Filter range must be ordered.');
 if(f.source==='guest'&&(!['all','recent','inactive'].includes(f.segment)||f.vip!=='all'||f.status!=='all'))throw new FinanceError('Guest recipient activity is not a registered buyer classification.');
 return f;
}
export function contactSale(o:OrderRecord,now:number){return qualifyingSale(o)&&!o.manual_review&&(!o.resolution_json||o.resolution_json.stage==='resolved')&&[o.paid_at,o.delivered_at].every(d=>d&&Number.isFinite(Date.parse(d))&&Date.parse(d)<=now);}
export function decorateContacts(rows:ContactRow[],now:number):ContactRow[]{
 const spending=rows.filter(r=>r.source==='registered'&&r.purchases>0).map(r=>r.spendingMinor).sort((a,b)=>a-b),threshold=spending[Math.ceil(spending.length*.9)-1];
 const duplicates=new Map<string,number>();for(const r of rows)if(r.phone)duplicates.set(r.phone,(duplicates.get(r.phone)||0)+1);
 return rows.map(r=>({...r,sharedPhoneRecords:r.phone?duplicates.get(r.phone)!:0,daysInactive:r.lastAt?Math.floor((now-Date.parse(r.lastAt))/86400000):null,averageMinor:r.purchases?Math.round(r.spendingMinor/r.purchases):null,supportReviewEligible:r.source==='registered'&&r.status==='active'&&!!r.phone&&r.purchases>0&&r.smsPermission!=='sms_unsubscribed'&&!r.supportRestricted,vip:r.source==='guest'?[]:[...(r.purchases>=2?['repeat']:[]),...(r.purchases>=5?['frequent']:[]),...(r.purchases&&r.spendingMinor>=threshold?['high_value']:[]),...(r.purchases>=2&&r.lastAt&&now-Date.parse(r.lastAt)>=30*86400000?['formerly_active']:[])],segment:r.source==='guest'?'Guest recipient activity':r.purchases===0?'No completed purchases':r.purchases===1?'One-time buyer':'Repeat buyer'}));
}
export function deriveContacts(users:UserRecord[],orders:OrderRecord[],waitlists:WaitlistRecord[],now:Date,options:{syntheticIds?:Set<string>;supportRestrictedIds?:Set<string>}={}):ContactRow[]{
 const base=(id:string,source:'registered'|'guest',rawPhone:string|null):ContactRow=>({id,source,name:null,phone:canonicalGhanaPhone(rawPhone||''),rawPhone,email:null,status:source==='guest'?'not_applicable':'active',registeredAt:null,purchases:0,spendingMinor:0,firstAt:null,lastAt:null,daysInactive:null,averageMinor:null,networks:[],services:[],smsPermission:'unknown',supportRestricted:false,supportReviewEligible:false,vip:[],segment:'',sharedPhoneRecords:0});
 const registered=new Map(users.filter(u=>u.role==='customer').map(u=>[u.id,{...base(u.id,'registered',u.phone),name:u.name,email:u.email,status:u.status,registeredAt:new Date(u.created_at).toISOString(),supportRestricted:options.supportRestrictedIds?.has(u.id)||false}])),guests=new Map<string,ContactRow>();
 for(const o of orders){if(!contactSale(o,+now)||options.syntheticIds?.has(o.id))continue;
  let row:ContactRow|undefined;if(o.user_id)row=registered.get(o.user_id);else {const phone=canonicalGhanaPhone(o.recipient_phone);if(!phone)continue;row=guests.get(phone);if(!row){row=base(phone,'guest',phone);guests.set(phone,row);}}
  if(!row)continue;row.purchases++;row.spendingMinor+=o.amount;if(!Number.isSafeInteger(row.spendingMinor))throw new FinanceError('Contact spending exceeds safe reporting limits.',503);
  const at=new Date(o.delivered_at!).toISOString();row.firstAt=!row.firstAt||at<row.firstAt?at:row.firstAt;row.lastAt=!row.lastAt||at>row.lastAt?at:row.lastAt;
  row.networks=[...new Set([...row.networks,o.network])].sort();row.services=[...new Set([...row.services,o.service_type||'data'])].sort();
 }
 for(const row of [...registered.values(),...guests.values()])if(waitlists.some(w=>w.channel==='sms'&&w.status==='unsubscribed'&&(row.source==='registered'&&w.user_id===row.id||row.phone&&canonicalGhanaPhone(w.contact_normalized||w.contact)===row.phone)))row.smsPermission='sms_unsubscribed';
 return decorateContacts([...registered.values(),...guests.values()],+now);
}
export function matchesContact(r:ContactRow,f:ContactFilters):boolean {
 if(r.source!==f.source||f.q&&!(canonicalGhanaPhone(f.q)&&r.phone===canonicalGhanaPhone(f.q))&&![r.name,r.email,r.rawPhone,r.phone].some(v=>v?.toLowerCase().includes(f.q.toLowerCase())))return false;
 const n=r.purchases,d=r.daysInactive;
 if(f.status!=='all'&&r.status!==f.status||f.network!=='all'&&!r.networks.includes(f.network)||f.service!=='all'&&!r.services.includes(f.service)||f.vip!=='all'&&!r.vip.includes(f.vip))return false;
 if(f.phone==='valid'&&!r.phone||f.phone==='missing'&&!!r.rawPhone?.trim()||f.phone==='invalid'&&(!r.rawPhone?.trim()||r.phone))return false;
 if(f.permission==='unknown'&&r.smsPermission!=='unknown'||f.permission==='suppressed'&&r.smsPermission!=='sms_unsubscribed'||f.permission==='service_notice_review'&&!r.supportReviewEligible)return false;
 if(f.segment==='no_purchases'&&n!==0||f.segment==='one_time'&&n!==1||f.segment==='repeat'&&n<2||f.segment==='frequent'&&n<5||f.segment==='high_value'&&!r.vip.includes('high_value')||f.segment==='recent'&&(d===null||d>=f.recentDays)||f.segment==='inactive'&&(d===null||d<f.inactiveDays)||f.segment==='at_risk'&&(d===null||d<f.recentDays||d>=f.inactiveDays))return false;
 for(const [value,min,max] of [[n,f.minPurchases,f.maxPurchases],[r.spendingMinor,f.minSpending,f.maxSpending],[d,f.minDays,f.maxDays]])if(min!==null&&(value===null||value<min)||max!==null&&(value===null||value>max))return false;
 for(const [value,from,to] of [[r.firstAt,f.firstFrom,f.firstTo],[r.lastAt,f.lastFrom,f.lastTo]])if(from&&(!value||value.slice(0,10)<from)||to&&(!value||value.slice(0,10)>to))return false;
 return true;
}
export function sortContacts(rows:ContactRow[],sort:ContactFilters['sort']):ContactRow[]{
 const field={last:'lastAt',inactive:'lastAt',first:'firstAt',spending:'spendingMinor',spending_low:'spendingMinor',purchases:'purchases',purchases_low:'purchases',newest:'registeredAt',oldest:'registeredAt',name:'name'}[sort] as keyof ContactRow;
 const direction=['last','spending','purchases','newest'].includes(sort)?-1:1;
 return [...rows].sort((a,b)=>{const x=a[field] as string|number|null,y=b[field] as typeof x;return x===null?(y===null?Buffer.compare(Buffer.from(a.id),Buffer.from(b.id)):1):y===null?-1:((typeof x==='string'&&typeof y==='string'?Buffer.compare(Buffer.from(x),Buffer.from(y)):x<y?-1:x>y?1:0)*direction||Buffer.compare(Buffer.from(a.id),Buffer.from(b.id)));});
}
export function purposeEligible(row:ContactRow,purpose:ContactPurpose){return purpose==='marketing'?false:purpose==='support_notice'?row.supportReviewEligible:purpose==='guest_reference'?row.source==='guest':row.source==='registered';}
