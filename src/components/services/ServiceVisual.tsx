import React from 'react';
import {
  Wifi, Smartphone, Globe, Zap, Droplet, Tv, GraduationCap, FileCheck2, Sparkles, Cpu, Wallet, Gift, Store, ShieldCheck,
} from 'lucide-react';
import type { DigitalService } from '../../types';
import { SAMPLE_SERVICE_ARTWORK } from '../../data/services';
import { getCloudinarySrcSet, getCloudinaryUrl } from '../../utils/cloudinary';

export const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>> = {
  Wifi, Smartphone, Layout: Globe, Zap, Droplet, Tv, GraduationCap, FileCheck2, Sparkles, Cpu, Wallet, Gift, Store, ShieldCheck,
};

export const ServiceIcon: React.FC<{ service: DigitalService; size?: number }> = ({ service, size = 22 }) => {
  const Icon = SERVICE_ICONS[service.iconName] || Sparkles;
  return <Icon size={size} aria-hidden />;
};

/** Accent colour for a service, exposed to CSS as --accent. */
export const accentStyle = (service: DigitalService) => ({ '--accent': service.accentColor } as React.CSSProperties);

/**
 * Approved Cloudinary artwork where a service has it (lazy, responsive), otherwise an icon composition.
 * Decorative in cards; the preview hero describes it as a concept illustration.
 */
export const ServiceVisual: React.FC<{ service: DigitalService; sizes: string; priority?: boolean; alt?: string }> = ({ service, sizes, priority, alt: label = '' }) => {
  const art = SAMPLE_SERVICE_ARTWORK[service.id];
  const alt = art ? label : '';
  return (
    <div className={`sd-visual${art ? ' sd-visual-art' : ''}`} style={accentStyle(service)} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      {art ? (
        <img
          src={getCloudinaryUrl(art.url, { width: 640 })}
          srcSet={getCloudinarySrcSet(art.url, [360, 640, 960])}
          sizes={sizes}
          alt=""
          width={1672}
          height={941}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          style={{ objectPosition: art.objectPosition }}
        />
      ) : <ServiceIcon service={service} size={64} />}
    </div>
  );
};
