import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { postgresErrorLabel, postgresTlsConfig } from '../../db/postgresTls.js';
import { databaseMode } from '../../services/databaseReadiness.js';

const project = 'fcvydpuuwbciuulrvizk';
const pooler = 'fixture.pooler.supabase.com';
const supabase = 'postgresql://postgres.'+project+':fixture-password@'+pooler+':5432/postgres';
const neon = 'postgresql://owner:fixture-password@compute-fixture.neon.tech/example';
const production = (DATABASE_URL: string, config: NodeJS.ProcessEnv = {}) => ({NODE_ENV:'production',DATABASE_URL,...config});
const verified = {DATABASE_SSL:'verify-full'};
const local = 'postgresql://owner:fixture-password@127.0.0.1/example_test';
let fixtures: string;
const file = (name: string) => path.join(fixtures,name);
const openssl = (...args: string[]) => execFileSync('openssl',args,{cwd:fixtures,stdio:'ignore'});
function sslOptions(value: unknown) {
  assert.ok(value && typeof value==='object');
  return value as tls.ConnectionOptions;
}

before(()=>{
  fixtures = mkdtempSync(path.join(os.tmpdir(),'mysteryhub-db-tls-'));
  openssl('req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=Synthetic database test root',
    '-addext','basicConstraints=critical,CA:TRUE','-keyout','ca.key','-out','ca.pem');
  openssl('req','-new','-newkey','rsa:2048','-nodes','-subj','/CN=Synthetic PostgreSQL fixture',
    '-keyout','server.key','-out','server.csr');
  writeFileSync(file('san.cfg'),'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n');
  writeFileSync(file('wrong-san.cfg'),'subjectAltName=DNS:wrong.fixture\nextendedKeyUsage=serverAuth\n');
  for (const [name, extension] of [['good','san.cfg'],['wrong-host','wrong-san.cfg']]) {
    openssl('x509','-req','-in','server.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial',
      '-extfile',extension,'-days','2','-out',name+'.pem');
  }
  writeFileSync(file('index.txt'),'');
  writeFileSync(file('serial'),'01\n');
  writeFileSync(file('ca.cfg'),`[ca]
default_ca=fixture
[fixture]
certificate=ca.pem
private_key=ca.key
database=index.txt
serial=serial
new_certs_dir=.
default_md=sha256
policy=subject
x509_extensions=server
[subject]
commonName=supplied
[server]
subjectAltName=IP:127.0.0.1
extendedKeyUsage=serverAuth
`);
  openssl('ca','-batch','-config','ca.cfg','-in','server.csr','-startdate','20000101000000Z',
    '-enddate','20000102000000Z','-notext','-out','expired.pem');
  writeFileSync(file('invalid.pem'),'synthetic non-certificate fixture');
});
after(()=>{ if (fixtures) rmSync(fixtures,{recursive:true,force:true}); });

test('Phase A preserves the existing driver precedence only for the known Supabase endpoint and tenant',()=>{
  const compatible = postgresTlsConfig(production(supabase));
  assert.equal(compatible.policy,'supabase-compatibility');
  assert.deepEqual(compatible.options.ssl,{rejectUnauthorized:false});
  const withMode = supabase+'?sslmode=verify-full';
  const existing = new pg.Client({connectionString:withMode,ssl:{rejectUnauthorized:false}});
  const afterRelease = new pg.Client(postgresTlsConfig(production(withMode)).options);
  assert.deepEqual(afterRelease.ssl,existing.ssl);
  assert.notEqual(sslOptions(afterRelease.ssl).rejectUnauthorized,false);
  for (const value of [
    supabase.replace('5432','6543'),supabase.replace(project,'anotherproject'),supabase.replace('/postgres','/isolated'),
  ]) assert.throws(()=>postgresTlsConfig(production(value)),/provider CA/);
  for (const value of [
    supabase.replace(pooler,'lookalike.example'),supabase.replace(pooler,pooler+'.lookalike.example'),
  ]) assert.equal(postgresTlsConfig(production(value)).policy,'verified');
  assert.throws(()=>postgresTlsConfig(production(supabase+'?sslmode=disable')), /must use TLS/);
  assert.throws(()=>postgresTlsConfig(production(supabase+'?host=lookalike.example')),/Unsupported/);
});

test('strict TLS supplies the operator CA for Supabase and uses Node trust for direct and pooled Neon',()=>{
  const ca = file('ca.pem');
  for (const configured of [
    production(supabase+'?sslmode=require', {...verified,DATABASE_SSL_CA_FILE:ca}),
    production(supabase+'?sslmode=verify-full', {...verified,DATABASE_SSL_CA_FILE:ca,DATABASE_EXPECTED_NAME:'postgres'}),
    production(supabase+'?sslmode=verify-full&sslrootcert='+encodeURIComponent(ca), verified),
  ]) {
    const {options,policy} = postgresTlsConfig(configured);
    assert.equal(policy,'verified');
    assert.equal(options.connectionString,undefined);
    assert.equal(options.host,pooler);
    assert.equal(options.user,'postgres.'+project);
    assert.equal(sslOptions(new pg.Client(options).ssl).ca,readFileSync(ca,'utf8'));
    assert.equal(sslOptions(new pg.Client(options).ssl).rejectUnauthorized,true);
  }

  for (const host of ['compute-fixture.neon.tech','compute-fixture-pooler.neon.tech']) {
    const env = production(neon.replace('compute-fixture.neon.tech',host)+'?sslmode=verify-full&channel_binding=require',{
      DATABASE_EXPECTED_NAME:'example',DATABASE_MAINTENANCE:'true',
    });
    const {options,policy} = postgresTlsConfig(env);
    assert.equal(databaseMode(env).maintenance,true);
    assert.equal(policy,'verified');
    assert.equal(options.host,host);
    assert.equal(sslOptions(new pg.Client(options).ssl).rejectUnauthorized,true);
    assert.equal(sslOptions(new pg.Client(options).ssl).ca,undefined);
  }
});

test('strict settings reject downgrade, connection-string overrides, and missing or invalid CAs',()=>{
  assert.throws(()=>postgresTlsConfig(production(supabase,verified)),/provider CA/);
  assert.throws(()=>postgresTlsConfig(production(supabase,{DATABASE_SSL_CA_FILE:file('ca.pem')})),/DATABASE_SSL=verify-full/);
  for (const name of ['missing.pem','invalid.pem','good.pem','.']) {
    assert.throws(()=>postgresTlsConfig(production(supabase,{...verified,DATABASE_SSL_CA_FILE:file(name)})),/readable PEM CA/);
  }
  assert.throws(()=>postgresTlsConfig(production(neon+'?sslrootcert=system',{...verified,DATABASE_SSL_CA_FILE:file('ca.pem')})),/conflict/);
  for (const extra of [
    '?sslmode=disable','?sslmode=no-verify','?sslmode=verify-ca','?sslmode=prefer',
    '?sslmode=verify-full&ssl=0','?sslmode=verify-full&sslmode=no-verify','?uselibpqcompat=true',
    '?sslnegotiation=direct','?sslkey=fixture.pem','?host=lookalike.example','?port=1234',
    '?channel_binding=disable','?user=alternate',
  ]) assert.throws(()=>postgresTlsConfig(production(neon+extra,verified)));
  assert.throws(()=>databaseMode(production(neon+'?sslmode=verify-full',{
    DATABASE_EXPECTED_NAME:'example',DATABASE_MAINTENANCE:'true',DATABASE_SSL:'false',
  })),/verify-full TLS/);
  assert.throws(()=>databaseMode(production(supabase+'?sslmode=verify-full',{
    DATABASE_EXPECTED_NAME:'postgres',DATABASE_MAINTENANCE:'true',
  })),/provider CA/);
  assert.throws(()=>postgresTlsConfig(production('postgresql://fixture-user:%C0%AF@fixture.invalid/db',verified)),
    err=>err instanceof Error && !err.message.includes('fixture-user'));
  assert.equal(postgresErrorLabel({code:'ERR_TLS_CERT_ALTNAME_INVALID',cert:'fixture certificate'}),' (ERR_TLS_CERT_ALTNAME_INVALID)');
  assert.equal(postgresErrorLabel({code:'PRIVATE_FIXTURE_PASSWORD'}),'');
});

test('development and existing loopback database fixtures keep their prior SSL behavior',()=>{
  assert.equal(postgresTlsConfig({NODE_ENV:'test',DATABASE_URL:local,DATABASE_SSL:'false'}).options.ssl,false);
  assert.deepEqual(postgresTlsConfig({NODE_ENV:'development',DATABASE_URL:local}).options.ssl,{rejectUnauthorized:false});
});

async function withPostgresTls(certificate: string, exercise: (endpoint: string) => Promise<void>) {
  const secureContext = tls.createSecureContext({key:readFileSync(file('server.key')),cert:readFileSync(file(certificate))});
  const sockets = new Set<net.Socket>();
  const server = net.createServer(socket=>{
    sockets.add(socket);
    socket.on('close',()=>sockets.delete(socket));
    socket.once('data',request=>{
      // Minimal PostgreSQL SSLRequest, AuthenticationOk and ReadyForQuery. The
      // client's handshake, certificate checks and pool machinery are real.
      if (request.length!==8 || request.readInt32BE(4)!==80877103) { socket.destroy(); return; }
      socket.write('S');
      const secure = new tls.TLSSocket(socket,{isServer:true,secureContext});
      secure.on('error',()=>socket.destroy());
      secure.once('data',()=>secure.write(Buffer.from([
        82,0,0,0,8,0,0,0,0,
        90,0,0,0,5,73,
      ])));
    });
  });
  server.listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    const address = server.address();
    assert.ok(address && typeof address!=='string');
    await exercise(local.replace('127.0.0.1','127.0.0.1:'+address.port));
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
}

async function connectToFixture(DATABASE_URL: string, ca?: string) {
  const {options}=postgresTlsConfig({DATABASE_URL,...verified,DATABASE_SSL_CA_FILE:ca});
  const pool = new pg.Pool({...options,connectionTimeoutMillis:1500});
  try { const client=await pool.connect(); client.release(); }
  finally { await pool.end(); }
}

test('node-postgres accepts a trusted matching cert and rejects untrusted, wrong-name and expired certs',async()=>{
  const ca = file('ca.pem');
  await withPostgresTls('good.pem',async endpoint=>{
    await connectToFixture(endpoint+'?sslmode=require',ca);
    await assert.rejects(()=>connectToFixture(endpoint),{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'});
  });
  await withPostgresTls('wrong-host.pem',endpoint=>assert.rejects(()=>connectToFixture(endpoint,ca),error=>{
    assert.equal((error as {code:string}).code,'ERR_TLS_CERT_ALTNAME_INVALID');
    assert.ok(error instanceof Error && !('cert' in error));
    return true;
  }));
  await withPostgresTls('expired.pem',endpoint=>assert.rejects(()=>connectToFixture(endpoint,ca),{code:'CERT_HAS_EXPIRED'}));
});
