import {randomUUID} from 'node:crypto';
import type {SiteContent,SiteSettings,WebsiteSiteRecord} from '../types/website.js';
import {websiteDatabase} from './websiteTransaction.js';
import {WebsiteOperationError} from '../services/websiteCloudinary.js';
export const WEBSITE_CHECKPOINT_LIMIT=10;
export interface WebsiteDraftCheckpoint {
  id:string; site_id:string; user_id:string; template_id:string; source_revision:string;
  reason:'template_change'|'layout_change'|'draft_restore'; created_at:string;
  document:{name:string;content:SiteContent;settings:SiteSettings};
}
const memory=new Map<string,WebsiteDraftCheckpoint>();
/** Call mutations only inside the owner's existing website transaction lock. */
export class WebsiteCheckpointStore {
  static clearDevStore(){memory.clear();}
  static async forSite(siteId:string,userId:string):Promise<WebsiteDraftCheckpoint[]> {
    const db=websiteDatabase();
    if(!db)return [...memory.values()].filter(c=>c.site_id===siteId&&c.user_id===userId).map(c=>structuredClone(c)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    return (await db.query('SELECT * FROM mysteryhub_builder_private.website_draft_checkpoints WHERE site_id=$1 AND user_id=$2 ORDER BY created_at DESC,id DESC',[siteId,userId])).rows.map(c=>({...c,created_at:new Date(c.created_at).toISOString()}));
  }
  static async capture<T>(site:WebsiteSiteRecord,reason:WebsiteDraftCheckpoint['reason'],action:()=>Promise<T>):Promise<T> {
    if((await this.forSite(site.id,site.user_id)).length>=WEBSITE_CHECKPOINT_LIMIT)throw new WebsiteOperationError('Draft recovery history is full. Review saved checkpoints before another design change. No content was changed.',409);
    const row:WebsiteDraftCheckpoint={id:randomUUID(),site_id:site.id,user_id:site.user_id,template_id:site.template_id,source_revision:site.updated_at,reason,created_at:new Date().toISOString(),document:structuredClone({name:site.name,content:site.content_json,settings:site.settings_json})};
    if(Buffer.byteLength(JSON.stringify(row.document),'utf8')>500000)throw new WebsiteOperationError('This draft exceeds the recovery size limit. No content was changed.',409);
    const db=websiteDatabase();
    if(db)await db.query('INSERT INTO mysteryhub_builder_private.website_draft_checkpoints(id,site_id,user_id,template_id,source_revision,reason,document) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[row.id,row.site_id,row.user_id,row.template_id,row.source_revision,reason,JSON.stringify(row.document)]);
    else memory.set(row.id,row);
    try{return await action();}catch(error){if(!db)memory.delete(row.id);throw error;}
  }
  static async discard(siteId:string,userId:string,id:string) {
    const db=websiteDatabase();
    if(db)await db.query('DELETE FROM mysteryhub_builder_private.website_draft_checkpoints WHERE id=$1 AND site_id=$2 AND user_id=$3',[id,siteId,userId]);
    else if(memory.get(id)?.site_id===siteId&&memory.get(id)?.user_id===userId)memory.delete(id);
  }
}
