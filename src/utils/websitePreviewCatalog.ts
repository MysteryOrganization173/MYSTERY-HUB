/** Public-shaped catalogue projection for a nontransactional owner frame. Never pass the owner
 * response itself: it includes wholesale prices, policy and other private business information. */
export interface WebsitePreviewProduct {id:string;network:string;networkName:string;dataAmount:string;validity:string;description:string;retailMinor:number}
export function websitePreviewCatalog(value:unknown,ownerResponse=false):WebsitePreviewProduct[] {
  if(!Array.isArray(value))return [];
  return value.filter(p=>p&&typeof p==='object'&&(!ownerResponse||p.eligible===true)&&typeof p.id==='string'&&['mtn','telecel','airteltigo'].includes(p.network)&&typeof p.dataAmount==='string'&&Number.isSafeInteger(p.retailMinor)&&p.retailMinor>0)
    .slice(0,200).map(p=>({id:p.id,network:p.network,networkName:typeof p.networkName==='string'?p.networkName:'',dataAmount:p.dataAmount,validity:typeof p.validity==='string'?p.validity:'',description:typeof p.description==='string'?p.description:'',retailMinor:p.retailMinor}));
}
