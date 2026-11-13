import {campaignCheckoutFields} from '../utils/campaignTracking';
import { API_BASE_URL, InitializePaymentResponse } from './apiClient';
import type { AfaPayload } from '../../shared/afa';
import { getStoredReferralCode, getOrGenerateVisitorKey } from '../utils/referralCapture';
export interface AfaConfig {enabled:boolean; available:boolean; retailPriceMinor:number|null; retailPriceGhc:number|null; status:string; message:string}
/** Server quote for the AFA fee. standardMinor is the regular price; a campaign appears only while it actually applies. */
export interface AfaQuote extends AfaConfig {standardMinor:number|null; totalMinor:number|null; pricingRevision:string|null; campaign?:{id:string;label:string;endDate:string|null}; savingMinor?:number; welcomeApplies:false}
export async function getAfaQuote(): Promise<AfaQuote> {
  const res = await fetch(`${API_BASE_URL}/api/afa/quote`);
  // An API from before quotes existed (the page and API deploy separately): use its config, the standard fee, with no
  // revision, so payment proceeds exactly as it did before quotes, at the standard price only.
  if (res.status === 404) {
    const config = await getAfaConfig();
    return { ...config, standardMinor: config.retailPriceMinor, totalMinor: config.retailPriceMinor, pricingRevision: null, welcomeApplies: false };
  }
  if (!res.ok) throw new Error('AFA registration is temporarily unavailable.');
  return res.json();
}
/** The reviewed fee the customer accepted; the server refuses payment if it no longer matches. */
export interface AfaAcceptedQuote {expectedTotalMinor:number; pricingRevision:string}
export async function getAfaConfig(): Promise<AfaConfig> {
  const res = await fetch(`${API_BASE_URL}/api/afa/config`);
  if (!res.ok) throw new Error('AFA registration is temporarily unavailable.');
  return res.json();
}
export async function initializeAfaPayment(payload:AfaPayload, consent:boolean, customerEmail:string, token:string, accepted?:AfaAcceptedQuote): Promise<InitializePaymentResponse> {
  const res = await fetch(`${API_BASE_URL}/api/afa/payments/initialize`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...payload,consent,customerEmail,...(accepted||{}),...campaignCheckoutFields(),referralCode:getStoredReferralCode(),visitorKey:getOrGenerateVisitorKey()})});
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Unable to start registration.'),{field:data.field,status:res.status,code:data.code,quote:data.quote});
  return data;
}
