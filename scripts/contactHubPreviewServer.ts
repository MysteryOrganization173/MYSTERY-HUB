/** Local synthetic acceptance server only; refuses application databases and production mode. */
import assert from 'node:assert/strict';
import express from 'express';
import {AuthStore} from '../server/db/authStore.js';
import {OrdersStore} from '../server/db/ordersStore.js';
import {contactHubRouter} from '../server/routes/contactHubApi.js';
import {contactDataset,contactOrder} from '../server/suppliers/__tests__/fixtures/contactHub.js';
assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
for(const u of contactDataset().users)await AuthStore.createUser({id:u.id,name:u.name,email:u.email,phone:u.phone,passwordHash:'synthetic',role:u.role,status:u.status});
for(const o of contactDataset().orders)await OrdersStore.createOrder(o);
for(let i=0;i<36;i++){
 const id='browser-person-'+String(i).padStart(2,'0');await AuthStore.createUser({id,name:'Synthetic Customer '+i,email:`synthetic-${i}@example.test`,phone:'025'+String(1000000+i),passwordHash:'synthetic',role:'customer'});
 if(i%3!==0)await OrdersStore.createOrder(contactOrder(id,i));
}
for(const width of [360,390,430,768,1280]){const id='browser-admin-'+width;await AuthStore.createUser({id,name:'Synthetic administrator',email:null,phone:null,passwordHash:'synthetic',role:'admin'});await AuthStore.createSession(id,id);}
const app=express();app.use(express.json({limit:'32kb'}));app.use('/api/admin/contacts',contactHubRouter);app.use(express.static('/tmp/contact-hub-browser'));
const server=app.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:(server.address() as any).port})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
