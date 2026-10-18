import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { readRegistry, registryFilePath, writeRegistry } from '../src/config/registry-file';
import { makeTempEnv } from './helpers';

test('a missing registry reads as empty', () => {
  const env = makeTempEnv();
  assert.deepEqual(readRegistry(env), { repositories: {} });
  assert.equal(existsSync(registryFilePath(env)), false);
});

test('the registry round-trips through an atomic write', () => {
  const env = makeTempEnv();
  writeRegistry(
    {
      repositories: {
        'github.com/acme/templates': {
          source: 'github.com/acme/templates',
          url: 'https://github.com/acme/templates',
          generators: [{ name: 'component', path: 'generators/component.generator.ts' }],
        },
      },
    },
    env,
  );
  const registry = readRegistry(env);
  assert.equal(
    registry.repositories['github.com/acme/templates']?.generators[0]?.name,
    'component',
  );
});

test('a malformed registry fails loudly and is not overwritten', () => {
  const env = makeTempEnv();
  const path = registryFilePath(env);
  mkdirSync(dirname(path), { recursive: true });
  const malformed = '{ not json';
  writeFileSync(path, malformed, 'utf8');

  assert.throws(() => readRegistry(env), /Failed to parse the neew registry/);
  assert.equal(readFileSync(path, 'utf8'), malformed);
});
