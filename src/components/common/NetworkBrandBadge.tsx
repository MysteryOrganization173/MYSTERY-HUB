import React from 'react';
import { GHANA_NETWORKS } from '../../data/bundles';
import { NetworkId } from '../../types';

export interface NetworkBrandBadgeProps {
  network: NetworkId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showFullName?: boolean;
}

/**
 * Standardized Network Brand Badge Component
 * Respects natural aspect ratio for each telecom logo/wordmark.
 * - MTN: compact/bold badge
 * - Telecel: natural horizontal width so the full wordmark is never squeezed or clipped
 * - AirtelTigo: natural proportions
 * Maintains strict vertical height uniformity so card grids remain aligned.
 */
export const NetworkBrandBadge: React.FC<NetworkBrandBadgeProps> = ({
  network,
  size = 'sm',
  className = '',
  showFullName = false,
}) => {
  const netInfo = GHANA_NETWORKS[network] || GHANA_NETWORKS.mtn;

  const sizeStyles = {
    xs: 'h-6 text-[10px] px-2 rounded-md',
    sm: 'h-7 text-[11px] px-2.5 rounded-lg',
    md: 'h-8 text-xs px-3 rounded-lg',
    lg: 'h-10 text-xs sm:text-sm px-3.5 rounded-xl',
  }[size];

  const brandDisplay = {
    mtn: {
      text: showFullName ? 'MTN Ghana' : 'MTN',
      bg: '#FFCC00',
      textColor: '#000000',
      fontWeight: 'font-extrabold',
    },
    telecel: {
      text: showFullName ? 'Telecel Ghana' : 'Telecel',
      bg: '#E60000',
      textColor: '#FFFFFF',
      fontWeight: 'font-bold tracking-tight',
    },
    airteltigo: {
      text: showFullName ? 'AirtelTigo (AT)' : 'AT',
      bg: '#004B93',
      textColor: '#FFFFFF',
      fontWeight: 'font-extrabold',
    },
  }[network] || {
    text: netInfo.name,
    bg: netInfo.brandColor,
    textColor: '#FFFFFF',
    fontWeight: 'font-bold',
  };

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none shadow-sm whitespace-nowrap ${brandDisplay.fontWeight} ${sizeStyles} ${className}`}
      style={{
        backgroundColor: brandDisplay.bg,
        color: brandDisplay.textColor,
      }}
    >
      <span>{brandDisplay.text}</span>
    </div>
  );
};
