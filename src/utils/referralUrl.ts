/**
 * Reusable Referral URL Builder
 * Generates canonical, URL-safe referral links for any route across Mystery Hub.
 */

export const DEFAULT_PRODUCTION_DOMAIN = 'https://mysterybundlehub.com';

/**
 * Builds a clean referral link with the referral code query parameter.
 * Handles root, relative paths, query strings, and custom base URLs.
 */
export function buildReferralUrl(
  pathOrRoute: string = '/',
  referralCode: string,
  baseDomain?: string
): string {
  if (!referralCode || !referralCode.trim()) {
    return pathOrRoute;
  }

  const cleanCode = referralCode.trim().toUpperCase();

  // Determine base host
  let origin = baseDomain;
  if (!origin) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      origin = window.location.origin;
    } else {
      origin = DEFAULT_PRODUCTION_DOMAIN;
    }
  }

  // Remove trailing slash from origin
  const cleanOrigin = origin.replace(/\/+$/, '');

  // Normalize path
  let relativePath = pathOrRoute.trim();
  if (!relativePath.startsWith('/') && !relativePath.startsWith('http')) {
    relativePath = `/${relativePath}`;
  }

  try {
    const fullUrl = new URL(relativePath, cleanOrigin);
    fullUrl.searchParams.set('ref', cleanCode);
    return fullUrl.toString();
  } catch {
    // Fallback string concatenation if URL parsing fails
    const separator = relativePath.includes('?') ? '&' : '?';
    return `${cleanOrigin}${relativePath}${separator}ref=${encodeURIComponent(cleanCode)}`;
  }
}
