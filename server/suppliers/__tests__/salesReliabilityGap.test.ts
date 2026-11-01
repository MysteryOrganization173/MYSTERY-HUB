import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {AddressInfo} from 'node:net';
import {apiRouter} from '../../routes/api.js';
import {adminRouter} from '../../routes/adminApi.js';
import {AuthStore} from '../../db/authStore.js';
import {FulfilmentService} from '../../services/fulfilmentService.js';
import {PaystackServerService} from '../../services/paystackService.js';

test('wallet connectivity cannot substitute for separate checkout reliability evidence',async()=>{
  const env={...process.env},provider=FulfilmentService.getProvider(),services=provider.client.getServices,balance=provider.getBalance;
  const payment=PaystackServerService.initializeTransaction;
  delete process.env.DATABASE_URL;process.env.NODE_ENV='test';process.env.SUCCESS_BIZ_HUB_API_KEY='synthetic';process.env.SUCCESS_BIZ_HUB_FULFILLMENT_ENABLED='true';
  let charges=0;
  provider.client.getServices=async()=>{throw Object.assign(new Error('Synthetic timeout'),{isTimeout:true});};
  provider.getBalance=async()=>({providerName:'success_biz_hub',currency:'GHS',balanceGhc:1000,balancePesewas:100000});
  const originalBalance=Object.getPrototypeOf(provider).getBalance;
  Object.getPrototypeOf(provider).getBalance=provider.getBalance;
  const originalResolve=provider.resolvePackage;
  provider.resolvePackage=async()=>({resolved:null,error:'Synthetic catalogue unavailable'});
  PaystackServerService.initializeTransaction=async()=>{charges++;throw Error('No live initialization allowed');};
  const app=express();app.use(express.json());app.use('/api/admin',adminRouter);app.use('/api',apiRouter);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const root=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await AuthStore.createUser({id:'sales-gap-admin',name:'Synthetic admin',email:null,phone:null,passwordHash:'fixture',role:'admin'});
    await AuthStore.createSession('sales-gap-admin','sales-gap-token');
    for(let i=0;i<3;i++)assert.equal((await FulfilmentService.preflightCheck('mtn','2GB','0241111111')).allowed,false);
    const headers={Authorization:'Bearer sales-gap-token'};
    const health=await (await fetch(root+'/api/admin/system',{headers})).json();
    assert.equal(health.system.components.successBizHub.status,'connected');
    const sales=await fetch(root+'/api/admin/sales-reliability',{headers});
    assert.equal(sales.status,200,'Admin needs independent purchasing evidence even when wallet health is green.');
    const body=await sales.json();
    assert.notEqual(body.data?.state,'healthy','Missing persistence must not invent healthy checkout.');
    assert.equal(charges,0);
  }finally{
    server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));
    provider.client.getServices=services;provider.getBalance=balance;provider.resolvePackage=originalResolve;Object.getPrototypeOf(provider).getBalance=originalBalance;PaystackServerService.initializeTransaction=payment;
    for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);
  }
});
