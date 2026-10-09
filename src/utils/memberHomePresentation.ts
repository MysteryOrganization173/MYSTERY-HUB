import type {SafePublicOrderDetails,AuthenticatedCustomerOrderDetails} from '../../server/types/orders';
import type {OrderRecord} from '../types';
import {afaStatusLabel} from '../../shared/afa';
import {dataOrderPresentation} from './dataPurchasePresentation';
export function memberGreeting(hour:number) {return hour>=5&&hour<12?'Good morning':hour>=12&&hour<17?'Good afternoon':'Good evening';}
export function memberOrderLabel(order:SafePublicOrderDetails) {
  if(order.manual_review)return 'Needs attention';
  return order.service_type==='afa'?afaStatusLabel(order.status):dataOrderPresentation(order.status).label;
}
export function memberOrderSelection(orders:SafePublicOrderDetails[]) {
  const sorted=[...orders].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const latest=sorted.find(o=>o.manual_review||['paid','queued','submitted','processing','pending_payment','refund_pending','failed'].includes(o.status))??sorted[0];
  return {latest,prioritizesActive:latest!==sorted[0],recent:sorted.filter(o=>o.public_reference!==latest?.public_reference).slice(0,3)};
}
export function memberTrackingOrder(o:AuthenticatedCustomerOrderDetails):OrderRecord {
  return {id:o.public_reference,publicReference:o.public_reference,serverReference:o.public_reference,serverStatus:o.status,manualReview:o.manual_review,commercialPricing:o.commercial_pricing,serviceType:o.service_type||'data',buyerRecipientVisible:true,
    bundle:{id:'account-'+o.public_reference,network:o.network,dataAmount:o.bundle_size_snapshot||o.product_name_snapshot||'Order',dataBytesValue:0,validity:'',validityCategory:'Daily',priceGhc:o.amount_ghc,description:o.product_name_snapshot},recipientPhone:o.recipient_phone,network:o.network,paymentMethod:'paystack',amountGhc:o.amount_ghc,
    status:o.status==='delivered'?'delivered':['submitted','processing'].includes(o.status)?'processing':['paid','queued'].includes(o.status)?'placed':['failed','refund_pending','refunded'].includes(o.status)?'failed':'verifying',createdAt:o.created_at,updatedAt:o.created_at};
}
