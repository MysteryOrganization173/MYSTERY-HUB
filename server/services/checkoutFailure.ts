import {FinanceError} from '../db/financeStore.js';
import {checkoutFailurePresentation,preflightFailure,recoveryFailure,type CheckoutFailureDetails,type CheckoutFailureCode,type PreflightCode} from '../../shared/checkoutFailure.js';
export class CheckoutFailure extends FinanceError {
 constructor(public checkout:CheckoutFailureDetails,public existingOrderReference?:string){super(checkoutFailurePresentation(checkout.code).message,checkout.paymentState==='unconfirmed'?409:checkout.code==='BENEFICIARY_NOT_ELIGIBLE'||checkout.code==='PACKAGE_UNAVAILABLE'?400:['CHECKOUT_REVIEW_REQUIRED','ACTIVE_MTN_ORDER'].includes(checkout.code)?409:503);}
}
export const rejectPreflight=(code:PreflightCode,reference?:string)=>new CheckoutFailure(preflightFailure(code),reference);
export const requireCheckoutRecovery=(reference?:string,code:'ACTIVE_MTN_ORDER'|'PAYMENT_INITIALIZATION_UNCERTAIN'='PAYMENT_INITIALIZATION_UNCERTAIN')=>new CheckoutFailure(recoveryFailure(code),reference);
export function checkoutFailureBody(error:CheckoutFailure){return {error:error.message,message:error.message,code:error.checkout.code,checkout:error.checkout,...(/^MH-[a-zA-Z0-9-]{1,60}$/.test(error.existingOrderReference||'')?{existingOrderReference:error.existingOrderReference}:{})};}
