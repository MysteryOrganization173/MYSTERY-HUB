import {BUSINESS_CONFIG} from '../config/business';

/** Formatting only: a usable link does not verify that a WhatsApp account exists. */
export function adminWhatsAppUrl(value:string|null|undefined):string|null {
  let number=(value||'').trim().replace(/[\s()-]/g,'');
  if(number.startsWith('00'))number='+'+number.slice(2);
  let digits:string;
  if(/^0[235]\d{8}$/.test(number))digits='233'+number.slice(1);
  else if(/^[235]\d{8}$/.test(number))digits='233'+number;
  else if(/^\+?233[235]\d{8}$/.test(number))digits=number.replace(/^\+/,'');
  else if(!number.startsWith('+233')&&/^\+[1-9]\d{9,14}$/.test(number))digits=number.slice(1);
  else return null;
  return `https://wa.me/${digits}`;
}
export function adminMailtoUrl(value:string|null|undefined):string|null {
  const email=(value||'').trim();
  return email.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?`mailto:${encodeURIComponent(email)}`:null;
}
export function adminPublishedWebsiteUrl(site:{status:string;slug:string;publicUrl:string|null}):string|null {
  return site.status==='published'&&site.publicUrl&&site.slug?`https://${BUSINESS_CONFIG.domain}/sites/${encodeURIComponent(site.slug)}`:null;
}
