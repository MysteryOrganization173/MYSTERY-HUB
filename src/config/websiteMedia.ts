export const WEBSITE_MEDIA_DEFAULTS = { maxAssets: 20, maxBytes: 8 * 1024 * 1024, intentMinutes: 10 } as const;
export const WEBSITE_UPLOAD_REPLAY_GRACE_MS = 15 * 60_000;
export const WEBSITE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export interface WebsiteAsset {
  id: string; website_id: string | null; user_id: string; provider: 'cloudinary'; public_id: string;
  original_filename: string; mime: string; format: string | null; bytes: number;
  width: number | null; height: number | null; secure_url: string | null; delivery_url: string | null;
  status: 'pending' | 'ready' | 'deleting' | 'deleted' | 'failed';
  expires_at: string; created_at: string; updated_at: string;
}
export interface WebsiteUploadIntent {
  assetId: string; expiresAt: string; uploadUrl: string; apiKey: string;
  parameters: Record<string, string>; signature: string;
}
/** Only canonical Cloudinary originals are transformed. Legacy/external URLs remain exact. */
export function websiteImageUrl(source: string | undefined, width = 1200): string {
  if (!source) return '';
  const match = source.match(/^(https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/)(v\d+\/[^?#]+)$/);
  if (!match) return source;
  return `${match[1]}f_auto,q_auto,c_limit,w_${Math.min(1600, Math.max(64, Math.round(width)))}/${match[2]}`;
}
