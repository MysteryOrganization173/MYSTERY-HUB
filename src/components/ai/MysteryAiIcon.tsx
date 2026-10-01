import React from 'react';

interface MysteryAiIconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const MysteryAiIcon: React.FC<MysteryAiIconProps> = ({
  className = '',
  size = 'md',
  active = false,
}) => {
  // Calibrated dimensions for optimal visual fill:
  // xs: 20px (compact)
  // sm: 24px (typing indicator)
  // md: 32px (chat header icon slot)
  // lg: 42px (floating button interior, fills ~87.5% of 48px button)
  const dim =
    size === 'xs'
      ? 'w-5 h-5'
      : size === 'sm'
      ? 'w-6 h-6'
      : size === 'lg'
      ? 'w-[42px] h-[42px]'
      : 'w-8 h-8';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none ${dim} ${className}`}
    >
      {/* Outer ambient pulse ring when active */}
      {active && (
        <span className="absolute inset-0 rounded-full bg-[#00c365]/30 animate-ping opacity-75 pointer-events-none z-10" />
      )}

      {/* Tightly cropped Emerald Emblem Artwork (Wordmark & Margins excluded, visually centered) */}
      <img
        src="https://res.cloudinary.com/da6oeat7m/image/upload/c_crop,w_640,h_640,x_309,y_160/f_auto,q_auto,w_300/v1790791174/ChatGPT_Image_Sep_30_2026_05_59_10_PM_klrk81.png"
        alt="Mystery AI"
        loading="eager"
        decoding="async"
        className="w-full h-full object-cover scale-105 pointer-events-none filter drop-shadow-[0_0_8px_rgba(0,195,101,0.45)]"
      />
    </div>
  );
};

