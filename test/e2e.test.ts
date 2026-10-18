import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../src/cli/run';
import {
  FIXTURE_APP,
  fixtureTarball,
  makeCapture,
  nonInteractiveAdapter,
  responseFor,
  writeFile,
} from './helpers';

test('end to end: add a fixture repository over the GitHub adapter and invoke its generator', async () => {
  const capture = makeCapture();
  const tarball = await fixtureTarball('app-main', FIXTURE_APP);
  const requested: string[] = [];
  const options = {
    env: capture.env,
    cwd: capture.cwd,
    stdout: (message: string) => capture.stdout.push(message),
    stderr: (message: string) => capture.stderr.push(message),
    adapter: nonInteractiveAdapter(),
    resolveCommit: async () => 'commit-1',
    downloadDeps: {
      fetch: async (input: string | URL | Request) => {
        requested.push(String(input));
        return responseFor(tarball);
      },
    },
  };

  const added = await runCli(['add', 'github.com/acme/app'], options);
  assert.equal(added.kind, 'added');
  assert.ok(requested.some((url) => url.includes('/tar.gz/commit-1')));
  assert.match(capture.stdout.join('\n'), /Added github\.com\/acme\/app/);

  const result = await runCli(['component', '--name', 'UserProfile'], options);
  assert.equal(result.kind, 'run');
  const file = join(capture.cwd, 'src', 'components', 'user-profile', 'UserProfile.tsx');
  assert.ok(existsSync(file), 'generated file lands below the working directory');
  assert.match(readFileSync(file, 'utf8'), /UserProfile/);

  const dryRun = await runCli(['component', '--name', 'Other', '--dry-run'], options);
  assert.equal(dryRun.kind, 'run');
  assert.equal(dryRun.written, false);
  assert.equal(existsSync(join(capture.cwd, 'src', 'components', 'other')), false);

  const target = join(capture.cwd, 'src', 'components', 'user-profile', 'UserProfile.tsx');
  writeFile(target, '// existing\n');
  await assert.rejects(
    () => runCli(['component', '--name', 'UserProfile'], options),
    /Refusing to overwrite/,
  );
  await runCli(['component', '--name', 'UserProfile', '--force'], options);
  assert.match(readFileSync(target, 'utf8'), /UserProfile/);
});

test('end to end: a second repository exposing the same generator name is rejected', async () => {
  const capture = makeCapture();
  const tarball = await fixtureTarball('app-main', FIXTURE_APP);
  const options = {
    env: capture.env,
    cwd: capture.cwd,
    stdout: (message: string) => capture.stdout.push(message),
    stderr: (message: string) => capture.stderr.push(message),
    adapter: nonInteractiveAdapter(),
    resolveCommit: async () => 'commit-1',
    downloadDeps: {
      fetch: async () => responseFor(tarball),
    },
  };

  await runCli(['add', 'github.com/acme/app'], options);

  await assert.rejects(
    () => runCli(['add', 'github.com/acme/other'], options),
    /collision.*component/s,
  );
});
