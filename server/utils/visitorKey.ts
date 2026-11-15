/**
 * The visitor's address for throttling public, unauthenticated routes. Render's proxy appends the address it saw to
 * X-Forwarded-For, so the right-most hop is the one a client cannot forge (earlier hops are whatever the client sent).
 * Falls back to the socket address when the header is missing or malformed.
 */
export function visitorKey(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const hops = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded || '').split(',').map(hop => hop.trim()).filter(Boolean);
  const last = hops[hops.length - 1] || '';
  return (/^[0-9a-f:.]{3,45}$/i.test(last) ? last : '') || req.socket?.remoteAddress || req.ip || 'unknown';
}
