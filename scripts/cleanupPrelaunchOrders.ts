/**
 * Pre-Launch Order Data Cleanup Tool
 * Safe, dry-run-first script for closing stale pre-launch test orders
 * so legitimate customer purchases are no longer blocked by old test records.
 *
 * SAFETY RULES ENFORCED:
 * 1. Default to DRY RUN: No modifications occur unless PRELAUNCH_CLEANUP_CONFIRM=true or --confirm is passed.
 * 2. Explicit References Required: Only explicitly targeted order references (PRELAUNCH_TEST_ORDER_REFS or --refs)
 *    are eligible for modification.
 * 3. Delivered Orders Preserved: Delivered orders are NEVER deleted or terminalized by default.
 * 4. Payment Safety: Paid orders (payment_status='success' or paid_at) require explicit confirmation (PRELAUNCH_ALLOW_PAID=true or --allow-paid).
 * 5. Auditability by Default: Default action is 'terminalize' (sets status='failed' with admin reason), preserving database audit records.
 * 6. Secrets Protection: No secrets or raw credentials printed in logs. Phone numbers are securely masked.
 * 7. Idempotent: Running the script multiple times is completely safe.
 */

import { loadApplicationEnvironment } from '../server/utils/environment.js';
import { fileURLToPath } from 'url';
import { OrdersStore } from '../server/db/ordersStore.js';
import { OrderRecord } from '../server/types/orders.js';
import { SuccessBizHubClient } from '../server/suppliers/successBizHub/client.js';

loadApplicationEnvironment();

export interface CleanupOptions {
  confirm?: boolean;
  targetRefs?: string[];
  action?: 'terminalize' | 'delete';
  allowPaid?: boolean;
  overrideDelivered?: boolean;
  verbose?: boolean;
}

export interface CleanupReport {
  isDryRun: boolean;
  action: 'terminalize' | 'delete';
  scannedCount: number;
  candidateCount: number;
  skippedDeliveredCount: number;
  skippedPaidCount: number;
  skippedNotTargetedCount: number;
  terminalizedCount: number;
  deletedCount: number;
  affectedReferences: string[];
}

/**
 * Masks recipient phone for secure logging (e.g. 0592066298 -> 059***6298)
 */
export function maskRecipientPhone(phone: string | null | undefined): string {
  if (!phone) return 'unknown';
  const clean = phone.trim();
  if (clean.length <= 4) return '***' + clean;
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}

/**
 * Formats order candidate details for terminal output
 */
export function formatOrderCandidate(order: OrderRecord): string {
  const hasSupplierId = Boolean(order.supplier_order_id);
  const supplierIdDisplay = hasSupplierId ? `Yes (${order.supplier_order_id})` : 'None';
  return [
    `  • Reference:       ${order.public_reference} (ID: ${order.id})`,
    `    Created At:      ${order.created_at}`,
    `    Network:         ${order.network.toUpperCase()}`,
    `    Service Type:    ${order.service_type || 'data'} (${order.bundle_size_snapshot || 'N/A'})`,
    `    Recipient Phone: ${maskRecipientPhone(order.recipient_phone)}`,
    `    Status:          ${order.status}`,
    `    Payment Status:  ${order.payment_status}`,
    `    Paid At:         ${order.paid_at || 'None'}`,
    `    Delivered At:    ${order.delivered_at || 'None'}`,
    `    Supplier ID:     ${supplierIdDisplay}`,
    `    Supplier Prov.:  ${order.supplier_provider || 'None'}`,
  ].join('\n');
}

/**
 * Main execution function for pre-launch cleanup
 */
export async function runPrelaunchCleanup(options: CleanupOptions = {}): Promise<CleanupReport> {
  const isConfirmed = options.confirm ?? (
    process.env.PRELAUNCH_CLEANUP_CONFIRM === 'true' ||
    process.argv.includes('--confirm')
  );
  const isDryRun = !isConfirmed;

  // Determine action (terminalize vs delete)
  const rawAction = options.action ?? (
    process.env.PRELAUNCH_CLEANUP_ACTION ||
    (process.argv.find((arg) => arg.startsWith('--action='))?.split('=')[1]) ||
    'terminalize'
  );
  const action: 'terminalize' | 'delete' = rawAction === 'delete' ? 'delete' : 'terminalize';

  // Explicit target references
  let targetRefs: string[] = options.targetRefs ?? [];
  if (targetRefs.length === 0) {
    const envRefs = process.env.PRELAUNCH_TEST_ORDER_REFS;
    if (envRefs) {
      targetRefs = envRefs.split(',').map((r) => r.trim()).filter(Boolean);
    }
    const cliRefsArg = process.argv.find((arg) => arg.startsWith('--refs='));
    if (cliRefsArg) {
      const cliRefs = cliRefsArg.split('=')[1];
      if (cliRefs) {
        targetRefs = cliRefs.split(',').map((r) => r.trim()).filter(Boolean);
      }
    }
  }

  const allowPaid = options.allowPaid ?? (
    process.env.PRELAUNCH_ALLOW_PAID === 'true' ||
    process.argv.includes('--allow-paid')
  );

  const overrideDelivered = options.overrideDelivered ?? (
    process.env.PRELAUNCH_FORCE_OVERRIDE_DELIVERED === 'true' ||
    process.argv.includes('--override-delivered')
  );

  console.log('\n===============================================================');
  console.log('       MYSTERY HUB PRE-LAUNCH ORDER CLEANUP TOOL               ');
  console.log('===============================================================');
  console.log(`Execution Mode:     ${isDryRun ? 'DRY RUN (NO CHANGES APPLIED)' : 'LIVE EXECUTION'}`);
  console.log(`Cleanup Action:     ${action.toUpperCase()}`);
  console.log(`Target References:  ${targetRefs.length > 0 ? targetRefs.join(', ') : '(None specified — Discovery Mode)'}`);
  console.log(`Allow Paid Orders:  ${allowPaid ? 'YES (Override active)' : 'NO (Protected)'}`);
  console.log(`Delivered Override: ${overrideDelivered ? 'YES (Override active)' : 'NO (Protected)'}`);
  console.log('===============================================================\n');

  if (isDryRun) {
    console.log('ℹ️  NOTE: Running in DRY RUN mode. Inspecting candidates only.');
    console.log('   To apply changes, set PRELAUNCH_CLEANUP_CONFIRM=true or pass --confirm.\n');
  }

  // 1. Fetch candidate orders
  let candidateOrders: OrderRecord[] = [];
  if (targetRefs.length > 0) {
    candidateOrders = await OrdersStore.findOrdersByReferences(targetRefs);
  } else {
    // Discovery mode: find all blocking / in-flight orders
    candidateOrders = await OrdersStore.findCandidateBlockingOrders();
  }

  const report: CleanupReport = {
    isDryRun,
    action,
    scannedCount: candidateOrders.length,
    candidateCount: candidateOrders.length,
    skippedDeliveredCount: 0,
    skippedPaidCount: 0,
    skippedNotTargetedCount: 0,
    terminalizedCount: 0,
    deletedCount: 0,
    affectedReferences: [],
  };

  if (candidateOrders.length === 0) {
    console.log('No candidate orders found.');
    printReport(report);
    return report;
  }

  console.log(`Found ${candidateOrders.length} candidate order(s) for review:\n`);

  const supplierClient = new SuccessBizHubClient();

  for (const order of candidateOrders) {
    console.log('---------------------------------------------------------------');
    console.log(formatOrderCandidate(order));

    // Safety Check 1: If target references were specified, verify match
    if (targetRefs.length > 0 && !targetRefs.includes(order.public_reference) && !targetRefs.includes(order.id)) {
      console.log(`↳ [SKIPPED — not targeted] Reference ${order.public_reference} was not in explicit target list.`);
      report.skippedNotTargetedCount++;
      continue;
    }

    // Safety Check 2: If no target references were provided, DO NOT modify anything even if confirm was passed
    if (targetRefs.length === 0) {
      console.log(`↳ [CANDIDATE DISCOVERY] Found blocking order. To clean this order, add its reference to PRELAUNCH_TEST_ORDER_REFS="${order.public_reference}".`);
      continue;
    }

    // Safety Check 3: Refuse to touch delivered orders
    if (order.status === 'delivered' || Boolean(order.delivered_at)) {
      if (!overrideDelivered) {
        console.log(`↳ [SKIPPED — delivered order] ${order.public_reference} is marked delivered. Preserving accounting record.`);
        report.skippedDeliveredCount++;
        continue;
      } else {
        console.log(`↳ [WARNING — override active] Proceeding with delivered order ${order.public_reference} due to override.`);
      }
    }

    // Safety Check 4: Supplier Refresh Check
    // If supplier_order_id exists and status is submitted/processing, query supplier before cleanup
    if (order.supplier_order_id && ['submitted', 'processing', 'queued'].includes(order.status)) {
      if (supplierClient.isConfigured()) {
        try {
          console.log(`↳ [SUPPLIER CHECK] Querying supplier status for ID ${order.supplier_order_id}...`);
          const supplierStatus = await supplierClient.getOrder(order.supplier_order_id);
          const rawStatus = (supplierStatus?.data?.status || '').toLowerCase();
          if (rawStatus === 'processed' || rawStatus === 'completed' || rawStatus === 'delivered') {
            console.log(`↳ [SUPPLIER SYNC] Supplier reports order as ${rawStatus}! Updating DB to delivered and preserving.`);
            if (!isDryRun) {
              await OrdersStore.updateOrderStatus(order.id, 'delivered');
            }
            report.skippedDeliveredCount++;
            continue;
          }
        } catch (err) {
          console.warn(`↳ [SUPPLIER CHECK] Could not refresh supplier status (continuing safely):`, err instanceof Error ? err.message : err);
        }
      }
    }

    // Safety Check 5: Payment Safety
    const isPaid = order.payment_status === 'success' || Boolean(order.paid_at);
    if (isPaid && !allowPaid) {
      console.log(`↳ [SKIPPED — paid order requires review] ${order.public_reference} has paid status (${order.payment_status}, paid_at: ${order.paid_at || 'n/a'}).`);
      console.log(`   To force cleanup on this test record, set PRELAUNCH_ALLOW_PAID=true or --allow-paid.`);
      report.skippedPaidCount++;
      continue;
    }

    // Apply Action
    if (isDryRun) {
      if (action === 'terminalize') {
        console.log(`↳ [DRY RUN] Would terminalize order ${order.public_reference} (status: ${order.status} -> failed).`);
      } else {
        console.log(`↳ [DRY RUN] Would delete order ${order.public_reference} from database.`);
      }
      report.affectedReferences.push(order.public_reference);
    } else {
      if (action === 'terminalize') {
        const cleanupReason = 'Pre-launch test order closed during production cleanup.';
        await OrdersStore.updateOrderStatus(order.id, 'failed', cleanupReason);
        await OrdersStore.updateOrderReview(order.id, false, cleanupReason);
        console.log(`↳ [SUCCESS] Terminalized order ${order.public_reference} (status set to failed, failure_reason recorded).`);
        report.terminalizedCount++;
        report.affectedReferences.push(order.public_reference);
      } else if (action === 'delete') {
        await OrdersStore.deleteOrder(order.id);
        console.log(`↳ [SUCCESS] Deleted order ${order.public_reference} from database.`);
        report.deletedCount++;
        report.affectedReferences.push(order.public_reference);
      }
    }
  }

  printReport(report);
  return report;
}

function printReport(report: CleanupReport): void {
  console.log('\n===============================================================');
  console.log('                 PRE-LAUNCH CLEANUP REPORT                     ');
  console.log('===============================================================');
  console.log(`Execution Mode:                ${report.isDryRun ? 'DRY RUN (Simulated)' : 'LIVE EXECUTION (Changes applied)'}`);
  console.log(`Action:                        ${report.action}`);
  console.log(`Total Orders Scanned:          ${report.scannedCount}`);
  console.log(`Candidate Orders:              ${report.candidateCount}`);
  console.log(`Skipped Delivered Orders:      ${report.skippedDeliveredCount}`);
  console.log(`Skipped Paid (Require Review): ${report.skippedPaidCount}`);
  console.log(`Skipped Not Targeted:          ${report.skippedNotTargetedCount}`);
  console.log(`Stale Orders Terminalized:     ${report.terminalizedCount}`);
  console.log(`Rows Deleted:                  ${report.deletedCount}`);
  console.log(`Affected Public References:    ${report.affectedReferences.length > 0 ? report.affectedReferences.join(', ') : 'None'}`);
  console.log('===============================================================\n');
}

// Auto-run if executed directly via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runPrelaunchCleanup()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error during pre-launch cleanup:', err);
      process.exit(1);
    });
}
