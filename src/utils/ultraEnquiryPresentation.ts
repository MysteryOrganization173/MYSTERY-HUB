/** Contact actions open a chat only; no customer text is sent automatically. */
export function ultraCustomerWhatsApp(phone: string): string | null {
  if (!/^\+?[\d ()-]{7,30}$/.test(phone)) return null;
  let digits = phone.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) digits = '233' + digits.slice(1);
  return /^\d{7,15}$/.test(digits) ? `https://wa.me/${digits}` : null;
}
export function ultraReferenceWebsite(value?: string): string | null {
  try { const url = new URL(value || ''); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
