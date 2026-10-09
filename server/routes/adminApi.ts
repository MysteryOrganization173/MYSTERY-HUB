import { adminCommercialRouter } from './commercialApi.js';
import { AfaStore } from '../db/afaStore.js';
import { adminFinanceRouter } from './financeApi.js';
import { AfaService } from '../services/afaService.js';
import { adminMarketplaceRouter } from './adminMarketplaceApi.js';
import { WebsiteUltraStore } from '../db/websiteUltraStore.js';
import { adminWebsiteRouter } from './websiteFreeApi.js';
/**
 * Production Admin V1 API Routes
 * Strict RBAC enforcement: Requires active session with role === 'admin'.
 * Provides real operational monitoring, safe order reviews, waitlist management,
 * customer account controls, and system health status.
 */

import { Router, Request, Response } from 'express';
import { adminEarnRouter } from './adminEarnApi.js';
import { AdminEarnStore } from '../db/adminEarnStore.js';
import { describeAdminRule, saveAdminRewardRule } from '../services/adminEarnControls.js';
import { EarnInputError } from '../services/adminEarnQuery.js';
import { ReferralRuleValidationError } from '../services/referralRulePolicy.js';
import { requireAdmin } from '../middleware/authMiddleware.js';
import { OrdersStore } from '../db/ordersStore.js';
import { AuthStore } from '../db/authStore.js';
import { WaitlistStore } from '../db/waitlistStore.js';
import { AdminAuditStore } from '../db/adminAuditStore.js';
import { ReferralStore } from '../db/referralStore.js';
import { OrderRecord, toAdminOrderDetails } from '../types/orders.js';
import { toSafeUserProfile, UserStatus } from '../types/auth.js';
import { FulfilmentService } from '../services/fulfilmentService.js';
import { SuccessBizHubProvider } from '../suppliers/successBizHub/provider.js';
import { isDbConnected } from '../db/connection.js';
import { parseSupplierAdvertWithAi } from '../services/marketplaceAiImporter.js';

// Simple sliding window rate limit map for Admin AI Importer
const adminAiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

import { adminAccountRouter } from './adminAccountApi.js';

export const adminRouter = Router();
adminRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});

// Apply strict admin authentication and authorization to all admin routes
adminRouter.use(requireAdmin);
adminRouter.use('/finance', adminFinanceRouter);
adminRouter.use('/commercial',adminCommercialRouter);
adminRouter.use('/website-builder', adminWebsiteRouter);
adminRouter.use(adminAccountRouter);
adminRouter.use('/marketplace', adminMarketplaceRouter);
adminRouter.use('/referrals', adminEarnRouter);
adminRouter.get('/websites/ultra-enquiries', async (req, res) => {
  const limit = Number(req.query.limit ?? 25), offset = Number(req.query.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) { res.status(400).json({ error: 'Invalid pagination.' }); return; }
  try { res.json({ success: true, ...(await WebsiteUltraStore.list(limit, offset)), limit, offset }); }
  catch { res.status(503).json({ error: 'Could not retrieve enquiries.' }); }
});

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
      order: { ...toAdminOrderDetails(order), ...(order.service_type === 'afa' ? { afa_registration: await AfaStore.operationalDetails(order.id) } : {}) },
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
      order: { ...toAdminOrderDetails(refreshed), ...(refreshed.service_type === 'afa' ? { afa_registration: await AfaStore.operationalDetails(refreshed.id) } : {}) },
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

    if (order.service_type === 'afa' && (marketplaceStatus || !['refund_pending','refunded','cancelled','failed'].includes(targetStatus))) { res.status(400).json({error:'AFA completion requires a confirmed supplier registered status. Use supplier refresh.'}); return; }
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

    const [orders, waitlist, earn] = await Promise.all([
      OrdersStore.findOrdersByUserId(userId),
      WaitlistStore.findUserWaitlists(userId),
      AdminEarnStore.customerSummary(userId),
    ]);

    res.json({
      success: true,
      user: toSafeUserProfile(user),
      orders: orders.map(toAdminOrderDetails),
      waitlist,
      earn,
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
          afa: await AfaService.publicConfig(),
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
      rules: rules.map(rule => describeAdminRule(rule, rules)),
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

    const saved = await saveAdminRewardRule(adminUser.id, rulePayload);
    res.json({ success: true, ...saved, message: 'Reward rule saved successfully.' });
  } catch (err) {
    if (err instanceof ReferralRuleValidationError || err instanceof EarnInputError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[Admin API] Failed to save referral rule:', err);
    res.status(500).json({ error: 'Failed to save referral rule.' });
  }
});
