import type {SafePublicOrderDetails,AuthenticatedCustomerOrderDetails} from '../../server/types/orders';
import type {OrderRecord} from '../types';
import {afaStatusLabel} from '../../shared/afa';
import {dataOrderPresentation} from './dataPurchasePresentation';
import {customerOrderStatus} from './customerOrderPresentation';
import {historicalOrderClass,type HistoricalOrderClassifier} from '../services/orderHistoryClassification';
export function memberGreeting(hour:number) {return hour>=5&&hour<12?'Good morning':hour>=12&&hour<17?'Good afternoon':'Good evening';}
export function memberOrderLabel(order:SafePublicOrderDetails,classify:HistoricalOrderClassifier=historicalOrderClass) {
  if(isQuietHistorical(order,classify))return 'Not paid';
  if(order.service_type==='marketplace'||order.payment_basis)return customerOrderStatus({serviceType:order.service_type,serverStatus:order.status,status:'verifying',manualReview:order.manual_review,customerResolution:order.customer_resolution,paymentBasis:order.payment_basis,marketplaceStatus:order.marketplace_status}).label;
  if(order.customer_resolution)return dataOrderPresentation(order.status,order.manual_review,order.customer_resolution).label;
  if(order.manual_review)return 'Needs attention';
  return order.service_type==='afa'?afaStatusLabel(order.status):dataOrderPresentation(order.status).label;
}
export function memberOrderSelection(orders:SafePublicOrderDetails[],classify:HistoricalOrderClassifier=historicalOrderClass) {
  const sorted=[...orders].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  // An old unpaid record never takes the featured slot while the customer has any other order to show.
  const latest=sorted.find(o=>memberOrderTone(o,classify)==='attention')??sorted.find(o=>memberOrderTone(o,classify)==='active')??sorted.find(o=>!isQuietHistorical(o,classify))??sorted[0];
  return {latest,prioritizesActive:latest!==sorted[0],recent:sorted.filter(o=>o.public_reference!==latest?.public_reference).slice(0,3)};
}
export function memberTrackingOrder(o:AuthenticatedCustomerOrderDetails):OrderRecord {
  return {id:o.public_reference,publicReference:o.public_reference,serverReference:o.public_reference,serverStatus:o.status,manualReview:o.manual_review,customerResolution:o.customer_resolution,paymentBasis:o.payment_basis,marketplaceStatus:o.marketplace_status,commercialPricing:o.commercial_pricing,serviceType:o.service_type||'data',buyerRecipientVisible:true,journey:'account',
    bundle:{id:'account-'+o.public_reference,network:o.network,dataAmount:o.bundle_size_snapshot||o.product_name_snapshot||'Order',dataBytesValue:0,validity:'',validityCategory:'Daily',priceGhc:o.amount_ghc,description:o.product_name_snapshot},recipientPhone:o.recipient_phone,network:o.network,paymentMethod:'paystack',amountGhc:o.amount_ghc,
    status:o.status==='delivered'?'delivered':['submitted','processing'].includes(o.status)?'processing':['paid','queued'].includes(o.status)?'placed':['failed','refund_pending','refunded'].includes(o.status)?'failed':'verifying',createdAt:o.created_at,updatedAt:o.created_at};
}

/** How the member home should treat an order: needs the customer's attention, still moving, delivered, or closed without delivery. */
export type MemberOrderTone='attention'|'active'|'done'|'closed';
const RESOLVED=['refund_confirmed','manual_fulfillment','external_compensation'];
const isDataLike=(o:SafePublicOrderDetails)=>!o.service_type||['data','airtime','instant_bundle'].includes(o.service_type);
/** Any sign of money received. A paid order is never quietened, whatever the classification says. */
const hasPaymentEvidence=(o:SafePublicOrderDetails)=>Boolean(o.paid_at||o.payment_basis||o.customer_resolution)||['paid','queued','submitted','processing','delivered','refund_pending','refunded'].includes(o.status);
/** The server classified this as an old record that was never paid, and nothing in the order says otherwise. */
export function isQuietHistorical(o:SafePublicOrderDetails,classify:HistoricalOrderClassifier=historicalOrderClass) {
  return classify(o)==='historical_unpaid'&&!hasPaymentEvidence(o);
}
export function memberOrderTone(o:SafePublicOrderDetails,classify:HistoricalOrderClassifier=historicalOrderClass):MemberOrderTone {
  if(isQuietHistorical(o,classify))return 'closed';
  if(o.customer_resolution&&RESOLVED.includes(o.customer_resolution))return 'closed';
  if(o.manual_review||['failed','refund_pending'].includes(o.status)||['review','refund_pending'].includes(o.customer_resolution||''))return 'attention';
  if(o.status==='delivered')return 'done';
  if(['pending_payment','paid','queued','submitted','processing'].includes(o.status))return 'active';
  return 'closed';
}
/** Truthful progress for data/airtime only: a step is complete only when the server status says so. */
export function memberOrderSteps(o:SafePublicOrderDetails) {
  if(!isDataLike(o)||memberOrderTone(o)!=='active')return null;
  const paid=o.status!=='pending_payment',sent=['submitted','processing'].includes(o.status);
  return [{label:'Payment confirmed',done:paid},{label:'With the network',done:sent},{label:'Delivered',done:false}];
}
/** The next step the customer should take, reusing the order page's own wording for data and airtime. */
export function memberOrderNext(o:SafePublicOrderDetails,classify:HistoricalOrderClassifier=historicalOrderClass) {
  if(isQuietHistorical(o,classify))return 'No payment was received for this older order, so there is nothing to follow up.';
  if(isDataLike(o))return dataOrderPresentation(o.status,!!o.manual_review,o.customer_resolution,o.payment_basis).next;
  const tone=memberOrderTone(o);
  return tone==='attention'?'Contact support with your order reference before placing the same order again.':tone==='active'?'Open the order for its latest status.':'Open the order for its details.';
}
/** "Buy again" only opens the catalogue for the same network; it never repeats a payment. */
export function memberReorder(o:SafePublicOrderDetails):{mode:'data'|'airtime';network:SafePublicOrderDetails['network']}|null {
  if(memberOrderTone(o)!=='done'||!isDataLike(o)||!['mtn','telecel','airteltigo'].includes(o.network))return null;
  return {mode:o.service_type==='airtime'?'airtime':'data',network:o.network};
}
