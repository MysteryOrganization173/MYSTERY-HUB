import {FinanceError} from '../db/financeStore.js';
import {qualifyingSale} from './adminReporting.js';
import type {OrderRecord} from '../types/orders.js';
import {canonicalGhanaPhone} from '../utils/phone.js';
import type {UserRecord,WaitlistRecord} from '../types/auth.js';
import type {ContactSmsWithdrawal} from './contactHubSuppression.js';
import {CONTACT_SEGMENTS,CONTACT_SORTS,type ContactFilters,type ContactRow,type ContactPurpose} from '../../shared/contactHub.js';

export const CONTACT_EXPORT_LIMIT=10000;
export const CONTACT_BASIS=[
 'Direct orders exclude all storefront snapshots, store payment references and linked store finance operations. Account ownership uses user_id only; recipient phones never assign purchases.',
 'Lifetime direct completed spending is GHS customer spending, not platform revenue or profit. Network/service filters select identities; metrics remain lifetime.',
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
 const f:ContactFilters={source:one(input.source,'all',['all','registered','guest','recipient','payer']) as any,segment:one(input.segment,'all',CONTACT_SEGMENTS) as any,sort:one(input.sort,'last',CONTACT_SORTS) as any,q:String(input.q||'').trim(),inactiveDays:number('inactiveDays',30,3650)!,recentDays:number('recentDays',14,3650)!,page:number('page',1,100000)!,limit:number('limit',25,100)!,status:one(input.status,'all',['all','active','disabled']) as any,phone:one(input.phone,'all',['all','valid','missing','invalid']) as any,permission:one(input.permission,'all',['all','unknown','suppressed','service_notice_review']) as any,vip:one(input.vip,'all',['all','repeat','frequent','high_value','formerly_active']) as any,network:one(input.network,'all',['all','mtn','telecel','airteltigo']),service:one(input.service,'all',['all','data','airtime','instant_bundle','afa','results_checker','marketplace']),minPurchases:number('minPurchases',null),maxPurchases:number('maxPurchases',null),minSpending:number('minSpending',null),maxSpending:number('maxSpending',null),firstFrom:date('firstFrom'),firstTo:date('firstTo'),lastFrom:date('lastFrom'),lastTo:date('lastTo'),minDays:number('minDays',null,100000),maxDays:number('maxDays',null,100000)};
 if(!f.page||!f.limit||!f.inactiveDays||!f.recentDays)throw new FinanceError('Page, size and intervals must be positive.');
 for(const [min,max] of [['minPurchases','maxPurchases'],['minSpending','maxSpending'],['minDays','maxDays'],['firstFrom','firstTo'],['lastFrom','lastTo']] as const)if(f[min]!==null&&f[max]!==null&&f[min]!==''&&f[max]!==''&&f[min]!>f[max]!)throw new FinanceError('Filter range must be ordered.');
 if(!['registered','all'].includes(f.source)&&(!['all','recent','inactive'].includes(f.segment)||f.vip!=='all'||f.status!=='all'))throw new FinanceError('Guest recipient activity is not a registered buyer classification.');
 if(f.source==='all'&&(f.segment!=='all'||f.vip!=='all'||f.status!=='all'||f.minSpending!==null||f.maxSpending!==null))throw new FinanceError('Choose Registered Customers for buyer metrics.');
 return f;
}
export function directContactOrder(o:OrderRecord,storeOrderIds:Set<string>=new Set()){return o.store_context==null&&!o.payment_reference?.startsWith('MH_STORE_')&&!storeOrderIds.has(o.id);}
export type GuestPayerEvidence={order_id:string;buyer_key:string;payer_name:string;payer_phone:string};
export function contactSale(o:OrderRecord,now:number){return directContactOrder(o)&&qualifyingSale(o)&&!o.manual_review&&(!o.resolution_json||o.resolution_json.stage==='resolved')&&[o.paid_at,o.delivered_at].every(d=>d&&Number.isFinite(Date.parse(d))&&Date.parse(d)<=now);}
export function decorateContacts(rows:ContactRow[],now:number):ContactRow[]{
 const spending=rows.filter(r=>r.source==='registered'&&r.purchases>0).map(r=>r.spendingMinor).sort((a,b)=>a-b),threshold=spending[Math.ceil(spending.length*.9)-1];
 const duplicates=new Map<string,number>();for(const r of rows)if(r.phone&&r.source!=='directory'&&r.source!=='guest')duplicates.set(r.phone,(duplicates.get(r.phone)||0)+1);
 return rows.map(r=>({...r,sharedPhoneRecords:r.phone?duplicates.get(r.phone)!:0,daysInactive:r.lastAt?Math.floor((now-Date.parse(r.lastAt))/86400000):null,averageMinor:r.purchases?Math.round(r.spendingMinor/r.purchases):null,supportReviewEligible:r.source==='registered'&&r.status==='active'&&!!r.phone&&r.purchases>0&&r.smsPermission!=='sms_unsubscribed'&&!r.supportRestricted&&!r.smsRestrictions?.some(p=>p==='transactional'||p==='operational')&&!rows.some(other=>!!r.phone&&other.phone===r.phone&&(other.supportRestricted||other.smsPermission==='sms_unsubscribed')),vip:r.source!=='registered'?[]:[...(r.purchases>=2?['repeat']:[]),...(r.purchases>=5?['frequent']:[]),...(r.purchases&&r.spendingMinor>=threshold?['high_value']:[]),...(r.purchases>=2&&r.lastAt&&now-Date.parse(r.lastAt)>=30*86400000?['formerly_active']:[])],segment:r.source!=='registered'?(r.source==='payer'?'Verified direct guest payer':'Direct recipient activity'):r.purchases===0?'No completed purchases':r.purchases===1?'One-time buyer':'Repeat buyer'}));
}
export function deriveContacts(users:UserRecord[],orders:OrderRecord[],waitlists:WaitlistRecord[],now:Date,options:{syntheticIds?:Set<string>;supportRestrictedIds?:Set<string>;storeOrderIds?:Set<string>;guestPayers?:GuestPayerEvidence[];metricExcludedIds?:Set<string>;smsWithdrawals?:ContactSmsWithdrawal[]}={}):ContactRow[]{
 const real=orders.filter(o=>!options.syntheticIds?.has(o.id)),direct=real.filter(o=>directContactOrder(o,options.storeOrderIds));
 const storeUsers=new Set(real.filter(o=>!directContactOrder(o,options.storeOrderIds)).map(o=>o.user_id));
 const directUsers=new Set(direct.map(o=>o.user_id));
 const base=(id:string,source:ContactRow['source'],rawPhone:string|null):ContactRow=>({id,source,provenance:[source==='registered'?'registered_account':source==='payer'?'verified_guest_payer':source==='guest'?'guest_recipient':'registered_order_recipient'],accountIds:source==='registered'?[id]:[],name:null,phone:canonicalGhanaPhone(rawPhone||''),rawPhone,email:null,status:source==='registered'?'active':'not_applicable',registeredAt:null,purchases:0,spendingMinor:0,firstAt:null,lastAt:null,daysInactive:null,averageMinor:null,networks:[],services:[],smsPermission:'unknown',smsRestrictions:[],supportRestricted:false,supportReviewEligible:false,vip:[],segment:'',sharedPhoneRecords:0});
 const registered=new Map(users.filter(u=>u.role==='customer'&&(!storeUsers.has(u.id)||directUsers.has(u.id))).map(u=>[u.id,{...base(u.id,'registered',u.phone),name:u.name,email:u.email,status:u.status,registeredAt:new Date(u.created_at).toISOString(),supportRestricted:options.supportRestrictedIds?.has(u.id)||false}]));
 const contacts=new Map<string,ContactRow>();
 const add=(r:ContactRow,o:OrderRecord)=>{r.purchases++;if(r.source==='registered'||r.source==='payer')r.spendingMinor+=o.amount;if(!Number.isSafeInteger(r.spendingMinor))throw new FinanceError('Contact spending exceeds safe reporting limits.',503);
  const at=new Date(o.delivered_at!).toISOString();r.firstAt=!r.firstAt||at<r.firstAt?at:r.firstAt;r.lastAt=!r.lastAt||at>r.lastAt?at:r.lastAt;r.networks=[...new Set([...r.networks,o.network])].sort();r.services=[...new Set([...r.services,o.service_type||'data'])].sort();};
 for(const o of direct){if(!contactSale(o,+now)||options.metricExcludedIds?.has(o.id))continue;if(o.user_id&&registered.has(o.user_id))add(registered.get(o.user_id)!,o);
  const phone=canonicalGhanaPhone(o.recipient_phone);
  if(phone)for(const source of (o.user_id?['recipient']:['recipient','guest']) as ('recipient'|'guest')[]){const key=source+phone;let r=contacts.get(key);if(!r){r=base(phone,source,phone);r.provenance=[];contacts.set(key,r);}const label=o.user_id?'registered_order_recipient':'guest_recipient';r.provenance=[...new Set([...r.provenance,label])].sort();add(r,o);}
  if(!o.user_id){const e=options.guestPayers?.find(e=>e.order_id===o.id),payerPhone=e&&canonicalGhanaPhone(e.payer_phone);if(e&&payerPhone){const payerId=e.buyer_key+'|'+payerPhone,key='payer'+payerId;let r=contacts.get(key);if(!r){r={...base(payerId,'payer',payerPhone),name:e.payer_name};contacts.set(key,r);}add(r,o);}}
 }
 const rows=[...registered.values(),...contacts.values()];
 const directory=new Map<string,ContactRow>();
 for(const r of rows){if(!r.phone||r.source==='guest')continue;let d=directory.get(r.phone);if(!d){d={...base(r.phone,'directory',r.phone),provenance:[]};directory.set(r.phone,d);}d.provenance=[...new Set([...d.provenance,...r.provenance])].sort();d.accountIds=[...new Set([...d.accountIds,...r.accountIds])].sort();if(r.source==='recipient'){d.purchases=r.purchases;d.firstAt=r.firstAt;d.lastAt=r.lastAt;d.networks=r.networks;d.services=r.services;}}
 for(const row of [...rows,...directory.values()])if(waitlists.some(w=>w.channel==='sms'&&w.status==='unsubscribed'&&(row.source==='registered'&&w.user_id===row.id||row.phone&&canonicalGhanaPhone(w.contact_normalized||w.contact)===row.phone)))row.smsPermission='sms_unsubscribed';
 for(const d of directory.values())d.searchAliases=rows.filter(r=>r.phone===d.phone).flatMap(r=>[r.name,r.email,r.rawPhone].filter((x):x is string=>!!x)).sort();const all=[...rows,...directory.values()];for(const r of all)r.smsRestrictions=[...new Set((options.smsWithdrawals||[]).filter(w=>w.phone!==null&&w.phone===r.phone||w.user_id!==null&&(r.source==='registered'&&r.id===w.user_id||rows.some(a=>a.source==='registered'&&a.id===w.user_id&&!!r.phone&&a.phone===r.phone))).map(w=>w.purpose))].sort();for(const d of directory.values())if(rows.some(r=>r.phone===d.phone&&r.smsPermission==='sms_unsubscribed'))d.smsPermission='sms_unsubscribed';return decorateContacts(all,+now);
}
export function matchesContact(r:ContactRow,f:ContactFilters):boolean {
 if(r.source!==(f.source==='all'?'directory':f.source)||f.q&&!(canonicalGhanaPhone(f.q)&&r.phone===canonicalGhanaPhone(f.q))&&![r.name,r.email,r.rawPhone,r.phone,...(r.searchAliases||[])].some(v=>v?.toLowerCase().includes(f.q.toLowerCase())))return false;
 const n=r.purchases,d=r.daysInactive;
 if(f.status!=='all'&&r.status!==f.status||f.network!=='all'&&!r.networks.includes(f.network)||f.service!=='all'&&!r.services.includes(f.service)||f.vip!=='all'&&!r.vip.includes(f.vip))return false;
 if(f.phone==='valid'&&!r.phone||f.phone==='missing'&&!!r.rawPhone?.trim()||f.phone==='invalid'&&(!r.rawPhone?.trim()||r.phone))return false;
 if(f.permission==='unknown'&&(r.smsPermission!=='unknown'||!!r.smsRestrictions?.length)||f.permission==='suppressed'&&r.smsPermission!=='sms_unsubscribed'&&!r.smsRestrictions?.length||f.permission==='service_notice_review'&&!r.supportReviewEligible)return false;
 if(f.segment==='formerly_active'&&!r.vip.includes('formerly_active')||f.segment==='no_purchases'&&n!==0||f.segment==='one_time'&&n!==1||f.segment==='repeat'&&n<2||f.segment==='frequent'&&n<5||f.segment==='high_value'&&!r.vip.includes('high_value')||f.segment==='recent'&&(d===null||d>=f.recentDays)||f.segment==='inactive'&&(d===null||d<f.inactiveDays)||f.segment==='at_risk'&&(d===null||d<f.recentDays||d>=f.inactiveDays))return false;
 for(const [value,min,max] of [[n,f.minPurchases,f.maxPurchases],[r.spendingMinor,f.minSpending,f.maxSpending],[d,f.minDays,f.maxDays]])if(min!==null&&(value===null||value<min)||max!==null&&(value===null||value>max))return false;
 for(const [value,from,to] of [[r.firstAt,f.firstFrom,f.firstTo],[r.lastAt,f.lastFrom,f.lastTo]])if(from&&(!value||value.slice(0,10)<from)||to&&(!value||value.slice(0,10)>to))return false;
 return true;
}
export function sortContacts(rows:ContactRow[],sort:ContactFilters['sort']):ContactRow[]{
 const field={last:'lastAt',inactive:'lastAt',first:'firstAt',spending:'spendingMinor',spending_low:'spendingMinor',purchases:'purchases',purchases_low:'purchases',newest:'registeredAt',oldest:'registeredAt',name:'name'}[sort] as keyof ContactRow;
 const direction=['last','spending','purchases','newest'].includes(sort)?-1:1;
 return [...rows].sort((a,b)=>{const x=a[field] as string|number|null,y=b[field] as typeof x;return x===null?(y===null?Buffer.compare(Buffer.from(a.id),Buffer.from(b.id)):1):y===null?-1:((typeof x==='string'&&typeof y==='string'?Buffer.compare(Buffer.from(x),Buffer.from(y)):x<y?-1:x>y?1:0)*direction||Buffer.compare(Buffer.from(a.id),Buffer.from(b.id)));});
}
export function purposeEligible(row:ContactRow,purpose:ContactPurpose){return purpose==='marketing'?false:purpose==='support_notice'?row.supportReviewEligible:purpose==='guest_reference'?row.source!=='registered':true;}
