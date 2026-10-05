import { randomUUID } from 'node:crypto';
import { websiteDatabase, withWebsiteLock } from './websiteTransaction.js';
import { WebsiteStore } from './websiteStore.js';
import { WEBSITE_IMAGE_MIMES, WEBSITE_MEDIA_DEFAULTS, WEBSITE_UPLOAD_REPLAY_GRACE_MS, websiteImageUrl, type WebsiteAsset } from '../../src/config/websiteMedia.js';
import { WebsiteCloudinary, WebsiteOperationError, websiteMediaLimits } from '../services/websiteCloudinary.js';
import type { SiteContent } from '../types/website.js';
const memory = new Map<string, WebsiteAsset>();
const copy = <T>(value: T): T => structuredClone(value);
function normalize(row: any): WebsiteAsset {
  return { ...row, bytes: Number(row.bytes), ...Object.fromEntries(['created_at','updated_at','expires_at'].map(key => [key, new Date(row[key]).toISOString()])) };
}
export function websiteImageReferences(content: SiteContent): { url: string; location: string }[] {
  const references = [{ url: content.heroImage, location: 'Hero image' }, { url: content.logoUrl || '', location: 'Brand logo' }];
  for (const [n, item] of (content.items || []).entries()) references.push({ url: item.image || '', location: `Business item ${n + 1}` });
  for (const section of content.composition?.sections || []) {
    references.push({ url: section.data.image || '', location: `${section.type} section` });
    for (const [n, item] of (section.data.items || []).entries()) references.push({ url: item.image || '', location: `${section.type} item ${n + 1}` });
  }
  return references.filter(reference => reference.url);
}
export function managedImagePublicId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'res.cloudinary.com') return null;
    const path = decodeURIComponent(parsed.pathname);
    const match = path.match(/\/image\/upload\/(?:[^/]+\/)*?(mysteryhub\/websites\/site_[a-zA-Z0-9_-]+\/asset_[a-zA-Z0-9_-]+)(?:\.[a-zA-Z0-9]+)?$/);
    return match?.[1] || null;
  } catch { return null; }
}
export class WebsiteAssetStore {
  static clearDevStore() { memory.clear(); }
  static async ownedSite(siteId: string, userId: string) {
    const site = await WebsiteStore.findSiteById(siteId);
    if (!site) throw new WebsiteOperationError('Website not found.', 404);
    if (site.user_id !== userId) throw new WebsiteOperationError('You do not own this website.', 403);
    return site;
  }
  static async all(): Promise<WebsiteAsset[]> {
    const db = websiteDatabase();
    return db ? (await db.query('SELECT * FROM website_assets')).rows.map(normalize) : [...memory.values()].map(copy);
  }
  static async forSite(siteId: string): Promise<WebsiteAsset[]> {
    const db = websiteDatabase();
    return db ? (await db.query('SELECT * FROM website_assets WHERE website_id = $1 ORDER BY created_at DESC', [siteId])).rows.map(normalize) : [...memory.values()].filter(a => a.website_id === siteId).map(copy);
  }
  static async list(siteId: string, userId: string) {
    await this.ownedSite(siteId, userId);
    return (await this.forSite(siteId)).filter(asset => asset.status === 'ready');
  }
  static async find(id: string): Promise<WebsiteAsset | null> {
    const db = websiteDatabase();
    if (!db) return memory.has(id) ? copy(memory.get(id)!) : null;
    const row = (await db.query('SELECT * FROM website_assets WHERE id = $1', [id])).rows[0];
    return row ? normalize(row) : null;
  }
  private static async save(asset: WebsiteAsset, insert = false) {
    const db = websiteDatabase();
    if (!db) { memory.set(asset.id, copy(asset)); return; }
    if (insert) await db.query(`INSERT INTO website_assets (id, website_id, user_id, provider, public_id, original_filename, mime, format, bytes, width, height, secure_url, delivery_url, status, expires_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, Object.values(asset));
    else await db.query(`UPDATE website_assets SET website_id=$1, mime=$2, format=$3, bytes=$4, width=$5, height=$6, secure_url=$7, delivery_url=$8, status=$9, updated_at=$10 WHERE id=$11 AND user_id=$12`,
      [asset.website_id,asset.mime,asset.format,asset.bytes,asset.width,asset.height,asset.secure_url,asset.delivery_url,asset.status,asset.updated_at,asset.id,asset.user_id]);
  }
  static async reserve(siteId: string, userId: string, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new WebsiteOperationError('Choose an image file.');
    const body = input as Record<string, unknown>;
    if (Object.keys(body).some(key => !['filename','mime','bytes'].includes(key)) || typeof body.filename !== 'string' || !body.filename.trim() || body.filename.length > 150 || /[<>\x00-\x1f/\\]/.test(body.filename) || !WEBSITE_IMAGE_MIMES.includes(body.mime as any)) throw new WebsiteOperationError('Use a JPEG, PNG or WebP image with a valid filename.');
    const limits = websiteMediaLimits();
    const filename = body.filename as string;
    if (!Number.isSafeInteger(body.bytes) || Number(body.bytes) <= 0) throw new WebsiteOperationError('Invalid image size.');
    if (Number(body.bytes) > limits.maxBytes) throw new WebsiteOperationError(`Image exceeds the ${Math.round(limits.maxBytes / 1024 / 1024)} MB limit.`, 413);
    return withWebsiteLock(userId, async () => {
      await this.ownedSite(siteId, userId);
      const assets = await this.forSite(siteId);
      // Keep reservations for the FULL provider replay window, not merely our 10-minute UI window.
      const now = Date.now();
      const active = assets.filter(a => a.status === 'ready' || (a.status !== 'deleted' && now < Date.parse(a.created_at) + WEBSITE_UPLOAD_REPLAY_GRACE_MS));
      if (active.length >= limits.maxAssets) throw new WebsiteOperationError('Your website image limit has been reached. Remove an unused image or wait for pending uploads to expire.', 409);
      const id = `asset_${randomUUID()}`, date = new Date(now).toISOString(), expires = new Date(now + WEBSITE_MEDIA_DEFAULTS.intentMinutes * 60_000).toISOString();
      const publicId = `mysteryhub/websites/${siteId}/${id}`;
      const intent = WebsiteCloudinary.sign(id, publicId, expires); // Configuration failure never reserves a slot.
      const asset: WebsiteAsset = { id, website_id: siteId, user_id: userId, provider: 'cloudinary', public_id: publicId, original_filename: filename.trim(), mime: body.mime as string, format: null, bytes: Number(body.bytes), width: null, height: null, secure_url: null, delivery_url: null, status: 'pending', expires_at: expires, created_at: date, updated_at: date };
      await this.save(asset, true);
      return intent;
    });
  }
  static async ownedAsset(siteId: string, userId: string, assetId: string) {
    await this.ownedSite(siteId, userId);
    const asset = await this.find(assetId);
    if (!asset || asset.website_id !== siteId || asset.user_id !== userId) throw new WebsiteOperationError('Image not found in this website.', 404);
    return asset;
  }
  static async finalize(siteId: string, userId: string, assetId: string): Promise<WebsiteAsset> {
    const initial = await this.ownedAsset(siteId, userId, assetId);
    if (initial.status === 'ready') return initial;
    if (initial.status !== 'pending' || Date.now() > Date.parse(initial.expires_at)) throw new WebsiteOperationError('This upload has expired. Choose the image again.', 409);
    const resource = await WebsiteCloudinary.inspect(initial.public_id);
    let secureUrl: string;
    try {
      secureUrl = WebsiteCloudinary.verifiedUrl(resource, initial.public_id);
      if (resource.bytes > websiteMediaLimits().maxBytes) throw new WebsiteOperationError('Uploaded image exceeds the size limit.', 413);
    } catch (error) {
      await withWebsiteLock(userId, async () => {
        const asset = await this.ownedAsset(siteId, userId, assetId);
        if (asset.status === 'pending') await this.save({ ...asset, status: 'failed', updated_at: new Date().toISOString() });
      });
      // Only delete our expected ID, never any public_id supplied in the provider response.
      await this.cleanup(assetId);
      throw error;
    }
    return withWebsiteLock(userId, async () => {
      const asset = await this.ownedAsset(siteId, userId, assetId);
      if (asset.status === 'ready') return asset;
      if (asset.status !== 'pending' || Date.now() > Date.parse(asset.expires_at)) throw new WebsiteOperationError('This upload has expired.', 409);
      const ready: WebsiteAsset = { ...asset, status: 'ready', format: resource.format, mime: `image/${resource.format === 'jpg' ? 'jpeg' : resource.format}`, bytes: resource.bytes, width: resource.width, height: resource.height, secure_url: secureUrl, delivery_url: websiteImageUrl(secureUrl), updated_at: new Date().toISOString() };
      await this.save(ready);
      return ready;
    });
  }
  static async validateReferences(siteId: string, userId: string, content: SiteContent) {
    const references = websiteImageReferences(content).map(r => ({ ...r, publicId: managedImagePublicId(r.url) })).filter(r => r.publicId);
    if (!references.length) return;
    const assets = await this.forSite(siteId);
    for (const reference of references) if (!assets.some(a => a.public_id === reference.publicId && a.website_id === siteId && a.user_id === userId && a.status === 'ready' && (a.secure_url === reference.url || a.delivery_url === reference.url))) throw new WebsiteOperationError('Choose a verified image from this website’s library.', 409);
  }
  static async delete(siteId: string, userId: string, assetId: string) {
    await withWebsiteLock(userId, async () => {
      const asset = await this.ownedAsset(siteId, userId, assetId);
      if (asset.status === 'deleted') return;
      const site = await this.ownedSite(siteId, userId);
      const usage = websiteImageReferences(site.content_json).filter(r => managedImagePublicId(r.url) === asset.public_id || r.url === asset.secure_url || r.url === asset.delivery_url);
      if (usage.length) throw new WebsiteOperationError(`Remove or replace this image first. In use: ${usage.map(r => r.location).join(', ')}.`, 409);
      await this.save({ ...asset, status: 'deleting', updated_at: new Date().toISOString() });
    });
    return this.cleanup(assetId);
  }
  /** Called inside the same transaction BEFORE site deletion. Tombstones retain cleanup identity. */
  static async detachSite(siteId: string) {
    const assets = await this.forSite(siteId);
    for (const asset of assets) await this.save({ ...asset, website_id: null, status: asset.status === 'deleted' ? 'deleted' : 'deleting', updated_at: new Date().toISOString() });
    return assets.map(a => a.id);
  }
  static async cleanup(assetId: string): Promise<boolean> {
    const asset = await this.find(assetId);
    if (!asset || asset.status === 'deleted') return true;
    if (!['deleting','failed'].includes(asset.status)) return false;
    try {
      await WebsiteCloudinary.destroy(asset.public_id);
      await withWebsiteLock(asset.user_id, async () => {
        const current = await this.find(assetId);
        if (current && ['deleting','failed'].includes(current.status)) {
          // A pending upload can arrive until the provider signature expires. Retain the
          // tombstone for a second sweep after the provider window plus clock grace.
          const replayEnded = Date.now() >= Date.parse(current.created_at) + WEBSITE_UPLOAD_REPLAY_GRACE_MS;
          await this.save({ ...current, status: replayEnded ? 'deleted' : 'deleting', updated_at: new Date().toISOString() });
        }
      });
      return true;
    } catch { console.warn('[Website media] Cleanup pending', { assetId: asset.id }); return false; }
  }
  /** Bounded maintenance action; caller must be Admin. No automatic provider mutations at startup. */
  static async cleanupCandidates(limit = 20) {
    const candidates = (await this.all()).filter(a => ['deleting','failed','pending'].includes(a.status) && Date.now() > Date.parse(a.created_at) + WEBSITE_UPLOAD_REPLAY_GRACE_MS).slice(0, limit);
    let cleaned = 0;
    for (const candidate of candidates) {
      await withWebsiteLock(candidate.user_id, async () => { const asset = await this.find(candidate.id); if (asset?.status === 'pending') await this.save({ ...asset, status: 'deleting', updated_at: new Date().toISOString() }); });
      if (await this.cleanup(candidate.id)) cleaned++;
    }
    return { attempted: candidates.length, cleaned };
  }
}
