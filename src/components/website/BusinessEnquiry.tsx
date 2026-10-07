import React from 'react';
/** Published templates offer contact, never simulate a reservation or a submitted form. */
export function BusinessEnquiry({onContact}:{onContact?:()=>void}) {
  return <div className="space-y-4 text-sm">
    <p>Contact the business to discuss availability and your requirements. Any booking or payment must be confirmed directly with them.</p>
    <button type="button" onClick={onContact} className="min-h-11 rounded-xl border border-current px-5 py-3 font-semibold">Contact the business</button>
  </div>;
}
