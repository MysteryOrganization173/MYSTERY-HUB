import { API_BASE_URL, InitializePaymentResponse } from './apiClient';
import type { AfaPayload } from '../../shared/afa';
import { getStoredReferralCode, getOrGenerateVisitorKey } from '../utils/referralCapture';
export interface AfaConfig {enabled:boolean; available:boolean; retailPriceMinor:number|null; retailPriceGhc:number|null; status:string; message:string}
export async function getAfaConfig(): Promise<AfaConfig> {
  const res = await fetch(`${API_BASE_URL}/api/afa/config`);
  if (!res.ok) throw new Error('AFA registration is temporarily unavailable.');
  return res.json();
}
export async function initializeAfaPayment(payload:AfaPayload, consent:boolean, customerEmail:string, token:string): Promise<InitializePaymentResponse> {
  const res = await fetch(`${API_BASE_URL}/api/afa/payments/initialize`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...payload,consent,customerEmail,referralCode:getStoredReferralCode(),visitorKey:getOrGenerateVisitorKey()})});
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Unable to start registration.'),{field:data.field,status:res.status});
  return data;
}
