import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdminReadGate,adminReadMessage,commercialCash} from '../../../src/utils/adminCommercialRefresh.js';
import {readFileSync} from 'node:fs';
test('retry latch stops duplicate requests and releases after failure',()=>{const g=createAdminReadGate();const a=g.start()!;assert.equal(g.start(),null);g.finish(a);assert.ok(g.start());});
test('older session/unmounted work cannot overwrite current state',()=>{const g=createAdminReadGate();const a=g.start()!;g.invalidate();const b=g.start()!;assert.equal(g.current(a),false);assert.equal(g.current(b),true);g.finish(a);assert.equal(g.start(),null);g.invalidate();assert.equal(g.current(b),false);});
test('unknown, missing, corrupt and real zero amounts differ',()=>{for(const n of [null,undefined,NaN,'0'])assert.equal(commercialCash(n),'Unknown / not configured');assert.match(commercialCash(0),/0.00/);});
test('expired sessions explain sign-in, generic failures do not expose raw server text',()=>{for(const status of [401,403])assert.match(adminReadMessage({status}),/Sign in again/);assert.doesNotMatch(adminReadMessage(new Error('secret')),/secret/);assert.match(adminReadMessage({status:503}),/does not confirm/);});
test('loading, retrying and error content are mutually exclusive with guarded cleanup',()=>{const s=readFileSync('src/components/admin/sections/AdminCommercialSection.tsx','utf8');assert.match(s,/phase==='error'\?/);assert.match(s,/Retry commercial settings/);assert.match(s,/controller.current\?\.abort\(\)/);assert.match(s,/gate.current.current\(id\)/);assert.match(s,/dependencyStatus\?\.supplierCosts/);});
