import React, { useEffect, useRef, useState } from 'react';
export function isSafeImageSource(src?: string): boolean {
  if (!src || /[<>\s]/.test(src)) return false;
  if (src.startsWith('/') && !src.startsWith('//') && !src.includes('\\')) return true;
  if (!/^https?:\/\//i.test(src) || src.includes('\\')) return false;
  try { const url = new URL(src); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
/** Fixed container survives loading/failure; changing src retries without a page reload. */
export function SafeImage({ src, alt = '', className = '', style, loading = 'lazy', onError, onLoad, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false), [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { setFailed(false); setLoaded(Boolean(ref.current?.complete && ref.current?.naturalWidth)); }, [src]);
  const fallback = failed || !isSafeImageSource(src);
  return <span className={`block overflow-hidden ${className}`} style={{ background: 'linear-gradient(135deg,#334155,#0f172a)', ...style }} data-image-state={fallback ? 'fallback' : loaded ? 'loaded' : 'loading'}>
    {fallback ? <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={!alt} className="flex h-full w-full min-h-12 items-center justify-center p-3 text-center text-xs text-white/80">{alt || ''}</span> :
      <img {...props} ref={ref} src={src} alt={alt} loading={loading} decoding="async" className="block h-full w-full object-cover" style={{ objectPosition: style?.objectPosition || 'center' }} onLoad={e => { setLoaded(true); onLoad?.(e); }} onError={e => { setFailed(true); onError?.(e); }} />}
  </span>;
}
