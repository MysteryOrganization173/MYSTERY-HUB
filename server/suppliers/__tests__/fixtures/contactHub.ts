import type {UserRecord,WaitlistRecord} from '../../../types/auth.js';
import type {OrderRecord} from '../../../types/orders.js';
import {opsOrder} from '../adminOperationsFixtures.js';
export const contactNow=new Date('2026-11-14T12:00:00.000Z');
export function contactUser(id:string,extra:Partial<UserRecord>={}):UserRecord{return {id,name:id,email:`${id}@example.test`,phone:null,password_hash:'NEVER-EXPORT-PASSWORD',role:'customer',status:'active',created_at:'2026-09-01T00:00:00.000Z',updated_at:'2026-09-01T00:00:00.000Z',last_login_at:null,must_change_password:false,password_changed_at:null,...extra};}
export function contactOrder(user_id:string|null,days:number,extra:Partial<OrderRecord>={}):OrderRecord {const at=new Date(+contactNow-days*86400000).toISOString();return opsOrder({user_id,network:'mtn',payment_provider:'paystack',amount:1000,paid_at:at,submitted_at:at,delivered_at:at,created_at:at,updated_at:at,...extra});}
export function contactWaitlist(user_id:string|null,contact:string):WaitlistRecord{return {id:'sms-'+(user_id||contact),user_id,service_key:'future-service',service_title:'Scoped SMS waitlist',channel:'sms',contact,contact_normalized:contact,status:'unsubscribed',source_page:null,admin_note:null,created_at:contactNow.toISOString(),updated_at:contactNow.toISOString(),contacted_at:null};}
export function contactDataset(){
 const users=[contactUser('zero'),contactUser('one',{name:'Ama One',phone:'0591234567'}),contactUser('repeat',{name:'Kojo Repeat',phone:'+233241234567'}),contactUser('frequent',{phone:'0201234567'}),contactUser('disabled',{phone:'0271234567',status:'disabled'}),contactUser('invalid',{phone:'123'}),contactUser('staff',{role:'admin',phone:'0551234567'})];
 const orders=[contactOrder('one',1,{recipient_phone:'0271111111'}),contactOrder('repeat',30),contactOrder('repeat',60,{network:'telecel',archived_at:'2026-11-01T00:00:00Z'}),...Array.from({length:5},(_,i)=>contactOrder('frequent',i+14,{amount:2000})),contactOrder('disabled',90),contactOrder('staff',1),contactOrder(null,2,{recipient_phone:'233241234567',customer_phone:'0551111111',customer_name:'Unrelated guest purchaser'}),contactOrder(null,5,{recipient_phone:'024 123 4567'}),contactOrder(null,1,{recipient_phone:'bad'})];
 return {users,orders,waitlists:[] as WaitlistRecord[]};
}
