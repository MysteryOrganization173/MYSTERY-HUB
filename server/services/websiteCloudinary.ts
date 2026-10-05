import { createHash } from 'node:crypto';
import { WEBSITE_MEDIA_DEFAULTS, type WebsiteUploadIntent } from '../../src/config/websiteMedia.js';
export class WebsiteOperationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function boundedEnv(name: string, fallback: number, ceiling: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 && value <= ceiling ? value : fallback;
}
export function websiteMediaLimits() {
  return { maxAssets: boundedEnv('WEBSITE_FREE_MAX_ASSETS', WEBSITE_MEDIA_DEFAULTS.maxAssets, 100),
    maxBytes: boundedEnv('WEBSITE_IMAGE_MAX_BYTES', WEBSITE_MEDIA_DEFAULTS.maxBytes, 20 * 1024 * 1024) };
}
function configuration() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || '', key = process.env.CLOUDINARY_API_KEY || '', secret = process.env.CLOUDINARY_API_SECRET || '';
  if (!/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret) throw new WebsiteOperationError('Image uploads are temporarily unavailable.', 503);
  return { cloud, key, secret };
}
export function cloudinaryConfigured() { try { configuration(); return true; } catch { return false; } }
/** Cloudinary documented sorted parameter signature; secret never leaves this module.
 * A fixed public ID and overwrite=false make replay unable to replace a ready image.
 * Cloudinary timestamps last one hour. Backdating by 50 minutes makes the provider
 * capability expire after the same ten-minute window as local finalization. */
export function cloudinarySignature(parameters: Record<string, string>, secret: string) {
  return createHash('sha256').update(Object.keys(parameters).sort().map(key => `${key}=${parameters[key]}`).join('&') + secret).digest('hex');
}
export interface CloudinaryImage { public_id: string; resource_type: string; type: string; format: string; bytes: number; width: number; height: number; secure_url: string; version: number; }
export const WebsiteCloudinary = {
  sign(assetId: string, publicId: string, expiresAt: string): WebsiteUploadIntent {
    const config = configuration();
    const parameters = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000) - (60 - WEBSITE_MEDIA_DEFAULTS.intentMinutes) * 60), overwrite: 'false', allowed_formats: 'jpg,png,webp' };
    // Slash-qualified public_id controls delivery identity in BOTH folder modes. No folder prefix option is used.
    return { assetId, expiresAt, uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloud}/image/upload`, apiKey: config.key, parameters, signature: cloudinarySignature(parameters, config.secret) };
  },
  async inspect(publicId: string): Promise<CloudinaryImage> {
    const config = configuration();
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud}/resources/image/upload/${encodeURIComponent(publicId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${config.key}:${config.secret}`).toString('base64')}` }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Provider unavailable');
      return await response.json();
    } catch { throw new WebsiteOperationError('Could not verify the uploaded image. Retry finalization shortly.', 503); }
  },
  async destroy(publicId: string): Promise<void> {
    const config = configuration();
    const parameters = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), invalidate: 'true' };
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud}/image/destroy`, {
        method: 'POST', body: new URLSearchParams({ ...parameters, api_key: config.key, signature: cloudinarySignature(parameters, config.secret) }), signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok || !['ok', 'not found'].includes(result.result)) throw new Error('Delete failed');
    } catch { throw new WebsiteOperationError('Image cleanup is pending. Please retry shortly.', 503); }
  },
  verifiedUrl(image: CloudinaryImage, publicId: string): string {
    const { cloud } = configuration();
    if (image.public_id !== publicId || image.resource_type !== 'image' || image.type !== 'upload' || !['jpg','png','webp'].includes(image.format) || !Number.isSafeInteger(image.version) || image.version <= 0 || !Number.isSafeInteger(image.bytes) || image.bytes <= 0 || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width <= 0 || image.height <= 0 || image.width * image.height > 100_000_000) throw new WebsiteOperationError('Unsupported or invalid uploaded image.');
    // Reconstruct trusted delivery URL; never persist a client/provider-supplied arbitrary host.
    return `https://res.cloudinary.com/${cloud}/image/upload/v${image.version}/${publicId}.${image.format}`;
  },
};
