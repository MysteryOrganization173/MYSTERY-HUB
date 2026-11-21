#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export const SUPABASE_HOST = 'db.fcvydpuuwbciuulrvizk.supabase.co';
export const NEON_HOST = 'ep-nameless-fire-bjc901fm.c-3.eu-west-2.aws.neon.tech';
export const SCOPE = {
  public: `admin_assisted_orders admin_assisted_quotes admin_audit_log admin_giveaway_awards admin_giveaway_rounds admin_guest_buyer_evidence
    afa_registrations analytics_events finance_accounts finance_config finance_ledger finance_operations growth_campaign_links growth_campaign_spend
    growth_campaign_touches growth_campaigns marketplace_assets marketplace_categories marketplace_inquiries marketplace_products order_management_events
    order_resolution_events order_test_fixtures orders referral_attributions referral_clicks referral_profile_suspensions referral_profiles referral_reward_rules
    referral_reward_suppressions reward_ledger sessions supplier_webhook_events users waitlist website_assets website_sites website_ultra_enquiries`,
  mysteryhub_ai_feedback_private: 'reports',
  mysteryhub_ai_private: 'conversations preferences turns',
  mysteryhub_builder_private: 'website_draft_checkpoints',
  mysteryhub_notifications: 'attempts audiences campaigns consents deliveries devices events guest_devices preferences settings template_versions templates',
  mysteryhub_operations: 'checkout_incidents checkout_observations',
  mysteryhub_sms: 'attempts campaigns consents consumed_events delivery_events guest_events messages permission_records previews settings template_versions templates',
};

export class StandbyError extends Error {}
const fail = message => { throw new StandbyError(message); };
export const ident = name => '"' + name.replaceAll('"', '""') + '"';
const qualified = (schema, name) => ident(schema) + '.' + ident(name);

export function databaseConfig(raw, caFile, env) {
  let url;
  try { url = new URL(raw); } catch { fail('Provide both PostgreSQL URLs using the dedicated migration variables.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash ||
    [...url.searchParams.keys()].some(k => !['sslmode', 'channel_binding'].includes(k) || url.searchParams.getAll(k).length !== 1)) {
    fail('Use a direct PostgreSQL URL without host, search path, or service overrides.');
  }
  if (url.searchParams.has('sslmode') && !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))) fail('TLS policy must allow verify-full.');
  if (url.searchParams.has('channel_binding') && url.searchParams.get('channel_binding') !== 'require') fail('Invalid channel binding policy.');
  const host = url.hostname.toLowerCase();
  const database = url.pathname.slice(1);
  const local = env.NODE_ENV === 'test' && env.MYSTERY_STANDBY_TEST === 'true' && host === '127.0.0.1' && /^[a-z0-9_]+_test$/.test(database);
  if ((env.NODE_TEST_CONTEXT || env.NODE_ENV === 'test') && !local) fail('Test processes may only use isolated loopback test databases.');
  if (!local && (url.port && url.port !== '5432' || ![SUPABASE_HOST, NEON_HOST].includes(host))) fail('Only the verified direct Supabase and Neon hosts are allowed.');
  if (!/^[a-z0-9_]{1,63}$/.test(database) || !url.username || (!local && !url.password)) fail('Database name and login are required.');
  if (decodeURIComponent(url.username).includes('\0') || decodeURIComponent(url.password).includes('\0')) fail('Invalid database login.');
  return { host, port:Number(url.port || 5432), database, user:decodeURIComponent(url.username),
    password:decodeURIComponent(url.password), local, caFile, channelBinding:url.searchParams.has('channel_binding') };
}

export function migrationEndpoints(env = process.env, clone = false) {
  const source = databaseConfig(env.MYSTERY_SOURCE_DATABASE_URL, env.MYSTERY_SOURCE_CA_FILE, env);
  const target = databaseConfig(env.MYSTERY_STANDBY_DATABASE_URL, env.MYSTERY_STANDBY_CA_FILE, env);
  if (source.host === target.host && source.port === target.port && source.database === target.database) fail('Source and destination identify the same database.');
  if (source.local && target.local) return { source, target };
  const neonName = /^mysteryhub_(staging|standby_[a-z0-9_]+)$/;
  const supabaseReturn = /^mysteryhub_return_[a-z0-9_]+$/;
  const outbound = source.host === SUPABASE_HOST && (source.database === 'postgres' || supabaseReturn.test(source.database)) &&
    target.host === NEON_HOST && neonName.test(target.database);
  const inbound = source.host === NEON_HOST && neonName.test(source.database) && target.host === SUPABASE_HOST && supabaseReturn.test(target.database);
  if (!outbound && !inbound) fail('Use the verified standby or a distinctly named isolated return database. Restoring over production postgres is prohibited.');
  if (clone && target.host === SUPABASE_HOST && target.database === 'postgres') fail('Production database restore is prohibited.');
  return { source, target };
}

export async function connect(cfg) {
  const { host, port, database, user, password, caFile } = cfg;
  const ssl = cfg.local ? false : { rejectUnauthorized:true, servername:host, ...(caFile ? {ca:readFileSync(caFile)} : {}) };
  const client = new pg.Client({host,port,database,user,password,ssl, enableChannelBinding:true,
    connectionTimeoutMillis:12000, statement_timeout:120000, application_name:'mysteryhub-standby-verify'});
  try { await client.connect(); } catch (error) { await client.end().catch(()=>{}); throw error; }
  return client;
}

export async function beginSnapshot(client) {
  await client.query(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SET LOCAL row_security=off; SET LOCAL search_path=pg_catalog; SET LOCAL TIME ZONE 'UTC';
    SET LOCAL DateStyle='ISO, YMD'; SET LOCAL IntervalStyle='postgres'; SET LOCAL bytea_output='hex'; SET LOCAL extra_float_digits=3`);
}

export const appSchema = alias => `(${alias}.nspname='public' OR left(${alias}.nspname,11)='mysteryhub_')`;
const shapes = `
WITH ns AS (SELECT oid,nspname FROM pg_namespace n WHERE ${appSchema('n')}),
relations AS (SELECT c.*,n.nspname FROM pg_class c JOIN ns n ON n.oid=c.relnamespace AND c.relkind IN ('r','S','p','v','m','f','c')),
objects AS (
 SELECT 'table' kind,nspname schema,relname name,jsonb_build_array(relrowsecurity,relforcerowsecurity,relpersistence,relkind) shape
  FROM relations WHERE relkind<>'S'
 UNION ALL SELECT 'column',r.nspname,r.relname||'.'||a.attname,jsonb_build_array(row_number() OVER(PARTITION BY r.oid ORDER BY a.attnum),format_type(a.atttypid,a.atttypmod),a.attnotnull,
  a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),cn.nspname,co.collname)
  FROM relations r JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid=r.oid AND d.adnum=a.attnum LEFT JOIN pg_collation co ON co.oid=a.attcollation
  LEFT JOIN pg_namespace cn ON cn.oid=co.collnamespace WHERE r.relkind<>'S'
 UNION ALL SELECT 'constraint',r.nspname,r.relname||'.'||c.conname,jsonb_build_array(pg_get_constraintdef(c.oid),c.convalidated)
  FROM relations r JOIN pg_constraint c ON c.conrelid=r.oid
 UNION ALL SELECT 'index',r.nspname,i.relname,jsonb_build_array(pg_get_indexdef(i.oid),x.indisvalid,x.indisready)
  FROM relations r JOIN pg_index x ON x.indrelid=r.oid JOIN pg_class i ON i.oid=x.indexrelid
 UNION ALL SELECT 'trigger',r.nspname,r.relname||'.'||t.tgname,jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled)
  FROM relations r JOIN pg_trigger t ON t.tgrelid=r.oid AND NOT t.tgisinternal
 UNION ALL SELECT 'function',n.nspname,p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  jsonb_build_array(pg_get_functiondef(p.oid),p.prosecdef,p.proconfig)
  FROM ns n JOIN pg_proc p ON p.pronamespace=n.oid AND p.prokind IN ('f','p','w')
 UNION ALL SELECT 'sequence',r.nspname,r.relname,jsonb_build_array(format_type(s.seqtypid,NULL),s.seqstart,s.seqincrement,
  s.seqmax,s.seqmin,s.seqcache,s.seqcycle,
  (SELECT jsonb_agg(jsonb_build_array(d.deptype,n.nspname,c.relname,a.attname) ORDER BY n.nspname,c.relname,a.attname)
   FROM pg_depend d JOIN pg_class c ON c.oid=d.refobjid JOIN pg_namespace n ON n.oid=c.relnamespace
   JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.refobjsubid
   WHERE d.classid='pg_class'::regclass AND d.objid=r.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i')))
  FROM relations r JOIN pg_sequence s ON s.seqrelid=r.oid
)
SELECT * FROM objects`;

const unsupported = `
  WITH ns AS (SELECT oid,nspname FROM pg_namespace n WHERE ${appSchema('n')}),
  dependency_sources AS (
    SELECT 'pg_class'::regclass classid,c.oid FROM pg_class c JOIN ns n ON n.oid=c.relnamespace
    UNION ALL SELECT 'pg_proc'::regclass,p.oid FROM pg_proc p JOIN ns n ON n.oid=p.pronamespace
    UNION ALL SELECT 'pg_attrdef'::regclass,d.oid FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN ns n ON n.oid=c.relnamespace
    UNION ALL SELECT 'pg_trigger'::regclass,t.oid FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN ns n ON n.oid=c.relnamespace
    UNION ALL SELECT 'pg_constraint'::regclass,c.oid FROM pg_constraint c JOIN ns n ON n.oid=c.connamespace
  )
  SELECT
   (SELECT array_agg(nspname ORDER BY nspname) FROM ns)::text[] schemas,
   EXISTS(SELECT FROM ns JOIN pg_class c ON c.relnamespace=ns.oid WHERE c.relkind NOT IN ('r','i','S','t')) unusual_relation,
   EXISTS(SELECT FROM ns JOIN pg_type t ON t.typnamespace=ns.oid WHERE t.typrelid=0 AND t.typelem=0) unusual_type,
   EXISTS(SELECT FROM ns JOIN pg_proc p ON p.pronamespace=ns.oid WHERE p.prokind NOT IN ('f','p','w') OR p.prosecdef) unusual_function,
   EXISTS(SELECT FROM ns JOIN pg_class c ON c.relnamespace=ns.oid JOIN pg_policy p ON p.polrelid=c.oid) has_policy,
   EXISTS(SELECT FROM dependency_sources s JOIN pg_depend d ON d.classid=s.classid AND d.objid=s.oid
    CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) ref
    WHERE (ref.schema IS NOT NULL AND ref.schema NOT IN ('pg_catalog','information_schema')
      AND NOT EXISTS (SELECT FROM ns WHERE nspname=ref.schema))
      OR d.deptype='e') external_dependency,
   EXISTS(SELECT FROM pg_largeobject_metadata) has_large_objects`;

// Only matching digests leave the database. Buckets bound the size of each ordered aggregate.
async function fingerprint(client, table) {
  const sql = `WITH row_hashes AS (
    SELECT encode(sha256(convert_to(row_to_json(t)::text,'UTF8')),'hex') AS value FROM ONLY ${table} t
  ), buckets AS (
    SELECT left(value,2) prefix,count(*) n,
      encode(sha256(convert_to(string_agg(value,'' ORDER BY value COLLATE "C"),'UTF8')),'hex') AS value
    FROM row_hashes GROUP BY left(value,2)
  ) SELECT COALESCE(sum(n),0)::text count,
    encode(sha256(convert_to(COALESCE(string_agg(prefix||value,'' ORDER BY prefix COLLATE "C"),''),'UTF8')),'hex') digest
    FROM buckets`;
  return (await client.query(sql)).rows[0];
}

export const referenceChecks = `
 SELECT EXISTS(SELECT FROM public.users WHERE role='admin' AND status='active') AS active_admin,
        EXISTS(SELECT FROM public.orders WHERE payment_status='success' AND paid_at IS NOT NULL) AS paid_history,
        EXISTS(SELECT FROM public.orders GROUP BY payment_reference HAVING count(*)>1) AS duplicate_payment,
        EXISTS(SELECT FROM public.orders GROUP BY public_reference HAVING count(*)>1) AS duplicate_order,
        EXISTS(SELECT FROM public.finance_operations GROUP BY user_id,idempotency_key HAVING count(*)>1) AS duplicate_operation,
        EXISTS(
          SELECT FROM public.finance_accounts a
          LEFT JOIN (SELECT user_id,sum(delta_minor) total FROM public.finance_ledger WHERE bucket='wallet' GROUP BY user_id) l USING(user_id)
          WHERE a.wallet_minor<>COALESCE(l.total,0)
        ) AS wallet_drift,
        EXISTS(SELECT FROM public.finance_ledger l WHERE bucket='wallet' AND
          NOT EXISTS(SELECT FROM public.finance_accounts a WHERE a.user_id=l.user_id)) AS wallet_without_account`;

// Inspect effective access too. ACLs alone miss inherited roles and provider defaults.
export const permissionsCheck = `
DO $check$
DECLARE role_name text;
BEGIN
  IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE ${appSchema('n')} AND c.relkind='r' AND (c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
       OR NOT c.relrowsecurity OR c.relforcerowsecurity)) THEN
    RAISE EXCEPTION 'Incorrect runtime owner or RLS';
  END IF;
  IF EXISTS(
    SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(
      CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a
    WHERE ${appSchema('n')} AND c.relkind IN ('r','S') AND a.grantee<>c.relowner
      AND NOT (n.nspname='public' AND c.relkind='r' AND a.grantee<>0 AND a.grantee=coalesce(to_regrole('service_role')::oid,0::oid)
        AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN') AND NOT a.is_grantable)
  ) OR EXISTS(
    SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(a.attacl) g
    WHERE ${appSchema('n')} AND a.attnum>0 AND NOT a.attisdropped AND g.grantee<>c.relowner
  ) OR EXISTS(
    SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE ${appSchema('n')} AND a.grantee<>p.proowner
  ) THEN RAISE EXCEPTION 'Unexpected application object grants'; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=role_name) THEN CONTINUE; END IF;
    IF EXISTS(
       SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ${appSchema('n')} AND CASE c.relkind
        WHEN 'r' THEN has_table_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
          OR has_any_column_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
        WHEN 'S' THEN has_sequence_privilege(role_name,c.oid,'USAGE,SELECT,UPDATE')
        ELSE false END
    ) OR EXISTS(
       SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE ${appSchema('n')} AND has_function_privilege(role_name,p.oid,'EXECUTE')
    ) THEN RAISE EXCEPTION 'Client role received application privileges'; END IF;
  END LOOP;
  IF EXISTS(
    SELECT FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    WHERE ${appSchema('n')} AND (n.nspname<>'public' AND n.nspowner<>to_regrole(current_user)::oid OR
      a.grantee<>n.nspowner AND NOT (n.nspname='public' AND a.grantee<>0
        AND a.grantee=coalesce(to_regrole('service_role')::oid,0::oid) AND a.privilege_type='USAGE' AND NOT a.is_grantable))
  ) OR EXISTS(
    SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE ${appSchema('n')} AND p.proowner<>to_regrole(current_user)::oid
  ) OR EXISTS(
    SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE ${appSchema('n')} AND c.relkind='S' AND c.relowner<>to_regrole(current_user)::oid
  ) THEN RAISE EXCEPTION 'Unexpected schema grants or runtime ownership'; END IF;
END;
$check$;
`;

export async function inspectSnapshot(client, target = false) {
  const meta = await databaseMetadata(client);
  const {rows:[scope]} = await client.query(unsupported);
  if (scope.schemas.some(s=>!(s in SCOPE)) || Object.entries(scope).some(([key,value])=>key!=='schemas' && value)) {
    fail('Application inventory contains an unreviewed schema, dependency, privilege policy, or object type.');
  }
  const {rows} = await client.query(shapes);
  const tables = new Map(), objects = new Map(), sequences = new Map();
  for (const item of rows) {
    const {kind,schema,name,shape} = item;
    let object = kind + ' ' + schema + '.' + name;
    objects.set(object,shape);
    if (kind==='table') {
      if (!shape[0] || shape[1] || shape[2]!=='p' || shape[3]!=='r') fail('Application table does not have the expected permanent owner-based RLS.');
      tables.set(schema+'.'+name,await fingerprint(client,qualified(schema,name)));
    }
    if (kind==='sequence') sequences.set(schema+'.'+name,(await client.query(`SELECT last_value::text,is_called FROM ${qualified(schema,name)}`)).rows[0]);
    if (kind==='constraint' && !shape[1] || kind==='index' && (!shape[1] || !shape[2])) fail('A database constraint or index is invalid.');
  }
  const missing = Object.entries(SCOPE).flatMap(([schema,names])=>
    names.trim().split(/\s+/).map(name=>schema+'.'+name).filter(key=>!tables.has(key)));
  if (target && tables.size) {
    try { await client.query(permissionsCheck); }
    catch (error) {
      if (error.code==='P0001') fail('Destination object ownership, RLS or role privileges are unsafe.');
      throw error;
    }
  }
  const identity = missing.length ? null : (await client.query(referenceChecks)).rows[0];
  const collation = identity ? (await client.query(collationCheck)).rows[0].digest : null;
  return {meta,scope:scope.schemas,tables,objects,sequences,identity,missing,collation};
}

// Use locale-sensitive ordering and case conversion for real sign-in keys and public slugs
// plus fixed Unicode examples. Secondary C ordering makes equivalent collation keys deterministic.
const collationCheck = `
WITH keys AS (
  SELECT email AS value FROM public.users WHERE email IS NOT NULL
  UNION SELECT name FROM public.users
  UNION SELECT public_reference FROM public.orders
  UNION SELECT slug FROM public.marketplace_products WHERE slug IS NOT NULL
  UNION SELECT slug FROM public.website_sites WHERE slug IS NOT NULL
  UNION SELECT * FROM (VALUES ('i'),('İ'),('ß'),('SS'),('é'),('é'),('Å'),('Æ'),('a'),('Z'),('ö'),('2'),('10')) v
)
SELECT encode(sha256(convert_to(string_agg(encode(sha256(convert_to(
  jsonb_build_array(value,lower(value),upper(value),value ILIKE 'i%',value ILIKE 'é%')::text,'UTF8')),'hex'),
  '' ORDER BY value COLLATE "default",value COLLATE "C"),'UTF8')),'hex') digest FROM keys`;

export async function databaseMetadata(client) {
  const {rows:[meta]}=await client.query(`
    SELECT current_setting('server_version_num')::int version, pg_encoding_to_char(encoding) encoding,
           datlocprovider provider,datlocale locale,datcollate lc_collate,datctype lc_ctype,
           datcollversion recorded,pg_database_collation_actual_version(oid) actual
    FROM pg_database WHERE datname=current_database()`);
  if (Math.floor(meta.version/10000)!==17) fail('Migration requires PostgreSQL 17 on both ends.');
  if (meta.recorded!==meta.actual) fail('The database has a stale locale version. Review affected indexes before migrating.');
  return meta;
}

export function compatibleLocale(a,b) {
  return a.encoding===b.encoding && a.provider===b.provider && a.locale===b.locale &&
    (a.provider==='i' || (a.lc_collate===b.lc_collate && a.lc_ctype===b.lc_ctype && a.actual===b.actual));
}

// PostgreSQL may move a lossless varchar[] -> text[] cast onto the
// individual literals when parsing its own dumped CHECK or index predicate.
// Tokenize single-quoted literals so an array-like string value stays intact.
const literal = "'(?:[^']|'')*'";
const varcharItem = literal + '::character varying';
const textItem = '\\(' + varcharItem + '\\)::text';
const arrayItems = item => item+'(?:, '+item+')*';
const arrayCasts = new RegExp('\\(ARRAY\\[('+arrayItems(varcharItem)+')\\]\\)::text\\[\\]'
  +'|ARRAY\\[('+arrayItems(textItem)+')\\]|'+literal,'g');
const stringLiterals = new RegExp(literal,'g');
export function canonicalDefinition(sql) {
  return sql.replace(arrayCasts,(original,arrayCast,itemCasts)=>{
    const items=arrayCast||itemCasts;
    return items ? 'ARRAY['+items.match(stringLiterals).map(value=>value+'::text').join(', ')+']' : original;
  });
}

export function compareSnapshots(source,target) {
  const differences = (a,b,equal) => [...new Set([...a.keys(),...b.keys()])].filter(name=>!a.has(name)||!b.has(name)||!equal(a.get(name),b.get(name))).sort();
  const equal = (a,b) => JSON.stringify(a)===JSON.stringify(b);
  const integrity = snapshot => snapshot.identity && snapshot.identity.active_admin && snapshot.identity.paid_history &&
    !Object.entries(snapshot.identity).some(([k,v])=>!['active_admin','paid_history'].includes(k) && v);
  const counts = differences(source.tables,target.tables,(a,b)=>a.count===b.count);
  const contents = differences(source.tables,target.tables,(a,b)=>a.digest===b.digest);
  const definitions = (snapshot) => new Map([...snapshot.objects].map(([key,value])=>
    [key,/^(constraint|index) /.test(key) ? [canonicalDefinition(value[0]),...value.slice(1)] : value]));
  const objects = differences(definitions(source),definitions(target),equal);
  const sequences = differences(source.sequences,target.sequences,equal);
  const ok = !source.missing.length && !target.missing.length && integrity(source) && integrity(target) && equal(source.scope,target.scope) &&
    !counts.length && !contents.length && !objects.length && !sequences.length &&
    compatibleLocale(source.meta,target.meta) && source.collation===target.collation;
  return { ok:Boolean(ok),verdict:ok?'PARITY_VERIFIED_CUTOVER_REQUIRES_APPROVAL':'NOT_READY',
    source:{tables:source.tables.size,schemata:source.scope.length,missing:source.missing,integrity:source.identity},
    destination:{tables:target.tables.size,schemata:target.scope.length,missing:target.missing,integrity:target.identity},
    locale:{source:source.meta,destination:target.meta,configurationMatches:compatibleLocale(source.meta,target.meta),
      orderingAndCaseMatch:Boolean(source.collation&&source.collation===target.collation)},
    differingCounts:counts,differingContents:contents,differingDefinitions:objects,differingSequences:sequences };
}

export function displayError(error) {
  // PostgreSQL errors and child output can include DDL literals, passwords or row values.
  const code = typeof error.code === 'string' && /^[A-Z0-9_]{1,24}$/.test(error.code) ? ' ('+error.code+')' : '';
  console.error(error instanceof StandbyError ? error.message : 'Database verification failed'+code+'. Connection details and database values are suppressed.');
  process.exitCode=1;
}

async function main() {
  const {source,target} = migrationEndpoints();
  const sourceClient = await connect(source);
  try {
    const targetClient = await connect(target);
    try {
      await Promise.all([beginSnapshot(sourceClient),beginSnapshot(targetClient)]);
      const result = compareSnapshots(...await Promise.all([inspectSnapshot(sourceClient),inspectSnapshot(targetClient,true)]));
      console.log(JSON.stringify(result,null,2));
      if (!result.ok) process.exitCode=2;
    } finally { await targetClient.end(); }
  } finally { await sourceClient.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(displayError);
