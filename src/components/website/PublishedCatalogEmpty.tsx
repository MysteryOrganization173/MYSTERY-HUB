import React from 'react';

export function PublishedCatalogEmpty({onContact}: {onContact?:()=>void}) {
  return <div className="col-span-full rounded-xl border border-current/15 p-6 text-center space-y-3">
    <p className="text-sm leading-relaxed">Details have not been published here yet. Contact the business for current options and availability.</p>
    {onContact && <button type="button" onClick={onContact} className="min-h-11 px-5 py-2 rounded-lg border border-current/30 text-sm font-semibold">Ask the business</button>}
  </div>;
}
