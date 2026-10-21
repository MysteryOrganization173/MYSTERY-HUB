/**
 * Website photos are resized on the owner's phone before upload, so pages load quickly on mobile data and
 * the Free plan's image storage lasts. Websites never show a photo wider than about 1600px, so a 12 MP
 * camera photo is mostly wasted bytes. If the browser cannot re-encode, the original is used when it fits.
 */
export const WEBSITE_IMAGE_TARGET = Object.freeze({ maxEdge: 2000, targetBytes: 1_200_000, skipBelowBytes: 350_000 });

export interface CompressionPlan { resize: boolean; width: number; height: number; reencode: boolean }
/** Pure decision, testable without a browser. */
export function websiteCompressionPlan(width: number, height: number, bytes: number, target = WEBSITE_IMAGE_TARGET): CompressionPlan {
  const scale = Math.min(1, target.maxEdge / Math.max(width, height, 1));
  const resize = scale < 1;
  const reencode = resize || bytes > target.targetBytes;
  return { resize, width: Math.round(width * scale), height: Math.round(height * scale), reencode: reencode && bytes > target.skipBelowBytes };
}

export interface PreparedImage { file: File; originalBytes: number; savedBytes: number; compressed: boolean }

export async function prepareWebsiteImage(file: File, maxBytes: number): Promise<PreparedImage> {
  const original = { file, originalBytes: file.size, savedBytes: 0, compressed: false };
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    if (file.size <= maxBytes) return original;
    throw new Error(`Choose an image smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { if (file.size <= maxBytes) return original; throw new Error('This photo could not be read. Try another one.'); }
  const plan = websiteCompressionPlan(bitmap.width, bitmap.height, file.size);
  if (!plan.reencode) { bitmap.close(); if (file.size <= maxBytes) return original; }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = plan.width; canvas.height = plan.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, plan.width, plan.height); bitmap.close();
    // PNG logos keep transparency as WebP; photos become JPEG, which every phone and crawler reads.
    const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg', ext = type === 'image/webp' ? '.webp' : '.jpg';
    for (const quality of [0.82, 0.72, 0.62]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
      if (!blob || blob.type !== type) break;
      if (blob.size <= WEBSITE_IMAGE_TARGET.targetBytes || quality === 0.62) {
        if (blob.size >= file.size && file.size <= maxBytes) return original;
        if (blob.size > maxBytes) break;
        return { file: new File([blob], (file.name || 'photo').replace(/\.[a-z0-9]+$/i, '') + ext, { type }), originalBytes: file.size, savedBytes: file.size - blob.size, compressed: true };
      }
    }
  } catch { /* fall through to the original */ }
  if (file.size <= maxBytes) return original;
  throw new Error(`This photo is larger than ${Math.round(maxBytes / 1024 / 1024)} MB even after resizing. Choose a smaller one.`);
}

export const formatImageBytes = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
