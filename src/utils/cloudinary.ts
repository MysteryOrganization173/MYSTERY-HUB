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
  /** Pixel region of the original to cut out before resizing (art-directed crops). */
  region?: { x: number; y: number; width: number; height: number };
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
    region,
  } = options;

  const transforms: string[] = [`f_${format}`, `q_${quality}`];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (crop) transforms.push(`c_${crop}`);
  if (gravity) transforms.push(`g_${gravity}`);

  // The region crop runs first, as its own component, so the resize applies to the cut-out.
  const transformStr = (region ? `c_crop,h_${region.height},w_${region.width},x_${region.x},y_${region.y}/` : '') + transforms.join(',');

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
