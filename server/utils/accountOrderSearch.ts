import { canonicalGhanaPhone } from './phone.js';

export interface OwnedOrderSearch {
  phone: string | null;
  reference: string | null;
  limit: number;
  before: { createdAt: string; id: string } | null;
}
export class OrderSearchError extends Error {}
export function parseOwnedOrderSearch(query: Record<string, unknown>): OwnedOrderSearch {
  const text=(name:string,max:number):string|null=>{const value=query[name];if(value===undefined)return null;if(typeof value!=='string'||value.length>max)throw new OrderSearchError('Check your search and try again.');return value;};
  const rawPhone=text('phone',64),reference=text('reference',128),rawLimit=text('limit',3),cursor=text('cursor',512);
  const phone=rawPhone===null?null:canonicalGhanaPhone(rawPhone);
  if(rawPhone!==null&&!phone||reference!==null&&!/^[a-zA-Z0-9_-]{1,128}$/.test(reference)||phone&&reference)throw new OrderSearchError('Enter a Ghana phone number or an order reference.');
  const limit=rawLimit===null?20:Number(rawLimit);
  if(!rawLimit&&rawLimit!==null||!Number.isInteger(limit)||limit<1||limit>50)throw new OrderSearchError('Page size must be between 1 and 50.');
  let before:OwnedOrderSearch['before']=null;
  if(cursor) {
    try {
      if(!/^[a-zA-Z0-9_-]+$/.test(cursor))throw Error();
      const value:unknown=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
      if(!value||typeof value!=='object'||!('createdAt' in value)||!('id' in value)||typeof value.createdAt!=='string'||typeof value.id!=='string'||!value.id||value.id.length>128||!/^\d{4}-\d{2}-\d{2}T/.test(value.createdAt)||!Number.isFinite(Date.parse(value.createdAt)))throw Error();
      before={createdAt:new Date(value.createdAt).toISOString(),id:value.id};
    } catch{throw new OrderSearchError('Refresh your orders and try again.');}
  }
  return {phone,reference,limit,before};
}
export function ownedOrderCursor(order:{created_at:string;id:string}):string {
  return Buffer.from(JSON.stringify({createdAt:new Date(order.created_at).toISOString(),id:order.id})).toString('base64url');
}
