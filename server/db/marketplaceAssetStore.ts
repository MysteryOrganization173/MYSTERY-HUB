import { randomUUID } from 'node:crypto';
import { getPool } from './connection.js';
import { AdminAuditStore } from './adminAuditStore.js';
import { MarketplaceInputError } from './marketplaceControlStore.js';
import { WEBSITE_IMAGE_MIMES, WEBSITE_MEDIA_DEFAULTS, WEBSITE_UPLOAD_REPLAY_GRACE_MS, type WebsiteUploadIntent } from '../../src/config/websiteMedia.js';
import { WebsiteCloudinary, WebsiteOperationError } from '../services/websiteCloudinary.js';

/**
 * Admin product photos. The browser uploads straight to Cloudinary with a short-lived,
 * server-signed intent (fixed public ID, overwrite=false, jpg/png/webp only); the API
 * secret never leaves the server. Finalize re-reads the image from Cloudinary and only
 * then returns a URL we reconstruct ourselves. Nothing here touches a product record:
 * the admin still saves the product, which re-validates the URL like any image URL.
 */
export interface MarketplaceAsset {
  id: string; uploaded_by: string; provider: 'cloudinary'; public_id: string; original_filename: string; mime: string;
  format: string | null; bytes: number; width: number | null; height: number | null; secure_url: string | null;
  status: 'pending' | 'ready' | 'failed'; expires_at: string; created_at: string; updated_at: string;
}
export const MARKETPLACE_IMAGE_DEFAULTS = { maxBytes: 8 * 1024 * 1024, maxPendingPerAdmin: 24 } as const;
const memory = new Map<string, MarketplaceAsset>();
const copy = <T>(value: T): T => structuredClone(value);
function normalize(row: any): MarketplaceAsset {
  return { ...row, bytes: Number(row.bytes), ...Object.fromEntries(['created_at', 'updated_at', 'expires_at'].map(key => [key, new Date(row[key]).toISOString()])) };
}
export function marketplaceImageMaxBytes() {
  const value = Number(process.env.MARKETPLACE_IMAGE_MAX_BYTES);
  return Number.isSafeInteger(value) && value > 0 && value <= 20 * 1024 * 1024 ? value : MARKETPLACE_IMAGE_DEFAULTS.maxBytes;
}
/** Maps provider errors to the marketplace router's error type so messages reach the admin. */
async function provider<T>(work: () => Promise<T> | T): Promise<T> {
  try { return await work(); }
  catch (error) { if (error instanceof WebsiteOperationError) throw new MarketplaceInputError(error.message, error.status); throw error; }
}

export class MarketplaceAssetStore {
  static clearDevStore() { memory.clear(); }
  static async find(id: string): Promise<MarketplaceAsset | null> {
    const pool = getPool();
    if (!pool) return memory.has(id) ? copy(memory.get(id)!) : null;
    const row = (await pool.query('SELECT * FROM marketplace_assets WHERE id = $1', [id])).rows[0];
    return row ? normalize(row) : null;
  }
  private static async insert(asset: MarketplaceAsset) {
    const pool = getPool();
    if (!pool) { memory.set(asset.id, copy(asset)); return; }
    await pool.query(`INSERT INTO marketplace_assets (id, uploaded_by, provider, public_id, original_filename, mime, format, bytes, width, height, secure_url, status, expires_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [asset.id, asset.uploaded_by, asset.provider, asset.public_id, asset.original_filename, asset.mime, asset.format, asset.bytes, asset.width, asset.height, asset.secure_url, asset.status, asset.expires_at, asset.created_at, asset.updated_at]);
  }
  /** Conditional transition so two finalize calls cannot both win. */
  private static async transition(asset: MarketplaceAsset, from: MarketplaceAsset['status']): Promise<boolean> {
    const pool = getPool();
    if (!pool) { const current = memory.get(asset.id); if (!current || current.status !== from) return false; memory.set(asset.id, copy(asset)); return true; }
    const result = await pool.query(`UPDATE marketplace_assets SET mime=$1, format=$2, bytes=$3, width=$4, height=$5, secure_url=$6, status=$7, updated_at=$8 WHERE id=$9 AND status=$10`,
      [asset.mime, asset.format, asset.bytes, asset.width, asset.height, asset.secure_url, asset.status, asset.updated_at, asset.id, from]);
    return result.rowCount === 1;
  }
  private static async pendingCount(adminId: string, now: number) {
    const since = new Date(now - WEBSITE_UPLOAD_REPLAY_GRACE_MS).toISOString();
    const pool = getPool();
    if (!pool) return [...memory.values()].filter(a => a.uploaded_by === adminId && a.status === 'pending' && a.created_at >= since).length;
    return Number((await pool.query(`SELECT COUNT(*) AS total FROM marketplace_assets WHERE uploaded_by=$1 AND status='pending' AND created_at >= $2`, [adminId, since])).rows[0].total);
  }

  static async reserve(adminId: string, input: unknown): Promise<WebsiteUploadIntent> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MarketplaceInputError('Choose an image file.');
    const body = input as Record<string, unknown>;
    if (Object.keys(body).some(key => !['filename', 'mime', 'bytes'].includes(key)) || typeof body.filename !== 'string' || !body.filename.trim() || body.filename.length > 150 || /[<>\x00-\x1f/\\]/.test(body.filename) || !WEBSITE_IMAGE_MIMES.includes(body.mime as any))
      throw new MarketplaceInputError('Use a JPEG, PNG or WebP photo.');
    if (!Number.isSafeInteger(body.bytes) || Number(body.bytes) <= 0) throw new MarketplaceInputError('Invalid image size.');
    const maxBytes = marketplaceImageMaxBytes();
    if (Number(body.bytes) > maxBytes) throw new MarketplaceInputError(`This photo is larger than ${Math.round(maxBytes / 1024 / 1024)} MB. Choose a smaller one or take a new photo.`, 413);
    const now = Date.now();
    if (await this.pendingCount(adminId, now) >= MARKETPLACE_IMAGE_DEFAULTS.maxPendingPerAdmin) throw new MarketplaceInputError('Too many unfinished uploads. Wait a few minutes and try again.', 429);
    const id = `asset_${randomUUID()}`, created = new Date(now).toISOString(), expires = new Date(now + WEBSITE_MEDIA_DEFAULTS.intentMinutes * 60_000).toISOString();
    const publicId = `mysteryhub/marketplace/products/${id}`;
    const intent = await provider(() => WebsiteCloudinary.sign(id, publicId, expires)); // Missing configuration never reserves a row.
    await this.insert({ id, uploaded_by: adminId, provider: 'cloudinary', public_id: publicId, original_filename: (body.filename as string).trim(), mime: body.mime as string, format: null, bytes: Number(body.bytes), width: null, height: null, secure_url: null, status: 'pending', expires_at: expires, created_at: created, updated_at: created });
    return intent;
  }

  static async finalize(adminId: string, assetId: string): Promise<MarketplaceAsset> {
    if (!/^asset_[0-9a-f-]{36}$/.test(assetId)) throw new MarketplaceInputError('Image not found.', 404);
    const asset = await this.find(assetId);
    if (!asset || asset.uploaded_by !== adminId) throw new MarketplaceInputError('Image not found.', 404);
    if (asset.status === 'ready') return asset;
    if (asset.status !== 'pending' || Date.now() > Date.parse(asset.expires_at)) throw new MarketplaceInputError('This upload has expired. Choose the photo again.', 409);
    const resource = await provider(() => WebsiteCloudinary.inspect(asset.public_id));
    let secureUrl: string;
    try {
      secureUrl = await provider(() => WebsiteCloudinary.verifiedUrl(resource, asset.public_id));
      if (resource.bytes > marketplaceImageMaxBytes()) throw new MarketplaceInputError('The uploaded photo is larger than the limit.', 413);
    } catch (error) {
      await this.transition({ ...asset, status: 'failed', updated_at: new Date().toISOString() }, 'pending');
      throw error;
    }
    const ready: MarketplaceAsset = { ...asset, status: 'ready', format: resource.format, mime: `image/${resource.format === 'jpg' ? 'jpeg' : resource.format}`, bytes: resource.bytes, width: resource.width, height: resource.height, secure_url: secureUrl, updated_at: new Date().toISOString() };
    if (!await this.transition(ready, 'pending')) {
      const latest = await this.find(assetId);
      if (latest?.status === 'ready') return latest;
      throw new MarketplaceInputError('This upload changed while it was being checked. Choose the photo again.', 409);
    }
    await AdminAuditStore.record({ adminUserId: adminId, action: 'marketplace_image_uploaded', entityType: 'marketplace_asset', entityId: assetId, metadata: { bytes: resource.bytes, width: resource.width, height: resource.height, format: resource.format } });
    return ready;
  }

  /** Recently uploaded, verified photos so an admin can reuse one without uploading again. */
  static async recent(limit = 30): Promise<MarketplaceAsset[]> {
    const bounded = Math.min(60, Math.max(1, limit));
    const pool = getPool();
    if (!pool) return [...memory.values()].filter(a => a.status === 'ready').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, bounded).map(copy);
    return (await pool.query(`SELECT * FROM marketplace_assets WHERE status='ready' ORDER BY created_at DESC LIMIT $1`, [bounded])).rows.map(normalize);
  }
}
