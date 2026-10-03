/**
 * Production Admin V1 API Routes
 * Strict RBAC enforcement: Requires active session with role === 'admin'.
 * Provides real operational monitoring, safe order reviews, waitlist management,
 * customer account controls, and system health status.
 */

import { Router, Request, Response } from 'express';
import { validateReferralRule, ReferralRuleValidationError } from '../services/referralRulePolicy.js';
import { requireAdmin } from '../middleware/authMiddleware.js';
import { OrdersStore } from '../db/ordersStore.js';
import { AuthStore } from '../db/authStore.js';
import { WaitlistStore } from '../db/waitlistStore.js';
import { MarketplaceStore } from '../db/marketplaceStore.js';
import { AdminAuditStore } from '../db/adminAuditStore.js';
import { ReferralStore } from '../db/referralStore.js';
import {
  MarketplaceProductPriceType,
  MarketplaceProductAvailability,
  CATEGORY_LABELS,
} from '../types/marketplace.js';
import { OrderRecord, toAdminOrderDetails } from '../types/orders.js';
import { toSafeUserProfile, UserStatus } from '../types/auth.js';
import { FulfilmentService } from '../services/fulfilmentService.js';
import { SuccessBizHubProvider } from '../suppliers/successBizHub/provider.js';
import { isDbConnected } from '../db/connection.js';
import { parseSupplierAdvertWithAi } from '../services/marketplaceAiImporter.js';

// Simple sliding window rate limit map for Admin AI Importer
const adminAiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export const adminRouter = Router();

// Apply strict admin authentication and authorization to all admin routes
adminRouter.use(requireAdmin);

/**
 * Neutralizes spreadsheet formula injection (CSV Injection) and escapes quotes
 * Defends against cells starting with =, +, -, @, \t, \r
 */
export function safeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();

  // Formula injection defense: neutralize leading formula trigger characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * 1. GET /api/admin/overview
 * Real server-calculated launch overview metrics
 */
adminRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    // Reconcile active supplier order statuses before calculating metrics
    const isForce = req.query.force === 'true' || req.query.refresh === 'true';
    await FulfilmentService.reconcileActiveSupplierOrders(isForce);

    const [orderMetrics, customerCount, waitlistStats] = await Promise.all([
      OrdersStore.getOverviewMetrics(),
      AuthStore.countCustomers(),
      WaitlistStore.getWaitlistGroupedStats(),
    ]);

    // Query supplier balance safely if available
    let supplierBalanceGhc: number | null = null;
    let supplierBalanceLow = false;
    let supplierStatus: 'connected' | 'unconfigured' | 'error' = 'unconfigured';
    const provider = new SuccessBizHubProvider();

    if (process.env.SUCCESS_BIZ_HUB_API_KEY) {
      try {
        const bal = await provider.getBalance();
        supplierBalanceGhc = bal.balanceGhc;
        const threshold = parseFloat(process.env.SUPPLIER_LOW_BALANCE_GHS || '100');
        supplierBalanceLow = supplierBalanceGhc < threshold;
        supplierStatus = 'connected';
      } catch {
        supplierStatus = 'error';
      }
    }

    res.json({
      success: true,
      metrics: {
        today: orderMetrics.today,
        last7Days: orderMetrics.last7Days,
        allTime: {
          ...orderMetrics.allTime,
          totalCustomers: customerCount,
          totalWaitlist: waitlistStats.totalAll,
          pendingWaitlist: waitlistStats.totalPending,
        },
        supplier: {
          status: supplierStatus,
          balanceGhc: supplierBalanceGhc,
          isLowBalance: supplierBalanceLow,
          fulfilmentEnabled: provider.client.isFulfillmentEnabled(),
        },
        waitlistGrouped: waitlistStats,
      },
    });
  } catch (err) {
    console.error('[Admin API] Overview error:', err);
    res.status(500).json({ error: 'Failed to compute admin overview metrics.' });
  }
});

/**
 * 2. GET /api/admin/orders
 * Paginated, searchable, and filtered order listing
 */
adminRouter.get('/orders', async (req: Request, res: Response) => {
  try {
    const isForce = req.query.force === 'true' || req.query.refresh === 'true';
    await FulfilmentService.reconcileActiveSupplierOrders(isForce);

    const {
      q,
      serviceType,
      network,
      status,
      paymentStatus,
      manualReview,
      dateFrom,
      dateTo,
      page,
      limit,
    } = req.query;

    const parsedManualReview =
      manualReview === 'true' ? true : manualReview === 'false' ? false : undefined;

    const result = await OrdersStore.searchOrdersAdmin({
      q: typeof q === 'string' ? q : undefined,
      serviceType: typeof serviceType === 'string' ? serviceType : undefined,
      network: typeof network === 'string' ? network : undefined,
      status: typeof status === 'string' ? status : undefined,
      paymentStatus: typeof paymentStatus === 'string' ? paymentStatus : undefined,
      manualReview: parsedManualReview,
      dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
      dateTo: typeof dateTo === 'string' ? dateTo : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25,
    });

    const safeOrders = result.orders.map(toAdminOrderDetails);

    res.json({
      success: true,
      orders: safeOrders,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    console.error('[Admin API] Search orders error:', err);
    res.status(500).json({ error: 'Failed to search and list orders.' });
  }
});

/**
 * 3. GET /api/admin/orders/:reference
 * Full administrative order details
 */
adminRouter.get('/orders/:reference', async (req: Request, res: Response) => {
  try {
    const ref = req.params.reference;
    const order = await OrdersStore.findOrder(ref);
    if (!order) {
      res.status(404).json({ error: 'Order reference not found.' });
      return;
    }

    res.json({
      success: true,
      order: toAdminOrderDetails(order),
    });
  } catch (err) {
    console.error('[Admin API] Get order error:', err);
    res.status(500).json({ error: 'Failed to retrieve order details.' });
  }
});

/**
 * 4. POST /api/admin/orders/:reference/refresh
 * Safely refreshes supplier order status using existing fulfilment service logic
 */
adminRouter.post('/orders/:reference/refresh', async (req: Request, res: Response) => {
  try {
    const ref = req.params.reference;
    const order = await OrdersStore.findOrder(ref);
    if (!order) {
      res.status(404).json({ error: 'Order reference not found.' });
      return;
    }

    const refreshed = await FulfilmentService.refreshOrderStatusIfDue(order, true);

    await AdminAuditStore.record({
      adminUserId: req.user!.id,
      action: 'order_supplier_status_refreshed',
      entityType: 'order',
      entityId: order.public_reference,
      metadata: {
        previousStatus: order.status,
        newStatus: refreshed.status,
      },
    });

    res.json({
      success: true,
      order: toAdminOrderDetails(refreshed),
      message: 'Order status refreshed from supplier.',
    });
  } catch (err) {
    console.error('[Admin API] Refresh order error:', err);
    res.status(500).json({ error: 'Failed to refresh order status.' });
  }
});

/**
 * 5. PATCH /api/admin/orders/:reference/review
 * Update manual review flag and/or internal admin note
 */
adminRouter.patch('/orders/:reference/review', async (req: Request, res: Response) => {
  try {
    const ref = req.params.reference;
    const { manualReview, adminNote } = req.body || {};

    const order = await OrdersStore.findOrder(ref);
    if (!order) {
      res.status(404).json({ error: 'Order reference not found.' });
      return;
    }

    const updated = await OrdersStore.updateOrderReview(
      order.id,
      typeof manualReview === 'boolean' ? manualReview : undefined,
      typeof adminNote === 'string' ? adminNote : adminNote === null ? null : undefined
    );

    if (!updated) {
      res.status(404).json({ error: 'Failed to update order.' });
      return;
    }

    await AdminAuditStore.record({
      adminUserId: req.user!.id,
      action: 'order_review_updated',
      entityType: 'order',
      entityId: order.public_reference,
      metadata: {
        manualReview: updated.manual_review,
        hasAdminNote: Boolean(updated.admin_note),
      },
    });

    res.json({
      success: true,
      order: toAdminOrderDetails(updated),
      message: 'Order review details updated.',
    });
  } catch (err) {
    console.error('[Admin API] Update order review error:', err);
    res.status(500).json({ error: 'Failed to update order review details.' });
  }
});

/**
 * 5b. PATCH /api/admin/orders/:reference/status
 * Admin update order marketplace/fulfilment status
 */
adminRouter.patch('/orders/:reference/status', async (req: Request, res: Response) => {
  try {
    const ref = req.params.reference;
    const { status, marketplaceStatus, adminNote } = req.body || {};

    const order = await OrdersStore.findOrder(ref);
    if (!order) {
      res.status(404).json({ error: 'Order reference not found.' });
      return;
    }

    const targetStatus = marketplaceStatus || status;
    if (!targetStatus) {
      res.status(400).json({ error: 'Status is required.' });
      return;
    }

    let updated: OrderRecord | null = null;
    if (order.service_type === 'marketplace' || marketplaceStatus) {
      updated = await OrdersStore.updateMarketplaceStatus(order.id, targetStatus, adminNote);
    } else {
      updated = await OrdersStore.updateOrderStatus(order.id, targetStatus, adminNote, undefined, undefined,
        { explicitReversal: ['refund_pending', 'refunded', 'cancelled', 'failed'].includes(targetStatus) });
    }

    if (!updated) {
      res.status(404).json({ error: 'Failed to update order status.' });
      return;
    }

    await AdminAuditStore.record({
      adminUserId: req.user!.id,
      action: 'order_status_updated',
      entityType: 'order',
      entityId: order.public_reference,
      metadata: {
        newStatus: updated.status,
        newMarketplaceStatus: updated.marketplace_status,
        hasAdminNote: Boolean(updated.admin_note),
      },
    });

    res.json({
      success: true,
      order: toAdminOrderDetails(updated),
      message: `Order status updated to ${updated.marketplace_status || updated.status}.`,
    });
  } catch (err) {
    console.error('[Admin API] Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

/**
 * 6. POST /api/admin/orders/:reference/close-test-order
 * Controlled closure of pre-launch/test orders so they no longer block MTN duplicate protection.
 * Strict safety rules:
 * - Refuses delivered orders.
 * - Refuses orders already dispatched with a supplier_order_id.
 * - Refuses already terminal orders (failed, refunded).
 * - Requires explicit second-level confirmation (confirmPaidTestOrder: true) if payment_status is success or paid_at exists.
 * - Sets status = 'failed' with descriptive administrative failure reason.
 * - Preserves all payment references, financial amounts, and customer history for audit integrity.
 * - Writes an audit record to admin_audit_log.
 */
adminRouter.post('/orders/:reference/close-test-order', async (req: Request, res: Response) => {
  try {
    const ref = req.params.reference;
    const { confirmPaidTestOrder, reason: customReason } = req.body || {};

    const order = await OrdersStore.findOrder(ref);
    if (!order) {
      res.status(404).json({ error: 'Order reference not found.' });
      return;
    }

    // Safety Rule 1: Never close delivered orders
    if (order.status === 'delivered' || order.delivered_at) {
      res.status(400).json({
        error: 'Delivered orders cannot be closed as test orders. The service was already fulfilled.',
      });
      return;
    }

    // Safety Rule 2: If dispatched to supplier, require supplier refresh instead
    if (order.supplier_order_id) {
      res.status(400).json({
        error: `Order was already dispatched to supplier (ID: ${order.supplier_order_id}). Use "Refresh Supplier Status" to synchronize the live supplier state.`,
      });
      return;
    }

    // Safety Rule 3: Refuse already terminal orders
    if (order.status === 'failed' || order.status === 'refunded') {
      res.status(400).json({
        error: `Order is already in a terminal state (${order.status}). No closure action needed.`,
      });
      return;
    }

    // Safety Rule 4: If order was paid, require explicit second-level confirmation
    const isPaid = order.payment_status === 'success' || Boolean(order.paid_at);
    if (isPaid && confirmPaidTestOrder !== true) {
      res.status(400).json({
        error:
          'This order has a successful payment record but no supplier order ID. Explicit confirmation (confirmPaidTestOrder: true) is required to close as a pre-launch test order.',
        requiresConfirmation: true,
      });
      return;
    }

    const finalReason =
      typeof customReason === 'string' && customReason.trim().length > 0
        ? customReason.trim()
        : 'Pre-launch test order closed by administrator.';

    const updated = await OrdersStore.closeAsTestOrder(order.id, finalReason);
    if (!updated) {
      res.status(500).json({ error: 'Failed to terminalize test order.' });
      return;
    }

    // Record audit record
    await AdminAuditStore.record({
      adminUserId: req.user!.id,
      action: 'prelaunch_test_order_closed',
      entityType: 'order',
      entityId: order.public_reference,
      metadata: {
        previousStatus: order.status,
        paymentStatus: order.payment_status,
        hadPaidAt: Boolean(order.paid_at),
        hadSupplierOrderId: Boolean(order.supplier_order_id),
        reason: finalReason,
        confirmedPaidTestOrder: Boolean(confirmPaidTestOrder),
      },
    });

    res.json({
      success: true,
      order: toAdminOrderDetails(updated),
      message: 'Test order closed. It will no longer block new MTN orders.',
    });
  } catch (err) {
    console.error('[Admin API] Close test order error:', err);
    res.status(500).json({ error: 'Failed to close test order.' });
  }
});

/**
 * 6. GET /api/admin/waitlist
 * Paginated waitlist entries with service aggregation stats
 */
adminRouter.get('/waitlist', async (req: Request, res: Response) => {
  try {
    const { q, serviceKey, channel, status, page, limit } = req.query;

    const [result, stats] = await Promise.all([
      WaitlistStore.searchWaitlistAdmin({
        q: typeof q === 'string' ? q : undefined,
        serviceKey: typeof serviceKey === 'string' ? serviceKey : undefined,
        channel: typeof channel === 'string' ? (channel as any) : undefined,
        status: typeof status === 'string' ? status : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 25,
      }),
      WaitlistStore.getWaitlistGroupedStats(),
    ]);

    res.json({
      success: true,
      entries: result.entries,
      stats,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    console.error('[Admin API] Waitlist search error:', err);
    res.status(500).json({ error: 'Failed to retrieve waitlist entries.' });
  }
});

/**
 * 7. PATCH /api/admin/waitlist/:id
 * Update status (pending, contacted, notified, unsubscribed) or admin note
 */
adminRouter.patch('/waitlist/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { status, adminNote } = req.body || {};

    if (status !== undefined && !['pending', 'contacted', 'notified', 'unsubscribed'].includes(status)) {
      res.status(400).json({ error: 'Invalid waitlist status.' });
      return;
    }

    if (status === undefined && adminNote === undefined) {
      res.status(400).json({ error: 'At least one field (status or adminNote) must be provided.' });
      return;
    }

    const updated = await WaitlistStore.updateWaitlistStatus(id, {
      status,
      adminNote: typeof adminNote === 'string' ? adminNote : adminNote === null ? null : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'Waitlist record not found.' });
      return;
    }

    await AdminAuditStore.record({
      adminUserId: req.user!.id,
      action: 'waitlist_status_changed',
      entityType: 'waitlist',
      entityId: id,
      metadata: {
        status: updated.status,
        serviceKey: updated.service_key,
        hasAdminNote: Boolean(updated.admin_note),
      },
    });

    res.json({
      success: true,
      entry: updated,
      message: 'Waitlist entry updated successfully.',
    });
  } catch (err) {
    console.error('[Admin API] Update waitlist error:', err);
    res.status(500).json({ error: 'Failed to update waitlist entry.' });
  }
});

/**
 * 8. GET /api/admin/waitlist/export
 * Safe CSV export of filtered waitlist entries with formula injection protection
 */
adminRouter.get('/waitlist-export', async (req: Request, res: Response) => {
  try {
    const { q, serviceKey, channel, status } = req.query;

    const result = await WaitlistStore.searchWaitlistAdmin({
      q: typeof q === 'string' ? q : undefined,
      serviceKey: typeof serviceKey === 'string' ? serviceKey : undefined,
      channel: typeof channel === 'string' ? (channel as any) : undefined,
      status: typeof status === 'string' ? status : undefined,
      page: 1,
      limit: 2000,
    });

    const rows = [
      ['ID', 'Service Key', 'Service Title', 'Channel', 'Contact', 'Status', 'Joined Date', 'Contacted Date', 'Admin Note'].map(safeCsvCell),
      ...result.entries.map((w) => [
        safeCsvCell(w.id),
        safeCsvCell(w.service_key),
        safeCsvCell(w.service_title),
        safeCsvCell(w.channel),
        safeCsvCell(w.contact),
        safeCsvCell(w.status),
        safeCsvCell(w.created_at),
        safeCsvCell(w.contacted_at || ''),
        safeCsvCell(w.admin_note || ''),
      ]),
    ];

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mystery_hub_waitlist_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('[Admin API] CSV Export error:', err);
    res.status(500).json({ error: 'Failed to export waitlist CSV.' });
  }
});

/**
 * 9. GET /api/admin/users
 * Search and list registered user accounts with batch aggregate stats (zero N+1 queries)
 */
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const { q, role, status, page, limit } = req.query;

    const result = await AuthStore.searchUsersAdmin({
      q: typeof q === 'string' ? q : undefined,
      role: typeof role === 'string' ? (role as any) : undefined,
      status: typeof status === 'string' ? (status as any) : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25,
    });

    const userIds = result.users.map((u) => u.id);
    const aggregates = await OrdersStore.getUserOrderAggregates(userIds);

    const safeUsers = result.users.map((u) => {
      const agg = aggregates.get(u.id) || { orderCount: 0, totalSpentMinor: 0 };
      return {
        ...toSafeUserProfile(u),
        orderCount: agg.orderCount,
        totalSpentGhc: Number((agg.totalSpentMinor / 100).toFixed(2)),
      };
    });

    res.json({
      success: true,
      users: safeUsers,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    console.error('[Admin API] Search users error:', err);
    res.status(500).json({ error: 'Failed to retrieve registered users.' });
  }
});

/**
 * 10. GET /api/admin/users/:id
 * Detailed customer profile with full order history and waitlist registrations
 */
adminRouter.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await AuthStore.findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    const [orders, waitlist] = await Promise.all([
      OrdersStore.findOrdersByUserId(userId),
      WaitlistStore.findUserWaitlists(userId),
    ]);

    res.json({
      success: true,
      user: toSafeUserProfile(user),
      orders: orders.map(toAdminOrderDetails),
      waitlist,
    });
  } catch (err) {
    console.error('[Admin API] Get user details error:', err);
    res.status(500).json({ error: 'Failed to retrieve user details.' });
  }
});

/**
 * 11. PATCH /api/admin/users/:id/status
 * Update user status (active <-> disabled).
 * Disabling revokes active sessions immediately.
 */
adminRouter.patch('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { status } = req.body || {};

    if (!status || !['active', 'disabled'].includes(status)) {
      res.status(400).json({ error: 'Status must be "active" or "disabled".' });
      return;
    }

    // Safety: prevent admin from disabling their own account
    if (req.user!.id === userId && status === 'disabled') {
      res.status(400).json({ error: 'You cannot disable your own administrator account.' });
      return;
    }

    const updated = await AuthStore.updateUserStatus(userId, status as UserStatus);
    if (!updated) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    if (status === 'disabled') {
      // Invalidate all active sessions for this user immediately
      await AuthStore.revokeAllUserSessions(userId);
    }

    await AdminAuditStore.record({
      adminUserId: req.user!.id,
      action: status === 'disabled' ? 'customer_disabled' : 'customer_enabled',
      entityType: 'user',
      entityId: userId,
      metadata: {
        targetUserName: updated.name,
        targetUserEmail: updated.email,
        targetUserPhone: updated.phone,
      },
    });

    res.json({
      success: true,
      user: toSafeUserProfile(updated),
      message: `User account has been ${status === 'disabled' ? 'disabled' : 'enabled'}.`,
    });
  } catch (err) {
    console.error('[Admin API] Update user status error:', err);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

/**
 * 12. GET /api/admin/system
 * Safe operations and integration health panel (never exposes secrets)
 */
adminRouter.get('/system', async (_req: Request, res: Response) => {
  try {
    // 1. Paystack check
    const paystackKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    let paystackStatus: 'configured' | 'unconfigured' = 'unconfigured';
    let paystackMode = 'Missing Key';

    if (paystackKey) {
      paystackStatus = 'configured';
      if (paystackKey.startsWith('sk_test_')) {
        paystackMode = 'Test Mode (sk_test_...)';
      } else if (paystackKey.startsWith('sk_live_')) {
        paystackMode = 'Live Production (sk_live_...)';
      } else {
        paystackMode = 'Unknown Key Format';
      }
    }

    const isPaystackTestMode = paystackKey.startsWith('sk_test_');

    // 2. Success Biz Hub check
    const sbhKey = (process.env.SUCCESS_BIZ_HUB_API_KEY || '').trim();
    const sbhConfigured = Boolean(sbhKey);
    let sbhStatus: 'connected' | 'unconfigured' | 'error' = sbhConfigured ? 'connected' : 'unconfigured';
    let sbhBalanceGhc: number | null = null;
    let sbhLowBalance = false;

    const provider = new SuccessBizHubProvider();

    if (sbhConfigured) {
      try {
        const bal = await provider.getBalance();
        sbhBalanceGhc = bal.balanceGhc;
        const threshold = parseFloat(process.env.SUPPLIER_LOW_BALANCE_GHS || '100');
        sbhLowBalance = sbhBalanceGhc < threshold;
      } catch {
        sbhStatus = 'error';
      }
    }

    // 3. Gemini AI check
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const geminiConfigured = Boolean(geminiKey);

    // 4. Database check
    const dbConnected = isDbConnected();

    // 5. Authoritative fulfilment state from SuccessBizHubClient
    const fulfilmentEnabled = provider.client.isFulfillmentEnabled();
    const uncertainSubmissionCount = await OrdersStore.getUncertainSupplierSubmissionCount();

    res.json({
      success: true,
      system: {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        components: {
          apiServer: { status: 'healthy', label: 'Online' },
          database: {
            status: dbConnected ? 'connected' : 'fallback',
            type: dbConnected ? 'PostgreSQL Connection Pool' : 'In-Memory Development Store',
          },
          paystack: {
            status: paystackStatus,
            mode: paystackMode,
            currency: 'GHS',
          },
          successBizHub: {
            status: sbhStatus,
            walletBalanceGhc: sbhBalanceGhc,
            isLowBalance: sbhLowBalance,
            lowBalanceThresholdGhc: parseFloat(process.env.SUPPLIER_LOW_BALANCE_GHS || '100'),
          },
          geminiAi: {
            status: geminiConfigured ? 'configured' : 'unconfigured',
            model: 'gemini-3.8-flash / gemini-3.1-flash-lite',
          },
          fulfilmentPipeline: {
            status: fulfilmentEnabled ? 'enabled' : 'disabled',
            autoDispatch: fulfilmentEnabled && !isPaystackTestMode,
            uncertainSubmissionCount,
          },
        },
      },
    });
  } catch (err) {
    console.error('[Admin API] System status error:', err);
    res.status(500).json({ error: 'Failed to retrieve system health status.' });
  }
});

/**
 * 13. GET /api/admin/audit-logs
 * Read recent administrative mutation audit records
 */
adminRouter.get('/audit-logs', async (_req: Request, res: Response) => {
  try {
    const logs = await AdminAuditStore.findRecent(50);
    res.json({
      success: true,
      logs,
    });
  } catch (err) {
    console.error('[Admin API] Audit logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// ==========================================
// 14. ADMIN MARKETPLACE PRODUCT MANAGEMENT
// ==========================================

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS).filter((k) => k !== 'all'));
const VALID_PRICE_TYPES = new Set<MarketplaceProductPriceType>(['fixed', 'starting_at', 'quote']);
const VALID_AVAILABILITIES = new Set<MarketplaceProductAvailability>([
  'available',
  'check_availability',
  'limited',
  'coming_soon',
]);

function sanitizeString(val: unknown, maxLen = 256): string | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val !== 'string') return undefined;
  // Remove raw script tags and control characters
  const clean = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
  return clean.slice(0, maxLen);
}

function isValidHttpUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 14a. GET /api/admin/marketplace/metrics
 */
adminRouter.get('/marketplace/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await MarketplaceStore.getAdminMetrics();
    res.json({
      success: true,
      metrics,
    });
  } catch (err) {
    console.error('[Admin API] Marketplace metrics error:', err);
    res.status(500).json({ error: 'Failed to retrieve marketplace metrics.' });
  }
});

/**
 * 14b. GET /api/admin/marketplace/products
 */
adminRouter.get('/marketplace/products', async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const status =
      req.query.status === 'published' ||
      req.query.status === 'draft' ||
      req.query.status === 'archived'
        ? (req.query.status as 'published' | 'draft' | 'archived')
        : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const products = await MarketplaceStore.getAdminProducts({ category, status, search });
    const metrics = await MarketplaceStore.getAdminMetrics();

    res.json({
      success: true,
      products,
      metrics,
    });
  } catch (err) {
    console.error('[Admin API] Marketplace products error:', err);
    res.status(500).json({ error: 'Failed to retrieve marketplace products.' });
  }
});

/**
 * 14c. POST /api/admin/marketplace/products
 * Create new marketplace product
 */
adminRouter.post('/marketplace/products', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const body = req.body || {};

    const name = sanitizeString(body.name, 256);
    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Product name must be at least 2 characters.' });
      return;
    }

    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!VALID_CATEGORIES.has(category)) {
      res.status(400).json({ error: `Invalid category. Supported categories: ${Array.from(VALID_CATEGORIES).join(', ')}` });
      return;
    }

    const priceType = body.priceType as MarketplaceProductPriceType;
    if (!VALID_PRICE_TYPES.has(priceType)) {
      res.status(400).json({ error: 'Invalid priceType. Supported: fixed, starting_at, quote' });
      return;
    }

    let priceMinor: number | null = null;
    if (priceType === 'fixed' || priceType === 'starting_at') {
      if (typeof body.priceMinor === 'number') {
        priceMinor = Math.floor(body.priceMinor);
      } else if (typeof body.priceGhc === 'number' || typeof body.priceGhc === 'string') {
        const parsedGhc = parseFloat(String(body.priceGhc));
        if (!isNaN(parsedGhc) && parsedGhc > 0) {
          priceMinor = Math.round(parsedGhc * 100);
        }
      }

      if (priceMinor === null || priceMinor <= 0) {
        res.status(400).json({ error: `Price is required for "${priceType}" price type and must be greater than 0.` });
        return;
      }
    }

    const availability = (body.availability as MarketplaceProductAvailability) || 'available';
    if (!VALID_AVAILABILITIES.has(availability)) {
      res.status(400).json({ error: 'Invalid availability status.' });
      return;
    }

    let imageUrl: string | null = null;
    if (body.imageUrl && typeof body.imageUrl === 'string' && body.imageUrl.trim().length > 0) {
      const cleanUrl = body.imageUrl.trim();
      if (!isValidHttpUrl(cleanUrl)) {
        res.status(400).json({ error: 'Image URL must be a valid HTTP or HTTPS URL.' });
        return;
      }
      imageUrl = cleanUrl;
    }

    let referralRewardMinor: number | null | undefined;
    if (body.referralRewardMinor !== undefined) {
      referralRewardMinor =
        typeof body.referralRewardMinor === 'number' && !isNaN(body.referralRewardMinor)
          ? Math.max(0, Math.floor(body.referralRewardMinor))
          : null;
    } else if (body.referralRewardGhc !== undefined) {
      if (body.referralRewardGhc === null || body.referralRewardGhc === '' || body.referralRewardGhc === 0) {
        referralRewardMinor = null;
      } else {
        const parsedGhc = parseFloat(String(body.referralRewardGhc));
        referralRewardMinor = !isNaN(parsedGhc) && parsedGhc > 0 ? Math.round(parsedGhc * 100) : null;
      }
    }

    const product = await MarketplaceStore.createProduct(
      {
        slug: body.slug ? sanitizeString(body.slug, 128) : undefined,
        name,
        category,
        tagline: sanitizeString(body.tagline, 256) || null,
        description: sanitizeString(body.description, 5000) || null,
        priceType,
        priceMinor,
        referralRewardMinor: referralRewardMinor !== undefined ? referralRewardMinor : null,
        availability,
        availabilityLabel: sanitizeString(body.availabilityLabel, 64) || null,
        badge: sanitizeString(body.badge, 64) || null,
        imageUrl,
        imageAlt: sanitizeString(body.imageAlt, 256) || name,
        highlights: Array.isArray(body.highlights)
          ? body.highlights.map((h: unknown) => sanitizeString(h, 200)).filter(Boolean)
          : null,
        specs: Array.isArray(body.specs)
          ? body.specs
              .filter((s: unknown) => typeof s === 'object' && s !== null && (s as { label?: string }).label)
              .map((s: { label: string; value: string }) => ({
                label: sanitizeString(s.label, 100) || '',
                value: sanitizeString(s.value, 200) || '',
              }))
          : null,
        featured: Boolean(body.featured),
        published: Boolean(body.published),
        sortOrder: typeof body.sortOrder === 'number' ? Math.floor(body.sortOrder) : 0,
        purchaseEnabled: body.purchaseEnabled !== undefined ? Boolean(body.purchaseEnabled) : true,
        fulfilmentMode: typeof body.fulfilmentMode === 'string' ? body.fulfilmentMode : 'both',
        pickupLocations: Array.isArray(body.pickupLocations) ? body.pickupLocations : [],
        deliveryAvailable: body.deliveryAvailable !== undefined ? Boolean(body.deliveryAvailable) : true,
        deliveryNote: body.deliveryNote ? sanitizeString(body.deliveryNote, 500) || null : null,
        purchaseNote: body.purchaseNote ? sanitizeString(body.purchaseNote, 500) || null : null,
        paymentRequiredBeforeDelivery: body.paymentRequiredBeforeDelivery !== undefined ? Boolean(body.paymentRequiredBeforeDelivery) : false,
      },
      adminUser.id
    );

    res.status(201).json({
      success: true,
      product,
      message: `Product "${product.name}" created successfully.`,
    });
  } catch (err) {
    console.error('[Admin API] Create marketplace product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create marketplace product.' });
  }
});

/**
 * 14d. PATCH /api/admin/marketplace/products/:id
 * Update product
 */
adminRouter.patch('/marketplace/products/:id', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const id = req.params.id;
    const body = req.body || {};

    const existing = await MarketplaceStore.getProductById(id);
    if (!existing) {
      res.status(404).json({ error: `Marketplace product "${id}" not found.` });
      return;
    }

    let name: string | undefined;
    if (body.name !== undefined) {
      name = sanitizeString(body.name, 256);
      if (!name || name.length < 2) {
        res.status(400).json({ error: 'Product name must be at least 2 characters.' });
        return;
      }
    }

    let category: string | undefined;
    if (body.category !== undefined) {
      const catTrimmed = typeof body.category === 'string' ? body.category.trim() : '';
      if (!VALID_CATEGORIES.has(catTrimmed)) {
        res.status(400).json({ error: 'Invalid category.' });
        return;
      }
      category = catTrimmed;
    }

    let priceType = existing.price_type;
    if (body.priceType !== undefined) {
      if (!VALID_PRICE_TYPES.has(body.priceType)) {
        res.status(400).json({ error: 'Invalid priceType.' });
        return;
      }
      priceType = body.priceType;
    }

    let priceMinor: number | null | undefined;
    if (priceType === 'quote') {
      priceMinor = null;
    } else if (body.priceMinor !== undefined) {
      priceMinor = typeof body.priceMinor === 'number' ? Math.floor(body.priceMinor) : null;
    } else if (body.priceGhc !== undefined) {
      const parsedGhc = parseFloat(String(body.priceGhc));
      if (!isNaN(parsedGhc) && parsedGhc > 0) {
        priceMinor = Math.round(parsedGhc * 100);
      }
    }

    let imageUrl: string | null | undefined;
    if (body.imageUrl !== undefined) {
      if (body.imageUrl && typeof body.imageUrl === 'string' && body.imageUrl.trim().length > 0) {
        const cleanUrl = body.imageUrl.trim();
        if (!isValidHttpUrl(cleanUrl)) {
          res.status(400).json({ error: 'Image URL must be a valid HTTP or HTTPS URL.' });
          return;
        }
        imageUrl = cleanUrl;
      } else {
        imageUrl = null;
      }
    }

    let availability = existing.availability;
    if (body.availability !== undefined) {
      if (!VALID_AVAILABILITIES.has(body.availability)) {
        res.status(400).json({ error: 'Invalid availability status.' });
        return;
      }
      availability = body.availability;
    }

    let referralRewardMinor: number | null | undefined;
    if (body.referralRewardMinor !== undefined) {
      referralRewardMinor =
        typeof body.referralRewardMinor === 'number' && !isNaN(body.referralRewardMinor)
          ? Math.max(0, Math.floor(body.referralRewardMinor))
          : null;
    } else if (body.referralRewardGhc !== undefined) {
      if (body.referralRewardGhc === null || body.referralRewardGhc === '' || body.referralRewardGhc === 0) {
        referralRewardMinor = null;
      } else {
        const parsedGhc = parseFloat(String(body.referralRewardGhc));
        referralRewardMinor = !isNaN(parsedGhc) && parsedGhc > 0 ? Math.round(parsedGhc * 100) : null;
      }
    }

    const updated = await MarketplaceStore.updateProduct(
      id,
      {
        slug: body.slug ? sanitizeString(body.slug, 128) : undefined,
        name,
        category,
        tagline: body.tagline !== undefined ? sanitizeString(body.tagline, 256) || null : undefined,
        description: body.description !== undefined ? sanitizeString(body.description, 5000) || null : undefined,
        priceType,
        priceMinor,
        referralRewardMinor,
        availability,
        availabilityLabel: body.availabilityLabel !== undefined ? sanitizeString(body.availabilityLabel, 64) || null : undefined,
        badge: body.badge !== undefined ? sanitizeString(body.badge, 64) || null : undefined,
        imageUrl,
        imageAlt: body.imageAlt !== undefined ? sanitizeString(body.imageAlt, 256) || null : undefined,
        highlights: Array.isArray(body.highlights)
          ? body.highlights.map((h: unknown) => sanitizeString(h, 200)).filter(Boolean)
          : undefined,
        specs: Array.isArray(body.specs)
          ? body.specs
              .filter((s: unknown) => typeof s === 'object' && s !== null && (s as { label?: string }).label)
              .map((s: { label: string; value: string }) => ({
                label: sanitizeString(s.label, 100) || '',
                value: sanitizeString(s.value, 200) || '',
              }))
          : undefined,
        featured: body.featured !== undefined ? Boolean(body.featured) : undefined,
        published: body.published !== undefined ? Boolean(body.published) : undefined,
        archived: body.archived !== undefined ? Boolean(body.archived) : undefined,
        sortOrder: typeof body.sortOrder === 'number' ? Math.floor(body.sortOrder) : undefined,
        purchaseEnabled: body.purchaseEnabled !== undefined ? Boolean(body.purchaseEnabled) : undefined,
        fulfilmentMode: body.fulfilmentMode !== undefined ? body.fulfilmentMode : undefined,
        pickupLocations: Array.isArray(body.pickupLocations) ? body.pickupLocations : undefined,
        deliveryAvailable: body.deliveryAvailable !== undefined ? Boolean(body.deliveryAvailable) : undefined,
        deliveryNote: body.deliveryNote !== undefined ? (sanitizeString(body.deliveryNote, 500) || null) : undefined,
        purchaseNote: body.purchaseNote !== undefined ? (sanitizeString(body.purchaseNote, 500) || null) : undefined,
        paymentRequiredBeforeDelivery: body.paymentRequiredBeforeDelivery !== undefined ? Boolean(body.paymentRequiredBeforeDelivery) : undefined,
      },
      adminUser.id
    );

    res.json({
      success: true,
      product: updated,
      message: `Product "${updated.name}" updated successfully.`,
    });
  } catch (err) {
    console.error('[Admin API] Update marketplace product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update marketplace product.' });
  }
});

/**
 * 14e. POST /api/admin/marketplace/products/:id/publish
 */
adminRouter.post('/marketplace/products/:id/publish', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const product = await MarketplaceStore.setPublished(req.params.id, true, adminUser.id);
    res.json({
      success: true,
      product,
      message: `Product "${product.name}" published live to storefront.`,
    });
  } catch (err) {
    console.error('[Admin API] Publish product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to publish product.' });
  }
});

/**
 * 14f. POST /api/admin/marketplace/products/:id/unpublish
 */
adminRouter.post('/marketplace/products/:id/unpublish', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const product = await MarketplaceStore.setPublished(req.params.id, false, adminUser.id);
    res.json({
      success: true,
      product,
      message: `Product "${product.name}" unpublished to draft status.`,
    });
  } catch (err) {
    console.error('[Admin API] Unpublish product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to unpublish product.' });
  }
});

/**
 * 14g. POST /api/admin/marketplace/products/:id/feature
 */
adminRouter.post('/marketplace/products/:id/feature', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const product = await MarketplaceStore.setFeatured(req.params.id, true, adminUser.id);
    res.json({
      success: true,
      product,
      message: `Product "${product.name}" marked as featured.`,
    });
  } catch (err) {
    console.error('[Admin API] Feature product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to feature product.' });
  }
});

/**
 * 14h. POST /api/admin/marketplace/products/:id/unfeature
 */
adminRouter.post('/marketplace/products/:id/unfeature', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const product = await MarketplaceStore.setFeatured(req.params.id, false, adminUser.id);
    res.json({
      success: true,
      product,
      message: `Product "${product.name}" removed from featured.`,
    });
  } catch (err) {
    console.error('[Admin API] Unfeature product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to unfeature product.' });
  }
});

/**
 * 14i. POST /api/admin/marketplace/products/:id/archive
 */
adminRouter.post('/marketplace/products/:id/archive', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const product = await MarketplaceStore.archiveProduct(req.params.id, adminUser.id);
    res.json({
      success: true,
      product,
      message: `Product "${product.name}" archived successfully.`,
    });
  } catch (err) {
    console.error('[Admin API] Archive product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to archive product.' });
  }
});

/**
 * 14j. POST /api/admin/marketplace/ai-import
 * Admin-only AI Importer endpoint to parse WhatsApp supplier adverts with Gemini.
 */
adminRouter.post('/marketplace/ai-import', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const { advertText } = req.body || {};

    if (!advertText || typeof advertText !== 'string' || !advertText.trim()) {
      res.status(400).json({ error: 'Please paste a supplier advert to parse.' });
      return;
    }

    const trimmed = advertText.trim();
    if (trimmed.length > 20000) {
      res.status(400).json({
        error: 'This advert is too long. Paste only the product information you want to import.',
      });
      return;
    }

    // Lightweight rate-limiting (e.g. 15 requests per minute per admin)
    const now = Date.now();
    const rateKey = adminUser.id;
    const currentLimit = adminAiRateLimitMap.get(rateKey) || { count: 0, resetAt: now + 60000 };

    if (now > currentLimit.resetAt) {
      currentLimit.count = 0;
      currentLimit.resetAt = now + 60000;
    }

    if (currentLimit.count >= 15) {
      res.status(429).json({
        error: 'AI import rate limit reached (15 per minute). Please wait a moment before trying again.',
      });
      return;
    }

    currentLimit.count += 1;
    adminAiRateLimitMap.set(rateKey, currentLimit);

    const extraction = await parseSupplierAdvertWithAi(trimmed);

    // Record admin audit log
    await AdminAuditStore.record({
      adminUserId: adminUser.id,
      action: 'marketplace_ai_import',
      entityType: 'marketplace_importer',
      entityId: 'ai_import',
      metadata: {
        productName: extraction.name,
        category: extraction.category,
        detectedPriceOptions: extraction.detectedPriceOptions.length,
        warningsCount: extraction.warnings.length,
      },
    });

    res.json({
      success: true,
      extraction,
      message: `Successfully extracted draft specifications for "${extraction.name}". Review and apply to form.`,
    });
  } catch (err) {
    console.error('[Admin API] AI Marketplace Importer error:', err);
    res.status(500).json({
      error: 'Mystery AI couldn\'t parse this advert right now. Your pasted text is still here, so you can retry or fill the form manually.',
    });
  }
});

// ==========================================
// ADMIN REFERRAL & REWARDS CONFIGURATION
// ==========================================

/**
 * GET /api/admin/referrals/rules
 * Returns all configured referral reward rules (active and disabled).
 */
adminRouter.get('/referrals/rules', async (_req: Request, res: Response) => {
  try {
    const rules = await ReferralStore.getAllRules();
    res.json({
      success: true,
      rules,
    });
  } catch (err) {
    console.error('[Admin API] Failed to get referral rules:', err);
    res.status(500).json({ error: 'Failed to retrieve referral rules.' });
  }
});

/**
 * POST /api/admin/referrals/rules
 * Create or update a referral reward rule.
 */
adminRouter.post('/referrals/rules', async (req: Request, res: Response) => {
  try {
    const adminUser = req.user!;
    const rulePayload = req.body || {};

    const rules = await ReferralStore.getAllRules();
    const existing = rules.find(rule => rule.id === rulePayload.id);
    const normalized = validateReferralRule(rulePayload, existing);
    const saved = await ReferralStore.createOrUpdateRule(normalized);
    const warnings = saved.reward_type === 'fixed_minor'
      ? ['Fixed rewards must fit the customer charge. Orders below this reward will not receive a payout; configured amounts are never reduced automatically.'] : [];
    if (rules.some(rule => rule.id !== saved.id && rule.enabled && saved.enabled
      && rule.service_type === saved.service_type && rule.network === saved.network
      && rule.product_key === saved.product_key && (rule.purchase_stage || 'any') === saved.purchase_stage
      && (!rule.ends_at || !saved.starts_at || new Date(rule.ends_at) >= new Date(saved.starts_at))
      && (!saved.ends_at || !rule.starts_at || new Date(saved.ends_at) >= new Date(rule.starts_at)))) {
      warnings.push('An enabled rule overlaps this scope and stage. The newest created rule wins; rule ID breaks ties.');
    }

    await AdminAuditStore.record({
      adminUserId: adminUser.id,
      action: 'referral_rule_updated',
      entityType: 'referral_reward_rule',
      entityId: saved.id,
      metadata: {
        service_type: saved.service_type,
        purchase_stage: saved.purchase_stage,
        reward_type: saved.reward_type,
        reward_minor: saved.reward_minor,
        reward_percent_bps: saved.reward_percent_bps,
        enabled: saved.enabled,
      },
    });

    res.json({
      success: true,
      rule: saved,
      warnings,
      message: 'Reward rule saved successfully.',
    });
  } catch (err) {
    if (err instanceof ReferralRuleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[Admin API] Failed to save referral rule:', err);
    res.status(500).json({ error: 'Failed to save referral rule.' });
  }
});

