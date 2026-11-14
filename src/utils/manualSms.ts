/** Preparation only. GSM7 extension characters cost two septets; UCS2 uses UTF16 units. */
const BASIC=new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const EXTENDED=new Set(Array.from('^{}\\[~]|€\f'));
export function smsEstimate(message:string){
 const chars=Array.from(message);const gsm=chars.every(c=>BASIC.has(c)||EXTENDED.has(c));const units=gsm?chars.reduce((n,c)=>n+(EXTENDED.has(c)?2:1),0):message.length;
 const single=gsm?160:70,multi=gsm?153:67;
 let segments=units===0?0:1;
 if(units>single){let used=0;for(const c of chars){const width=gsm?(EXTENDED.has(c)?2:1):c.length;if(used+width>multi){segments++;used=0;}used+=width;}}
 return {characters:chars.length,units,encoding:gsm?'GSM-7':'Unicode',segments};
}
export function channelDestination(value:string):string|null {
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='whatsapp.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/channel\/[A-Za-z0-9]{10,100}$/.test(u.pathname)?u.href:null;}catch{return null;}
}
export function smsLink(phone:string,message:string){return `sms:${phone}?body=${encodeURIComponent(message)}`;}
export function manualSmsTemplate(kind:'support'|'return'|'channel',origin:string,channel?:string){
 if(kind==='channel'){const destination=channelDestination(channel||'');return destination?`Mystery Hub has a new official WhatsApp channel for service updates and announcements. Join here: ${destination}. Thank you for staying with us.`:'';}
 return kind==='support'?`Mystery Hub Update: Our previous WhatsApp support accounts are unavailable. Visit ${origin}/help for our latest support contacts and updates. Thank you for your patience.`:`Hello! It's been a while since your last Mystery Hub purchase. You can still order data and other digital services at ${origin}. Thank you for choosing Mystery Hub.`;
}
