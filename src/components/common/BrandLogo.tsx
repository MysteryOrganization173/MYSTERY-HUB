import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const iconSize = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className={`flex items-center gap-2.5 font-bold tracking-tight text-white select-none ${className}`}>
      {/* Custom Stylized 'M' Emblem inspired by Mystery Hub branding */}
      <div
        className={`${iconSize} rounded-xl bg-gradient-to-br from-[#00E575] to-[#00A855] p-[1.5px] shadow-[0_0_15px_rgba(0,195,101,0.35)] flex items-center justify-center shrink-0`}
      >
        <div className="w-full h-full bg-[#0a110e] rounded-[10px] flex items-center justify-center relative overflow-hidden">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-4/5 h-4/5 text-[#00E575] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Distinctive M shape with upward dynamic wing */}
            <path d="M4 18V6l8 8 8-8v12" />
            <circle cx="12" cy="14" r="1.5" fill="#00E575" stroke="none" />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-t from-[#00c365]/20 to-transparent pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-col leading-none">
        <span className={`font-semibold tracking-tight text-white ${textClass}`}>
          Mystery <span className="text-[#00c365]">Hub</span>
        </span>
      </div>
    </div>
  );
};
