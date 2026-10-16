/** A malformed shared/bookmarked hash must never crash the admin workspace. */
export function decodeAdminHash(hash:string):string[] {
  try {return decodeURIComponent(hash.replace(/^#/, '')).split('/');}
  catch {return ['overview'];}
}
