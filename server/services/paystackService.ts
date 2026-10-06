/**
 * Server-Side Paystack Payment Service
 * All payment initializations and verification happen on the SERVER with PAYSTACK_SECRET_KEY.
 * The browser is NEVER trusted for transaction amounts or delivery approval.
 */

import crypto from 'node:crypto';

export interface PaystackInitializeParams {
  email: string;
  amountPesewas: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface PaystackInitializeResult {
  definitiveFailure?: boolean;
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference: string;
  isSimulated?: boolean;
  error?: string;
}

export interface PaystackVerifyResult {
  isTestMode?: boolean;
  metadata?: Record<string, unknown>;
  reference?: string;
  isSimulated?: boolean;
  isVerified: boolean;
  status: 'success' | 'failed' | 'abandoned' | 'pending' | 'unknown';
  amountPesewas: number;
  currency: string;
  customerEmail?: string;
  gatewayResponse?: string;
  paidAt?: string;
  error?: string;
}

export class PaystackServerService {
  private static getSecretKey(): string {
    const raw = process.env.PAYSTACK_SECRET_KEY || '';
    return typeof raw === 'string' ? raw.trim() : '';
  }

  /**
   * Initializes a Paystack transaction from the server
   */
  static async initializeTransaction(params: PaystackInitializeParams): Promise<PaystackInitializeResult> {
    const secretKey = this.getSecretKey();
    const isProd = process.env.NODE_ENV === 'production';

    // In production, require PAYSTACK_SECRET_KEY
    if (!secretKey) {
      if (isProd) {
        console.error('CRITICAL: PAYSTACK_SECRET_KEY is missing in production environment!');
        return {
          success: false,
          reference: params.reference,
          error: 'Payment initialization failed. Server payment configuration is incomplete.',
        };
      } else {
        console.warn('PAYSTACK_SECRET_KEY not set in development mode. Returning server dev access code.');
        return {
          success: true,
          authorizationUrl: `https://checkout.paystack.com/dev_access_${params.reference}`,
          accessCode: `dev_access_${params.reference}`,
          reference: params.reference,
          isSimulated: true,
        };
      }
    }

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          amount: params.amountPesewas,
          currency: 'GHS',
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
          ...(params.channels ? { channels: params.channels } : {}),
        }),
      });

      const data = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: {
          authorization_url: string;
          access_code: string;
          reference: string;
        };
      };

      if (!response.ok || !data.status || !data.data) {
        console.error('Paystack API Initialization Error:', data);
        return {
          success: false,
          reference: params.reference,
          // Timeout, conflict and rate-limit responses remain uncertain.
          definitiveFailure: [400,401,403,404,422].includes(response.status),
          error: data.message || 'Unable to initialize transaction with Paystack.',
        };
      }

      return {
        success: true,
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference: data.data.reference,
      };
    } catch (err) {
      console.error('Paystack Network Exception:', err);
      return {
        success: false,
        reference: params.reference,
        error: 'Network error communicating with payment provider.',
      };
    }
  }

  /**
   * Verifies a Paystack transaction directly with Paystack API
   */
  static async verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
    const secretKey = this.getSecretKey();
    const isProd = process.env.NODE_ENV === 'production';

    if (!secretKey) {
      if (isProd) {
        return {
          isVerified: false,
          status: 'unknown',
          amountPesewas: 0,
          currency: 'GHS',
          error: 'PAYSTACK_SECRET_KEY missing in production.',
        };
      } else {
        // Development sandbox simulation
        return {
          isVerified: true,
          status: 'success',
          reference,
          isSimulated: true,
          amountPesewas: 0, // Checked against saved order in verify route
          currency: 'GHS',
          gatewayResponse: 'Simulated dev payment verified',
          paidAt: new Date().toISOString(),
        };
      }
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      const json = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: {
          status: string;
          amount: number;
          currency: string;
          customer?: { email: string };
          gateway_response?: string;
          paid_at?: string;
          reference?: string;
          metadata?: Record<string, unknown>;
        };
      };

      if (!response.ok || !json.status || !json.data) {
        return {
          isVerified: false,
          status: 'failed',
          amountPesewas: 0,
          currency: 'GHS',
          error: json.message || 'Verification failed on Paystack API.',
        };
      }

      const tx = json.data;
      const isSuccess = tx.status === 'success';

      return {
        isVerified: isSuccess,
        isTestMode: secretKey.startsWith('sk_test_'),
        reference: tx.reference,
        metadata: tx.metadata,
        status: isSuccess ? 'success' : (tx.status as PaystackVerifyResult['status']),
        amountPesewas: tx.amount,
        currency: tx.currency,
        customerEmail: tx.customer?.email,
        gatewayResponse: tx.gateway_response,
        paidAt: tx.paid_at || new Date().toISOString(),
      };
    } catch (err) {
      console.error('Paystack Verification Exception:', err);
      return {
        isVerified: false,
        status: 'unknown',
        amountPesewas: 0,
        currency: 'GHS',
        error: 'Network error verifying payment.',
      };
    }
  }

  /**
   * Verifies Paystack HMAC SHA512 Webhook Signature using PAYSTACK_SECRET_KEY
   */
  static verifyWebhookSignature(rawBodyBuffer: Buffer | string, signatureHeader: string): boolean {
    const secretKey = this.getSecretKey();
    if (!secretKey || !signatureHeader) {
      return false;
    }

    try {
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(rawBodyBuffer)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
    } catch (err) {
      console.error('Webhook signature check exception:', err);
      return false;
    }
  }
}
