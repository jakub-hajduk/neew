import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as tar from 'tar';
import type { Environment } from '../src/config/paths';
import type { PromptAdapter } from '@trut/gen/runtime';

export const FIXTURE_REPO = join(import.meta.dirname, 'fixtures', 'repo');
export const FIXTURE_APP = join(import.meta.dirname, 'fixtures', 'app');

export function makeTempEnv(): Environment {
  const root = mkdtempSync(join(tmpdir(), 'neew-test-'));
  return {
    ...process.env,
    NEEW_CONFIG_DIR: join(root, 'config'),
    NEEW_CACHE_DIR: join(root, 'cache'),
    HOME: root,
  };
}

export function makeTempDir(prefix = 'neew-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export interface Captured {
  stdout: string[];
  stderr: string[];
  env: Environment;
  cwd: string;
}

export function makeCapture(cwd?: string): Captured {
  return {
    stdout: [],
    stderr: [],
    env: makeTempEnv(),
    cwd: cwd ?? makeTempDir(),
  };
}

export async function fixtureTarball(
  topDir = 'repo-main',
  sourceDir = FIXTURE_REPO,
): Promise<Buffer> {
  const work = makeTempDir('neew-fixture-tar-');
  const staging = join(work, topDir);
  cpSync(sourceDir, staging, { recursive: true });
  const out = join(work, 'out.tar.gz');
  await tar.c({ gzip: true, cwd: work, file: out }, [topDir]);
  return readFileSync(out);
}

export function responseFor(buffer: Buffer, ok = true): Response {
  return new Response(buffer, {
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
  });
}

export function nonInteractiveAdapter(): PromptAdapter {
  const fail = (): never => {
    throw new Error('interactive prompt was called');
  };
  return {
    interactive: false,
    selectGenerator: async () => fail(),
    text: async () => fail(),
    password: async () => fail(),
    number: async () => fail(),
    confirm: async () => fail(),
    select: async () => fail(),
    multiselect: async () => fail(),
  };
}

export function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
}

export interface RepoOptions {
  barrel?: string;
  patterns?: string[];
  modules?: Array<{ file: string; contents: string }>;
}

export function generatorModule(name: string, description?: string): string {
  return (
    `import { defineGenerator } from '@trut/gen';\n` +
    `export default defineGenerator({\n` +
    `  name: ${JSON.stringify(name)},\n` +
    (description ? `  description: ${JSON.stringify(description)},\n` : '') +
    `  basePath: 'src',\n` +
    `  actions: [],\n` +
    `});\n`
  );
}

export function writeRepo(dir: string, options: RepoOptions = {}): string {
  const patterns = options.patterns ?? ['./generators/*.generator.ts'];
  writeFile(
    join(dir, 'generators.ts'),
    options.barrel ?? `export default { generators: ${JSON.stringify(patterns)} };\n`,
  );
  for (const module of options.modules ?? []) {
    writeFile(join(dir, module.file), module.contents);
  }
  return dir;
}

export function copyRepo(repoDir: string) {
  return async (_source: unknown, dest: string): Promise<void> => {
    cpSync(repoDir, dest, { recursive: true });
  };
}
