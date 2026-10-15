import React, {useEffect, useRef, useState} from 'react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import {VisualEditContext} from './VisualEditMarkers';

/** Visible site content that has no tap-to-edit field yet. Empty layout space is not included. */
const CONTENT_SELECTOR = 'img,picture,svg,video,h1,h2,h3,h4,h5,h6,p,a,button,li,label,span,strong,em,small,blockquote,figure,input,select,textarea';
export type VisualSelectHint = 'settings';

/**
 * Owner-only selection layer inside the draft frame. `reserveBottom` is the fraction of the frame
 * covered by the editor's bottom sheet, so a selected target is scrolled into the visible part.
 */
export function VisualSelectionSurface({targets, selected, onSelect, onOrder, focusRequest, reserveBottom = 0, children}: {targets: VisualTarget[]; selected: string | null; onSelect: (id: string | null, hint?: VisualSelectHint) => void; onOrder?: (ids: string[]) => void; focusRequest: number; reserveBottom?: number; children: React.ReactNode}) {
  const root = useRef<HTMLDivElement>(null), previous = useRef<string | null>(null), lastOrder = useRef('');
  const [tag, setTag] = useState<{label: string; top: number; left: number} | null>(null);
  const elementsFor = (id: string) => Array.from(root.current?.querySelectorAll<HTMLElement>('[data-visual-target]') || []).filter(e => e.dataset.visualTarget === id);

  useEffect(() => {
    for (const element of root.current?.querySelectorAll<HTMLElement>('[data-visual-target]') || []) {
      element.toggleAttribute('data-visual-selected', element.dataset.visualTarget === selected);
    }
    if (selected) previous.current = selected;
    // Report rendered targets in reading order so the editor's Previous/Next follow the page.
    const ids = Array.from(new Set(Array.from(root.current?.querySelectorAll<HTMLElement>('[data-visual-target]') || []).map(e => e.dataset.visualTarget!)));
    const key = ids.join('|');
    if (key !== lastOrder.current) {lastOrder.current = key; onOrder?.(ids);}
  });

  // Keep the selected target above the bottom sheet and label it, on any customer theme.
  useEffect(() => {
    const element = selected ? elementsFor(selected)[0] : undefined;
    const label = targets.find(t => t.id === selected)?.label;
    if (!element || !label) {setTag(null); return;}
    const place = () => {
      const rect = element.getBoundingClientRect();
      setTag({label, top: rect.top + window.scrollY, left: Math.max(4, Math.min(rect.left + window.scrollX, window.innerWidth - 160))});
    };
    const rect = element.getBoundingClientRect(), view = window.innerHeight, visibleBottom = view * (1 - reserveBottom);
    if (rect.top < 40 || rect.bottom > visibleBottom - 12) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({top: Math.max(0, rect.top + window.scrollY - Math.max(48, view * 0.1)), behavior: reduce ? 'auto' : 'smooth'});
    }
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(document.body);
    window.addEventListener('resize', place);
    return () => {observer?.disconnect(); window.removeEventListener('resize', place);};
  }, [selected, targets, reserveBottom]);

  useEffect(() => {
    if (!focusRequest || !previous.current) return;
    elementsFor(previous.current)[0]?.focus({preventScroll: true});
  }, [focusRequest]);

  const select = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault(); event.stopPropagation();
    const origin = event.target instanceof Element ? event.target : null;
    const element = origin?.closest<HTMLElement>('[data-visual-target]');
    const id = element?.dataset.visualTarget;
    if (id && targets.some(t => t.id === id)) return onSelect(id);
    // Visible content without a tap target gets an explanation instead of silently doing nothing.
    const content = origin?.closest<HTMLElement>(CONTENT_SELECTOR);
    if (content && root.current?.contains(content)) {
      content.setAttribute('data-visual-locked', '');
      setTimeout(() => content.removeAttribute('data-visual-locked'), 1400);
      return onSelect(null, 'settings');
    }
    onSelect(null);
  };
  return <VisualEditContext.Provider value={targets}><div ref={root} className="visual-selection-surface" onClickCapture={select} onAuxClickCapture={select} onSubmitCapture={event => {event.preventDefault(); event.stopPropagation();}} onKeyDownCapture={event => {
    if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); onSelect(null);}
    else if (event.key === 'Enter' || event.key === ' ') select(event);
  }}>
    <style>{`.visual-selection-surface [data-visual-target]{cursor:pointer;scroll-margin:24px;transition:outline-color .15s}
@media (hover:hover){.visual-selection-surface [data-visual-target]:hover{outline:2px dashed #00c365;outline-offset:3px}}
.visual-selection-surface [data-visual-selected],.visual-selection-surface [data-visual-target]:focus-visible{outline:3px solid #00c365!important;outline-offset:3px;box-shadow:0 0 0 3px #fff}
.visual-selection-surface [data-visual-locked]{outline:2px dashed #94a3b8!important;outline-offset:3px}
.visual-selected-tag{position:absolute;z-index:2147483000;transform:translateY(calc(-100% - 8px));background:#0a0e11;color:#fff;font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;padding:6px 9px;border-radius:8px;pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.25)}
.visual-selected-tag::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#00c365;margin-right:6px;vertical-align:1px}
@media (prefers-reduced-motion:reduce){.visual-selection-surface [data-visual-target]{transition:none}}`}</style>
    {children}
    {tag && <div className="visual-selected-tag" aria-hidden="true" style={{top: Math.max(tag.top, 34), left: tag.left}}>{tag.label}</div>}
  </div></VisualEditContext.Provider>;
}
