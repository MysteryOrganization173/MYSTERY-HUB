/**
 * Success Biz Hub Webhook Handler
 * Verifies HMAC-SHA256 signature, ensures event idempotency,
 * and updates order statuses according to supplier lifecycle.
 */

import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { OrdersStore } from '../../db/ordersStore.js';
import { SbhWebhookPayload, SbhWebhookOrderItem } from './types.js';
import { FulfilmentService } from '../../services/fulfilmentService.js';
import { OrderStatus } from '../../types/orders.js';

export class SuccessBizHubWebhookHandler {
  private static getWebhookSecret(): string {
    const raw = process.env.SUCCESS_BIZ_HUB_WEBHOOK_SECRET || '';
    return raw.trim();
  }

  /**
   * Verifies HMAC-SHA256 signature against raw body
   */
  static verifySignature(rawBodyBuffer: Buffer | string, signatureHeader: string): boolean {
    const secret = this.getWebhookSecret();
    if (!secret || !signatureHeader) {
      return false;
    }

    try {
      // Signature may come in format "sha256=<hex>" or plain "<hex>"
      const expectedHex = signatureHeader.startsWith('sha256=')
        ? signatureHeader.slice(7).trim()
        : signatureHeader.trim();

      const computedHash = crypto
        .createHmac('sha256', secret)
        .update(rawBodyBuffer)
        .digest('hex');

      return (
        computedHash.length === expectedHex.length &&
        crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(expectedHex, 'hex'))
      );
    } catch (err) {
      console.error('[SBH Webhook] Error calculating HMAC signature:', err);
      return false;
    }
  }

  /**
   * Main Express handler for POST /api/webhooks/success-biz-hub
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const signature =
        (req.headers['x-webhook-signature'] as string) ||
        (req.headers['x-sbh-signature'] as string) ||
        '';

      const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody || JSON.stringify(req.body);
      const secret = this.getWebhookSecret();

      // Check signature if secret is configured
      if (secret) {
        const isValid = this.verifySignature(rawBody, signature);
        if (!isValid) {
          console.warn('[SBH Webhook] Invalid HMAC-SHA256 signature received.');
          res.status(401).json({ error: 'Invalid webhook signature.' });
          return;
        }
      } else if (process.env.NODE_ENV === 'production' && !secret) {
        console.warn('[SBH Webhook] SUCCESS_BIZ_HUB_WEBHOOK_SECRET is not configured in production.');
      }

      const payload = (req.body || {}) as SbhWebhookPayload;
      const eventType = payload.event;
      const eventId = payload.event_id || payload.eventId || payload.id;

      // Webhook test ping
      if (eventType === 'webhook.test') {
        console.info('[SBH Webhook] Received webhook.test event.');
        res.status(200).json({ status: 'success', message: 'Webhook test received.' });
        return;
      }

      // Balance low notification
      if (eventType === 'balance.low') {
        console.warn(
          '[SBH Webhook] ALERT: Success Biz Hub wallet balance is low! Please top up supplier wallet immediately.'
        );
        res.status(200).json({ status: 'success', message: 'Balance low logged.' });
        return;
      }

      // Check idempotency for event
      if (eventId) {
        const isNewEvent = await OrdersStore.recordSupplierWebhookEvent(eventId, eventType, payload);
        if (!isNewEvent) {
          console.info(`[SBH Webhook] Duplicate event ${eventId} ignored.`);
          res.status(200).json({ status: 'success', message: 'Duplicate event acknowledged.' });
          return;
        }
      }

      // Extract order items (supports single or grouped/bulk payloads)
      const orderItems: SbhWebhookOrderItem[] = [];

      if (payload.data) {
        if (Array.isArray(payload.data)) {
          orderItems.push(...payload.data);
        } else if (typeof payload.data === 'object') {
          const d = payload.data as {
            order?: SbhWebhookOrderItem;
            orders?: SbhWebhookOrderItem[];
            items?: SbhWebhookOrderItem[];
            status?: string;
          };
          if (Array.isArray(d.orders)) {
            orderItems.push(...d.orders);
          } else if (Array.isArray(d.items)) {
            orderItems.push(...d.items);
          } else if (d.order && typeof d.order === 'object') {
            orderItems.push(d.order);
          } else if (d.status) {
            orderItems.push(d as SbhWebhookOrderItem);
          }
        }
      }

      if (Array.isArray(payload.orders)) {
        orderItems.push(...payload.orders);
      }
      if (Array.isArray(payload.items)) {
        orderItems.push(...payload.items);
      }

      const provider = FulfilmentService.getProvider();

      // Process each order item
      for (const item of orderItems) {
        const supplierOrderId = item.publicId || item.orderId || item.id;
        if (!supplierOrderId) continue;

        const order = await OrdersStore.findOrderBySupplierOrderId(supplierOrderId);
        if (!order) {
          console.warn(`[SBH Webhook] No matching Mystery Hub order found for supplier ID: ${supplierOrderId}`);
          continue;
        }

        const supplierStatus = provider.mapSupplierStatus(item.status);
        const mappedStatus: OrderStatus =
          supplierStatus === 'delivered'
            ? 'delivered'
            : supplierStatus === 'failed'
            ? 'refund_pending'
            : supplierStatus === 'processing'
            ? 'processing'
            : 'submitted';

        // Do not regress terminal delivered status
        if (order.status === 'delivered' && mappedStatus !== 'delivered') {
          continue;
        }

        await OrdersStore.updateOrderStatus(
          order.id,
          mappedStatus,
          item.failureReason,
          supplierOrderId,
          JSON.stringify(item)
        );

        console.info(
          `[SBH Webhook] Updated order ${order.public_reference} status: ${order.status} -> ${mappedStatus} (Supplier status: ${item.status})`
        );
      }

      res.status(200).json({ status: 'success' });
    } catch (err) {
      console.error('[SBH Webhook] Exception processing webhook:', err);
      // Webhooks must return 200 promptly to avoid aggressive retries
      res.status(200).json({ status: 'error_logged' });
    }
  }
}
