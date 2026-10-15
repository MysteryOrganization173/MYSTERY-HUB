import React, {useEffect, useRef} from 'react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import {VisualEditContext} from './VisualEditMarkers';

export function VisualSelectionSurface({targets, selected, onSelect, focusRequest, children}: {targets: VisualTarget[]; selected: string | null; onSelect: (id: string | null) => void; focusRequest: number; children: React.ReactNode}) {
  const root = useRef<HTMLDivElement>(null), previous = useRef<string | null>(null);
  useEffect(() => {
    for (const element of root.current?.querySelectorAll<HTMLElement>('[data-visual-target]') || []) {
      element.toggleAttribute('data-visual-selected', element.dataset.visualTarget === selected);
    }
    if (selected) previous.current = selected;
  }, [selected, targets]);
  useEffect(() => {
    if (!focusRequest || !previous.current) return;
    const element = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-visual-target]') || []).find(e => e.dataset.visualTarget === previous.current);
    element?.focus({preventScroll: true});
  }, [focusRequest]);
  const select = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault(); event.stopPropagation();
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-visual-target]') : null;
    const id = element?.dataset.visualTarget;
    onSelect(id && targets.some(t => t.id === id) ? id : null);
  };
  return <VisualEditContext.Provider value={targets}><div ref={root} className="visual-selection-surface" onClickCapture={select} onAuxClickCapture={select} onSubmitCapture={event => {event.preventDefault(); event.stopPropagation();}} onKeyDownCapture={event => {
    if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); onSelect(null);}
    else if (event.key === 'Enter' || event.key === ' ') select(event);
  }}>
    <style>{`.visual-selection-surface [data-visual-target]{cursor:pointer;scroll-margin:24px}.visual-selection-surface [data-visual-target]:hover{outline:2px dashed #00c365;outline-offset:3px}.visual-selection-surface [data-visual-selected],.visual-selection-surface [data-visual-target]:focus-visible{outline:3px solid #00c365!important;outline-offset:4px}`}</style>
    {children}
  </div></VisualEditContext.Provider>;
}
