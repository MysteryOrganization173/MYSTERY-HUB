import React, {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {WebsiteBundlePricing} from '../WebsiteBundlePricing';
import '../websiteBuilder.css';

/**
 * Bundles & pricing inside the editor: the real bundle workspace in a sheet over the canvas, so a Data
 * store owner never leaves the editor (or passes through All Settings) to choose what to sell.
 */
export function WebsiteBundleSetupSheet({siteId, token, published, onSaved, onClose}: {siteId: string; token: string; published: boolean; onSaved: (sellable: number) => void; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {dialog.current?.showModal();}, []);
  const close = () => {if (!dirty || window.confirm('You have unsaved bundle changes. Close without saving them?')) onClose();};
  return <dialog ref={dialog} aria-labelledby="website-bundles-title" onCancel={event => {event.preventDefault(); close();}} className="website-sheet website-bundles-sheet" data-website-bundle-sheet>
    <div className="website-sheet-head">
      <div className="min-w-0 flex-1"><h2 id="website-bundles-title">Bundles &amp; prices</h2><p>Choose what customers can buy on your store.</p></div>
      <button type="button" onClick={close} aria-label="Close" className="website-sheet-close"><X size={20}/></button>
    </div>
    <div className="website-sheet-body">
      <WebsiteBundlePricing siteId={siteId} token={token} published={published} variant="sheet" onDirty={setDirty} onSaved={onSaved}/>
    </div>
  </dialog>;
}
