import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBarrel } from '../src/config/load-barrel';
import { FIXTURE_REPO, makeTempDir } from './helpers';

test('the documented repository contract loads through the loader', async () => {
  const barrel = await loadBarrel(FIXTURE_REPO);
  assert.deepEqual(barrel.config.generators, ['./generators/*.generator.ts']);
  assert.equal(barrel.dir, FIXTURE_REPO);
});

test('a missing barrel reports the missing file', async () => {
  await assert.rejects(() => loadBarrel(makeTempDir('neew-empty-')), /no generators\.ts found/);
});
