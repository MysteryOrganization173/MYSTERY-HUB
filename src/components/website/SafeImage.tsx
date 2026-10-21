import React, { useEffect, useRef, useState } from 'react';
import { websiteImageUrl } from '../../config/websiteMedia.js';
export function isSafeImageSource(src?: string): boolean {
  if (!src || /[<>\s]/.test(src)) return false;
  if (src.startsWith('/') && !src.startsWith('//') && !src.includes('\\')) return true;
  if (!/^https?:\/\//i.test(src) || src.includes('\\')) return false;
  try { const url = new URL(src); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
const WEBSITE_IMAGE_WIDTHS = [480, 800, 1200, 1600];
/** Fixed container survives loading/failure; changing src retries without a page reload. */
export function SafeImage({ src, alt = '', className = '', style, loading = 'lazy', onError, onLoad, 'data-visual-target': visualTarget, tabIndex, 'aria-label': editLabel, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {'data-visual-target'?:string}) {
  const [failed, setFailed] = useState(false), [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { setFailed(false); setLoaded(Boolean(ref.current?.complete && ref.current?.naturalWidth)); }, [src]);
  const fallback = failed || !isSafeImageSource(src);
  // Owner photos on Cloudinary get a width set, so phones download about half of what a 1600px hero costs.
  const responsive = !fallback && !props.srcSet && websiteImageUrl(src, 800) !== src;
  const srcSet = responsive ? WEBSITE_IMAGE_WIDTHS.map(w => `${websiteImageUrl(src, w)} ${w}w`).join(', ') : props.srcSet;
  const sizes = responsive ? props.sizes || (loading === 'eager' ? '100vw' : '(min-width: 1024px) 50vw, 100vw') : props.sizes;
  return <span data-visual-target={visualTarget} tabIndex={visualTarget ? tabIndex : undefined} aria-label={visualTarget ? editLabel : undefined} className={`block overflow-hidden ${className}`} style={{ background: 'linear-gradient(135deg,#334155,#0f172a)', ...style }} data-image-state={fallback ? 'fallback' : loaded ? 'loaded' : 'loading'}>
    {fallback ? <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={!alt} className="flex h-full w-full min-h-12 items-center justify-center p-3 text-center text-xs text-white/80">{alt || ''}</span> :
      <img {...props} srcSet={srcSet} sizes={sizes} tabIndex={!visualTarget ? tabIndex : undefined} aria-label={!visualTarget ? editLabel : undefined} ref={ref} src={websiteImageUrl(src, loading === 'eager' ? 1600 : 800)} alt={alt} loading={loading} decoding="async" className="block h-full w-full object-cover" style={{ objectPosition: style?.objectPosition || 'center', objectFit:style?.objectFit || 'cover' }} onLoad={e => { setLoaded(true); onLoad?.(e); }} onError={e => { setFailed(true); onError?.(e); }} />}
  </span>;
}
