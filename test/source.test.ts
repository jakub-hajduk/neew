import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSource, parseSource } from '../src/engine/source';

test('scheme is optional', () => {
  const withScheme = parseSource('https://github.com/acme/templates');
  const withoutScheme = parseSource('github.com/acme/templates');
  assert.equal(withScheme.url, 'https://github.com/acme/templates');
  assert.equal(canonicalSource(withScheme), canonicalSource(withoutScheme));
});

test('giget-style shorthand normalizes to the same identity as a URL', () => {
  const shorthand = parseSource('gh:acme/templates#main');
  const url = parseSource('https://github.com/acme/templates#main');
  assert.equal(canonicalSource(shorthand), canonicalSource(url));
  assert.equal(shorthand.host, 'github.com');
  assert.equal(shorthand.owner, 'acme');
  assert.equal(shorthand.repo, 'templates');
  assert.equal(shorthand.ref, 'main');
});

test('github: prefix and bare shorthand resolve to github.com', () => {
  assert.equal(parseSource('github:acme/templates').host, 'github.com');
  const bare = parseSource('acme/templates');
  assert.equal(bare.host, 'github.com');
  assert.equal(bare.owner, 'acme');
  assert.equal(bare.repo, 'templates');
});

test('the :: separator marks a subdirectory', () => {
  const source = parseSource('github.com/acme/templates::packages/foo');
  assert.equal(source.subdir, 'packages/foo');
  assert.equal(source.repo, 'templates');
  assert.equal(canonicalSource(source), 'github.com/acme/templates::packages/foo');
});

test('extra path segments also mark a subdirectory', () => {
  const source = parseSource('gh:acme/templates/packages/foo');
  assert.equal(source.subdir, 'packages/foo');
  assert.equal(source.owner, 'acme');
  assert.equal(source.repo, 'templates');
});

test('a #ref is captured and optional', () => {
  assert.equal(parseSource('github.com/acme/templates#v1').ref, 'v1');
  assert.equal(parseSource('github.com/acme/templates').ref, undefined);
});

test('canonical identity ignores scheme, trailing slash, .git, and host case', () => {
  const expected = canonicalSource(parseSource('https://github.com/acme/templates'));
  const variants = [
    'https://github.com/acme/templates',
    'github.com/acme/templates',
    'https://github.com/acme/templates/',
    'https://github.com/acme/templates.git',
    'https://GitHub.com/acme/templates',
    'gh:acme/templates',
    'acme/templates',
  ];
  for (const variant of variants) {
    assert.equal(canonicalSource(parseSource(variant)), expected, variant);
  }
});
