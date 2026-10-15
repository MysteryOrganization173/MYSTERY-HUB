import { OrdersStore } from '../db/ordersStore.js';
import { PaystackServerService } from './paystackService.js';
import { isDefinitiveUnpaidPayment, validateOrderPayment } from './paymentValidation.js';
import { FulfilmentService } from './fulfilmentService.js';
import { CommercialService } from './commercialService.js';

/** Closing a browser window is not payment evidence. Uncertain attempts stay recoverable. */
export async function reconcileCheckoutClosure(ref: string) {
  const order = await OrdersStore.findOrder(ref);
  if (!order) return {order:null, cancelled:false, alreadyPaid:false};
  if (order.payment_provider !== 'paystack' || order.payment_status === 'success'
    || order.status !== 'pending_payment') return {order,cancelled:false,alreadyPaid:order.payment_status === 'success'};
  const payment = await PaystackServerService.verifyTransaction(order.payment_reference);
  if (!validateOrderPayment(order,payment)) {
    await FulfilmentService.processPaidOrder(order.payment_reference,payment.paidAt || new Date().toISOString());
  } else if (isDefinitiveUnpaidPayment(order,payment)) {
    const closed = await OrdersStore.cancelOrder(order.id,'paystack_unpaid_verified');
    if (closed.cancelled) await CommercialService.paymentFailed(order,payment);
    return closed;
  }
  const current = await OrdersStore.findOrder(order.id);
  return {order:current,cancelled:false,alreadyPaid:current?.payment_status === 'success'};
}
