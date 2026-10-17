import React from 'react';
import type { TemplateItem } from '../../types';
/**
 * Marks starter content the owner has not kept yet. Only owner drafts and design previews carry
 * examples: published websites never contain `isExample` items, so this renders nothing there.
 */
export function ExampleTag({item,corner='left',flow=false}:{item:TemplateItem;corner?:'left'|'right';flow?:boolean}) {
  if(!item.isExample)return null;
  // Without a photo to sit on, the tag takes its own line so it never covers the card's text.
  return <span className={`${flow?'relative self-start mx-4 mt-4 -mb-1 w-fit':`absolute top-2 ${corner==='left'?'left-2':'right-2'}`} z-[2] inline-flex items-center rounded-full bg-black/75 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-white shadow pointer-events-none`}>Example</span>;
}
