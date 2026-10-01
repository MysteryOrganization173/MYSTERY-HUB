import React, { useState } from 'react';
import { BUSINESS_CONFIG } from '../../config/business';

export const OFFICIAL_BRAND_MARK_URL =
  BUSINESS_CONFIG.brandMarkUrl ||
  'https://res.cloudinary.com/da6oeat7m/image/upload/v1790859552/30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png';

/**
 * Generates an optimized Cloudinary delivery URL for the official brand mark.
 * Applies f_auto and q_auto with specified width to minimize payload.
 */
export function getBrandMarkDeliveryUrl(width = 96): string {
  return `https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_${width}/v1790859552/30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png`;
}

export interface BrandMarkProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
  ariaHidden?: boolean;
  priority?: 'high' | 'auto' | 'low';
}

const SIZE_CONFIG = {
  xs: { box: 'w-5 h-5', width: 20, height: 20, src1x: 64, src2x: 128 },
  sm: { box: 'w-6 h-6', width: 24, height: 24, src1x: 72, src2x: 144 },
  md: { box: 'w-8 h-8', width: 32, height: 32, src1x: 96, src2x: 192 },
  lg: { box: 'w-10 h-10', width: 40, height: 40, src1x: 128, src2x: 256 },
  xl: { box: 'w-12 h-12', width: 48, height: 48, src1x: 160, src2x: 320 },
};

/**
 * Standalone Official Mystery Hub Brand Mark Component.
 * Pure Cloudinary geometric M mark without artificial borders, surrounding boxes, or extra glow.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  className = '',
  size = 'md',
  alt = '',
  ariaHidden = false,
  priority = 'auto',
}) => {
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const [hasError, setHasError] = useState(false);

  const src1x = getBrandMarkDeliveryUrl(cfg.src1x);
  const src2x = getBrandMarkDeliveryUrl(cfg.src2x);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${cfg.box} ${className}`}
      style={{ aspectRatio: '1/1' }}
      aria-hidden={ariaHidden || undefined}
    >
      {!hasError ? (
        <img
          src={src1x}
          srcSet={`${src1x} 1x, ${src2x} 2x`}
          alt={alt}
          width={cfg.width}
          height={cfg.height}
          loading="eager"
          fetchPriority={priority === 'high' ? 'high' : 'auto'}
          decoding="async"
          onError={() => setHasError(true)}
          className="w-full h-full object-contain pointer-events-none select-none"
        />
      ) : (
        <span className="w-full h-full rounded bg-[#00c365]/20 text-[#00c365] flex items-center justify-center font-bold text-xs select-none">
          M
        </span>
      )}
    </div>
  );
};

export interface BrandLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  showWordmark?: boolean;
  priority?: 'high' | 'auto';
  wordmarkClassName?: string;
}

/**
 * Mystery Hub Brand Logo Component (Official Mark + Wordmark).
 * Clean, premium, accessible, and responsive.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = true,
  priority = 'auto',
  wordmarkClassName = '',
}) => {
  const textClass =
    size === 'xs'
      ? 'text-sm'
      : size === 'sm'
      ? 'text-base'
      : size === 'lg'
      ? 'text-2xl'
      : 'text-lg';

  const gapClass = size === 'xs' ? 'gap-1.5' : size === 'sm' ? 'gap-2' : 'gap-2.5';

  return (
    <div
      className={`inline-flex items-center ${gapClass} font-bold tracking-tight text-white select-none ${className}`}
    >
      {/* Official Mystery Hub Brand Mark */}
      <BrandMark
        size={size}
        ariaHidden={showWordmark}
        alt={showWordmark ? '' : 'Mystery Hub'}
        priority={priority}
      />

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-semibold tracking-tight text-white ${textClass} ${wordmarkClassName}`}
          >
            Mystery <span className="text-[#00c365]">Hub</span>
          </span>
        </div>
      )}
    </div>
  );
};
