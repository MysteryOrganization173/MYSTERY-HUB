import {getPool} from './connection.js';
import {WebsiteStore} from './websiteStore.js';
import {WebsiteAssetStore} from './websiteAssetStore.js';
import {AuthStore} from './authStore.js';
import {WebsiteOperationError} from '../services/websiteCloudinary.js';
import {isValidTemplateId} from '../types/website.js';
import type {AdminWebsiteRow,AdminWebsiteInspection,WebsiteAdminSummary} from '../../src/config/websiteAnalytics.js';

const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value.trim():null;
const iso=(value:Date|string)=>new Date(value).toISOString();
function project(row:any):AdminWebsiteRow {
  return {id:row.id,name:row.name,businessName:text(row.businessName)??'',slug:row.slug,user_id:row.user_id,ownerName:text(row.ownerName)??'Not provided',template_id:row.template_id,status:row.status,created_at:iso(row.created_at),updated_at:iso(row.updated_at),published_at:row.published_at?iso(row.published_at):null,assetCount:Number(row.assetCount)||0,publicUrl:row.status==='published'?`/sites/${encodeURIComponent(row.slug)}`:null};
}
export function validateAdminWebsiteId(id:string){if(!/^site_[a-zA-Z0-9_-]{1,59}$/.test(id))throw new WebsiteOperationError('Invalid website ID.');}
export function adminWebsiteFilters(query:Record<string,unknown>){
  if(Object.keys(query).some(k=>!['range','status','template','search','limit','offset'].includes(k))||['range','status','template','search'].some(k=>query[k]!==undefined&&typeof query[k]!=='string')||['limit','offset'].some(k=>query[k]!==undefined&&!['string','number'].includes(typeof query[k])))throw new WebsiteOperationError('Invalid website filters.');
  const range=String(query.range||'30'),status=String(query.status||''),template=String(query.template||''),search=String(query.search||'').trim();
  const limit=Number(query.limit??25),offset=Number(query.offset??0);
  if(!['7','30','90','all'].includes(range)||!['','draft','published'].includes(status)||(template&&!isValidTemplateId(template))||search.length>100||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)throw new WebsiteOperationError('Invalid website filters.');
  return {range,status,template,search,limit,offset,since:range==='all'?null:new Date(Date.now()-Number(range)*86400_000).toISOString()};
}
type ProjectReport=Pick<WebsiteAdminSummary,'sites'|'total'|'limit'|'offset'|'metrics'|'recentCreated'|'recentPublished'> & {
  templateProjects:Array<{templateId:string;projects:number;published:number}>;
  assetMetrics:{tracked:number;ready:number;cleanupPending:number};
};
const columns=`s.id,s.name,s.slug,s.user_id,s.template_id,s.status,s.created_at,s.updated_at,s.published_at,
 CASE WHEN jsonb_typeof(s.content_json->'businessName')='string' THEN s.content_json->>'businessName' ELSE '' END AS "businessName",u.name AS "ownerName"`;

/** Admin-only read projections. Never add these contact joins to public/owner site serializers. */
export class AdminWebsiteStore {
  static async inspect(id:string):Promise<AdminWebsiteInspection>{
    validateAdminWebsiteId(id);const db=getPool();let row:any;
    if(db){row=(await db.query(`SELECT ${columns},u.email AS "ownerEmail",u.phone AS "ownerPhone",
      CASE WHEN jsonb_typeof(s.content_json->'phone')='string' THEN s.content_json->>'phone' END AS "businessPhone",
      CASE WHEN jsonb_typeof(s.content_json->'whatsapp')='string' THEN s.content_json->>'whatsapp' END AS "businessWhatsapp",
      CASE WHEN jsonb_typeof(s.content_json->'email')='string' THEN s.content_json->>'email' END AS "businessEmail",
      (SELECT count(*) FROM website_assets a WHERE a.website_id=s.id AND a.status='ready') AS "assetCount"
      FROM website_sites s LEFT JOIN users u ON u.id=s.user_id WHERE s.id=$1`,[id])).rows[0];}
    else{
      const site=await WebsiteStore.findSiteRecordById(id);
      if(site){const owner=await AuthStore.findUserById(site.user_id),assets=await WebsiteAssetStore.forSite(id);
        row={...site,businessName:site.content_json.businessName,ownerName:owner?.name,ownerEmail:owner?.email,ownerPhone:owner?.phone,businessPhone:site.content_json.phone,businessWhatsapp:site.content_json.whatsapp,businessEmail:site.content_json.email,assetCount:assets.filter(a=>a.status==='ready').length};}
    }
    if(!row)throw new WebsiteOperationError('Website not found.',404);
    return {...project(row),owner:{name:text(row.ownerName),email:text(row.ownerEmail),phone:text(row.ownerPhone)},businessContact:{phone:text(row.businessPhone),whatsapp:text(row.businessWhatsapp),email:text(row.businessEmail)}};
  }
  static async projects(query:Record<string,unknown>,f=adminWebsiteFilters(query)):Promise<ProjectReport>{
    const db=getPool(),now=new Date();
    if(db){
      const pattern=f.search?`%${f.search.replace(/[\\%_]/g,'\\$&')}%`:'';
      const raw=(await db.query(`WITH assets AS (SELECT website_id,status,expires_at FROM website_assets),
        projects AS (SELECT ${columns},COALESCE(a.ready,0)::int AS "assetCount" FROM website_sites s LEFT JOIN users u ON u.id=s.user_id
          LEFT JOIN (SELECT website_id,count(*) FILTER(WHERE status='ready') AS ready FROM assets GROUP BY website_id) a ON a.website_id=s.id WHERE s.status<>'archived'),
        period AS (SELECT * FROM projects WHERE ($1::timestamptz IS NULL OR created_at >= $1)),
        filtered AS (SELECT * FROM period WHERE ($2='' OR status=$2) AND ($3='' OR template_id=$3) AND
          ($4='' OR name ILIKE $4 OR "businessName" ILIKE $4 OR COALESCE("ownerName",'') ILIKE $4 OR id ILIKE $4 OR slug ILIKE $4))
        SELECT jsonb_build_object(
          'sites',(SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]') FROM (SELECT * FROM filtered ORDER BY created_at DESC,id LIMIT $5 OFFSET $6) p),
          'total',(SELECT count(*) FROM filtered),'limit',$5::int,'offset',$6::int,
          'metrics',(SELECT jsonb_build_object('total',count(*),'draft',count(*) FILTER(WHERE status='draft'),'published',count(*) FILTER(WHERE status='published'),'free',count(*)) FROM period),
          'recentCreated',(SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]') FROM (SELECT * FROM period ORDER BY created_at DESC,id LIMIT 5) p),
          'recentPublished',(SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]') FROM (SELECT * FROM projects WHERE status='published' AND published_at IS NOT NULL AND ($1::timestamptz IS NULL OR published_at >= $1) ORDER BY published_at DESC,id LIMIT 5) p),
          'templateProjects',(SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT template_id AS "templateId",count(*) FILTER(WHERE $1::timestamptz IS NULL OR created_at >= $1) AS projects,count(*) FILTER(WHERE status='published' AND ($1::timestamptz IS NULL OR created_at >= $1)) AS published FROM projects GROUP BY template_id) t),
          'assetMetrics',(SELECT jsonb_build_object('tracked',count(*),'ready',count(*) FILTER(WHERE status='ready'),'cleanupPending',count(*) FILTER(WHERE status IN ('deleting','failed') OR status='pending' AND expires_at<$7)) FROM assets)
        ) AS report`,[f.since,f.status,f.template,pattern,f.limit,f.offset,now])).rows[0].report;
      return {...raw,sites:raw.sites.map(project),recentCreated:raw.recentCreated.map(project),recentPublished:raw.recentPublished.map(project)};
    }
    const [sites,assets]=await Promise.all([WebsiteStore.allSites(),WebsiteAssetStore.all()]);
    const owners=new Map(AuthStore.adminDevUsers().map(u=>[u.id,u.name]));
    const rows=sites.map(s=>project({...s,businessName:s.content_json.businessName,ownerName:owners.get(s.user_id),assetCount:assets.filter(a=>a.website_id===s.id&&a.status==='ready').length}));
    const period=rows.filter(r=>!f.since||r.created_at>=f.since);
    const sorted=(a:AdminWebsiteRow,b:AdminWebsiteRow)=>b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id);
    const filtered=period.filter(r=>(!f.status||r.status===f.status)&&(!f.template||r.template_id===f.template)&&(!f.search||[r.name,r.businessName,r.ownerName,r.id,r.slug].some(v=>v.toLowerCase().includes(f.search.toLowerCase())))).sort(sorted);
    return {sites:filtered.slice(f.offset,f.offset+f.limit),total:filtered.length,limit:f.limit,offset:f.offset,
      metrics:{total:period.length,draft:period.filter(s=>s.status==='draft').length,published:period.filter(s=>s.status==='published').length,free:period.length},
      recentCreated:[...period].sort(sorted).slice(0,5),recentPublished:rows.filter(r=>r.status==='published'&&r.published_at&&(!f.since||r.published_at>=f.since)).sort((a,b)=>b.published_at!.localeCompare(a.published_at!)||a.id.localeCompare(b.id)).slice(0,5),
      templateProjects:[...new Set(rows.map(r=>r.template_id))].map(templateId=>({templateId,projects:period.filter(r=>r.template_id===templateId).length,published:period.filter(r=>r.template_id===templateId&&r.status==='published').length})),
      assetMetrics:{tracked:assets.length,ready:assets.filter(a=>a.status==='ready').length,cleanupPending:assets.filter(a=>['deleting','failed'].includes(a.status)||a.status==='pending'&&now.getTime()>Date.parse(a.expires_at)).length}};
  }
}
