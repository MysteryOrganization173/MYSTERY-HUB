/**
 * Optional admin framing for a Marketplace product's main photo.
 * x/y are the subject's position in the original photo (0–100%), zoom enlarges toward it.
 * Framing never edits the original image: the browser and the Cloudinary sharing image
 * read it at delivery time, and an unset value means automatic framing.
 * Stored as "x,y,zoom" (e.g. "50,42,1.2") in marketplace_products.image_framing.
 */
export interface ImageFraming { x: number; y: number; zoom: number }

export const DEFAULT_FRAMING: ImageFraming = { x: 50, y: 50, zoom: 1 };
export const FRAMING_ZOOM_MAX = 2;

const FORMAT = /^(\d{1,3}),(\d{1,3}),(\d(?:\.\d{1,2})?)$/;

export function isDefaultFraming(framing: ImageFraming | null | undefined): boolean {
  return !framing || (framing.x === 50 && framing.y === 50 && framing.zoom === 1);
}

/** Strict parser for stored and submitted values; anything else is "automatic". */
export function parseImageFraming(value: unknown): ImageFraming | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(FORMAT);
  if (!match) return null;
  const x = Number(match[1]); const y = Number(match[2]); const zoom = Number(match[3]);
  if (x > 100 || y > 100 || zoom < 1 || zoom > FRAMING_ZOOM_MAX) return null;
  return { x, y, zoom };
}

/** Normalises a framing to whole percentages and 0.05 zoom steps; the default becomes null. */
export function formatImageFraming(framing: ImageFraming | null | undefined): string | null {
  if (!framing) return null;
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  const x = Math.round(clamp(Number(framing.x) || 0, 0, 100));
  const y = Math.round(clamp(Number(framing.y) || 0, 0, 100));
  const zoom = Math.round(clamp(Number(framing.zoom) || 1, 1, FRAMING_ZOOM_MAX) * 20) / 20;
  const normal = { x, y, zoom };
  return isDefaultFraming(normal) ? null : `${x},${y},${zoom}`;
}

/**
 * The part of the original photo a zoomed framing keeps, as fractions of its width/height,
 * centred on the subject and kept inside the photo. Used for the Cloudinary sharing crop.
 */
export function framingRegion(framing: ImageFraming): { x: number; y: number; w: number; h: number } {
  const size = 1 / framing.zoom;
  const start = (focus: number) => Math.min(1 - size, Math.max(0, focus / 100 - size / 2));
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { x: round(start(framing.x)), y: round(start(framing.y)), w: round(size), h: round(size) };
}
