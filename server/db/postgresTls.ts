import { X509Certificate } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { checkServerIdentity } from 'node:tls';
import type { PoolConfig } from 'pg';

const projectRef = 'fcvydpuuwbciuulrvizk';
const strictParameters = new Set(['sslmode','sslrootcert','channel_binding','application_name','connect_timeout']);
const compatibilityParameters = new Set([...strictParameters,'ssl','sslcert','sslkey','sslnegotiation','uselibpqcompat','pgbouncer']);
const certificatePattern = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

function requiredCa(file: string): string {
  try {
    if (!isAbsolute(file) || !statSync(file).isFile()) throw new Error();
    const pem = readFileSync(file,'utf8');
    const certificates = pem.match(certificatePattern);
    if (!certificates?.length || pem.replace(certificatePattern,'').trim() ||
      !certificates.every(certificate=>new X509Certificate(certificate).ca)) throw new Error();
    return pem;
  } catch {
    throw new Error('[DB] The configured database CA must be a readable PEM CA certificate or bundle at an absolute path.');
  }
}

export function postgresTlsConfig(env: NodeJS.ProcessEnv): {
  options: PoolConfig; policy: 'verified' | 'supabase-compatibility' | 'development';
} {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error('[DB] DATABASE_URL is required.');
  const production = env.NODE_ENV==='production';
  const guarded = env.DATABASE_EXPECTED_NAME!==undefined || env.DATABASE_MAINTENANCE==='true';
  const configured = env.DATABASE_SSL;
  // Keep the existing opt-in development/test database behavior.
  if (!production && !guarded && configured!=='verify-full' && env.DATABASE_SSL_CA_FILE===undefined) {
    return {options:{connectionString:raw,ssl:configured==='false'?false:{rejectUnauthorized:false}},policy:'development'};
  }
  if (configured!==undefined && !['true','verify-full'].includes(configured)) {
    throw new Error('[DB] An encrypted connection is required. Use DATABASE_SSL=verify-full to enable certificate verification.');
  }

  let uri: URL, user: string, password: string, database: string;
  try {
    uri = new URL(raw);
    user = decodeURIComponent(uri.username);
    password = decodeURIComponent(uri.password);
    database = decodeURIComponent(uri.pathname.slice(1));
  } catch {
    throw new Error('[DB] Invalid PostgreSQL connection URL.');
  }
  const host = uri.hostname.toLowerCase().replace(/^\[(.+)\]$/,'$1');
  if (!['postgres:','postgresql:'].includes(uri.protocol) || uri.hash || !host || host.includes('%') ||
      host.includes(',') || !user || !database || database.includes('/') || uri.port==='0' ||
      /[\x00-\x1f\x7f]/.test(user+password+database)) throw new Error('[DB] Invalid PostgreSQL connection URL.');

  const sharedPooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(host);
  const productionSupabase = database==='postgres' && (uri.port==='' || uri.port==='5432') && (
    sharedPooler && user==='postgres.'+projectRef ||
    host==='db.'+projectRef+'.supabase.co' && user==='postgres'
  );
  const params = uri.searchParams;
  const urlMode = params.get('sslmode');
  const caFile = env.DATABASE_SSL_CA_FILE;
  const compatibility = production && productionSupabase && !guarded && configured!=='verify-full';
  if (compatibility && caFile!==undefined) {
    throw new Error('[DB] Configure DATABASE_SSL=verify-full when setting DATABASE_SSL_CA_FILE.');
  }

  const allowed = compatibility ? compatibilityParameters : strictParameters;
  if ([...params.keys()].some(key=>!allowed.has(key) || params.getAll(key).length!==1)) {
    throw new Error('[DB] Unsupported or duplicate database URL options. Database identity and TLS settings must be unambiguous.');
  }
  if (compatibility) {
    if (urlMode!==null && !['require','prefer','verify-ca','verify-full','no-verify'].includes(urlMode) ||
        params.has('ssl') && !['1','true','no-verify'].includes(params.get('ssl')!)) {
      throw new Error('[DB] The Supabase connection must use TLS.');
    }
    // Preserve pg's existing SSL URL precedence for this one established deployment.
    // In particular, this path does not weaken a DSN already verifying certificates.
    return {options:{connectionString:raw,ssl:{rejectUnauthorized:false}},policy:'supabase-compatibility'};
  }

  if (urlMode!==null && !['require','verify-full'].includes(urlMode) ||
      guarded && urlMode!=='verify-full' && production) {
    throw new Error('[DB] Strict database TLS requires sslmode=verify-full or an unambiguous TLS URL.');
  }
  const urlCa = params.get('sslrootcert');
  if (caFile!==undefined && urlCa!==null && caFile!==urlCa) {
    throw new Error('[DB] The database CA file settings conflict.');
  }
  const file = caFile ?? (urlCa==='system'?null:urlCa);
  if (sharedPooler && !file) throw new Error('[DB] Strict TLS needs the provider CA file for the Supabase Session Pooler.');
  const channelBinding = params.get('channel_binding');
  if (channelBinding!==null && !['require','prefer'].includes(channelBinding)) {
    throw new Error('[DB] Invalid channel_binding setting.');
  }

  return {
    policy:'verified',
    // Do not pass a connectionString in strict mode. pg would parse it again
    // and replace the SSL object, including our selected CA and hostname check.
    options:{
      host, port:Number(uri.port||5432), database, user, password,
      application_name: params.get('application_name')??undefined,
      enableChannelBinding:true,
      ssl:{
        rejectUnauthorized:true,
        ...(file!==null ? {ca:requiredCa(file)} : {}),
        checkServerIdentity:(_hostname,certificate)=>checkServerIdentity(host,certificate)
          ? Object.assign(new Error('PostgreSQL TLS hostname verification failed.'),{code:'ERR_TLS_CERT_ALTNAME_INVALID'})
          : undefined,
      },
    },
  };
}

const safeConnectionCodes = new Set([
  '28P01','28000','3D000','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN',
  'CERT_HAS_EXPIRED','CERT_NOT_YET_VALID','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID',
]);

export function postgresErrorLabel(error: unknown): string {
  const code = error && typeof error==='object' && 'code' in error ? error.code : undefined;
  return typeof code==='string' && safeConnectionCodes.has(code) ? ' ('+code+')' : '';
}
