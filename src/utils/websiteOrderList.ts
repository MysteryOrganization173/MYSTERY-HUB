import type { TemplateItem } from '../types/index.js';
import { formatGhs } from '../../shared/money.js';

/**
 * The WhatsApp order list on Shop and Restaurant websites. It only writes a message for the buyer to
 * send: nothing is paid, reserved or deducted, and the business confirms price, stock and delivery.
 */
export interface OrderLine { key: string; itemId: string; name: string; option?: string; price?: string; quantity: number }
export const ORDER_LIST_LIMITS = Object.freeze({ lines: 20, quantity: 20 });

/** Owner prices are free text ("GH₵ 85.00", "GHC 280", "85"). Anything else ("Ask", "From 40") has no total. */
export function orderPriceMinor(price?: string): number | null {
  if (!price) return null;
  const clean = price.replace(/gh[s₵¢c]?|cedis?|₵|¢/gi, '').replace(/,/g, '').trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const orderLineKey = (itemId: string, option?: string) => `${itemId}::${option || ''}`;

export function addOrderLine(lines: OrderLine[], item: TemplateItem, option?: string): OrderLine[] {
  const itemId = item.id || item.name, key = orderLineKey(itemId, option);
  const existing = lines.find(l => l.key === key);
  if (existing) return lines.map(l => l === existing ? { ...l, quantity: Math.min(ORDER_LIST_LIMITS.quantity, l.quantity + 1) } : l);
  if (lines.length >= ORDER_LIST_LIMITS.lines) return lines;
  return [...lines, { key, itemId, name: item.name, option: option || undefined, price: item.price || undefined, quantity: 1 }];
}
export function setOrderQuantity(lines: OrderLine[], key: string, quantity: number): OrderLine[] {
  if (quantity <= 0) return lines.filter(l => l.key !== key);
  return lines.map(l => l.key === key ? { ...l, quantity: Math.min(ORDER_LIST_LIMITS.quantity, Math.floor(quantity)) } : l);
}

/** The sum of the owner's listed prices, only when every line has a plain price. */
export function orderTotalMinor(lines: OrderLine[]): number | null {
  if (!lines.length) return null;
  let total = 0;
  for (const line of lines) { const minor = orderPriceMinor(line.price); if (minor === null) return null; total += minor * line.quantity; }
  return total;
}
export const orderCount = (lines: OrderLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);

/** One plain WhatsApp message in the buyer's voice. The link lets the business see where it came from. */
export function orderMessage(businessName: string, lines: OrderLine[], link?: string): string {
  const rows = lines.map(l => `• ${l.quantity > 1 ? `${l.quantity} × ` : ''}${l.name}${l.option ? ` (${l.option})` : ''}${l.price ? ` · ${l.price}` : ''}`);
  const total = orderTotalMinor(lines);
  return [
    `Hello ${businessName}, I'd like to order:`,
    ...rows,
    ...(total !== null && lines.length > 1 ? [`Total at your listed prices: ${formatGhs(total)}`] : []),
    'Please confirm availability, delivery and payment.',
    ...(link ? [link] : []),
  ].join('\n');
}

/** wa.me needs the international number without "+" or a leading 0. Returns null without a usable number. */
export function whatsappOrderUrl(number: string | undefined, text: string): string | null {
  const digits = (number || '').replace(/\D/g, '').replace(/^0/, '233');
  if (digits.length < 9 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
