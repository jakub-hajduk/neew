import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadRuntimeHandlers } from '../src/config/load-runtime-handlers';
import { makeTempDir, writeFile } from './helpers';

test('returns undefined without a configured handler module', async () => {
  const handlers = await loadRuntimeHandlers(makeTempDir('neew-runtime-'), undefined);
  assert.equal(handlers, undefined);
});

test('loads a default-exported handler registry', async () => {
  const dir = makeTempDir('neew-runtime-');
  writeFile(join(dir, 'runtime.ts'), `export default { 'acme/example': async () => {} };\n`);

  const handlers = await loadRuntimeHandlers(dir, './runtime.ts');

  assert.equal(typeof Object.values(handlers ?? {})[0], 'function');
});

test('rejects an invalid handler-module export', async () => {
  const dir = makeTempDir('neew-runtime-');
  writeFile(join(dir, 'runtime.ts'), `export default 'invalid';\n`);

  await assert.rejects(
    () => loadRuntimeHandlers(dir, './runtime.ts'),
    /expected a default export of a handler registry/,
  );
});

test('rejects a handler path outside the repository', async () => {
  const dir = makeTempDir('neew-runtime-');

  await assert.rejects(() => loadRuntimeHandlers(dir, '../runtime.ts'), /must resolve within/);
});
