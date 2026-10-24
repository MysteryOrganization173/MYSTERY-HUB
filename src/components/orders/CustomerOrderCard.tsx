import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, RotateCcw, ShoppingBag, XCircle } from 'lucide-react';
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

const GROUP_STYLE: Record<CustomerOrderGroup, { className: string; Icon: typeof Clock }> = {
  awaiting_payment: { className: 'text-amber-200 bg-amber-400/10 border-amber-400/25', Icon: Clock },
  in_progress: { className: 'text-sky-200 bg-sky-400/10 border-sky-400/25', Icon: Clock },
  delivered: { className: 'text-[#44df95] bg-[#00c365]/10 border-[#00c365]/25', Icon: CheckCircle2 },
  attention: { className: 'text-rose-200 bg-rose-500/10 border-rose-400/30', Icon: AlertTriangle },
  refund_pending: { className: 'text-amber-200 bg-amber-400/10 border-amber-400/25', Icon: RotateCcw },
  refunded: { className: 'text-slate-100 bg-slate-500/15 border-slate-400/30', Icon: RotateCcw },
  resolved: { className: 'text-slate-100 bg-slate-500/15 border-slate-400/30', Icon: CheckCircle2 },
  cancelled: { className: 'text-slate-300 bg-slate-700/30 border-slate-600/40', Icon: XCircle },
};

export const OrderStatusPill: React.FC<{ status: CustomerOrderStatus }> = ({ status }) => {
  const { className, Icon } = GROUP_STYLE[status.group];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
      <Icon aria-hidden="true" className="w-3.5 h-3.5" />
      {shortStatusLabel(status.label)}
    </span>
  );
};

/**
 * One order in the list: what was bought, what it cost, where it stands and when. The whole
 * card is a single button that opens the receipt; it holds no other controls.
 */
export const CustomerOrderCard: React.FC<{ order: OrderRecord; status: CustomerOrderStatus; onOpen: () => void; now: Date }> = ({ order, status, onOpen, now }) => {
  const marketplace = isMarketplaceOrder(order);
  const recipient = customerOrderRecipient(order);
  const saving = order.commercialPricing?.discountMinor ? order.commercialPricing.discountMinor / 100 : 0;
  return (
    <button
      type="button"
      data-mh-order-card
      onClick={onOpen}
      className="group w-full text-left flex items-start gap-3 rounded-2xl border border-slate-800 bg-[#0f151b] hover:border-[#00c365]/40 hover:bg-[#111a21] px-3.5 py-3 sm:px-4 sm:py-3.5 transition-colors cursor-pointer"
    >
      <span className="w-[3.25rem] shrink-0 flex justify-center pt-0.5" aria-hidden="true">
        {marketplace ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00c365]/15 border border-[#00c365]/30 text-[#00c365]">
            <ShoppingBag className="w-4 h-4" />
          </span>
        ) : (
          <NetworkBrandBadge network={order.network} size="xs" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-sm sm:text-[15px] font-semibold text-white leading-snug line-clamp-2 break-words">{customerOrderTitle(order)}</span>
          <span className="shrink-0 text-sm sm:text-[15px] font-bold text-white tabular-nums">GH₵{order.amountGhc.toFixed(2)}</span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-3 text-xs text-slate-400">
          <span className="min-w-0 truncate"><span className={marketplace ? '' : 'sr-only'}>{customerOrderNetwork(order)}{recipient ? ' · ' : ''}</span>{recipient}</span>
          {saving > 0 && <span className="shrink-0 text-emerald-300">Saved GH₵{saving.toFixed(2)}</span>}
        </span>
        <span className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <OrderStatusPill status={status} />
          <span className="text-xs text-slate-500 whitespace-nowrap">{orderDateLabel(order.createdAt, now)}</span>
        </span>
        <span className="sr-only">. View order details</span>
      </span>
      <ChevronRight aria-hidden="true" className="w-4 h-4 mt-1 shrink-0 text-slate-600 group-hover:text-[#00c365] transition-colors" />
    </button>
  );
};
