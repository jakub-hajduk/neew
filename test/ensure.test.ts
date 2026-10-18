import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cacheEntryDir, readMetadata, writeMetadata } from '../src/engine/cache';
import { ensure } from '../src/engine/ensure';
import { parseSource, type ParsedSource } from '../src/engine/source';
import { makeTempDir, writeFile } from './helpers';

function seedCache(root: string, source: ParsedSource, commit: string, marker: string): string {
  const dir = cacheEntryDir(root, source);
  writeFile(join(dir, 'marker.txt'), marker);
  writeMetadata(dir, {
    url: source.url,
    ref: source.ref ?? null,
    subdir: source.subdir ?? null,
    commit,
    fetchedAt: '2026-01-01T00:00:00.000Z',
  });
  return dir;
}

test('an unchanged ref reuses the cache without downloading', async () => {
  const root = makeTempDir('neew-ensure-');
  const source = parseSource('github.com/acme/templates');
  seedCache(root, source, 'commit-1', 'original');

  const result = await ensure(source, {
    cacheRoot: root,
    resolveCommit: async () => 'commit-1',
    download: async () => {
      throw new Error('download must not run');
    },
  });

  assert.equal(result.changed, false);
  assert.equal(result.offline, false);
  assert.equal(readFileSync(join(result.dir, 'marker.txt'), 'utf8'), 'original');
});

test('a changed ref downloads a new copy and replaces the cache atomically', async () => {
  const root = makeTempDir('neew-ensure-');
  const source = parseSource('github.com/acme/templates');
  const dir = seedCache(root, source, 'commit-1', 'original');

  const result = await ensure(source, {
    cacheRoot: root,
    resolveCommit: async () => 'commit-2',
    download: async (_source, dest) => {
      writeFile(join(dest, 'marker.txt'), 'updated');
    },
  });

  assert.equal(result.changed, true);
  assert.equal(result.metadata.commit, 'commit-2');
  assert.equal(readFileSync(join(dir, 'marker.txt'), 'utf8'), 'updated');
  assert.equal(readMetadata(dir)?.commit, 'commit-2');
});

test('an interrupted fetch leaves the previous copy intact', async () => {
  const root = makeTempDir('neew-ensure-');
  const source = parseSource('github.com/acme/templates');
  const dir = seedCache(root, source, 'commit-1', 'original');

  await assert.rejects(
    () =>
      ensure(source, {
        cacheRoot: root,
        resolveCommit: async () => 'commit-2',
        download: async (_source, dest) => {
          writeFile(join(dest, 'partial.txt'), 'partial');
          throw new Error('network dropped');
        },
      }),
    /network dropped/,
  );

  assert.equal(readFileSync(join(dir, 'marker.txt'), 'utf8'), 'original');
  assert.equal(readMetadata(dir)?.commit, 'commit-1');
});

test('a remote that cannot be reached falls back to the cached copy', async () => {
  const root = makeTempDir('neew-ensure-');
  const source = parseSource('github.com/acme/templates');
  seedCache(root, source, 'commit-1', 'original');
  const warnings: string[] = [];

  const result = await ensure(source, {
    cacheRoot: root,
    resolveCommit: async () => {
      throw new Error('ENOTFOUND');
    },
    warn: (message) => warnings.push(message),
  });

  assert.equal(result.changed, false);
  assert.equal(result.offline, true);
  assert.equal(readFileSync(join(result.dir, 'marker.txt'), 'utf8'), 'original');
  assert.equal(warnings.length, 1);
});

test('a remote that cannot be reached with no cache fails', async () => {
  const root = makeTempDir('neew-ensure-');
  const source = parseSource('github.com/acme/templates');
  await assert.rejects(
    () =>
      ensure(source, {
        cacheRoot: root,
        resolveCommit: async () => {
          throw new Error('ENOTFOUND');
        },
      }),
    /ENOTFOUND/,
  );
});
