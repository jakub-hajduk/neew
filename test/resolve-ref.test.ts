import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickCommit, resolveCommit } from '../src/engine/resolve-ref';
import { parseSource } from '../src/engine/source';

const REFS = [
  { ref: 'HEAD', oid: 'head-oid', target: 'refs/heads/main' },
  { ref: 'refs/heads/main', oid: 'main-commit' },
  { ref: 'refs/heads/feature', oid: 'feature-commit' },
  { ref: 'refs/tags/v1', oid: 'tag-object', peeled: 'tag-commit' },
];

test('an explicit branch resolves to its commit', () => {
  const source = parseSource('github.com/acme/templates#feature');
  assert.equal(resolveCommitFromRefs(source, REFS), 'feature-commit');
});

test('an annotated tag peels to its commit', () => {
  const source = parseSource('github.com/acme/templates#v1');
  assert.equal(resolveCommitFromRefs(source, REFS), 'tag-commit');
});

test('no ref resolves the default branch from the HEAD symref', () => {
  const source = parseSource('github.com/acme/templates');
  assert.equal(resolveCommitFromRefs(source, REFS), 'main-commit');
});

test('a missing ref fails clearly', () => {
  const source = parseSource('github.com/acme/templates#missing');
  assert.throws(() => resolveCommitFromRefs(source, REFS), /not found/);
});

test('resolveCommit asks for symrefs and peeled tags without spawning git', async () => {
  const calls: unknown[] = [];
  const source = parseSource('github.com/acme/templates');
  const commit = await resolveCommit(source, {
    listServerRefs: async (options) => {
      calls.push(options);
      return REFS;
    },
  });
  assert.equal(commit, 'main-commit');
  assert.equal(calls.length, 1);
  const options = calls[0] as Record<string, unknown>;
  assert.equal(options.url, 'https://github.com/acme/templates');
  assert.equal(options.symrefs, true);
  assert.equal(options.peelTags, true);
  assert.ok(options.http);
});

test('ref resolution never shells out to a git binary', () => {
  const source = readFileSync(
    join(import.meta.dirname, '..', 'src', 'engine', 'resolve-ref.ts'),
    'utf8',
  );
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /execSync|execFileSync|spawnSync/);
  assert.match(source, /isomorphic-git/);
});

function resolveCommitFromRefs(source: ReturnType<typeof parseSource>, refs: typeof REFS): string {
  return pickCommit(refs, source);
}
