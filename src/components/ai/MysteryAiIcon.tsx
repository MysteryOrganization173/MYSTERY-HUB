import React from 'react';

interface MysteryAiIconProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const MysteryAiIcon: React.FC<MysteryAiIconProps> = ({
  className = '',
  size = 'md',
  active = false,
}) => {
  const dim = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${dim} ${className}`}>
      {/* Outer ambient pulse ring when active */}
      {active && (
        <span className="absolute inset-0 rounded-full bg-[#00c365]/30 animate-ping opacity-75 pointer-events-none" />
      )}

      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-[#00E575] drop-shadow-[0_2px_8px_rgba(0,195,101,0.4)]"
      >
        {/* Stylized M-Spark Emblem connecting to Mystery Hub */}
        <path
          d="M3.5 18V8.5C3.5 7.67 4.17 7 5 7H6.5C7.33 7 8 7.67 8 8.5V14L11.29 9.61C11.67 9.11 12.33 9.11 12.71 9.61L16 14V8.5C16 7.67 16.67 7 17.5 7H19C19.83 7 20.5 7.67 20.5 8.5V18"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Soft glowing intelligent beacon pip */}
        <circle cx="12" cy="5" r="2" fill="#00E575" />
        <path
          d="M12 2V3.5M12 6.5V8M9 5H10.5M13.5 5H15"
          stroke="#00E575"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
