#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, realpathSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  StandbyError, appSchema, beginSnapshot, compareSnapshots, connect, displayError,
  inspectSnapshot, migrationEndpoints, permissionsCheck, compatibleLocale, databaseMetadata, verifySessionSource,
} from './db-standby-preflight.mjs';

function workspace() {
  const supplied = process.env.MYSTERY_STANDBY_ARCHIVE_DIR;
  if (!supplied || !path.isAbsolute(supplied)) throw new StandbyError('Set MYSTERY_STANDBY_ARCHIVE_DIR to an absolute path on a private encrypted volume.');
  const dir = realpathSync(supplied);
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || (stat.mode & 0o077) || stat.uid!==process.getuid()) {
    throw new StandbyError('The archive directory must be owned by the operator and have mode 0700.');
  }
  for (let parent=dir; ; parent=path.dirname(parent)) {
    const dotgit = path.join(parent,'.git');
    if (lstatSync(dotgit,{throwIfNoEntry:false})?.isFile() || lstatSync(path.join(dotgit,'HEAD'),{throwIfNoEntry:false})) {
      throw new StandbyError('Backup archives must be outside Git worktrees.');
    }
    if (parent===path.dirname(parent)) break;
  }
  process.umask(0o077);
  return mkdtempSync(path.join(dir,'mysteryhub-'));
}

function run(tool,args,cfg,stage) {
  const tls=!cfg.local || Boolean(cfg.caFile);
  const env={
    PATH:process.env.PATH, LANG:'C', PGAPPNAME:'mysteryhub-standby-clone',
    PGHOST:cfg.host, PGPORT:String(cfg.port), PGDATABASE:cfg.database, PGUSER:cfg.user, PGPASSWORD:cfg.password,
    PGCONNECT_TIMEOUT:'12', PGSSLMODE:tls?'verify-full':'disable',
    ...(tls?{PGSSLROOTCERT:cfg.caFile||'system',PGCHANNELBINDING:cfg.channelBinding?'require':'prefer'}:{}),
  };
  const child=spawnSync(tool,args,{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024,timeout:300000});
  if (child.error || child.status!==0) throw new StandbyError(stage+' failed. Tool output is suppressed; the authorized operator can inspect the isolated target before retrying.');
  return child.stdout;
}

function checkClient(tool,cfg) {
  if (!/PostgreSQL\) 17\./.test(run(tool,['--version'],cfg,'PostgreSQL 17 client check'))) {
    throw new StandbyError('Use the PostgreSQL 17 client tools for rehearsals and backups.');
  }
}

async function probeSnapshot() {
  const {source}=migrationEndpoints();
  checkClient('pg_dump',source);
  const client=await connect(source);
  try {
    await beginSnapshot(client);
    await verifySessionSource(client,source);
    const {rows:[{snapshot}]}=await client.query('SELECT pg_export_snapshot() AS snapshot');
    // A second authenticated client imports the snapshot. This dumps only
    // one table's definition, with no rows, archive, or destination connection.
    run('pg_dump',['--no-password','--schema-only','--table=public.users','--lock-wait-timeout=5s',
      '--snapshot='+snapshot,'--file=/dev/null'],source,'Read-only exported snapshot test');
    console.log('PostgreSQL 17 pg_dump imported the source snapshot. No application rows were copied.');
  } finally { await client.end(); }
}

const emptyGuard = name => `
DO $guard$
BEGIN
  IF current_database()<>'${name}' THEN RAISE EXCEPTION 'Wrong restore database'; END IF;
  PERFORM pg_advisory_xact_lock(31035139);
  IF EXISTS(SELECT FROM pg_namespace n WHERE left(n.nspname,11)='mysteryhub_')
     OR EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
     OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
     OR EXISTS(SELECT FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public')
     OR EXISTS(SELECT FROM pg_largeobject_metadata)
  THEN RAISE EXCEPTION 'Restore destination is not empty'; END IF;
END;
$guard$;
`;

const protectObjects = `
-- Initialize the runtime owner with the narrower, provider-neutral access model.
SET search_path=pg_catalog;
DO $privileges$
DECLARE schema_name text; recipient text; permissions text;
BEGIN
  ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  FOR schema_name IN SELECT n.nspname FROM pg_namespace n WHERE ${appSchema('n')} LOOP
    FOREACH recipient IN ARRAY ARRAY['PUBLIC','anon','authenticated','service_role'] LOOP
      IF recipient<>'PUBLIC' AND NOT EXISTS(SELECT FROM pg_roles WHERE rolname=recipient) THEN CONTINUE; END IF;
      permissions:=CASE WHEN recipient='PUBLIC' THEN recipient ELSE quote_ident(recipient) END;
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %s',schema_name,permissions);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %s',schema_name,permissions);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %s',schema_name,permissions);
      EXECUTE format('REVOKE ALL ON ALL ROUTINES IN SCHEMA %I FROM %s',schema_name,permissions);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %s',schema_name,permissions);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %s',schema_name,permissions);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM %s',schema_name,permissions);
    END LOOP;
  END LOOP;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES TO service_role;
  END IF;
END;
$privileges$;
`;

export async function cloneStandby() {
  const {source,target}=migrationEndpoints(process.env,true);
  for (const tool of ['pg_dump','pg_restore','psql']) checkClient(tool,target);
  const dir=workspace();
  const dump=path.join(dir,'application.dump'), partial=path.join(dir,'application.partial'), toc=path.join(dir,'restore.list'), restore=path.join(dir,'restore.sql');
  const before=path.join(dir,'guard.sql'), after=path.join(dir,'protect.sql');
  const client=await connect(source);
  let sourceOpen=true;
  try {
    await beginSnapshot(client);
    await verifySessionSource(client,source);
    // Run the emptiness and identity guard before taking a potentially expensive snapshot.
    writeFileSync(before,emptyGuard(target.database));
    const empty=await connect(target);
    try {
      if (!compatibleLocale(await databaseMetadata(client),await databaseMetadata(empty))) {
        throw new StandbyError('Destination locale differs from the source. Prepare an isolated database with the source encoding, locale provider and language.');
      }
    } finally { await empty.end(); }
    // The definitive check takes the same advisory lock again inside the atomic restore.
    run('psql',['-X','--no-password','--single-transaction','--set=ON_ERROR_STOP=1','--file='+before],target,'Empty destination verification');
    const reference=await inspectSnapshot(client);
    if (!compareSnapshots(reference,reference).ok) throw new StandbyError('Source has missing application data or inconsistent financial invariants.');
    const {rows:[{snapshot}]}=await client.query('SELECT pg_export_snapshot() AS snapshot');
    writeFileSync(partial,'',{flag:'wx',mode:0o600});
    run('pg_dump',['--no-password','--format=custom','--no-owner','--no-acl','--lock-wait-timeout=5s','--snapshot='+snapshot,
      ...reference.scope.map(name=>'--schema='+name),'--file='+partial],source,'Consistent application backup');
    renameSync(partial,dump);
    await client.end();
    sourceOpen=false;
    console.log('Private application archive saved in '+path.basename(dir)+'.');
    const entries=run('pg_restore',['--list',dump],target,'Archive inventory');
    // PostgreSQL already provisions the empty public namespace. Keep all of its app objects.
    writeFileSync(toc,entries.split('\n').filter(line=>!/^\d+; \d+ \d+ SCHEMA - public\s/.test(line)).join('\n'));
    run('pg_restore',['--no-owner','--no-acl','--exit-on-error','--use-list='+toc,'--file='+restore,dump],target,'Restore SQL preparation');
    writeFileSync(after,protectObjects+permissionsCheck);
    run('psql',['-X','--no-password','--single-transaction','--set=ON_ERROR_STOP=1',
      '--file='+before,'--file='+restore,'--file='+after],target,'Atomic restore and privilege validation');
    const restored=await connect(target);
    try {
      await beginSnapshot(restored);
      const verification=compareSnapshots(reference,await inspectSnapshot(restored,true));
      console.log(JSON.stringify(verification,null,2));
      if (!verification.ok) process.exitCode=2;
    } finally { await restored.end(); }
  } finally {
    for (const file of [partial,toc,restore,before,after]) rmSync(file,{force:true});
    if (sourceOpen) await client.end();
  }
}

async function main() {
  const args=process.argv.slice(2);
  if (!args.length) await cloneStandby();
  else if (args.length===1 && args[0]==='--probe-source') await probeSnapshot();
  else throw new StandbyError('Use --probe-source for a read-only snapshot test or no arguments for the isolated clone.');
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(displayError);
