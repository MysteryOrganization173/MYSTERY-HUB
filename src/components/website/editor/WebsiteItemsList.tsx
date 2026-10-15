import React from 'react';
import {ChevronRight, Plus} from 'lucide-react';
import type {TemplateItem} from '../../../types';
import {SafeImage} from '../SafeImage';

/** The owner's menu, services, rooms or products as a plain list. Each row opens on the page. */
export function WebsiteItemsList({items, word, sectionsMode, onOpen, onAdd}: {items: TemplateItem[]; word: {singular: string; plural: string; many: string}; sectionsMode: boolean; onOpen: (id: string) => void; onAdd: () => void}) {
  const examples = items.filter(item => item.isExample).length, lower = word.singular.toLowerCase();
  return <section className="space-y-4 text-left" aria-labelledby="website-items-title">
    <div><h3 id="website-items-title" className="text-lg font-semibold">Your {word.plural.toLowerCase()}</h3>
      <p className="text-sm text-slate-400 mt-1">{sectionsMode ? `You are using Custom sections, so these ${word.many} show when you go back to the designed layout. Edit section items in Layout.` : `Tap one to edit it on your page.${examples ? ` ${examples} ${examples === 1 ? 'is an example' : 'are examples'} to keep or remove before publishing.` : ''}`}</p></div>
    {!items.length && <p className="visual-empty">No {word.many} yet. Add your first {lower} so customers can see what you offer.</p>}
    <ul className="visual-item-list">{items.map((item, index) => <li key={item.id || index}>
      <button type="button" disabled={!item.id || sectionsMode} onClick={() => item.id && onOpen(item.id)}>
        {item.image ? <SafeImage src={item.image} alt="" className="visual-item-thumb"/> : <span className="visual-item-thumb" aria-hidden="true">{item.name.slice(0, 1)}</span>}
        <span className="visual-item-text"><strong>{item.name}</strong><span>{[item.isExample ? 'Example' : '', item.price, item.category].filter(Boolean).join(' · ') || 'No price shown'}</span></span>
        {item.isExample && <span className="visual-chip">Review</span>}
        <ChevronRight size={18} aria-hidden="true"/>
      </button>
    </li>)}</ul>
    <button type="button" disabled={items.length >= 50 || sectionsMode} onClick={onAdd} className="visual-primary-button"><Plus size={17}/>Add a {lower}</button>
  </section>;
}
