import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import pg from 'pg';
import {ReferralStore} from '../../db/referralStore.js';
import {AdminEarnStore} from '../../db/adminEarnStore.js';
import {parseEarnQuery} from '../../services/adminEarnQuery.js';
import {saveAdminRewardRule} from '../../services/adminEarnControls.js';
const env={...process.env};const connect=pg.Pool.prototype.connect;const poolQuery=pg.Pool.prototype.query;
let sqls:string[];let argsList:any[][];let failAudit:boolean;let profileEnabled:boolean;let mode:string;
async function query(sql:string,args:any[]=[]){sqls.push(sql);argsList.push(args);
  if(sql.includes('FROM referral_profiles WHERE user_id'))return{rows:[{id:'profile',user_id:'owner',referral_code:'MH-OWNER',is_enabled:profileEnabled,updated_at:'2026-10-01T00:00:00Z'}]};
  if(sql.includes('UPDATE referral_profiles'))return{rows:[{id:'profile',user_id:'owner',referral_code:'MH-OWNER',is_enabled:args[1]}]};
  if(sql.includes('SELECT * FROM referral_reward_rules'))return{rows:[]};
  if(sql.includes('INSERT INTO referral_reward_rules'))return{rows:[{id:args[0],service_type:args[1],network:args[3],product_key:args[2],reward_type:args[4],reward_minor:args[5],enabled:args[7],purchase_stage:args[12],created_at:args[10]}]};
  if(sql.includes('INSERT INTO admin_audit_log')){if(failAudit)throw new Error('audit unavailable');return{rows:[{id:'audit'}]};}
  if(sql.includes(' AS blocked'))return{rows:[{blocked:mode==='blocked'}]};
  if(sql.includes(' AS items'))return{rows:[{total:'0',items:[]}]};
  return{rows:[]};
}
beforeEach(()=>{process.env.NODE_ENV='test';process.env.DATABASE_URL='postgresql://fixture.invalid/never-contacted';sqls=[];argsList=[];failAudit=false;profileEnabled=true;mode='';
  pg.Pool.prototype.query=query as any;pg.Pool.prototype.connect=(async()=>({query,release:()=>{}})) as any;});
afterEach(()=>{pg.Pool.prototype.connect=connect;pg.Pool.prototype.query=poolQuery;process.env={...env};});
test('profile mutation writes durable interval and audit in one transaction',async()=>{await ReferralStore.setProfileEnabled('owner',false,'admin');assert.ok(sqls[0]==='BEGIN');assert.ok(sqls.some(s=>s.includes('FOR UPDATE')));assert.ok(sqls.some(s=>s.includes('INSERT INTO referral_profile_suspensions')));assert.ok(sqls.some(s=>s.includes('INSERT INTO admin_audit_log')));assert.equal(sqls.at(-1),'COMMIT');});
test('audit failure rolls back suspension rather than committing unaudited state',async()=>{failAudit=true;await assert.rejects(ReferralStore.setProfileEnabled('owner',false,'admin'),/audit unavailable/);assert.equal(sqls.at(-1),'ROLLBACK');assert.ok(!sqls.includes('COMMIT'));});
test('resume closes interval without touching old rewards or attributions',async()=>{profileEnabled=false;await ReferralStore.setProfileEnabled('owner',true,'admin');assert.ok(sqls.some(s=>s.includes('UPDATE referral_profile_suspensions SET ends_at = NOW()')));assert.ok(!sqls.some(s=>/UPDATE (reward_ledger|referral_attributions)/.test(s)));});
test('blocked reward creates durable suppression and obtains profile share lock',async()=>{mode='blocked';const result=await ReferralStore.withRewardTransaction('relationship','order',client=>ReferralStore.rewardAllowed('owner','2026-10-03T00:00:00Z',client,'order'));assert.equal(result,false);assert.ok(sqls.some(s=>s.includes('FOR SHARE')));assert.ok(sqls.some(s=>s.includes('INSERT INTO referral_reward_suppressions')));assert.ok(sqls.some(s=>s.includes('order_id = $3')));});
test('rule config and audit are atomic and rolled back together on audit failure',async()=>{failAudit=true;await assert.rejects(saveAdminRewardRule('admin',{service_type:'data',reward_minor:50,enabled:false}),/audit unavailable/);assert.equal(sqls.at(-1),'ROLLBACK');assert.ok(sqls.some(s=>s.includes('admin-referral-rule-config')));});
test('aggregate leaderboard filters search server-side and paginates with bound parameters',async()=>{const result=await AdminEarnStore.leaderboard(parseEarnQuery({period:'30d',page:'2',limit:'10',q:"x' OR TRUE --",sort:'uniqueVisitors',excludeDisabled:'true'}));assert.equal(result.total,0);const sql=sqls[0];assert.ok(sql.includes('LIMIT $7 OFFSET $8'));assert.ok(sql.includes('STRPOS'));assert.ok(!sql.includes("x' OR TRUE"));assert.equal(argsList[0][2],"x' OR TRUE --");assert.equal(argsList[0][7],10);assert.equal(sqls.length,1);});
test('ledger filtering is parameterized with a bounded page and explicit safe fields',async()=>{await AdminEarnStore.ledger(parseEarnQuery({period:'all',status:'reversed',service:'data',stage:'acquisition',referrer:'owner',order:'MH-123'}));assert.ok(sqls[0].includes('LIMIT $8 OFFSET $9'));assert.ok(!sqls[0].includes('metadata_json'));assert.deepEqual(argsList[0].slice(2,7),['reversed','data','acquisition','owner','MH-123']);});
