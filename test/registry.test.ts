import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  addSource,
  CollisionError,
  findGeneratorByName,
  listRegistered,
  removeSource,
} from '../src/registry/operations';
import { cacheEntryDir } from '../src/engine/cache';
import { parseSource } from '../src/engine/source';
import { readRegistry, registryFilePath } from '../src/config/registry-file';
import type { Environment } from '../src/config/paths';
import { makeTempEnv, makeTempDir, writeFile } from './helpers';

interface RepoOptions {
  barrel?: string;
  patterns?: string[];
  modules?: Array<{ file: string; contents: string }>;
}

function generatorModule(name: string, description?: string): string {
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

function writeRepo(dir: string, options: RepoOptions = {}): string {
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

function copyRepo(repoDir: string) {
  return async (_source: unknown, dest: string): Promise<void> => {
    cpSync(repoDir, dest, { recursive: true });
  };
}

function depsFor(env: Environment, repoDir: string) {
  return {
    env,
    cacheRoot: env.NEEW_CACHE_DIR as string,
    resolveCommit: async () => 'commit-1',
    download: copyRepo(repoDir),
  };
}

test('add registers a source and indexes its generators', async () => {
  const env = makeTempEnv();
  const repo = writeRepo(makeTempDir('neew-repo-'), {
    modules: [
      {
        file: 'generators/component.generator.ts',
        contents: generatorModule('component', 'Create a component'),
      },
    ],
  });

  const entry = await addSource('github.com/acme/templates', depsFor(env, repo));

  assert.equal(entry.source, 'github.com/acme/templates');
  assert.deepEqual(entry.generators, [
    {
      name: 'component',
      path: 'generators/component.generator.ts',
      description: 'Create a component',
    },
  ]);
  const registry = readRegistry(env);
  assert.ok(registry.repositories['github.com/acme/templates']);
  const located = findGeneratorByName(listRegistered({ env }), 'component');
  assert.equal(located?.entry.source, 'github.com/acme/templates');
});

test('add rejects a missing barrel and leaves the registry and cache untouched', async () => {
  const env = makeTempEnv();
  const repo = makeTempDir('neew-repo-');
  const link = 'github.com/acme/templates';

  await assert.rejects(() => addSource(link, depsFor(env, repo)), /no generators\.ts found/);

  assert.deepEqual(readRegistry(env).repositories, {});
  assert.equal(existsSync(cacheEntryDir(env.NEEW_CACHE_DIR as string, parseSource(link))), false);
});

test('add rejects a dangling pattern, deletes the download, and leaves the registry untouched', async () => {
  const env = makeTempEnv();
  const repo = writeRepo(makeTempDir('neew-repo-'), {
    patterns: ['./missing/*.generator.ts'],
  });
  const link = 'github.com/acme/templates';

  await assert.rejects(() => addSource(link, depsFor(env, repo)), /matched no files/);

  assert.deepEqual(readRegistry(env).repositories, {});
  assert.equal(existsSync(cacheEntryDir(env.NEEW_CACHE_DIR as string, parseSource(link))), false);
});

test('add rejects a module that fails to load and leaves the registry untouched', async () => {
  const env = makeTempEnv();
  const repo = writeRepo(makeTempDir('neew-repo-'), {
    modules: [{ file: 'generators/broken.generator.ts', contents: `throw new Error('boom');\n` }],
  });
  const link = 'github.com/acme/templates';

  await assert.rejects(
    () => addSource(link, depsFor(env, repo)),
    /Failed to load generator module/,
  );

  assert.deepEqual(readRegistry(env).repositories, {});
  assert.equal(existsSync(cacheEntryDir(env.NEEW_CACHE_DIR as string, parseSource(link))), false);
});

test('add rejects duplicate names within one repository', async () => {
  const env = makeTempEnv();
  const repo = writeRepo(makeTempDir('neew-repo-'), {
    modules: [
      { file: 'generators/a.generator.ts', contents: generatorModule('component') },
      { file: 'generators/b.generator.ts', contents: generatorModule('component') },
    ],
  });

  await assert.rejects(
    () => addSource('github.com/acme/templates', depsFor(env, repo)),
    /Duplicate generator name "component"/,
  );
  assert.deepEqual(readRegistry(env).repositories, {});
});

test('a global name collision is rejected with conflicting names and descriptions', async () => {
  const env = makeTempEnv();
  const first = writeRepo(makeTempDir('neew-repo-'), {
    modules: [
      {
        file: 'generators/component.generator.ts',
        contents: generatorModule('component', 'First'),
      },
    ],
  });
  const second = writeRepo(makeTempDir('neew-repo-'), {
    modules: [
      {
        file: 'generators/component.generator.ts',
        contents: generatorModule('component', 'Second'),
      },
    ],
  });

  await addSource('github.com/acme/one', depsFor(env, first));

  await assert.rejects(
    () => addSource('github.com/acme/two', depsFor(env, second)),
    (error: unknown) => {
      assert.ok(error instanceof CollisionError);
      assert.match(error.message, /component/);
      assert.match(error.message, /Second/);
      assert.match(error.message, /github\.com\/acme\/one/);
      return true;
    },
  );

  const registry = readRegistry(env);
  assert.ok(registry.repositories['github.com/acme/one']);
  assert.equal(registry.repositories['github.com/acme/two'], undefined);
  assert.equal(
    existsSync(cacheEntryDir(env.NEEW_CACHE_DIR as string, parseSource('github.com/acme/two'))),
    false,
  );
});

test('an unused name is added successfully', async () => {
  const env = makeTempEnv();
  const first = writeRepo(makeTempDir('neew-repo-'), {
    modules: [{ file: 'generators/a.generator.ts', contents: generatorModule('component') }],
  });
  const second = writeRepo(makeTempDir('neew-repo-'), {
    modules: [{ file: 'generators/b.generator.ts', contents: generatorModule('button') }],
  });

  await addSource('github.com/acme/one', depsFor(env, first));
  const entry = await addSource('github.com/acme/two', depsFor(env, second));

  assert.deepEqual(
    entry.generators.map((generator) => generator.name),
    ['button'],
  );
});

test('remove accepts a scheme-less link and drops the entry and cache', async () => {
  const env = makeTempEnv();
  const repo = writeRepo(makeTempDir('neew-repo-'), {
    modules: [{ file: 'generators/a.generator.ts', contents: generatorModule('component') }],
  });
  await addSource('https://github.com/acme/templates', depsFor(env, repo));
  const cacheDir = cacheEntryDir(
    env.NEEW_CACHE_DIR as string,
    parseSource('github.com/acme/templates'),
  );
  assert.equal(existsSync(cacheDir), true);

  const removed = removeSource('github.com/acme/templates', {
    env,
    cacheRoot: env.NEEW_CACHE_DIR as string,
  });

  assert.equal(removed.source, 'github.com/acme/templates');
  assert.deepEqual(readRegistry(env).repositories, {});
  assert.equal(existsSync(cacheDir), false);
});

test('list reports registered repositories without contacting the network', async () => {
  const env = makeTempEnv();
  const repo = writeRepo(makeTempDir('neew-repo-'), {
    modules: [
      { file: 'generators/a.generator.ts', contents: generatorModule('component', 'Create') },
    ],
  });
  await addSource('github.com/acme/templates', depsFor(env, repo));

  const entries = listRegistered({ env });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].generators[0].name, 'component');
});

test('a malformed registry aborts add and is not overwritten', async () => {
  const env = makeTempEnv();
  const repo = writeRepo(makeTempDir('neew-repo-'), {
    modules: [{ file: 'generators/a.generator.ts', contents: generatorModule('component') }],
  });
  const path = registryFilePath(env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '{ broken', 'utf8');

  await assert.rejects(
    () => addSource('github.com/acme/templates', depsFor(env, repo)),
    /Failed to parse the neew registry/,
  );
  assert.equal(readFileSync(path, 'utf8'), '{ broken');
});
