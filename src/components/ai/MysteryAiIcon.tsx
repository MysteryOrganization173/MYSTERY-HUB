import React from 'react';
interface MysteryAiIconProps {className?:string;size?:'xs'|'sm'|'md'|'lg';active?:boolean;}
/** Mystery's M with a signal trace, drawn for small sizes without an image request. */
export const MysteryAiIcon:React.FC<MysteryAiIconProps>=({className='',size='md',active=false})=>{
  const dim=size==='xs'?'w-5 h-5':size==='sm'?'w-6 h-6':size==='lg'?'w-[42px] h-[42px]':'w-8 h-8';
  return <svg viewBox="0 0 48 48" aria-hidden="true" className={`${dim} shrink-0 ${className}`} fill="none">
    <rect x="3" y="3" width="42" height="42" rx="14" fill="#111c19"/>
    <path d="M12 33V17l12 12 12-12v16" stroke="#31d887" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24 29v8" stroke="#a6efc6" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="11" r="2.5" fill={active?'#e6fff1':'#31d887'}/>
  </svg>;
};
