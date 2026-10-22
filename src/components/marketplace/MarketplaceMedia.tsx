import React, { useState } from 'react';
import { Laptop, Smartphone, Mic, Camera, Cpu, Printer, Globe, Home, Gamepad2, Box } from 'lucide-react';
import { getCloudinaryUrl, getCloudinarySrcSet } from '../../utils/cloudinary';
import type { CategoryIconKey } from '../../utils/marketplaceBrowse';
import type { ImageFraming } from '../../../shared/marketplaceImageFraming';

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
   * adaptive: fill the frame when the photo is close to its shape, otherwise enlarge it a little
   *   and show the rest of the frame as a blurred copy of the same photo.
   * contain: always show the whole photo (product detail).
   * cover: always fill.
   */
  fit?: 'adaptive' | 'contain' | 'cover';
  /** Adaptive only: the share of the photo that may be trimmed to fill the frame (small tiles allow more). */
  coverTolerance?: number;
  /** Optional admin framing (subject position + zoom). Ignored by `contain`, which always shows everything. */
  framing?: ImageFraming;
  iconSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** A photo may lose at most this share of its width or height to fill a frame. */
export const COVER_TOLERANCE = 0.16;
/** Beyond that, a photo is still enlarged until this share is trimmed, so the blurred bands stay narrow. */
export const PARTIAL_CROP = 0.1;

/**
 * Chooses how a photo sits in its frame. Vendor photos are mostly 3:4 phone shots, so
 * they fill a 4:5 card with only a sliver trimmed; wide banners, square shots in tall
 * frames and other mismatches are shown (nearly) whole instead of losing part of the product.
 */
export function photoTreatment(natural: { width: number; height: number }, frame: { width: number; height: number }, tolerance = COVER_TOLERANCE): 'cover' | 'contain' {
  if (!natural.width || !natural.height || !frame.width || !frame.height) return 'contain';
  const photo = natural.width / natural.height;
  const box = frame.width / frame.height;
  return 1 - Math.min(photo / box, box / photo) <= tolerance ? 'cover' : 'contain';
}

export interface PhotoLayout {
  treatment: 'cover' | 'contain';
  /** Extra enlargement applied on top of object-fit (1 = none). */
  scale: number;
  /** CSS position of the subject; used for object-position (cover) and transform-origin. */
  position: string;
  /**
   * Admin framing only: the photo's box in % of the frame, placed so the chosen subject point sits
   * as close to the centre as the photo allows (no empty edges when it fills). Same proportions
   * as the photo, so nothing is stretched.
   */
  box?: { left: number; top: number; width: number; height: number };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Full layout for one photo in one frame. `contain` photos are enlarged until at most
 * PARTIAL_CROP of the photo would be trimmed (never past filling the frame), which removes most
 * of the empty band without cutting into the product. Admin framing then zooms toward the subject.
 */
export function photoLayout(natural: { width: number; height: number }, frame: { width: number; height: number }, options: { fit?: PhotoProps['fit']; coverTolerance?: number; framing?: ImageFraming } = {}): PhotoLayout {
  const { fit = 'adaptive', coverTolerance = COVER_TOLERANCE } = options;
  const framing = fit === 'contain' ? undefined : options.framing;
  if (fit === 'contain') return { treatment: 'contain', scale: 1, position: '50% 50%' };
  const known = natural.width > 0 && natural.height > 0 && frame.width > 0 && frame.height > 0;
  const treatment = fit === 'cover' ? 'cover' : photoTreatment(natural, frame, coverTolerance);
  const photo = known ? natural.width / natural.height : 1;
  const box = known ? frame.width / frame.height : 1;
  const fill = Math.max(photo / box, box / photo); // enlargement over "contain" that fills the frame
  const base = treatment === 'cover' ? 1 : Math.min(fill, 1 / (1 - PARTIAL_CROP)); // relative to object-fit
  if (!framing || !known) return { treatment, scale: Math.round(base * 1000) / 1000, position: treatment === 'cover' ? '50% 42%' : '50% 50%' };
  // Photo size as a share of the frame: start from contain (or cover), apply the enlargement and zoom.
  const containW = photo >= box ? 1 : photo / box, containH = photo >= box ? box / photo : 1;
  const grow = (treatment === 'cover' ? fill : base) * framing.zoom;
  const w = containW * grow, h = containH * grow;
  const place = (size: number, focus: number) => size >= 1 ? Math.min(0, Math.max(1 - size, 0.5 - focus * size)) : (1 - size) / 2;
  return {
    treatment, scale: 1, position: `${framing.x}% ${framing.y}%`,
    box: { left: round(place(w, framing.x / 100) * 100), top: round(place(h, framing.y / 100) * 100), width: round(w * 100), height: round(h * 100) },
  };
}

/**
 * Real catalogue photography on a dark surface. Photos close to the frame's shape fill
 * it; anything else is shown (nearly) whole over a dimmed, blurred copy of the same photo,
 * so the frame never shows pale empty bands and nothing is stretched or replaced.
 */
export const ProductPhoto: React.FC<PhotoProps> = ({ src, alt, iconKey, widths, sizes, priority, fit = 'adaptive', coverTolerance, framing, iconSize, className = '' }) => {
  // Results are keyed to the photo they were measured for, so a new src starts fresh
  // without an effect that could race a cached image's load event.
  const [measured, setMeasured] = useState<{ src?: string; natural: { width: number; height: number } | null; frame?: { width: number; height: number }; failed?: boolean }>({ src, natural: null });
  const current = measured.src === src ? measured : { src, natural: null, failed: false };
  const failed = !!current.failed;
  const setFailed = () => setMeasured({ src, natural: null, failed: true });

  if (!src || failed) {
    return <div className={`relative w-full h-full overflow-hidden ${className}`}><CategoryIcon iconKey={iconKey} size={iconSize} /></div>;
  }

  const onLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const rect = img.parentElement?.getBoundingClientRect();
    setMeasured({ src, natural: { width: img.naturalWidth, height: img.naturalHeight }, frame: { width: rect?.width || 0, height: rect?.height || 0 } });
  };
  // Framing changes (admin preview) re-lay out instantly from the stored measurements.
  // Cover photos show at once; framed and adaptive ones wait for their measurements.
  const layout = current.natural ? photoLayout(current.natural, current.frame || { width: 0, height: 0 }, { fit, coverTolerance, framing })
    : fit === 'cover' && !framing ? photoLayout({ width: 0, height: 0 }, { width: 0, height: 0 }, { fit }) : null;
  const contained = layout?.treatment === 'contain';
  const transform = layout && layout.scale !== 1 ? `scale(${layout.scale})` : undefined;

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#0f171d] ${className}`} data-photo-fit={fit} data-photo-treatment={layout?.treatment}>
      {!layout && <div className="absolute inset-0 bg-slate-800/40 motion-safe:animate-pulse" aria-hidden="true" />}
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
        onError={setFailed}
        style={layout?.box
          ? { left: `${layout.box.left}%`, top: `${layout.box.top}%`, width: `${layout.box.width}%`, height: `${layout.box.height}%`, maxWidth: 'none' }
          : layout ? { objectPosition: layout.treatment === 'cover' ? layout.position : undefined, transform, transformOrigin: transform ? layout.position : undefined } : undefined}
        className={`absolute transition-opacity duration-300 motion-reduce:transition-none ${layout?.box ? '' : 'inset-0 w-full h-full'} ${layout ? 'opacity-100' : 'opacity-0'} ${contained ? 'object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]' : 'object-cover'}`}
      />
    </div>
  );
};
