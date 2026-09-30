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
  const dim =
    size === 'xs'
      ? 'w-4 h-4'
      : size === 'sm'
      ? 'w-6 h-6'
      : size === 'lg'
      ? 'w-10 h-10'
      : 'w-8 h-8';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none ${dim} ${className}`}
    >
      {/* Outer ambient pulse ring when active */}
      {active && (
        <span className="absolute inset-0 rounded-full bg-[#00c365]/30 animate-ping opacity-75 pointer-events-none z-10" />
      )}

      {/* Cropped Emerald Emblem Artwork */}
      <img
        src="https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_250/v1790791174/ChatGPT_Image_Sep_30_2026_05_59_10_PM_klrk81.png"
        alt="Mystery AI"
        loading="eager"
        decoding="async"
        className="w-full h-full object-cover object-[center_18%] scale-[1.38] pointer-events-none filter drop-shadow-[0_0_6px_rgba(0,195,101,0.4)]"
      />
    </div>
  );
};
