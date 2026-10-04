import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'server/suppliers/__tests__');
const files = process.argv.slice(2);
const targets = files.length ? files : readdirSync(directory).filter(name => name.endsWith('.test.ts')).map(name => path.join(directory, name));
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test' };
// Full regression defaults to memory. Never inherit an application database URL.
delete env.DATABASE_URL;
delete env.MYSTERY_TEST_DATABASE_OPT_IN;
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...targets], { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
