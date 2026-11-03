import React, {useEffect, useRef, useState} from 'react';
import {Check, ChevronDown, ChevronUp, SlidersHorizontal} from 'lucide-react';
import type {SiteSettings} from '../../../types';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import {WEBSITE_PALETTES, WEBSITE_PALETTE_GROUPS, type WebsitePalette, type WebsitePaletteGroup} from '../../../utils/websitePalettes';
import {WEBSITE_STYLE_VARIANTS} from '../../../config/websiteStyleVariants';
import {resolveStoreTheme, websiteActionText} from '../../../utils/websiteBrand';
import {WebsiteStoreLook} from './WebsiteStoreLook';
import {VisualField} from './VisualField';

type DesignTab = 'style' | 'colours' | 'fine';
const samePalette = (p: WebsitePalette, s: SiteSettings) => [p.backgroundColor, p.primaryColor, p.accentColor].join() === [s.backgroundColor, s.primaryColor, s.accentColor].map(c => (c || '').toLowerCase()).join();

/**
 * V7.2 Design mode: the one place to change how the whole website looks. Style (Data Stores), colour sets and
 * fine-tuning share one panel. Desktops show it beside the canvas. On phones and tablets it takes the lower part of
 * the screen *in the layout* (the canvas shrinks rather than hiding behind it), so every tap shows its result in
 * the live draft above. "More room" grows the panel when browsing; "Less" gives the canvas back.
 *
 * Every choice is an ordinary draft edit: saved like any other change, undoable, and public only after publishing.
 */
export function WebsiteDesignPanel({layout, styleValue, onStyle, settings, onPalette, targets, siteId, token, onChange, onDone, onAllSettings, expanded, onExpanded}: {
  /** The design's layout, when it offers store styles (Data Stores). */ layout?: string;
  styleValue?: string; onStyle: (style: string) => void; settings: SiteSettings; onPalette: (palette: WebsitePalette) => void;
  /** The site's own colour fields, for fine-tuning. */ targets: VisualTarget[];
  siteId: string; token: string; onChange: (id: string, value: string) => void; onDone: () => void; onAllSettings: () => void;
  expanded: boolean; onExpanded: (expanded: boolean) => void;
}) {
  const hasStyles = !!layout && !!WEBSITE_STYLE_VARIANTS[layout]?.length;
  const [tab, setTab] = useState<DesignTab>(hasStyles ? 'style' : 'colours');
  const [group, setGroup] = useState<WebsitePaletteGroup | 'all'>('all');
  const root = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, []);
  // Escape returns to the canvas even when focus is on the toolbar (Undo, for example). Menus and sheets that handle
  // Escape themselves stop it first; an open modal dialog keeps it.
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) done.current(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const tabs: Array<[DesignTab, string]> = [...(hasStyles ? [['style', 'Style'] as [DesignTab, string]] : []), ['colours', 'Colours'], ['fine', 'Fine-tune']];
  const colors = {background: settings.backgroundColor, accent: settings.accentColor};
  const palettes = WEBSITE_PALETTES.filter(p => group === 'all' || p.group === group);
  const keyTabs = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex(([id]) => id === tab);
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const id = tabs[(next + tabs.length) % tabs.length][0];
    setTab(id); root.current?.querySelector<HTMLElement>(`#design-tab-${id}`)?.focus();
  };

  return <aside ref={root} role="dialog" aria-modal="false" aria-labelledby="design-title" className="design-panel" data-size={expanded ? 'full' : 'peek'}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onDone(); } }}
    // Fine-tuning opens the keyboard on phones: give the fields room above it.
    onFocus={event => { if ((event.target as HTMLElement).matches('input:not([type=color]),textarea') && !expanded) onExpanded(true); }}>
    <div className="design-head">
      <button type="button" className="design-size" aria-expanded={expanded} aria-controls="design-body" onClick={() => onExpanded(!expanded)}>
        <span className="design-grabber" aria-hidden="true"/>
        {expanded ? <ChevronDown size={18} aria-hidden="true"/> : <ChevronUp size={18} aria-hidden="true"/>}<span>{expanded ? 'Less' : 'More room'}</span>
      </button>
      <div className="design-title">
        <h3 id="design-title" ref={heading} tabIndex={-1}>Design</h3>
        <p>Draft only until you publish</p>
      </div>
      <button type="button" onClick={onDone} className="visual-done-button">Done</button>
    </div>
    <div role="tablist" aria-label="Design" className="design-tabs" onKeyDown={keyTabs}>
      {tabs.map(([id, label]) => <button key={id} id={`design-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="design-body" tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <div id="design-body" role="tabpanel" aria-labelledby={`design-tab-${tab}`} className="design-body">
      {tab === 'style' && hasStyles && <WebsiteStoreLook layout={layout!} value={styleValue} onChange={onStyle} colors={colors} variant={expanded ? 'grid' : 'rail'} heading={false}/>}
      {tab === 'colours' && <section className="design-palettes" aria-labelledby="design-palettes-title" data-palettes>
        <h4 id="design-palettes-title" className="sr-only">Colour sets</h4>
        <div className="design-chips" role="group" aria-label="Colour mood">
          {([['all', 'All'], ...WEBSITE_PALETTE_GROUPS.map(g => [g.id, g.label])] as Array<[WebsitePaletteGroup | 'all', string]>).map(([id, label]) =>
            <button key={id} type="button" aria-pressed={group === id} onClick={() => setGroup(id)}>{label}</button>)}
        </div>
        <ul className="design-palette-list" data-variant={expanded ? 'grid' : 'rail'}>
          {palettes.map(p => {
            const on = samePalette(p, settings), t = resolveStoreTheme({background: p.backgroundColor, accent: p.accentColor, secondary: p.accentColor});
            return <li key={p.name}><button type="button" aria-pressed={on} onClick={() => onPalette(p)} className="design-palette">
              {/* A tiny store in this palette: page, heading, a card and the main button. */}
              <span className="design-swatch" aria-hidden="true" style={{background: t.background, borderColor: t.hairline || t.border}}>
                <i style={{background: t.text}}/><i style={{background: t.mutedText}}/>
                <b style={{background: t.surface, borderColor: t.hairline || t.border}}><em style={{background: t.accent, color: websiteActionText(t.accent)}}>Buy</em></b>
              </span>
              <span className="design-palette-name">{p.name}{on && <Check size={14} aria-hidden="true"/>}</span>
            </button></li>;
          })}
        </ul>
        <p className="visual-field-hint">Any colour set works with any style. Undo brings your previous colours back.</p>
      </section>}
      {tab === 'fine' && <div className="design-fine">
        {targets.map(target => <VisualField key={target.id} target={target} siteId={siteId} token={token} onChange={onChange}/>)}
        <button type="button" onClick={onAllSettings} className="visual-link-button"><SlidersHorizontal size={15}/>More options in All Settings</button>
      </div>}
    </div>
  </aside>;
}
