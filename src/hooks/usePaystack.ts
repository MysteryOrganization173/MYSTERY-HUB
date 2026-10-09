/**
 * Paystack Hook (Server-First Bridge)
 * Uses official Paystack Inline JS V2 with server-created access codes.
 * Transactions are initialized on the server and resumed in the browser.
 */

import { useState, useEffect, useCallback } from 'react';
import { initializePaymentOnServer, verifyPaymentOnServer } from '../services/apiClient';
import { getActiveSessionToken } from '../utils/authStorage';
import { initializeStorePayment } from '../services/websiteBusinessApi';
import { waitForStoreInitialization } from '../utils/storeCheckoutAttempt';

export interface PaystackTransactionResponse {
  reference: string;
  status?: string;
  trans?: string;
  transaction?: string;
  message?: string;
  [key: string]: unknown;
}

export interface PaystackResumeOptions {
  onSuccess?: (response: PaystackTransactionResponse) => void;
  onCancel?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
}

export interface PaystackPopInstance {
  resumeTransaction: (accessCode: string, options?: PaystackResumeOptions) => void;
}

declare global {
  interface Window {
    PaystackPop?: {
      new (): PaystackPopInstance;
    };
  }
}

export interface ServerPaystackOptions {
  // Storefront lifecycle guard; other checkout callers keep their existing behavior.
  isActive?: () => boolean;
  commercial?:{requestId:string;expectedTotalMinor:number;expectedRegularMinor:number;pricingRevision:string;promotionRevision:string};
  store?: {siteId:string;requestId:string;expectedMinor:number};
  onOrderCreated?: (orderRef:string) => void;
  productId: string;
  recipientPhone: string;
  customerEmail?: string;
  customerName?: string;
  serviceType?: 'data' | 'airtime' | 'instant_bundle';
  network?: string;
  amount?: number;
  onPaymentReceived: (orderRef: string, reference: string) => void;
  onCancel?: (orderRef?: string, reference?: string) => void;
  onError?: (error: Error & { code?: string; existingOrderReference?: string; existingOrderStatus?: string }) => void;
}

// Paystack Inline JS V2
const PAYSTACK_INLINE_SCRIPT = 'https://js.paystack.co/v2/inline.js';

export function usePaystack() {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'preparing' | 'opening'>('idle');

  const rawKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
  const publicKey = typeof rawKey === 'string' ? rawKey.trim() : '';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.PaystackPop) {
      setIsScriptLoaded(true);
      return;
    }

    let active=true;
    const existingScript = document.querySelector(`script[src="${PAYSTACK_INLINE_SCRIPT}"]`);
    const script = existingScript || document.createElement('script');
    const loaded=()=>{if(active)setIsScriptLoaded(Boolean(window.PaystackPop));};
    const failed=() => {
      console.warn('Paystack InlineJS V2 failed to load.');
    };
    script.addEventListener('load',loaded);
    script.addEventListener('error',failed);
    if(!existingScript){(script as HTMLScriptElement).src=PAYSTACK_INLINE_SCRIPT;(script as HTMLScriptElement).async=true;document.body.appendChild(script);}
    // The shared SDK stays available to other checkouts; only our listeners leave.
    return()=>{active=false;script.removeEventListener('load',loaded);script.removeEventListener('error',failed);};
  }, []);

  const waitForPaystackPop = async (maxWaitMs = 1500): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (window.PaystackPop) return true;

    const startTime = Date.now();
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.PaystackPop) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - startTime >= maxWaitMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  };

  const initializeServerPayment = useCallback(async (options: ServerPaystackOptions) => {
    const active=()=>options.isActive?.()!==false;
    const idle=()=>{if(active()){setIsInitializing(false);setLoadingPhase('idle');}};
    setIsInitializing(true);
    setLoadingPhase('preparing');

    try {
      // 1. Call Backend to create pending order & initialize Paystack transaction authoritatively
      const sessionToken = getActiveSessionToken();
      const initRes = options.store ? await waitForStoreInitialization(initializeStorePayment(options.store.siteId,options.store.requestId,options.productId,options.recipientPhone,options.customerEmail||'',sessionToken||undefined),ref=>options.onOrderCreated?.(ref)) : await initializePaymentOnServer(
        {
          ...options.commercial,
          productId: options.productId,
          recipientPhone: options.recipientPhone,
          customerEmail: options.customerEmail,
          customerName: options.customerName,
          serviceType: options.serviceType,
          network: options.network,
          amount: options.amount,
        },
        sessionToken
      );

      if (!initRes.success) {
        throw new Error(initRes.error || 'Failed to initialize payment with server.');
      }

      const { orderRef, reference, accessCode, isSimulated } = initRes;
      options.onOrderCreated?.(orderRef);
      // Preserve the reference for recovery, but never open a popup after leaving.
      if(!active())return;
      if(options.store&&!import.meta.env.DEV&&(isSimulated||accessCode?.startsWith('dev_access_')))throw new Error('A production payment cannot use a simulated authorization. Track this order or contact the business.');
      if(options.commercial&&initRes.amountPesewas!==options.commercial.expectedTotalMinor)throw new Error('Price changed. Refresh and review before paying.');
      if(options.store&&initRes.amountPesewas!==options.store.expectedMinor)throw new Error('This bundle price changed. Refresh the storefront and review the current total before paying. No payment was opened.');

      if (!accessCode) {
        throw new Error('Server did not return a valid Paystack payment access code.');
      }

      setLoadingPhase('opening');

      // 2. Ensure Paystack InlineJS V2 script is ready
      const popAvailable = window.PaystackPop ? true : await waitForPaystackPop();
      if(!active())return;

      // 3. Official Paystack InlineJS V2 Server-Initialized Flow
      if (popAvailable && window.PaystackPop) {
        try {
          const popup = new window.PaystackPop();
          let settled=false;
          const acceptSignal=()=>{if(!active()||options.store&&settled)return false;settled=true;return true;};

          popup.resumeTransaction(accessCode, {
            onSuccess: async () => {
              if(!acceptSignal())return;
              idle();
              // Trigger backend verification, then poll for authoritative status
              try {
                await verifyPaymentOnServer(reference);
              } catch {
                // Backend webhook or polling will reconcile status
              }
              if(active())options.onPaymentReceived(orderRef, reference);
            },
            onCancel: () => {
              if(!acceptSignal())return;
              idle();
              options.onCancel?.(orderRef, reference);
            },
            onClose: () => {
              if(!acceptSignal())return;
              idle();
              options.onCancel?.(orderRef, reference);
            },
            onError: (popErr: unknown) => {
              if(!acceptSignal())return;
              idle();
              const errMsg =
                popErr instanceof Error
                  ? popErr.message
                  : 'An error occurred during payment processing with Paystack.';
              options.onError?.(new Error(errMsg));
            },
          });
          return;
        } catch (popErr) {
          if(!active())return;
          idle();
          const err =
            popErr instanceof Error
              ? popErr
              : new Error('Failed to open Paystack payment popup.');
          options.onError?.(err);
          return;
        }
      }

      // 4. DEVELOPMENT ONLY: Simulated fallback when explicitly in dev mode with simulated server response
      if (import.meta.env.DEV && isSimulated) {
        console.info('[DEV ONLY] Simulating payment processing in local test mode...');
        setTimeout(async () => {
          if(!active())return;
          idle();
          try {
            await verifyPaymentOnServer(reference);
          } catch {
            // ignore dev simulation verification error
          }
          if(active())options.onPaymentReceived(orderRef, reference);
        }, 1200);
        return;
      }

      // 5. PRODUCTION FAILURE: Missing popup in production must NEVER claim payment success
      if(!active())return;
      idle();
      const scriptError = new Error(
        'Unable to load Paystack payment module. Please check your internet connection, disable ad-blockers, and try again.'
      );
      options.onError?.(scriptError);
    } catch (err) {
      if(options.store&&(err as any)?.existingOrderReference)options.onOrderCreated?.((err as any).existingOrderReference);
      if(!active())return;
      idle();
      options.onError?.(
        err instanceof Error ? err : new Error('Payment initialization failed.')
      );
    }
  }, []);

  return {
    initializeServerPayment,
    isScriptLoaded,
    isInitializing,
    loadingPhase,
    isConfigured: Boolean(publicKey),
  };
}
