import type {OrderRecord} from '../types/orders.js';
import type {AdminFinancialReport,AdminPeriod,AdminPeriodName,ReportMetric} from '../../shared/adminOperations.js';
import {getPool} from '../db/connection.js';
import {OrdersStore} from '../db/ordersStore.js';
import {FinanceError} from '../db/financeStore.js';
import type {PoolClient} from 'pg';

export function adminPeriod(input:Record<string,unknown>={},now=new Date()):AdminPeriod {
 const name=String(input.period||'month') as AdminPeriodName;
 const today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 let from:Date|null=new Date(today),to=new Date(now.getTime()+1);
 const date=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new FinanceError('Use dates in YYYY-MM-DD format.');const parsed=new Date(value+'T00:00:00Z');if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==value)throw new FinanceError('Choose valid calendar dates.');return parsed;};
 if(name==='all')from=null;
 else if(name==='last7')from.setUTCDate(from.getUTCDate()-6);
 else if(name==='month')from.setUTCDate(1);
 else if(name==='week'||name==='previous_week'){from.setUTCDate(from.getUTCDate()-((from.getUTCDay()+6)%7));if(name==='previous_week'){to=new Date(from);from.setUTCDate(from.getUTCDate()-7);}}
 else if(name==='custom'){from=date(input.from);to=date(input.to);to.setUTCDate(to.getUTCDate()+1);if(+from>+today||+to>+today+86400000||+from>=+to)throw new FinanceError('Choose an ordered date range ending no later than today.');if(+to>+now)to=new Date(+now+1);}
 else if(name!=='today')throw new FinanceError('Unknown reporting period.');
 if(input.cutoff!==undefined){const cutoff=new Date(String(input.cutoff));if(!Number.isFinite(+cutoff)||+cutoff>+to||from&&+cutoff<=+from)throw new FinanceError('Invalid report cutoff.');to=cutoff;}
 return {name,from:from?.toISOString()||null,to:to.toISOString(),timezone:'Africa/Accra'};
}
const time=(value:string|null|undefined)=>value?Date.parse(value):NaN;
export const inPeriod=(value:string|null|undefined,p:AdminPeriod)=>Number.isFinite(time(value))&&(!p.from||time(value)>=time(p.from))&&time(value)<time(p.to);
export const verifiedPaid=(o:OrderRecord)=>o.payment_status==='success'&&Boolean(o.paid_at)&&o.currency==='GHS'&&Number.isSafeInteger(o.amount)&&o.amount>0&&['paystack','wallet'].includes(o.payment_provider);
export const confirmedRefund=(o:OrderRecord)=>o.resolution_json?.stage==='resolved'&&['paystack_refund','wallet_refund'].includes(o.resolution_json?.outcome||'');
/** Dedicated supplier/public fulfilment fact; operator remedy never invents supplier delivery. */
export const qualifyingSale=(o:OrderRecord)=>verifiedPaid(o)&&o.status==='delivered'&&Boolean(o.delivered_at)&&!['paystack_refund','wallet_refund','external_compensation'].includes(o.resolution_json?.outcome||'')&&!['refund_pending','refunded','cancelled'].includes(o.marketplace_status||'');
export const knownCost=(o:OrderRecord)=>Number.isSafeInteger(o.supplier_cost_minor)&&o.supplier_cost_minor!==null&&o.supplier_cost_minor>=0;
export function platformSaleMinor(o:OrderRecord){const value=o.store_context?o.store_context.wholesaleMinor:o.amount;if(!Number.isSafeInteger(value)||value<0||value>o.amount)throw new FinanceError('Managed-store wholesale snapshot needs reconciliation.',409);return value;}
export const REPORT_METRICS:ReportMetric[]=['external_receipts','wallet_redemptions','completed_sales','known_cost','unknown_cost','customer_refunds'];
export function matchesReport(o:OrderRecord,metric:ReportMetric,p:AdminPeriod):boolean {
 if(metric==='external_receipts'||metric==='wallet_redemptions')return verifiedPaid(o)&&o.payment_provider===(metric==='external_receipts'?'paystack':'wallet')&&inPeriod(o.paid_at,p);
 if(metric==='customer_refunds')return verifiedPaid(o)&&confirmedRefund(o)&&inPeriod(o.resolution_json?.verifiedAt,p);
 return qualifyingSale(o)&&inPeriod(o.delivered_at,p)&&(metric==='completed_sales'||(metric==='known_cost'?knownCost(o):!knownCost(o)));
}
export function financialReport(orders:OrderRecord[],period:AdminPeriod):AdminFinancialReport {
 const sum=(rows:OrderRecord[],field:'amount'|'supplier_cost_minor')=>rows.reduce((n,o)=>{const value=o[field];if(!Number.isSafeInteger(value)||value===null||!Number.isSafeInteger(n+value))throw new FinanceError('Recorded amounts cannot be safely totalled. Review the source records.',409);return n+value;},0);
 const rows=(m:ReportMetric)=>orders.filter(o=>matchesReport(o,m,period));const sales=rows('completed_sales'),known=rows('known_cost'),unknown=rows('unknown_cost');
 const salesSum=(rows:OrderRecord[])=>rows.reduce((total,o)=>{const n=total+platformSaleMinor(o);if(!Number.isSafeInteger(n))throw new FinanceError('Sales total exceeds safe limits.',409);return n;},0);
 const costs=orders.filter(o=>knownCost(o)&&(o.supplier_order_id||o.submitted_at)&&inPeriod(o.submitted_at,period));
 return {period,externalReceiptsMinor:sum(rows('external_receipts'),'amount'),walletRedemptionsMinor:sum(rows('wallet_redemptions'),'amount'),completedSalesMinor:salesSum(sales),completedCustomerSpendingMinor:sum(sales,'amount'),completedCount:sales.length,recordedSupplierCostMinor:sum(costs,'supplier_cost_minor'),costKnownSalesMinor:salesSum(known),completedKnownCostMinor:sum(known,'supplier_cost_minor'),grossMarginMinor:salesSum(known)-sum(known,'supplier_cost_minor'),unknownCostSalesMinor:salesSum(unknown),unknownCostCount:unknown.length,confirmedRefundsMinor:sum(rows('customer_refunds'),'amount'),pendingRemedyMinor:sum(orders.filter(o=>verifiedPaid(o)&&['failed','refund_pending','refunded','cancelled','expired'].includes(o.status)&&o.resolution_json?.stage!=='resolved'&&inPeriod(o.paid_at,period)),'amount'),basis:['GHS integer minor units. Ghana time (UTC). Receipts use paid_at; completed sales use delivered_at; costs use submitted_at; confirmed refunds use verifiedAt.','Paystack order receipts are gross verified receipts before refunds. Wallet purchases redeem an existing liability; they are not new external cash. Wallet top-ups are reported separately in Finance.','Managed-store completed platform sales use the immutable wholesale amount, excluding the seller share and processing reserve; customer spending uses the full amount.','Completed sales exclude unpaid, failed, cancelled and customer-refunded orders. Supplier-wallet reimbursement is not a customer refund.','Gross margin includes only completed orders with recorded direct costs. Unknown costs, fees, rewards, taxes and overhead prevent a net-profit claim.']};
}
export async function reportingOrders(client?:PoolClient):Promise<OrderRecord[]> {
 const pool=client||getPool();return pool?(await pool.query('SELECT * FROM orders ORDER BY created_at,id')).rows.map(o=>({...o,...Object.fromEntries(['created_at','updated_at','paid_at','submitted_at','delivered_at'].map(key=>[key,o[key] instanceof Date?o[key].toISOString():o[key]]))})):OrdersStore.adminDevOrders();
}
