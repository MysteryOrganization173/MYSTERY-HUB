import React, { useState } from 'react';
import { getCloudinaryUrl, getCloudinarySrcSet, CloudinaryOptions } from '../../utils/cloudinary';

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'placeholder'> {
  src: string | null | undefined;
  alt: string;
  priority?: boolean; // If true: loading="eager", fetchPriority="high", decoding="async"
  aspectRatio?: string; // e.g., '4/3', '16/9', '1/1'
  transformOptions?: Omit<CloudinaryOptions, 'width'>;
  responsiveWidths?: number[];
  sizes?: string;
  containerClassName?: string;
  fallbackIcon?: React.ReactNode;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  priority = false,
  aspectRatio,
  transformOptions,
  responsiveWidths,
  sizes,
  containerClassName = '',
  className = '',
  fallbackIcon,
  objectFit = 'contain',
  objectPosition,
  ...rest
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#090d11] to-[#0e141a] text-slate-500 ${containerClassName}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {fallbackIcon || (
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400">
            <span className="text-xs font-bold text-emerald-400">MH</span>
          </div>
        )}
      </div>
    );
  }

  const finalSrc = getCloudinaryUrl(src, transformOptions);
  const srcSet = responsiveWidths ? getCloudinarySrcSet(src, responsiveWidths, transformOptions) : undefined;

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#090d11] ${containerClassName}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Background skeleton/placeholder while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-800/40 animate-pulse z-0 pointer-events-none" />
      )}

      <img
        src={finalSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        style={{
          objectFit,
          objectPosition,
        }}
        className={`w-full h-full transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...rest}
      />
    </div>
  );
};
