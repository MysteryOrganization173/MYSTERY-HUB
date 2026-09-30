/**
 * Paystack Hook (Server-First Bridge)
 * Uses official Paystack Inline JS V2 with server-created access codes.
 * Transactions are initialized on the server and resumed in the browser.
 */

import { useState, useEffect, useCallback } from 'react';
import { initializePaymentOnServer, verifyPaymentOnServer } from '../services/apiClient';

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
  productId: string;
  recipientPhone: string;
  customerEmail?: string;
  customerName?: string;
  serviceType?: 'data' | 'airtime';
  network?: string;
  amount?: number;
  onPaymentReceived: (orderRef: string, reference: string) => void;
  onCancel?: () => void;
  onError?: (error: Error & { code?: string; existingOrderReference?: string; existingOrderStatus?: string }) => void;
}

// Paystack Inline JS V2
const PAYSTACK_INLINE_SCRIPT = 'https://js.paystack.co/v2/inline.js';

export function usePaystack() {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const rawKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
  const publicKey = typeof rawKey === 'string' ? rawKey.trim() : '';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.PaystackPop) {
      setIsScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${PAYSTACK_INLINE_SCRIPT}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = PAYSTACK_INLINE_SCRIPT;
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => {
      console.warn('Paystack InlineJS V2 failed to load.');
    };
    document.body.appendChild(script);
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
    setIsInitializing(true);

    try {
      // 1. Call Backend to create pending order & initialize Paystack transaction authoritatively
      const initRes = await initializePaymentOnServer({
        productId: options.productId,
        recipientPhone: options.recipientPhone,
        customerEmail: options.customerEmail,
        customerName: options.customerName,
        serviceType: options.serviceType,
        network: options.network,
        amount: options.amount,
      });

      if (!initRes.success) {
        throw new Error(initRes.error || 'Failed to initialize payment with server.');
      }

      const { orderRef, reference, accessCode, isSimulated } = initRes;

      if (!accessCode) {
        throw new Error('Server did not return a valid Paystack payment access code.');
      }

      // 2. Ensure Paystack InlineJS V2 script is ready
      const popAvailable = window.PaystackPop ? true : await waitForPaystackPop();

      // 3. Official Paystack InlineJS V2 Server-Initialized Flow
      if (popAvailable && window.PaystackPop) {
        try {
          const popup = new window.PaystackPop();

          popup.resumeTransaction(accessCode, {
            onSuccess: async () => {
              setIsInitializing(false);
              // Trigger backend verification, then poll for authoritative status
              try {
                await verifyPaymentOnServer(reference);
              } catch {
                // Backend webhook or polling will reconcile status
              }
              options.onPaymentReceived(orderRef, reference);
            },
            onCancel: () => {
              setIsInitializing(false);
              options.onCancel?.();
            },
            onClose: () => {
              setIsInitializing(false);
              options.onCancel?.();
            },
            onError: (popErr: unknown) => {
              setIsInitializing(false);
              const errMsg =
                popErr instanceof Error
                  ? popErr.message
                  : 'An error occurred during payment processing with Paystack.';
              options.onError?.(new Error(errMsg));
            },
          });
          return;
        } catch (popErr) {
          setIsInitializing(false);
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
          setIsInitializing(false);
          try {
            await verifyPaymentOnServer(reference);
          } catch {
            // ignore dev simulation verification error
          }
          options.onPaymentReceived(orderRef, reference);
        }, 1200);
        return;
      }

      // 5. PRODUCTION FAILURE: Missing popup in production must NEVER claim payment success
      setIsInitializing(false);
      const scriptError = new Error(
        'Unable to load Paystack payment module. Please check your internet connection, disable ad-blockers, and try again.'
      );
      options.onError?.(scriptError);
    } catch (err) {
      setIsInitializing(false);
      options.onError?.(
        err instanceof Error ? err : new Error('Payment initialization failed.')
      );
    }
  }, []);

  return {
    initializeServerPayment,
    isScriptLoaded,
    isInitializing,
    isConfigured: Boolean(publicKey),
  };
}
