import type { TemplateItem } from '../types/index.js';

/**
 * The WhatsApp order list on Shop and Restaurant websites. It only writes a message for the buyer to
 * send: nothing is paid, reserved or deducted, and the business confirms price, stock and delivery.
 */
export interface OrderLine { key: string; itemId: string; name: string; option?: string; price?: string; quantity: number }
export const ORDER_LIST_LIMITS = Object.freeze({ lines: 20, quantity: 20, note: 200 });

/** What customers see when the owner left the price empty (V7.5: one wording everywhere). */
export const PRICE_ON_REQUEST = 'Price on request';

/** Owner prices are free text ("GH₵ 85.00", "GHC 280", "85"). Anything else ("Ask", "From 40") has no total. */
export function orderPriceMinor(price?: string): number | null {
  if (!price) return null;
  const clean = price.replace(/gh[s₵¢c]?|cedis?|₵|¢/gi, '').replace(/,/g, '').trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** "GH₵ 1,234.50" — the order list's own format, with thousands separators, for sums of listed prices. */
export function formatOrderGhs(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}GH₵ ${whole}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * The price as customers see it. The editor asks for cedis, so a bare number ("45", "1200.5") is shown
 * as cedis; anything the owner wrote in words ("From GH₵ 40", "Ask") is shown exactly as written; an
 * empty price is returned empty, and the design shows "Price on request" for it.
 */
export function displayItemPrice(price?: string): string {
  const text = typeof price === 'string' ? price.trim() : '';
  if (!text) return '';
  if (/^\d{1,7}(\.\d{1,2})?$/.test(text.replace(/,/g, ''))) return formatOrderGhs(Math.round(Number(text.replace(/,/g, '')) * 100));
  return text;
}
/** The same items with customer-facing prices, so cards, sheets and WhatsApp messages agree.
 * Groups are trimmed too, so "Mains " and "Mains" are one filter tab, not two that look alike. */
export const withDisplayPrices = <T extends TemplateItem>(items: readonly T[]): T[] => items.map(item => ({ ...item, price: displayItemPrice(item.price), ...(typeof item.category === "string" ? { category: item.category.trim() || undefined } : {}) }));

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

/** Known and unknown amounts, kept apart: a partial sum is never presented as the order total. */
export function orderTotals(lines: OrderLine[]): { knownMinor: number; unpriced: number; complete: boolean } {
  let knownMinor = 0, unpriced = 0;
  for (const line of lines) { const minor = orderPriceMinor(line.price); if (minor === null) unpriced += line.quantity; else knownMinor += minor * line.quantity; }
  return { knownMinor, unpriced, complete: lines.length > 0 && unpriced === 0 };
}
/** The sum of the owner's listed prices, only when every line has a plain price. */
export function orderTotalMinor(lines: OrderLine[]): number | null {
  const t = orderTotals(lines);
  return t.complete ? t.knownMinor : null;
}
export const orderCount = (lines: OrderLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);

/** One order line as it reads in the message: "2 × Sobolo · GH₵ 20 each (GH₵ 40.00)". */
export function orderLineText(l: OrderLine): string {
  const minor = orderPriceMinor(l.price);
  const price = !l.price ? PRICE_ON_REQUEST.toLowerCase() : l.quantity > 1 && minor !== null ? `${l.price} each (${formatOrderGhs(minor * l.quantity)})` : l.quantity > 1 ? `${l.price} each` : l.price;
  return `• ${l.quantity > 1 ? `${l.quantity} × ` : ''}${l.name}${l.option ? ` (${l.option})` : ''} · ${price}`;
}

/**
 * One plain WhatsApp message in the buyer's voice. The link lets the business see where it came from.
 * A total appears only when every line has a listed price; otherwise the known part is labelled as such.
 */
export function orderMessage(businessName: string, lines: OrderLine[], link?: string, note?: string): string {
  const t = orderTotals(lines);
  const cleanNote = (note || '').replace(/[<>]/g, '').trim().slice(0, ORDER_LIST_LIMITS.note);
  const summary = t.complete
    ? (lines.length > 1 || lines[0].quantity > 1 ? [`Total at your listed prices: ${formatOrderGhs(t.knownMinor)}`] : [])
    : t.knownMinor > 0 ? [`Listed prices so far: ${formatOrderGhs(t.knownMinor)}, plus ${t.unpriced} item${t.unpriced === 1 ? '' : 's'} for you to price`] : [];
  return [
    `Hello ${businessName}, I'd like to order:`,
    ...lines.map(orderLineText),
    ...summary,
    ...(cleanNote ? [`Note: ${cleanNote}`] : []),
    'Please confirm availability, the final price, delivery and payment.',
    ...(link ? [link] : []),
  ].join('\n');
}

/**
 * The international number wa.me needs, or '' without a usable one. Accepts 024…, 24… (nine digits,
 * leading 0 dropped), 233…, +233… and 00233…; other international numbers pass through unchanged.
 */
export function whatsappDigits(number?: string): string {
  let digits = (number || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  else if (/^[235]\d{8}$/.test(digits)) digits = `233${digits}`;
  return digits.length >= 9 && digits.length <= 15 ? digits : '';
}
/** wa.me needs the international number without "+" or a leading 0. Returns null without a usable number. */
export function whatsappOrderUrl(number: string | undefined, text: string): string | null {
  const digits = whatsappDigits(number);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** V7.5: the price hint says exactly what customers will see, so owners never guess. */
export function priceHint(price?: string): string {
  const text = (price || '').trim();
  if (!text) return `Empty is fine when the price varies: customers see “${PRICE_ON_REQUEST}” and you confirm it on WhatsApp.`;
  if (orderPriceMinor(text) !== null) return `Customers see “${displayItemPrice(text)}”. It is added up in their WhatsApp order.`;
  return `Customers see “${text}” as written. Words aren’t added up, so you confirm the price on WhatsApp.`;
}
