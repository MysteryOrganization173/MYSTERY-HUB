/** Finite customer-safe checkout outcomes. No provider payloads, contact details or money state from the browser. */
export const PREFLIGHT_CODES=['BENEFICIARY_NOT_ELIGIBLE','BENEFICIARY_CHECK_UNAVAILABLE','SERVICE_TEMPORARILY_UNAVAILABLE','PACKAGE_UNAVAILABLE','SUPPLIER_WALLET_LOW','CHECKOUT_REVIEW_REQUIRED','ACTIVE_MTN_ORDER'] as const;
export type PreflightCode=typeof PREFLIGHT_CODES[number];
export type CheckoutFailureCode=PreflightCode|'PAYMENT_INITIALIZATION_UNCERTAIN'|'ACTIVE_MTN_ORDER';
export interface CheckoutFailureDetails {version:1;code:CheckoutFailureCode;paymentState:'not_started'|'unconfirmed';retryAllowed:boolean;verificationSubmitted:false}
export const isPreflightCode=(code:unknown):code is PreflightCode=>typeof code==='string'&&(PREFLIGHT_CODES as readonly string[]).includes(code);
export function preflightFailure(code:PreflightCode):CheckoutFailureDetails{return {version:1,code,paymentState:'not_started',retryAllowed:true,verificationSubmitted:false};}
export function recoveryFailure(code:'PAYMENT_INITIALIZATION_UNCERTAIN'|'ACTIVE_MTN_ORDER'='PAYMENT_INITIALIZATION_UNCERTAIN'):CheckoutFailureDetails{return {version:1,code,paymentState:'unconfirmed',retryAllowed:false,verificationSubmitted:false};}
/** Old servers, malformed responses and client timeouts cannot establish that initialization did not start. */
export function readCheckoutFailure(value:unknown):CheckoutFailureDetails|null {
 const v=value as CheckoutFailureDetails|undefined;
 if(!v||v.version!==1||v.verificationSubmitted!==false)return null;
 if(isPreflightCode(v.code)&&v.paymentState==='not_started'&&v.retryAllowed===true)return preflightFailure(v.code);
 if(['PAYMENT_INITIALIZATION_UNCERTAIN','ACTIVE_MTN_ORDER'].includes(v.code)&&v.paymentState==='unconfirmed'&&v.retryAllowed===false)return recoveryFailure(v.code as 'PAYMENT_INITIALIZATION_UNCERTAIN'|'ACTIVE_MTN_ORDER');
 return null;
}
export function checkoutFailurePresentation(code:CheckoutFailureCode){
 switch(code){
 case 'BENEFICIARY_NOT_ELIGIBLE':return {title:"This number isn't ready for this bundle yet",message:`This number isn’t ready for the selected bundle. It may need additional verification. Becoming eligible can take time; repeatedly checking does not speed it up. Please try again tomorrow or contact Mystery Hub Support. We cannot confirm that this number has entered a verification queue.`,recipient:true};
 case 'BENEFICIARY_CHECK_UNAVAILABLE':return {title:"We couldn't confirm this number’s status right now",message:'The check is temporarily unavailable. This does not mean the number is unverified or ineligible. You can deliberately retry the check later.',recipient:false};
 case 'CHECKOUT_REVIEW_REQUIRED':return {title:'Review your checkout details',message:'The current price or checkout details could not be accepted. Review the details and refresh the price before trying again.',recipient:false};
 case 'PACKAGE_UNAVAILABLE':return {title:'This bundle is temporarily unavailable',message:'Please choose another currently available bundle or check back later. You do not need to change the recipient number.',recipient:false};
 case 'SUPPLIER_WALLET_LOW':case 'SERVICE_TEMPORARILY_UNAVAILABLE':return {title:'Service temporarily unavailable',message:'We could not safely prepare this purchase. Try again shortly. You do not need to change the recipient number.',recipient:false};
 case 'ACTIVE_MTN_ORDER':return {title:'An order is already in progress',message:'Track the existing order before starting another purchase for this number.',recipient:false};
 default:return {title:'Check the existing payment attempt',message:'Payment is not confirmed. Keep the existing reference and check its status or contact support before paying again.',recipient:false};
 }
}
