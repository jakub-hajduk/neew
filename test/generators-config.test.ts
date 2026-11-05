import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { defineGenerators, defineRuntimeHandlers } from '../src/index';
import { loadBarrel } from '../src/config/load-barrel';
import { makeTempDir, writeFile } from './helpers';

test('defineGenerators returns its config unchanged', () => {
  const config = defineGenerators({ generators: ['./generators/*.generator.ts'] });
  assert.deepEqual(config.generators, ['./generators/*.generator.ts']);
});

test('defineGenerators preserves an optional runtime handler path', () => {
  const config = defineGenerators({
    generators: ['./generators/*.generator.ts'],
    runtime: { handlers: './runtime/handlers.ts' },
  });

  assert.equal(config.runtime?.handlers, './runtime/handlers.ts');
});

test('defineRuntimeHandlers returns its registry unchanged', () => {
  const handlers = defineRuntimeHandlers({ 'acme/example': async () => {} } as never);
  assert.equal(typeof handlers['acme/example'], 'function');
});

test('a barrel written with defineGenerators loads back without the runtime engine', async () => {
  const dir = makeTempDir('neew-barrel-');
  const sourceIndex = join(import.meta.dirname, '..', 'src', 'index.ts');
  writeFile(
    join(dir, 'generators.ts'),
    `import { defineGenerators } from '${sourceIndex}';\n` +
      `export default defineGenerators({ generators: ['./generators/*.generator.ts'] });\n`,
  );

  const barrel = await loadBarrel(dir);

  assert.deepEqual(barrel.config.generators, ['./generators/*.generator.ts']);
});
