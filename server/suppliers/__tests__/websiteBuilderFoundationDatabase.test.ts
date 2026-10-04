/** Exercise PostgreSQL persistence at the pg query boundary; no live DB connection. */
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import pg from 'pg';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebsiteUltraStore } from '../../db/websiteUltraStore.js';
import { ultraRouter } from '../../routes/websiteUltraApi.js';
import { WebsiteStore } from '../../db/websiteStore.js';
const originalQuery = pg.Pool.prototype.query;
const oldUrl = process.env.DATABASE_URL;
const input = { businessName: "Ama's Studio", businessType:'Design', contactName:'Ama', phone:'0241111111', existingDomain:'no', estimatedPages:2, featuresRequirements:'Gallery', preferredStyle:'Clean', projectNotes:'Launch soon' };
let statements: { sql:string; values:any[] }[] = [], leads: any[] = [], site: any, failInsert = false;
let server: Server, base: string;
before(async () => {
  process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted'; process.env.NODE_ENV='test';
  pg.Pool.prototype.query = (async (sql:string, values:any[]=[]) => {
    statements.push({sql,values});
    if (sql.startsWith('INSERT INTO website_ultra_enquiries')) {
      if (failInsert) throw new Error('Fixture write failed');
      leads.push({id:values[0],reference:values[1],user_id:values[2],brief:JSON.parse(values[3]),status:values[4],created_at:values[5]});return {rows:[]};
    }
    if (sql.startsWith('SELECT COUNT(*) FROM website_ultra')) return {rows:[{count:String(leads.length)}]};
    if (sql.includes('FROM website_ultra_enquiries')) return {rows:leads.slice(values[1],values[1]+values[0])};
    if (sql.startsWith('SELECT * FROM website_sites WHERE id')) return {rows:[structuredClone(site)]};
    if (sql.includes('UPDATE website_sites')) {site.content_json=JSON.parse(values[1]);return {rows:[]};}
    throw new Error(`Unexpected query: ${sql}`);
  }) as any;
  const app=express();app.use(express.json());app.use('/ultra',ultraRouter);
  server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async()=>{pg.Pool.prototype.query=originalQuery;if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{statements=[];leads=[];failInsert=false;site={id:'site-db',user_id:'owner',name:'Studio',template_id:'tmpl-start-blank',slug:'studio',status:'draft',content_json:{businessName:'Studio'},settings_json:{primaryColor:'#000000',accentColor:'#00c365'},created_at:new Date().toISOString(),updated_at:new Date().toISOString(),published_at:null};});
test('PostgreSQL enquiry insert parameterizes contacts and stores exact sanitized brief',async()=>{const record=await WebsiteUltraStore.create(input,'owner');const saved=await WebsiteUltraStore.list(25,0);assert.equal(saved.total,1);assert.equal(saved.enquiries[0].reference,record.reference);assert.equal(saved.enquiries[0].user_id,'owner');assert.equal(saved.enquiries[0].brief.businessName,"Ama's Studio");assert.ok(!statements[0].sql.includes("Ama's"));assert.ok(statements[0].sql.includes('$6'));});
test('database listing passes bounded pagination as parameters',async()=>{await WebsiteUltraStore.create(input);await WebsiteUltraStore.list(10,20);const select=statements.find(s=>s.sql.includes('ORDER BY'));assert.deepEqual(select?.values,[10,20]);});
test('failed database insert returns 503 without success reference or WhatsApp link',async()=>{failInsert=true;const response=await fetch(`${base}/ultra/enquiries`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,503);const body=await response.json();assert.equal(body.whatsappUrl,undefined);assert.equal(body.reference,undefined);assert.equal(leads.length,0);});
test('invalid enquiry is rejected before any database query',async()=>{await assert.rejects(()=>WebsiteUltraStore.create({...input,estimatedPages:999}));assert.equal(statements.length,0);});
test('section composition update survives PostgreSQL JSONB normalization',async()=>{const {createWebsiteComposition}=await import('../../../src/config/websiteBuilder.js');const composition=createWebsiteComposition(['header','contact','hero','footer']);await WebsiteStore.updateSite('site-db','owner',{content:{composition}});const loaded=await WebsiteStore.findSiteById('site-db');assert.deepEqual(loaded?.content_json.composition,composition);const write=statements.find(s=>s.sql.includes('UPDATE website_sites'));assert.deepEqual(write?.values.slice(-2),['site-db','owner']);});
