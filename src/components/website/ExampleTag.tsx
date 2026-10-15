import React from 'react';
import type { TemplateItem } from '../../types';
/**
 * Marks starter content the owner has not kept yet. Only owner drafts and design previews carry
 * examples: published websites never contain `isExample` items, so this renders nothing there.
 */
export function ExampleTag({item,corner='left'}:{item:TemplateItem;corner?:'left'|'right'}) {
  if(!item.isExample)return null;
  return <span className={`absolute top-2 ${corner==='left'?'left-2':'right-2'} z-[2] inline-flex items-center rounded-full bg-black/75 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-white shadow pointer-events-none`}>Example</span>;
}
