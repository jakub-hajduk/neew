import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cacheEntryDir,
  METADATA_FILENAME,
  readMetadata,
  removeCacheEntry,
  writeMetadata,
} from '../src/engine/cache';
import { parseSource } from '../src/engine/source';
import { makeTempDir, writeFile } from './helpers';

test('cache entries live under sources/<host>/<owner>/<repo>@<ref>', () => {
  const root = '/cache/neew';
  const withRef = parseSource('github.com/acme/templates#main');
  const withDefault = parseSource('github.com/acme/templates');
  assert.equal(
    cacheEntryDir(root, withRef),
    join('/cache/neew', 'sources', 'github.com', 'acme', 'templates@main'),
  );
  assert.equal(
    cacheEntryDir(root, withDefault),
    join('/cache/neew', 'sources', 'github.com', 'acme', 'templates@HEAD'),
  );
});

test('metadata is written inside the cache entry and read back', () => {
  const root = makeTempDir('neew-cache-');
  const source = parseSource('github.com/acme/templates');
  const dir = cacheEntryDir(root, source);
  writeFile(join(dir, 'README.md'), '# repo');
  writeMetadata(dir, {
    url: source.url,
    ref: null,
    subdir: null,
    commit: 'abc123',
    fetchedAt: '2026-01-01T00:00:00.000Z',
  });

  const metadata = readMetadata(dir);
  assert.equal(metadata?.commit, 'abc123');
  assert.ok(existsSync(join(dir, METADATA_FILENAME)));
});

test('metadata is discarded together with the cache entry', () => {
  const root = makeTempDir('neew-cache-');
  const source = parseSource('github.com/acme/templates');
  const dir = cacheEntryDir(root, source);
  writeMetadata(dir, {
    url: source.url,
    ref: null,
    subdir: null,
    commit: 'abc123',
    fetchedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(readMetadata(dir)?.commit, 'abc123');

  removeCacheEntry(root, source);

  assert.equal(existsSync(dir), false);
  assert.equal(readMetadata(dir), undefined);
});

test('metadata round-trips the resolved ref and subdir', () => {
  const root = makeTempDir('neew-cache-');
  const source = parseSource('github.com/acme/templates::pkg#dev');
  const dir = cacheEntryDir(root, source);
  writeMetadata(dir, {
    url: source.url,
    ref: 'dev',
    subdir: 'pkg',
    commit: 'deadbeef',
    fetchedAt: '2026-01-01T00:00:00.000Z',
  });
  const parsed = JSON.parse(readFileSync(join(dir, METADATA_FILENAME), 'utf8')) as {
    ref: string;
    subdir: string;
  };
  assert.equal(parsed.ref, 'dev');
  assert.equal(parsed.subdir, 'pkg');
});
