import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recipientVerification} from '../recipientVerification.js';
import {parseBeneficiaryEligibility} from '../successBizHub/beneficiary.js';
import {checkoutFailurePresentation,preflightFailure} from '../../../shared/checkoutFailure.js';
const context={recipient:'0241234567',network:'mtn',offer:'mtn-data',provider:'success_biz_hub' as const};
for(const outcome of ['eligible','ineligible','unknown'] as const)test('context-bound '+outcome,()=>{const d=recipientVerification(context,{eligible:outcome==='eligible',outcome},'2026-11-14T00:00:00Z');assert.equal(d.outcome,outcome);assert.equal(d.context.offer,'mtn-data');assert.equal(d.verificationSubmitted,false);assert.equal(d.observedAt,'2026-11-14T00:00:00Z');});
test('unqualified cross-supplier, invalid phone/network/selector and inconsistent evidence cannot approve',()=>{
 for(const changed of [{recipient:'bad'},{network:'unsupported'},{offer:''}])assert.equal(recipientVerification({...context,...changed},{eligible:true,outcome:'eligible'}).outcome,'unknown');
 assert.equal(recipientVerification({...context,provider:'telcogh'},{eligible:true,outcome:'eligible'}).outcome,'unsupported');
 assert.equal(recipientVerification(context,{eligible:true,outcome:'ineligible'}).outcome,'unknown');
});
test('explicit product mismatch cannot supply recipient evidence',()=>{
 for(const data of [{eligible:true,offerSlug:'other'},{results:[{phone:context.recipient,eligible:true,offerSlug:'other'}]}])assert.equal(parseBeneficiaryEligibility({success:true,data},context.recipient,{offerSlug:context.offer}).outcome,'unknown');
 assert.equal(parseBeneficiaryEligibility({data:{eligible:true,offerSlug:'mtn-data'}},context.recipient,{offerSlug:context.offer}).outcome,'eligible');
});
test('generic rejection remains a possibility, not enrollment or SIM diagnosis',()=>{
 const view=checkoutFailurePresentation('BENEFICIARY_NOT_ELIGIBLE');assert.match(view.message,/may need additional verification/);assert.match(view.message,/cannot confirm/);assert.doesNotMatch(view.message,/SIM|24–72|has been submitted|will be approved/);assert.equal(preflightFailure('BENEFICIARY_NOT_ELIGIBLE').verificationSubmitted,false);
 assert.notEqual(view.message,checkoutFailurePresentation('BENEFICIARY_CHECK_UNAVAILABLE').message);
});
