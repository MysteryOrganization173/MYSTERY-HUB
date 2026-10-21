import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { TemplateItem } from '../../../types';
import { SafeImage } from '../SafeImage.js';
import { focalPosition } from '../../../config/websiteContentV5';
import { formatGhs } from '../../../../shared/money';
import { addOrderLine, orderCount, orderMessage, orderTotalMinor, setOrderQuantity, whatsappOrderUrl, type OrderLine } from '../../../utils/websiteOrderList';

/**
 * Shared by Boutique and Night Kitchen. Each design sets the look through CSS variables on an ancestor:
 * --ol-bg, --ol-text, --ol-muted, --ol-line, --ol-accent, --ol-on-accent, --ol-radius, --ol-font.
 * Nothing here takes payment: the buyer sends a WhatsApp message and the business confirms.
 */
export const ORDER_LIST_CSS = `
.ol-sheet{margin:auto auto 0;width:100%;max-width:520px;max-height:92svh;border:0;padding:0;border-radius:var(--ol-radius,18px) var(--ol-radius,18px) 0 0;background:var(--ol-bg,#fff);color:var(--ol-text,#111);overflow:hidden}
.ol-sheet::backdrop{background:rgba(0,0,0,.55)}
@media (min-width:900px){.ol-sheet{margin:0 0 0 auto;height:100svh;max-height:100svh;border-radius:0}}
.ol-sheet-inner{display:flex;flex-direction:column;max-height:inherit;height:100%}
.ol-sheet-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--ol-line,#e5e5e5)}
.ol-sheet-head h2{flex:1;min-width:0;font-size:18px;line-height:1.25;margin:0}
.ol-close{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid var(--ol-line,#e5e5e5);background:transparent;color:inherit}
.ol-sheet-body{overflow:auto;padding:16px;display:flex;flex-direction:column;gap:14px;flex:1}
.ol-sheet-foot{padding:12px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--ol-line,#e5e5e5);display:grid;gap:8px}
.ol-photos{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:0 16px;scrollbar-width:none}
.ol-photos>*{flex:0 0 86%;scroll-snap-align:center;aspect-ratio:4/5;border-radius:calc(var(--ol-radius,18px) * .6)}
.ol-photos.single>*{flex-basis:100%;aspect-ratio:4/3}
.ol-price{font-weight:700;font-size:17px}
.ol-muted{color:var(--ol-muted,#666);font-size:14px;line-height:1.55}
.ol-label{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border:1px solid currentColor;border-radius:999px;color:var(--ol-accent,#111)}
.ol-options{display:flex;flex-wrap:wrap;gap:8px}
.ol-option{min-height:44px;padding:0 14px;border:1px solid var(--ol-line,#ddd);border-radius:calc(var(--ol-radius,18px) * .5);background:transparent;color:inherit;font-weight:600;font-size:14px}
.ol-option[aria-pressed=true]{border-color:var(--ol-text,#111);box-shadow:inset 0 0 0 1px var(--ol-text,#111)}
.ol-primary,.ol-secondary{min-height:50px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:calc(var(--ol-radius,18px) * .6);font-weight:700;font-size:15px;text-align:center;padding:0 16px;text-decoration:none}
.ol-primary{background:#25D366;color:#062b16;border:0}
.ol-secondary{background:transparent;color:inherit;border:1px solid var(--ol-text,#111)}
.ol-preview{white-space:pre-wrap;font-size:13px;line-height:1.5;padding:12px;border-radius:calc(var(--ol-radius,18px) * .5);background:color-mix(in srgb,#25D366 12%,var(--ol-bg,#fff));border:1px solid color-mix(in srgb,#25D366 30%,transparent);overflow-wrap:anywhere}
.ol-lines{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.ol-line{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--ol-line,#eee)}
.ol-line-name{flex:1;min-width:0;font-weight:600;font-size:15px;overflow-wrap:anywhere}
.ol-qty{display:inline-flex;align-items:center;gap:4px}
.ol-qty button{width:40px;height:40px;border-radius:999px;border:1px solid var(--ol-line,#ddd);background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center}
.ol-qty span{min-width:24px;text-align:center;font-weight:700}
.ol-bar{position:sticky;bottom:0;z-index:40;padding:10px 12px calc(10px + env(safe-area-inset-bottom));pointer-events:none}
.ol-bar button{pointer-events:auto;width:100%;max-width:640px;margin:0 auto;min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 18px;border:0;border-radius:calc(var(--ol-radius,18px) * .8);background:var(--ol-accent,#111);color:var(--ol-on-accent,#fff);font-weight:700;font-size:15px;box-shadow:0 12px 30px rgba(0,0,0,.35)}
.ol-note{font-size:12px;line-height:1.5;color:var(--ol-muted,#666)}
`;

/** The buyer's list for this visit only. Nothing is stored or sent until they choose WhatsApp. */
export function useOrderList() {
  const [lines, setLines] = useState<OrderLine[]>([]);
  return {
    lines,
    add: (item: TemplateItem, option?: string) => setLines(current => addOrderLine(current, item, option)),
    setQuantity: (key: string, quantity: number) => setLines(current => setOrderQuantity(current, key, quantity)),
    clear: () => setLines([]),
  };
}

function Sheet({ title, onClose, children, foot, label }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) { try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); } } }, []);
  return <dialog ref={ref} className="ol-sheet" aria-label={label} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="ol-sheet-inner">
      <div className="ol-sheet-head"><h2 className="site-display">{title}</h2><button type="button" className="ol-close" aria-label="Close" onClick={onClose}><X size={20} aria-hidden="true" /></button></div>
      <div className="ol-sheet-body">{children}</div>
      {foot && <div className="ol-sheet-foot">{foot}</div>}
    </div>
  </dialog>;
}

interface Contact { businessName: string; whatsapp?: string; link?: string; demo: boolean; onContact?: () => void }

/** Where the buyer is sent: WhatsApp with the message, else the business's contact, never a fake confirmation. */
function SendButton({ contact, message, label }: { contact: Contact; message: string; label: string }) {
  const [notice, setNotice] = useState('');
  const url = whatsappOrderUrl(contact.whatsapp, message);
  if (contact.demo) return <><button type="button" className="ol-primary" onClick={() => setNotice('Example design: on a real website this opens WhatsApp with the message above, addressed to the business.')}>{label}</button>{notice && <p role="status" className="ol-note">{notice}</p>}</>;
  if (url) return <a className="ol-primary" href={url} target="_blank" rel="noopener noreferrer" data-website-event="whatsapp_click">{label}</a>;
  return <><button type="button" className="ol-secondary" onClick={contact.onContact}>Contact the business</button><p className="ol-note">This business has not added a WhatsApp number yet. Copy your order and contact them directly.</p></>;
}

export function ItemDetailSheet({ item, contact, onAdd, onClose, addLabel = 'Add to order list' }: { item: TemplateItem; contact: Contact; onAdd: (item: TemplateItem, option?: string) => void; onClose: () => void; addLabel?: string }) {
  const photos = [item.image, ...(item.images || [])].filter((src): src is string => !!src).slice(0, 3);
  const options = (item.options || []).filter(Boolean);
  const [option, setOption] = useState<string | undefined>(options[0]);
  const [added, setAdded] = useState(false);
  const message = orderMessage(contact.businessName, [{ key: '', itemId: item.id || item.name, name: item.name, option, price: item.price, quantity: 1 }], contact.link);
  return <Sheet label={item.name} title={item.name} onClose={onClose} foot={<>
    <SendButton contact={contact} message={message} label="Order on WhatsApp" />
    <button type="button" className="ol-secondary" onClick={() => { onAdd(item, option); setAdded(true); }}>{added ? 'Added · add another' : addLabel}</button>
  </>}>
    {photos.length > 0 && <div className={`ol-photos${photos.length === 1 ? ' single' : ''}`} aria-label={photos.length > 1 ? 'Photos, swipe for more' : undefined}>
      {photos.map((src, i) => <SafeImage key={src + i} src={src} alt={i === 0 ? item.alt || item.name : `${item.name}, photo ${i + 1}`} style={i === 0 ? { objectPosition: focalPosition(item.focal) } : undefined} />)}
    </div>}
    <div className="flex flex-wrap items-center gap-2">
      {item.price ? <span className="ol-price">{item.price}</span> : <span className="ol-price">Ask for the price</span>}
      {(item.label || item.tag) && <span className="ol-label">{item.label || item.tag}</span>}
    </div>
    {item.desc && <p className="ol-muted">{item.desc}</p>}
    {options.length > 0 && <div role="group" aria-label="Choose an option" className="ol-options">
      {options.map(o => <button key={o} type="button" className="ol-option" aria-pressed={option === o} onClick={() => setOption(o)}>{o}</button>)}
    </div>}
    <div><p className="ol-note" style={{ marginBottom: 6 }}>Your WhatsApp message</p><p className="ol-preview">{message}</p></div>
    <p className="ol-note">Nothing is paid or reserved here. {contact.demo ? 'The business' : contact.businessName} confirms the price, availability and delivery with you.</p>
  </Sheet>;
}

export function OrderListSheet({ lines, contact, onQuantity, onClear, onClose, noun = 'items' }: { lines: OrderLine[]; contact: Contact; onQuantity: (key: string, quantity: number) => void; onClear: () => void; onClose: () => void; noun?: string }) {
  const message = orderMessage(contact.businessName, lines, contact.link);
  const total = orderTotalMinor(lines);
  return <Sheet label="Your order list" title="Your order list" onClose={onClose} foot={lines.length ? <>
    <SendButton contact={contact} message={message} label="Send order on WhatsApp" />
    <button type="button" className="ol-secondary" onClick={onClear}>Clear the list</button>
  </> : undefined}>
    {!lines.length ? <p className="ol-muted">Your list is empty. Add {noun} to send them in one WhatsApp message.</p> : <>
      <ul className="ol-lines">{lines.map(l => <li key={l.key} className="ol-line">
        <div className="ol-line-name">{l.name}{l.option && <span className="ol-muted"> · {l.option}</span>}<div className="ol-muted">{l.price || 'Ask for the price'}</div></div>
        <div className="ol-qty">
          <button type="button" aria-label={`One less ${l.name}`} onClick={() => onQuantity(l.key, l.quantity - 1)}><Minus size={16} aria-hidden="true" /></button>
          <span aria-live="polite">{l.quantity}</span>
          <button type="button" aria-label={`One more ${l.name}`} onClick={() => onQuantity(l.key, l.quantity + 1)}><Plus size={16} aria-hidden="true" /></button>
        </div>
      </li>)}</ul>
      {total !== null ? <p className="ol-price">At the listed prices: {formatGhs(total)}</p> : <p className="ol-muted">Some prices are to be confirmed by the business.</p>}
      <div><p className="ol-note" style={{ marginBottom: 6 }}>Your WhatsApp message</p><p className="ol-preview">{message}</p></div>
      <p className="ol-note">This is a message, not a payment. Delivery, pickup and payment are agreed with the business.</p>
    </>}
  </Sheet>;
}

/** Pinned to the bottom once something is on the list. */
export function OrderBar({ lines, onOpen }: { lines: OrderLine[]; onOpen: () => void }) {
  if (!lines.length) return null;
  const count = orderCount(lines), total = orderTotalMinor(lines);
  return <div className="ol-bar"><button type="button" onClick={onOpen} data-order-bar>
    <span>{count} item{count === 1 ? '' : 's'}{total !== null ? ` · ${formatGhs(total)}` : ''}</span>
    <span>Review order →</span>
  </button></div>;
}
