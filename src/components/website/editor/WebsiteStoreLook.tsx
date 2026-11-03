import React from 'react';
import {Check} from 'lucide-react';
import {WEBSITE_STYLE_VARIANTS, WEBSITE_ORIGINAL_STYLE} from '../../../config/websiteStyleVariants';
import {resolveStoreTheme, mixWebsiteColor, websiteActionText} from '../../../utils/websiteBrand';

/** The store's own colours, so every sketch shows the style in the palette the owner has chosen. */
export type StyleSketchColors = {background?: string; accent?: string};
export function sketchVars(colors?: StyleSketchColors): React.CSSProperties | undefined {
  if (!colors?.background) return undefined;
  const t = resolveStoreTheme({background: colors.background, accent: colors.accent, secondary: colors.accent});
  return {'--sk-bg': t.background, '--sk-surface': t.surface, '--sk-line': t.hairline || t.border, '--sk-ink': t.text, '--sk-muted': mixWebsiteColor(t.background, t.text, .35), '--sk-accent': t.accent, '--sk-on-accent': websiteActionText(t.accent), '--sk-img': mixWebsiteColor(t.background, t.accent, .45)} as React.CSSProperties;
}

/**
 * V7.1 store style picker. Each card is a small drawing of the layout (not a screenshot and not a fake store),
 * so the owner sees what changes before tapping. Picking a style changes only the draft: the published store
 * keeps its look until the next publish, and Undo or picking Classic again brings the original back.
 * V7.2: drawings use the store's own colours, and `rail` lays the cards out in one swipeable row for phones.
 */
export function WebsiteStoreLook({layout, value, onChange, colors, variant = 'grid', heading = true}: {layout: string; value?: string; onChange: (style: string) => void; colors?: StyleSketchColors; variant?: 'grid' | 'rail'; heading?: boolean}) {
  const styles = WEBSITE_STYLE_VARIANTS[layout] || [];
  if (!styles.length) return null;
  const current = styles.some(s => s.id === value) ? value! : WEBSITE_ORIGINAL_STYLE[layout];
  return <section className="store-look" data-variant={variant} aria-labelledby="store-look-title" data-store-look>
    <div className={heading ? 'store-look-head' : 'store-look-head sr-only'}>
      <h3 id="store-look-title">Store style</h3>
      <p>Same bundles, prices and checkout in every style. Your live store changes only when you publish.</p>
    </div>
    <div className="store-look-grid" role="radiogroup" aria-labelledby="store-look-title" style={sketchVars(colors)}>
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

/** A schematic of each composition, drawn with plain shapes in the store's colours (neutral editor colours by default). */
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
    {id === 'compact' && <>
      <rect x="8" y="7" width="54" height="6" rx="2" className="s-ink"/><rect x="8" y="16" width="38" height="3" rx="1.5" className="s-muted"/>
      <rect x="68" y="7" width="24" height="10" rx="3" className="s-accent"/>
      <rect x="8" y="25" width="84" height="7" rx="3.5" className="s-tab"/>
      <rect x="8" y="36" width="84" height="50" rx="4" className="s-row"/>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><rect x="8" y={45 + i * 9} width="84" height=".6" className="s-muted"/><rect x="12" y={39 + i * 9} width="12" height="3" rx="1" className="s-ink"/><rect x="78" y={39 + i * 9} width="10" height="3" rx="1.5" className="s-accent"/></g>)}
    </>}
    {id === 'editorial' && <>
      <rect x="8" y="6" width="84" height=".8" className="s-ink"/><rect x="8" y="8" width="84" height=".8" className="s-ink"/>
      <rect x="8" y="14" width="30" height="2" rx="1" className="s-muted"/>
      <rect x="8" y="21" width="44" height="7" rx="1" className="s-ink"/><rect x="8" y="31" width="36" height="7" rx="1" className="s-ink"/>
      <rect x="8" y="42" width="30" height="5" rx="2.5" className="s-accent"/>
      <rect x="58" y="19" width="34" height="34" rx="1" className="s-img"/><rect x="58" y="56" width="20" height="2" rx="1" className="s-muted"/>
      {[0, 1, 2].map(i => <g key={i}><rect x="8" y={64 + i * 9} width="84" height=".6" className="s-muted"/><rect x="8" y={67 + i * 9} width="4" height="2" rx="1" className="s-muted"/><rect x="16" y={66 + i * 9} width="14" height="4" rx="1" className="s-ink"/><rect x="80" y={66 + i * 9} width="12" height="4" rx="1" className="s-ink"/></g>)}
    </>}
    {id === 'signature' && <>
      <path d="M36 30 V18 a14 14 0 0 1 28 0 V30 Z" className="s-img"/>
      <rect x="8" y="30" width="84" height="32" rx="6" className="s-accent"/>
      <rect x="14" y="35" width="10" height="10" rx="3" className="s-on-accent"/>
      <rect x="14" y="48" width="48" height="5" rx="1.5" className="s-on-accent"/><rect x="14" y="55" width="22" height="3" rx="1.5" className="s-on-accent" opacity=".6"/>
      {[0, 1].map(i => <g key={i}><rect x="8" y={67 + i * 12} width="84" height="10" rx="2" className="s-row"/><circle cx="8" cy={72 + i * 12} r="2" className="s-bg"/><circle cx="92" cy={72 + i * 12} r="2" className="s-bg"/><rect x="70" y={68 + i * 12} width=".6" height="8" className="s-muted"/></g>)}
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
