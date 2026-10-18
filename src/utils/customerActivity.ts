/** Labels for known activity codes. Unknown events remain visible without exposing raw snake-case. */
export function customerActivityLabel(code:string):string {
  const labels:Record<string,string>={site_view:'Website visited',product_view:'Bundle viewed',checkout_started:'Checkout started',whatsapp_click:'WhatsApp opened',call_click:'Call button used',email_click:'Email button used',primary_cta_click:'Main button used',store_sale:'Store sale',store_checkout:'Store checkout',withdrawal:'Withdrawal',pending_review:'Awaiting review',manual_review:'Under review',pending_payment:'Awaiting payment',initializing:'Starting payment',initialization_uncertain:'Payment needs checking',available:'Available',paid:'Paid',completed:'Completed',credited:'Added to Wallet',approved:'Approved',rejected:'Declined',reversal_review:'Reversal under review',reserved:'Reserved',withdrawn:'Withdrawn',website_editor_opened:'You opened the editor',website_template_previewed:'You previewed a design',website_build_started:'You started building',website_builder_viewed:'You visited the Website Builder'};
  return labels[code] || code.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
}

/** Collapses consecutive identical activity labels; input is newest first, so each row keeps its latest time. */
export function activityDigest(entries:Array<{label:string;at:string}>) {
  const rows:Array<{label:string;at:string;count:number}>=[];
  for(const entry of entries){const last=rows[rows.length-1];if(last&&last.label===entry.label)last.count++;else rows.push({...entry,count:1});}
  return rows;
}

/** The owner's own builder actions. They stay in the full history but are not customer or business activity. */
export const OWNER_ACTIVITY_EVENTS = new Set(['website_editor_opened','website_template_previewed','website_build_started','website_builder_viewed']);
export const isOwnerActivity = (code:string) => OWNER_ACTIVITY_EVENTS.has(code);
