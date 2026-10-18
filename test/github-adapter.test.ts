import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { downloadGithub, githubTarballUrl, tarballStrip } from '../src/engine/adapters/github';
import { getDownloadAdapter, UnsupportedHostError } from '../src/engine/adapters';
import { parseSource } from '../src/engine/source';
import { fixtureTarball, makeTempDir, responseFor } from './helpers';

test('the GitHub tarball URL requests the exact ref', () => {
  const source = parseSource('github.com/acme/templates');
  assert.equal(
    githubTarballUrl(source, 'abc123'),
    'https://codeload.github.com/acme/templates/tar.gz/abc123',
  );
});

test('the strip count accounts for the archived top directory and subdir', () => {
  assert.equal(tarballStrip(undefined), 1);
  assert.equal(tarballStrip('packages/foo'), 3);
});

test('an unknown host fails with a clear unsupported-host error', () => {
  assert.throws(() => getDownloadAdapter('gitlab.com'), UnsupportedHostError);
  assert.throws(() => getDownloadAdapter('gitlab.com'), /Unsupported host "gitlab\.com"/);
  assert.equal(getDownloadAdapter('github.com').host, 'github.com');
});

test('GitHub downloads extract the whole repository when no subdir is given', async () => {
  const source = parseSource('github.com/acme/templates');
  const dest = makeTempDir('neew-dl-');
  const requested: string[] = [];
  const tarball = await fixtureTarball('templates-main');

  await downloadGithub(
    source,
    dest,
    { ref: 'abc123' },
    {
      fetch: async (input) => {
        requested.push(String(input));
        return responseFor(tarball);
      },
    },
  );

  assert.deepEqual(requested, ['https://codeload.github.com/acme/templates/tar.gz/abc123']);
  assert.ok(existsSync(join(dest, 'generators.ts')));
  assert.ok(existsSync(join(dest, 'generators', 'component.generator.ts')));
});

test('GitHub downloads extract only the requested subdirectory', async () => {
  const source = parseSource('github.com/acme/templates::generators');
  const dest = makeTempDir('neew-dl-');
  const tarball = await fixtureTarball('templates-main');

  await downloadGithub(
    source,
    dest,
    { ref: 'abc123', subdir: 'generators' },
    {
      fetch: async () => responseFor(tarball),
    },
  );

  assert.ok(existsSync(join(dest, 'component.generator.ts')));
  assert.equal(existsSync(join(dest, 'generators.ts')), false);
});

test('a failed download reports the response status', async () => {
  const source = parseSource('github.com/acme/templates');
  const dest = makeTempDir('neew-dl-');
  await assert.rejects(
    () =>
      downloadGithub(
        source,
        dest,
        { ref: 'abc123' },
        {
          fetch: async () => responseFor(Buffer.from(''), false),
        },
      ),
    /Failed to download .*: 404/,
  );
});
