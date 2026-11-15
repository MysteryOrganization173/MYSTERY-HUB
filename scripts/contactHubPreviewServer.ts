/** Local synthetic acceptance server only; refuses application databases and production mode. */
import assert from 'node:assert/strict';
import express from 'express';
import {AuthStore} from '../server/db/authStore.js';
import {OrdersStore} from '../server/db/ordersStore.js';
import {contactHubRouter} from '../server/routes/contactHubApi.js';
import {contactDataset,contactOrder} from '../server/suppliers/__tests__/fixtures/contactHub.js';
import {contactV2Dataset} from '../server/suppliers/__tests__/fixtures/contactHubV2.js';
import {FinanceStore} from '../server/db/financeStore.js';
import {CustomerChampions} from '../server/services/customerChampions.js';
assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
for(const u of contactDataset().users)await AuthStore.createUser({id:u.id,name:u.name,email:u.email,phone:u.phone,passwordHash:'synthetic',role:u.role,status:u.status});
for(const o of contactDataset().orders)await OrdersStore.createOrder(o);
const v2=contactV2Dataset();for(const u of v2.users)await AuthStore.createUser({id:u.id,name:u.name,email:u.email,phone:u.phone,passwordHash:'synthetic',role:u.role,status:u.status});for(const o of v2.orders)await OrdersStore.createOrder(o);
await FinanceStore.transaction('finance-only',async tx=>{await tx.create('store_checkout','browser-source-evidence',1000,{orderId:'reseller-finance'},'pending');});
await CustomerChampions.evidence('staff',{orderId:'direct-guest-v2',payerName:'Verified payer',payerPhone:'0599990003',evidence:'Synthetic isolated payer verification fixture',payerConfirmed:true,confirmed:true,requestId:'browser-verified-payer-v2'});
for(let i=0;i<36;i++){
 const id='browser-person-'+String(i).padStart(2,'0');await AuthStore.createUser({id,name:'Synthetic Customer '+i,email:`synthetic-${i}@example.test`,phone:'025'+String(1000000+i),passwordHash:'synthetic',role:'customer'});
 if(i%3!==0)await OrdersStore.createOrder(contactOrder(id,i));
}
for(const width of [360,390,430,768,1280]){const id='browser-admin-'+width;await AuthStore.createUser({id,name:'Synthetic administrator',email:null,phone:null,passwordHash:'synthetic',role:'admin'});await AuthStore.createSession(id,id);}
const app=express();app.use(express.json({limit:'32kb'}));app.use('/api/admin/contacts',contactHubRouter);app.use(express.static('/tmp/contact-hub-v2-browser'));
const server=app.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:(server.address() as any).port})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
