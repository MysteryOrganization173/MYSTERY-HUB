/** Public legacy formats share one parser on server and browser. No redirects or ref/filter changes. */
export function marketplaceProductKey(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);
  const query = params.get('product') || params.get('item') || params.get('id');
  const match = pathname.match(/^\/marketplace\/([^/]+)\/?$/i);
  let pathKey: string | null = null;
  try { pathKey = match && match[1].toLowerCase() !== 'index.html' ? decodeURIComponent(match[1]) : null; } catch { return null; }
  const value = query || pathKey;
  return value?.trim().toLowerCase() || null;
}
