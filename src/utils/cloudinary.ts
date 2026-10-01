/**
 * Cloudinary Transformation & Responsive Image Helpers
 * Applies f_auto, q_auto, width transforms, and responsive srcSet generation.
 */

export interface CloudinaryOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'auto:good' | 'auto:best' | 'auto:eco' | number;
  format?: 'auto' | 'webp' | 'png' | 'jpg';
  crop?: 'fill' | 'scale' | 'fit' | 'limit' | 'thumb' | 'pad';
  gravity?: 'auto' | 'center' | 'east' | 'west' | 'north' | 'south' | 'face';
}

/**
 * Builds a transformed Cloudinary URL.
 */
export function getCloudinaryUrl(
  url: string | null | undefined,
  options: CloudinaryOptions = {}
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com')) return url;

  const {
    width,
    height,
    quality = 'auto',
    format = 'auto',
    crop,
    gravity,
  } = options;

  const transforms: string[] = [`f_${format}`, `q_${quality}`];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (crop) transforms.push(`c_${crop}`);
  if (gravity) transforms.push(`g_${gravity}`);

  const transformStr = transforms.join(',');

  // If already transformed, return as is
  if (url.includes('/upload/f_auto') || url.includes('/upload/w_')) {
    return url;
  }

  return url.replace('/upload/', `/upload/${transformStr}/`);
}

/**
 * Generates responsive srcSet string for Cloudinary image URLs.
 */
export function getCloudinarySrcSet(
  url: string | null | undefined,
  widths: number[] = [640, 960, 1280, 1600],
  options: Omit<CloudinaryOptions, 'width'> = {}
): string {
  if (!url || !url.includes('res.cloudinary.com')) return '';

  return widths
    .map((w) => `${getCloudinaryUrl(url, { ...options, width: w })} ${w}w`)
    .join(', ');
}
