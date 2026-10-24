import { socialHeadEntries, type SocialHead } from './socialMetadata.js';

/** Shared by the Express HTML responder and the build step that writes dist/app/index.html for the static site. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function injectSocialHead(html: string, head: SocialHead, customerSite = false): string {
  let result = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["'](?:canonical|icon|apple-touch-icon)["'][^>]*>/gi, '');
  // The static platform graph must not claim ownership of a hosted business.
  if (customerSite) result = result.replace(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*rel\s*=\s*["']manifest["'][^>]*>/gi, '');
  const tags = [`<title>${escapeHtml(head.title)}</title>`, ...socialHeadEntries(head).filter(([, , value]) => value).map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`),
    `<link rel="canonical" href="${escapeHtml(head.url)}" />`, `<link rel="icon" href="${escapeHtml(head.icon || 'data:,')}" />`];
  return result.replace(/<\/head>/i, `${tags.join('\n    ')}\n  </head>`);
}
