/** Labels for known activity codes. Unknown events remain visible without exposing raw snake-case. */
export function customerActivityLabel(code:string):string {
  const labels:Record<string,string>={site_view:'Website visited',product_view:'Bundle viewed',checkout_started:'Checkout started',whatsapp_click:'WhatsApp opened',call_click:'Call button used',email_click:'Email button used',primary_cta_click:'Main button used',store_sale:'Store sale',store_checkout:'Store checkout',withdrawal:'Withdrawal',pending_review:'Awaiting review',manual_review:'Under review',pending_payment:'Awaiting payment',initializing:'Starting payment',initialization_uncertain:'Payment needs checking',available:'Available',paid:'Paid',completed:'Completed',credited:'Added to Wallet',approved:'Approved',rejected:'Declined',reversal_review:'Reversal under review',reserved:'Reserved',withdrawn:'Withdrawn'};
  return labels[code] || code.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
}
