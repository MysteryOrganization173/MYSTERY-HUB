import React from 'react';
import { Laptop, Smartphone, Mic, Camera, Cpu, Printer, Globe, Home, Gamepad2, Box } from 'lucide-react';
import { OptimizedImage } from '../common/OptimizedImage';
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
  fit?: 'studio' | 'cover';
  iconSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Product photography on a neutral "studio" surface. Real catalogue photos arrive
 * in every shape: white-background shots, transparent PNG electronics, tall boxes,
 * wide banners. Containing them on one soft light surface keeps the whole grid
 * consistent; multiply blending lets white backgrounds melt into the surface
 * instead of showing as hard rectangles. Nothing is cropped or replaced.
 */
export const ProductPhoto: React.FC<PhotoProps> = ({ src, alt, iconKey, widths, sizes, priority, fit = 'studio', iconSize, className = '' }) => {
  const studio = fit === 'studio';
  return (
    <div className={`relative w-full h-full overflow-hidden ${studio && src ? 'bg-[radial-gradient(120%_90%_at_50%_35%,#f7f8fa_0%,#e9edf1_70%,#dde2e7_100%)]' : 'bg-[#0b1116]'} ${className}`}>
      {/* Absolute so a tall photo can never stretch its frame (e.g. a portrait box in a square card). */}
      <div className="absolute inset-0">
      <OptimizedImage
        src={src}
        alt={alt}
        priority={priority}
        objectFit={studio ? 'contain' : 'cover'}
        objectPosition="center center"
        responsiveWidths={widths}
        sizes={sizes}
        containerClassName="bg-transparent!"
        className={studio ? 'p-[7%] mix-blend-multiply' : ''}
        fallbackIcon={<CategoryIcon iconKey={iconKey} size={iconSize} />}
      />
      </div>
    </div>
  );
};
