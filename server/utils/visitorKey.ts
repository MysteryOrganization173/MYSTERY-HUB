/**
 * The visitor's address behind Render's proxy (no `trust proxy` here): the first X-Forwarded-For hop when it is a
 * plain IP address, else the socket address. Used to throttle public, unauthenticated routes per visitor.
 */
export function visitorKey(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return (/^[0-9a-f:.]{3,45}$/i.test(first) ? first : '') || req.ip || req.socket?.remoteAddress || 'unknown';
}
