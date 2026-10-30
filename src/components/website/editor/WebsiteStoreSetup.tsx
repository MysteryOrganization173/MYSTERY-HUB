import React, {useEffect, useRef, useState} from 'react';
import {Check, ChevronDown, CircleAlert, LayoutDashboard, Store} from 'lucide-react';
import {resellerStoreStatus, type ResellerCatalogueSummary} from '../../../utils/websiteOwnerAttention';

type StepState = 'done' | 'todo' | 'blocked' | 'checking' | 'info';
interface Step {id: 'brand' | 'bundles' | 'publish' | 'business'; title: string; detail: string; state: StepState; action?: {label: string; run: () => void}}

/**
 * Builder V6: a Data Store's way from design to selling, inside the editor. One slim line says what is next; it
 * opens to the four steps (name & look, bundles & prices, publish, run the business in My Business). Every state
 * comes from the store status My Business uses (`resellerStoreStatus`), built from the owner catalogue the
 * editor already loads. It never blocks editing and never claims customers can buy unless the server agrees.
 */
export function WebsiteStoreSetup({businessName, published, liveChanges, catalogue, onBrand, onBundles, onPublish, onBusiness}: {
  businessName: string; published: boolean; liveChanges: boolean; catalogue: ResellerCatalogueSummary | null;
  onBrand: () => void; onBundles: () => void; onPublish: () => void; onBusiness?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const status = resellerStoreStatus({published, catalogue});
  const bundleStep: Step = !catalogue ? {id: 'bundles', title: 'Bundles & prices', detail: 'Checking your bundles…', state: 'checking'}
    : status?.tone === 'blocked' ? {id: 'bundles', title: status.title, detail: status.detail, state: 'blocked'}
    : catalogue.sellable ? {id: 'bundles', title: 'Bundles & prices', detail: `${catalogue.sellable === 1 ? '1 bundle' : `${catalogue.sellable} bundles`} on sale at your prices`, state: 'done', action: {label: 'Edit prices', run: onBundles}}
    : {id: 'bundles', title: 'Bundles & prices', detail: catalogue.ownerOnSale ? 'None of the bundles you switched on can be sold right now.' : 'None on sale yet. Pick networks and add your profit.', state: 'todo', action: {label: 'Set up', run: onBundles}};
  const steps: Step[] = [
    {id: 'brand', title: 'Name & look', detail: businessName.trim() || 'Add your store name', state: businessName.trim() ? 'done' : 'todo', action: {label: 'Colours', run: onBrand}},
    bundleStep,
    published
      ? {id: 'publish', title: 'Published', detail: liveChanges ? 'Your newer edits are saved but not live yet.' : 'Your store link works for customers.', state: liveChanges ? 'todo' : 'done', action: liveChanges ? {label: 'Update', run: onPublish} : undefined}
      : {id: 'publish', title: 'Publish', detail: 'Not published yet. Customers can’t open your store.', state: 'todo', action: {label: 'Publish', run: onPublish}},
    {id: 'business', title: 'Orders & earnings', detail: published ? 'Orders, Store Earnings and analytics are in My Business.' : 'Once you publish, orders and Store Earnings appear in My Business.', state: 'info', action: onBusiness ? {label: 'Open', run: onBusiness} : undefined},
  ];
  const counted = steps.filter(step => step.id !== 'business');
  const done = counted.filter(step => step.state === 'done').length;
  const next = counted.find(step => step.state === 'todo' && step.action);
  const ready = status?.state === 'open' && !liveChanges;
  const blocked = status?.tone === 'blocked';
  const summary = ready ? status!.title : blocked ? status!.label : `Store setup · ${done} of ${counted.length} done`;
  // Phones keep the line on one row next to the next step's button.
  const short = ready ? 'Customers can buy' : blocked ? status!.label : `Setup · ${done} of ${counted.length}`;

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {if (!box.current?.contains(event.target as Node)) setOpen(false);};
    const key = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.stopPropagation(); setOpen(false); toggle.current?.focus();}};
    // A tap on the website canvas lands in its iframe, which the page only notices as the window losing focus.
    const blur = () => setOpen(false);
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key); window.addEventListener('blur', blur);
    return () => {document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); window.removeEventListener('blur', blur);};
  }, [open]);
  const run = (action: () => void) => () => {setOpen(false); action();};

  return <div ref={box} className="visual-setup" data-store-setup={ready ? 'ready' : blocked ? 'blocked' : 'setup'}>
    <div className="visual-setup-bar">
      <button ref={toggle} type="button" className="visual-setup-toggle" aria-expanded={open} aria-controls="visual-setup-steps" onClick={() => setOpen(value => !value)}>
        <span className="visual-setup-icon" aria-hidden="true">{ready ? <Check size={16}/> : blocked ? <CircleAlert size={16}/> : <Store size={16}/>}</span>
        <span className="visual-setup-summary"><span className="visual-setup-long">{summary}</span><span className="visual-setup-short" aria-hidden="true">{short}</span></span>
        <ChevronDown size={16} aria-hidden="true" className="visual-setup-chevron"/>
      </button>
      {next?.action && !open && <button type="button" className="visual-setup-next" onClick={next.action.run}>{next.id === 'bundles' ? 'Set up bundles' : next.action.label}</button>}
      {ready && onBusiness && !open && <button type="button" className="visual-setup-next" data-quiet onClick={onBusiness}><LayoutDashboard size={15} aria-hidden="true"/>My Business</button>}
    </div>
    {open && <ol id="visual-setup-steps" className="visual-setup-steps" aria-label="Store setup steps">
      {steps.map(step => <li key={step.id} data-state={step.state}>
        <span className="visual-setup-mark" aria-hidden="true">{step.state === 'done' ? <Check size={14}/> : step.state === 'blocked' ? <CircleAlert size={14}/> : step.id === 'business' ? <LayoutDashboard size={14}/> : null}</span>
        <div className="min-w-0 flex-1"><strong>{step.title}</strong><p>{step.detail}</p></div>
        {step.action && <button type="button" onClick={run(step.action.run)}>{step.action.label}</button>}
      </li>)}
    </ol>}
  </div>;
}
