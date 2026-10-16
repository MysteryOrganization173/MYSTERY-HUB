import React, { useEffect, useState } from 'react';
import { Laptop, Smartphone, Mic, Camera, Cpu, Printer, Globe, Home, Gamepad2, Box } from 'lucide-react';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import type { CategoryIconKey } from '../../utils/marketplaceBrowse';

const ICONS: Record<CategoryIconKey, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop, phone: Smartphone, audio: Mic, camera: Camera, software: Cpu, printer: Printer, digital: Globe, home: Home, game: Gamepad2, box: Box,
};
// Calm per-icon tints so photo-less tiles stay recognisable without fake imagery.
const TINTS: Record<CategoryIconKey, string> = {
  laptop: 'text-sky-300 from-sky-500/15', phone: 'text-emerald-300 from-emerald-500/15', audio: 'text-pink-300 from-pink-500/15',
  camera: 'text-violet-300 from-violet-500/15', software: 'text-[#00e575] from-[#00c365]/15', printer: 'text-amber-300 from-amber-500/15',
  digital: 'text-cyan-300 from-cyan-500/15', home: 'text-orange-300 from-orange-500/15', game: 'text-fuchsia-300 from-fuchsia-500/15', box: 'text-slate-300 from-slate-500/15',
};

/** Icon placeholder used wherever a product or category has no usable photo. */
export const CategoryIcon: React.FC<{ iconKey: CategoryIconKey; size?: 'sm' | 'md' | 'lg' }> = ({ iconKey, size = 'md' }) => {
  const Icon = ICONS[iconKey];
  return (
    <div className={`w-full h-full flex items-center justify-center bg-[#0b1116] bg-gradient-to-br to-transparent ${TINTS[iconKey]}`}>
      <Icon className={size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8'} aria-hidden="true" />
    </div>
  );
};

interface PhotoProps {
  src?: string;
  alt: string;
  iconKey: CategoryIconKey;
  widths: number[];
  sizes: string;
  priority?: boolean;
  /**
   * adaptive: fill the frame when the photo is close to its shape, otherwise show it whole.
   * contain: always show the whole photo (product detail).
   * cover: always fill (small thumbnails, where a crop is harmless).
   */
  fit?: 'adaptive' | 'contain' | 'cover';
  iconSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** A photo may lose at most this share of its width or height to fill a frame. */
export const COVER_TOLERANCE = 0.16;

/**
 * Chooses how a photo sits in its frame. Vendor photos are mostly 3:4 phone shots, so
 * they fill a 4:5 card with only a sliver trimmed; wide banners, square shots in tall
 * frames and other mismatches are shown whole instead of losing part of the product.
 */
export function photoTreatment(natural: { width: number; height: number }, frame: { width: number; height: number }): 'cover' | 'contain' {
  if (!natural.width || !natural.height || !frame.width || !frame.height) return 'contain';
  const photo = natural.width / natural.height;
  const box = frame.width / frame.height;
  return 1 - Math.min(photo / box, box / photo) <= COVER_TOLERANCE ? 'cover' : 'contain';
}

/**
 * Real catalogue photography on a dark surface. Photos close to the frame's shape fill
 * it; anything else is shown whole over a dimmed, blurred copy of the same photo, so the
 * frame never shows pale empty bands and nothing is stretched or replaced.
 */
export const ProductPhoto: React.FC<PhotoProps> = ({ src, alt, iconKey, widths, sizes, priority, fit = 'adaptive', iconSize, className = '' }) => {
  const [treatment, setTreatment] = useState<'cover' | 'contain' | null>(fit === 'cover' ? 'cover' : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setTreatment(fit === 'cover' ? 'cover' : null); setFailed(false); }, [src, fit]);

  if (!src || failed) {
    return <div className={`relative w-full h-full overflow-hidden ${className}`}><CategoryIcon iconKey={iconKey} size={iconSize} /></div>;
  }

  const onLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (fit === 'cover') return;
    const img = event.currentTarget;
    if (fit === 'contain') { setTreatment('contain'); return; }
    const frame = img.parentElement?.getBoundingClientRect();
    setTreatment(photoTreatment({ width: img.naturalWidth, height: img.naturalHeight }, { width: frame?.width || 0, height: frame?.height || 0 }));
  };
  const contained = treatment === 'contain';

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#0f171d] ${className}`} data-photo-fit={fit}>
      {treatment === null && <div className="absolute inset-0 bg-slate-800/40 motion-safe:animate-pulse" aria-hidden="true" />}
      {/* A tiny (≈2KB) copy of the same photo, blurred and dimmed, fills the frame around a contained photo. */}
      {contained && (
        <img src={getCloudinaryUrl(src, { width: 48 })} alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl brightness-[.42] saturate-[1.2]" />
      )}
      <img
        src={getCloudinaryUrl(src)}
        srcSet={getCloudinarySrcSet(src, widths) || undefined}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onLoad={onLoad}
        onError={() => setFailed(true)}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 motion-reduce:transition-none ${treatment ? 'opacity-100' : 'opacity-0'} ${contained ? 'object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]' : 'object-cover object-[50%_42%]'}`}
      />
    </div>
  );
};
