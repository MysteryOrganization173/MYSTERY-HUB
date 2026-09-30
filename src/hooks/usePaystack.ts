/**
 * Paystack Hook (Server-First Bridge)
 * Uses server-created access codes and transaction references.
 * Never calculates or trusts payment amounts on the client.
 */

import { useState, useEffect, useCallback } from 'react';
import { initializePaymentOnServer, verifyPaymentOnServer } from '../services/apiClient';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key?: string;
        access_code?: string;
        email?: string;
        amount?: number;
        currency?: string;
        ref?: string;
        channels?: string[];
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string; status?: string; trans?: string; [key: string]: unknown }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

export interface ServerPaystackOptions {
  productId: string;
  recipientPhone: string;
  customerEmail?: string;
  customerName?: string;
  onPaymentReceived: (orderRef: string, reference: string) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

const PAYSTACK_INLINE_SCRIPT = 'https://js.paystack.co/v1/inline.js';

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
      console.warn('Paystack inline.js failed to load.');
    };
    document.body.appendChild(script);
  }, []);

  const initializeServerPayment = useCallback(async (options: ServerPaystackOptions) => {
    setIsInitializing(true);

    try {
      // 1. Call Backend to create order & initialize Paystack transaction authoritatively
      const initRes = await initializePaymentOnServer({
        productId: options.productId,
        recipientPhone: options.recipientPhone,
        customerEmail: options.customerEmail,
        customerName: options.customerName,
      });

      if (!initRes.success) {
        throw new Error(initRes.error || 'Failed to initialize payment.');
      }

      const { orderRef, reference, accessCode, isSimulated } = initRes;

      // 2. Open Paystack Pop popup if Paystack script is loaded & accessCode/publicKey present
      if (window.PaystackPop && (accessCode || publicKey)) {
        try {
          const handler = window.PaystackPop.setup({
            key: publicKey || undefined,
            access_code: accessCode || undefined,
            ref: reference,
            callback: async (_response) => {
              setIsInitializing(false);
              // Frontend callback triggers verification on backend — DOES NOT claim delivery
              try {
                await verifyPaymentOnServer(reference);
              } catch {
                // Ignore verification retry error; backend polling/webhook will handle status
              }
              options.onPaymentReceived(orderRef, reference);
            },
            onClose: () => {
              setIsInitializing(false);
              options.onCancel?.();
            },
          });

          handler.openIframe();
          return;
        } catch (popErr) {
          console.warn('PaystackPop setup error, falling back:', popErr);
        }
      }

      // 3. Sandbox / Dev fallback if Paystack popup iframe is omitted
      if (isSimulated || !window.PaystackPop) {
        setTimeout(async () => {
          setIsInitializing(false);
          try {
            await verifyPaymentOnServer(reference);
          } catch {
            // ignore
          }
          options.onPaymentReceived(orderRef, reference);
        }, 1200);
      }
    } catch (err) {
      setIsInitializing(false);
      options.onError?.(err instanceof Error ? err : new Error('Payment initialization failed.'));
    }
  }, [publicKey]);

  return {
    initializeServerPayment,
    isScriptLoaded,
    isInitializing,
    isConfigured: Boolean(publicKey),
  };
}
