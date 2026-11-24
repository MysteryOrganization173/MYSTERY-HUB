import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, RotateCcw, ShoppingBag, XCircle, GraduationCap, ShieldCheck, RefreshCw } from 'lucide-react';
import { OrderRecord } from '../../types';
import { NetworkBrandBadge } from '../common/NetworkBrandBadge';
import {
  CustomerOrderGroup,
  CustomerOrderStatus,
  customerOrderNetwork,
  customerOrderRecipient,
  customerOrderTitle,
  isMarketplaceOrder,
  orderDateLabel,
  shortStatusLabel,
} from '../../utils/customerOrderPresentation';
import { orderSaving } from '../../utils/orderReceiptPresentation';

const GROUP_ICON: Record<CustomerOrderGroup, typeof Clock> = {
  awaiting_payment: Clock,
  in_progress: RefreshCw,
  delivered: CheckCircle2,
  attention: AlertTriangle,
  refund_pending: RotateCcw,
  refunded: RotateCcw,
  resolved: ShieldCheck,
  cancelled: XCircle,
};

/** The status as a short pill. It pops once if the status changes while the page is open, never on arrival. */
export const OrderStatusPill: React.FC<{ status: CustomerOrderStatus }> = ({ status }) => {
  const Icon = GROUP_ICON[status.group];
  const first = useRef(status.label);
  const [changed, setChanged] = useState(false);
  useEffect(() => { if (status.label !== first.current) { first.current = status.label; setChanged(true); } }, [status.label]);
  return (
    <span key={changed ? status.label : 'first'} className="mh-or-pill" data-group={status.group} {...(changed ? { 'data-changed': '' } : {})}>
      <Icon aria-hidden="true" />
      {shortStatusLabel(status.label)}
    </span>
  );
};

/**
 * One order in the list: what was bought, what it cost, where it stands and when. The whole card is a single button
 * that opens the receipt; it holds no other controls. Its colour comes from the status group only.
 */
export const CustomerOrderCard: React.FC<{ order: OrderRecord; status: CustomerOrderStatus; onOpen: () => void; now: Date }> = ({ order, status, onOpen, now }) => {
  const marketplace = isMarketplaceOrder(order);
  const recipient = customerOrderRecipient(order);
  // From the order's own snapshot, never today's prices, and only once a payment is confirmed.
  const saving = orderSaving(order, status.group);
  const complimentary = order.paymentBasis === 'complimentary';
  const unpaid = status.group === 'cancelled' || status.group === 'awaiting_payment';
  return (
    <button
      type="button"
      data-mh-order-card
      data-group={status.group}
      onClick={onOpen}
      className="mh-or-card"
    >
      <span className="mh-or-card-mark" aria-hidden="true">
        {marketplace || order.serviceType === 'results_checker' ? (
          <span className="mh-or-card-icon">
            {order.serviceType === 'results_checker' ? <GraduationCap /> : <ShoppingBag />}
          </span>
        ) : (
          <NetworkBrandBadge network={order.network} size="xs" />
        )}
      </span>
      <span className="mh-or-card-main">
        <span className="mh-or-card-top">
          <span className="mh-or-card-title">{customerOrderTitle(order)}</span>
          {complimentary
            ? <span className="mh-or-card-amount" data-muted="">Complimentary</span>
            : <span className="mh-or-card-amount" {...(unpaid ? { 'data-muted': '' } : {})}>GH₵{order.amountGhc.toFixed(2)}</span>}
        </span>
        <span className="mh-or-card-sub">
          <span><span className={marketplace ? '' : 'sr-only'}>{customerOrderNetwork(order)}{recipient ? ' · ' : ''}</span>{recipient}</span>
          {saving > 0 && <span className="mh-or-card-saving">Saved GH₵{saving.toFixed(2)}</span>}
        </span>
        <span className="mh-or-card-foot">
          <OrderStatusPill status={status} />
          <span className="mh-or-card-date">{orderDateLabel(order.createdAt, now)}</span>
        </span>
        <span className="sr-only">. View order details</span>
      </span>
      <ChevronRight aria-hidden="true" className="mh-or-card-chevron" />
    </button>
  );
};
