import React from 'react';
import {Check} from 'lucide-react';
import {WEBSITE_STYLE_VARIANTS, WEBSITE_ORIGINAL_STYLE} from '../../../config/websiteStyleVariants';

/**
 * V7.1 store style picker. Each card is a small drawing of the layout (not a screenshot and not a fake store),
 * so the owner sees what changes before tapping. Picking a style changes only the draft: the published store
 * keeps its look until the next publish, and Undo or picking Classic again brings the original back.
 */
export function WebsiteStoreLook({layout, value, onChange}: {layout: string; value?: string; onChange: (style: string) => void}) {
  const styles = WEBSITE_STYLE_VARIANTS[layout] || [];
  if (!styles.length) return null;
  const current = styles.some(s => s.id === value) ? value! : WEBSITE_ORIGINAL_STYLE[layout];
  return <section className="store-look" aria-labelledby="store-look-title" data-store-look>
    <div className="store-look-head">
      <h3 id="store-look-title">Store style</h3>
      <p>Same bundles, prices and checkout in every style. Your live store changes only when you publish.</p>
    </div>
    <div className="store-look-grid" role="radiogroup" aria-labelledby="store-look-title">
      {styles.map(style => {
        const on = style.id === current;
        return <button key={style.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(style.id)} className="store-look-card" data-style={style.id}>
          <span className="store-look-art" aria-hidden="true"><StyleSketch id={style.id}/></span>
          <span className="store-look-text">
            <strong>{style.name}{on && <Check size={14} aria-hidden="true"/>}</strong>
            <small>{style.summary}</small>
          </span>
        </button>;
      })}
    </div>
    <p className="store-look-detail" role="status">{styles.find(s => s.id === current)?.detail}</p>
  </section>;
}

/** A schematic of each composition, drawn with plain shapes in neutral editor colours. */
function StyleSketch({id}: {id: string}) {
  const rows = (y: number, two = false) => [0, 1, 2].map(i => <rect key={i} x={two ? (i % 2 ? 52 : 8) : 8} y={y + (two ? Math.floor(i / 2) * 22 : i * 11)} width={two ? 40 : 84} height={two ? 18 : 8} rx="2.5" className="s-row"/>);
  return <svg viewBox="0 0 100 92" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <rect width="100" height="92" className="s-bg"/>
    {id === 'horizon' && <>
      <rect width="100" height="44" className="s-img"/><rect y="26" width="100" height="18" className="s-fade"/>
      <rect x="8" y="22" width="52" height="7" rx="2" className="s-ink"/><rect x="8" y="32" width="36" height="4" rx="2" className="s-muted"/>
      <rect x="8" y="50" width="84" height="7" rx="3.5" className="s-tab"/>{rows(62)}
    </>}
    {id === 'market' && <>
      <rect x="8" y="6" width="84" height="16" rx="3" className="s-img"/>
      <rect x="8" y="27" width="56" height="6" rx="2" className="s-ink"/><rect x="8" y="36" width="12" height="2" rx="1" className="s-accent"/>
      <rect x="8" y="42" width="84" height="6" rx="3" className="s-tab"/>
      {[0, 1].map(r => [0, 1].map(c => <g key={`${r}${c}`}><rect x={8 + c * 44} y={52 + r * 20} width="40" height="17" rx="3" className="s-row"/><rect x={8 + c * 44} y={52 + r * 20} width="40" height="2" className="s-accent"/></g>))}
    </>}
    {id === 'studio' && <>
      <rect x="8" y="8" width="14" height="14" rx="4" className="s-accent"/>
      <rect x="8" y="27" width="70" height="10" rx="2" className="s-ink"/><rect x="8" y="40" width="50" height="10" rx="2" className="s-ink"/>
      <rect x="8" y="56" width="84" height="1" className="s-muted"/>
      {[0, 1, 2].map(i => <rect key={i} x="8" y={63 + i * 9} width="84" height="1" className="s-muted"/>)}
      {[0, 1, 2].map(i => <rect key={i} x="8" y={59 + i * 9} width="14" height="3" rx="1" className="s-ink"/>)}
    </>}
    {id === 'classic' && <>
      <rect x="8" y="6" width="84" height="30" rx="4" className="s-img"/>
      <rect x="8" y="41" width="60" height="6" rx="2" className="s-ink"/><rect x="8" y="50" width="26" height="6" rx="3" className="s-accent"/>
      <rect x="8" y="61" width="84" height="6" rx="3" className="s-tab"/>{rows(71)}
    </>}
  </svg>;
}

/**
 * Ready-made wording for a field. Tapping one fills the field (and the draft), the owner can then edit it.
 * Presets are fixed, plain-English suggestions: no prices, numbers, reviews or delivery promises.
 */
export function WebsiteCopyIdeas({ideas, value, onPick}: {ideas: readonly string[]; value: string; onPick: (text: string) => void}) {
  if (!ideas.length) return null;
  return <div className="copy-ideas" role="group" aria-label="Wording ideas">
    <p>Ideas · tap one, then make it yours</p>
    <ul>{ideas.map(idea => <li key={idea}><button type="button" aria-pressed={idea === value} onClick={() => onPick(idea)}>{idea}</button></li>)}</ul>
  </div>;
}
