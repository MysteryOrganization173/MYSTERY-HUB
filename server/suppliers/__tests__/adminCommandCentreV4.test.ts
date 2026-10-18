import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {REPORT_METRICS} from '../../services/adminReporting.js';
import {REPORT_METRIC_LABELS} from '../../../src/components/admin/sections/AdminBusinessSummary.js';

const source=(path:string)=>readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8');
const overview=source('src/components/admin/sections/AdminOverviewSection.tsx');
const business=source('src/components/admin/sections/AdminBusinessSummary.tsx');
const recent=source('src/components/admin/sections/AdminRecentOrders.tsx');

test('Overview reads today first, then attention and latest orders, then business performance',()=>{
 const order=['id="today-heading"','{attentionPanel}','<AdminRecentOrders','{healthPanel}','<AdminBusinessSummary','<AdminEarnPulse'].map(marker=>overview.lastIndexOf(marker));
 assert.ok(order.every(i=>i>0),'every Overview layer is rendered');
 assert.deepEqual([...order].sort((a,b)=>a-b),order);
});

test('Today figures name distinct populations and never relabel payments as deliveries',()=>{
 for(const label of ['label="Paid orders"','label="Delivered today"','label="Paystack receipts"','label="Needs attention"'])assert.ok(overview.includes(label),label);
 assert.match(overview,/Created today\./);
 assert.match(overview,/by delivery time/);
 assert.match(overview,/by payment time/);
 assert.match(overview,/report\?period=today/);
 assert.match(overview,/Open cases from all dates/);
});

test('every supplier, health and queue alert from Admin V3 remains in the attention list',()=>{
 for(const id of ['supplier-low','supplier-error','dispatch-off','uncertain','orders','withdrawals','inquiries','waitlist'])assert.ok(overview.includes(`id: '${id}'`),id);
 assert.match(overview,/Never resubmit/);
});

test('business performance keeps every V3 figure, one-tap supporting orders and the not-net-profit label',()=>{
 for(const label of ['Paystack order receipts','Completed platform sales','Gross margin · cost known','Supplier cost recorded','Unknown cost exposure','Confirmed customer refunds','Completed customer spending','Wallet redemptions','Paid orders with unresolved remedies','Assisted external collections','Complimentary orders','Accounting basis and limitations'])assert.ok(business.includes(label),label);
 assert.match(business,/Not net profit/);
 assert.doesNotMatch(business,/net profit:/i);
 for(const metric of REPORT_METRICS)assert.ok(REPORT_METRIC_LABELS[metric],metric);
 // Money is formatted, never derived: no arithmetic on report fields in the client.
 assert.doesNotMatch(business,/report\.\w+Minor\s*[-+*/]/);
});

test('latest orders use the passive admin search and show no customer contact details',()=>{
 assert.match(recent,/getAdminOrdersOnServer/);
 assert.match(source('src/services/apiClient.ts'),/searchParams\.set\('readOnly','true'\)/);
 assert.doesNotMatch(recent,/recipient_phone|customer_phone|customer_email|customer_name/);
});

test('today deep link opens Orders with the Ghana-date created filter and keeps reference links',()=>{
 const page=source('src/components/admin/AdminPage.tsx');
 assert.match(page,/initialCreatedToday=\{!param\.startsWith\('ref\/'\)&&param\.endsWith\('\/today'\)\}/);
 const orders=source('src/components/admin/sections/AdminOrdersSection.tsx');
 assert.match(orders,/timeZone: 'Africa\/Accra'/);
 assert.match(orders,/Clear created date filter/);
});
