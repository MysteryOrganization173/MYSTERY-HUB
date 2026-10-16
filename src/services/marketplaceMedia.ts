import { marketplaceControlRequest } from './marketplaceControls';
import { uploadWebsiteImage } from './apiClient';
import type { WebsiteUploadIntent } from '../config/websiteMedia';

export interface MarketplaceMediaAsset { id: string; url: string; width: number | null; height: number | null; bytes: number; format: string | null; filename: string; createdAt: string }
export interface MarketplaceMediaLibrary { configured: boolean; maxBytes: number; assets: MarketplaceMediaAsset[] }
export const MARKETPLACE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function getMarketplaceMedia(token: string): Promise<MarketplaceMediaLibrary> {
  return marketplaceControlRequest('media', token);
}

/**
 * Phone cameras often produce photos larger than the upload limit. Re-encode only when the
 * file is too large or too wide, keeping the original otherwise. Runs entirely in the browser.
 */
export async function preparePhoto(file: File, maxBytes: number, maxEdge = 2400): Promise<File> {
  if (!MARKETPLACE_PHOTO_TYPES.includes(file.type)) throw new Error('Use a JPEG, PNG or WebP photo.');
  if (typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { if (file.size <= maxBytes) return file; throw new Error('This photo could not be read. Try another one.'); }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (file.size <= maxBytes && scale === 1) { bitmap.close(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  for (const quality of [0.86, 0.75, 0.62]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= maxBytes) return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
  }
  throw new Error(`This photo is larger than ${Math.round(maxBytes / 1024 / 1024)} MB even after resizing. Choose a smaller one.`);
}

/** Signed direct upload: the server reserves an ID and signs; the browser sends the file to Cloudinary; the server verifies it. */
export async function uploadMarketplacePhoto(token: string, file: File, onProgress: (percent: number) => void, signal: AbortSignal): Promise<MarketplaceMediaAsset> {
  const filename = (file.name || 'photo.jpg').replace(/[<>\x00-\x1f/\\]/g, '').slice(-150) || 'photo.jpg';
  const { intent } = await marketplaceControlRequest('media/upload-intent', token, 'POST', { filename, mime: file.type, bytes: file.size }) as { intent: WebsiteUploadIntent };
  await uploadWebsiteImage(intent, file, onProgress, signal);
  const { asset } = await marketplaceControlRequest(`media/${encodeURIComponent(intent.assetId)}/finalize`, token, 'POST') as { asset: MarketplaceMediaAsset };
  return asset;
}

/** Cloudinary delivery transform for previews; other URLs are returned unchanged. */
export function marketplaceThumb(url: string, width = 320) {
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/)(v\d+\/[^?#]+)$/);
  return match ? `${match[1]}f_auto,q_auto,c_fill,w_${width},h_${width}/${match[2]}` : url;
}
