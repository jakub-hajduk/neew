import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stageFile, type RunContext } from '@trut/gen/runtime';
import { runCli } from '../src/cli/run';
import { readRegistry } from '../src/config/registry-file';
import {
  copyRepo,
  FIXTURE_APP,
  generatorModule,
  makeCapture,
  makeTempDir,
  nonInteractiveAdapter,
  writeFile,
  writeRepo,
} from './helpers';

type CliOptions = NonNullable<Parameters<typeof runCli>[1]>;

function baseOptions(capture: ReturnType<typeof makeCapture>, repoDir: string) {
  return {
    env: capture.env,
    cwd: capture.cwd,
    stdout: (message: string) => capture.stdout.push(message),
    stderr: (message: string) => capture.stderr.push(message),
    adapter: nonInteractiveAdapter(),
    resolveCommit: async () => 'commit-1',
    download: copyRepo(repoDir),
  } satisfies CliOptions;
}

async function addFixture(capture: ReturnType<typeof makeCapture>, repoDir = FIXTURE_APP) {
  await runCli(['add', 'github.com/acme/templates'], baseOptions(capture, repoDir));
}

function projectGeneratorModule(projectName: string, prompts: string): string {
  return `import { defineGenerator${prompts ? ', text' : ''} } from '@trut/gen';
export const projectName = ${JSON.stringify(projectName)};
export default defineGenerator({
  name: 'project',
  basePath: '.',
  ${prompts ? `prompts: { ${prompts}: text({ message: 'Project name' }) },` : ''}
  actions: [],
});
`;
}

function customActionGenerator(name: string, actions: string): string {
  return `import { defineGenerator } from '@trut/gen';
export default defineGenerator({
  name: ${JSON.stringify(name)},
  basePath: '.',
  actions: ${actions},
});
`;
}

test('bare neew prints the commands followed by the available generators', async () => {
  const capture = makeCapture();
  let result = await runCli([], baseOptions(capture, FIXTURE_APP));
  assert.equal(result.kind, 'help');
  let output = capture.stdout.join('\n');
  assert.match(output, /neew add <link>/);
  assert.match(output, /neew remove <link>/);
  assert.match(output, /neew list/);
  assert.match(output, /Generators:/);
  assert.match(output, /\(none registered\)/);

  await addFixture(capture);
  capture.stdout.length = 0;
  result = await runCli([], baseOptions(capture, FIXTURE_APP));
  output = capture.stdout.join('\n');
  assert.match(output, /Generators:/);
  assert.match(output, /component/);
});

test('the shortcut and create produce identical files and honor the target directory', async () => {
  const capture = makeCapture();
  await addFixture(capture);

  const shortcutCwd = makeTempDir('neew-shortcut-');
  await runCli(['component', '--name', 'UserProfile'], {
    ...baseOptions(capture, FIXTURE_APP),
    cwd: shortcutCwd,
  });
  const shortcutFile = join(shortcutCwd, 'src', 'components', 'user-profile', 'UserProfile.tsx');
  assert.ok(existsSync(shortcutFile), 'shortcut wrote the file');

  const createCwd = makeTempDir('neew-create-');
  await runCli(['create', 'component', '--name', 'UserProfile'], {
    ...baseOptions(capture, FIXTURE_APP),
    cwd: createCwd,
  });
  const createFile = join(createCwd, 'src', 'components', 'user-profile', 'UserProfile.tsx');
  assert.ok(existsSync(createFile), 'create wrote the file');
  assert.equal(readFileSync(shortcutFile, 'utf8'), readFileSync(createFile, 'utf8'));

  const target = makeTempDir('neew-target-');
  await runCli(['component', '--name', 'Widget', '--target', target], {
    ...baseOptions(capture, FIXTURE_APP),
  });
  assert.ok(existsSync(join(target, 'src', 'components', 'widget', 'Widget.tsx')));
});

test('neew <generator> --help lists parameters and global options without writing files', async () => {
  const capture = makeCapture();
  await addFixture(capture);

  const result = await runCli(['component', '--help'], baseOptions(capture, FIXTURE_APP));

  assert.equal(result.kind, 'generator-help');
  const output = capture.stdout.join('\n');
  assert.match(output, /Parameters:/);
  assert.match(output, /--name <value>/);
  assert.match(output, /--dry-run/);
  assert.match(output, /--force/);
  assert.equal(existsSync(join(capture.cwd, 'src')), false);
});

test('a changed source re-indexes and a removed generator fails clearly', async () => {
  const capture = makeCapture();
  const v1 = writeRepo(makeTempDir('neew-v1-'), {
    modules: [{ file: 'generators/a.generator.ts', contents: generatorModule('component') }],
  });
  const v2 = writeRepo(makeTempDir('neew-v2-'), {
    modules: [{ file: 'generators/a.generator.ts', contents: generatorModule('widget') }],
  });
  let activeRepo = v1;
  let activeCommit = 'commit-1';
  const options: CliOptions = {
    env: capture.env,
    cwd: capture.cwd,
    stdout: (message) => capture.stdout.push(message),
    stderr: (message) => capture.stderr.push(message),
    adapter: nonInteractiveAdapter(),
    resolveCommit: async () => activeCommit,
    download: async (_source, dest) => {
      cpSync(activeRepo, dest, { recursive: true });
    },
  };

  await runCli(['add', 'github.com/acme/templates'], options);
  activeRepo = v2;
  activeCommit = 'commit-2';

  await assert.rejects(() => runCli(['component'], options), /no longer provided.*widget/);

  const entry = readRegistry(capture.env).repositories['github.com/acme/templates'];
  assert.deepEqual(
    entry.generators.map((generator) => generator.name),
    ['widget'],
  );
});

test('an unknown generator fails and lists the available generators', async () => {
  const capture = makeCapture();
  await addFixture(capture);

  await assert.rejects(
    () => runCli(['nope'], baseOptions(capture, FIXTURE_APP)),
    /Unknown generator "nope".*component/,
  );
});

test('a missing required parameter fails and names its flag', async () => {
  const capture = makeCapture();
  await addFixture(capture);

  await assert.rejects(
    () => runCli(['component'], baseOptions(capture, FIXTURE_APP)),
    /Missing required value.*--name/,
  );
});

test('a projectName export requires a matching projectName prompt', async () => {
  const capture = makeCapture();
  const repo = writeRepo(makeTempDir('neew-project-prompt-'), {
    modules: [
      {
        file: 'generators/project.generator.ts',
        contents: projectGeneratorModule('Template Name', ''),
      },
    ],
  });
  await addFixture(capture, repo);

  await assert.rejects(
    () => runCli(['project'], baseOptions(capture, repo)),
    /exports "projectName" but does not declare a "projectName" prompt/,
  );
});

test('a projectName export must be a non-empty string', async () => {
  const capture = makeCapture();
  const repo = writeRepo(makeTempDir('neew-project-name-'), {
    modules: [
      {
        file: 'generators/project.generator.ts',
        contents: projectGeneratorModule('', 'projectName'),
      },
    ],
  });
  await addFixture(capture, repo);

  await assert.rejects(
    () => runCli(['project', '--project-name', 'My App'], baseOptions(capture, repo)),
    /not a non-empty string/,
  );
});

test('a valid projectName export invokes a generator', async () => {
  const capture = makeCapture();
  const repo = writeRepo(makeTempDir('neew-project-generator-'), {
    modules: [
      {
        file: 'generators/project.generator.ts',
        contents: projectGeneratorModule('Template Name', 'projectName'),
      },
    ],
  });
  await addFixture(capture, repo);

  const result = await runCli(['project', '--project-name', 'My App'], baseOptions(capture, repo));
  assert.equal(result.kind, 'run');
});

test('dry-run reports planned files without writing them', async () => {
  const capture = makeCapture();
  await addFixture(capture);

  const result = await runCli(['component', '--name', 'Foo', '--dry-run'], {
    ...baseOptions(capture, FIXTURE_APP),
  });

  assert.equal(result.kind, 'run');
  assert.equal(result.written, false);
  assert.match(capture.stdout.join('\n'), /Dry run for "component"/);
  assert.equal(existsSync(join(capture.cwd, 'src')), false);
});

test('a repository without runtime handlers runs without calling the injected loader', async () => {
  const capture = makeCapture();
  const repo = writeRepo(makeTempDir('neew-runtime-actions-'), {
    modules: [
      {
        file: 'generators/runtime.generator.ts',
        contents: generatorModule('runtime'),
      },
    ],
  });
  await addFixture(capture, repo);

  let loads = 0;
  const result = await runCli(['runtime'], {
    ...baseOptions(capture, repo),
    runtimeHandlerLoader: async () => {
      loads += 1;
      return {};
    },
  });

  assert.equal(result.kind, 'run');
  assert.equal(loads, 0, 'a repository without runtime configuration skips the loader');
});

test('an async runtime handler stages output and prepares later actions', async () => {
  const capture = makeCapture();
  const repo = writeRepo(makeTempDir('neew-runtime-actions-'), {
    barrel:
      `export default { generators: ['./generators/*.generator.ts'], ` +
      `runtime: { handlers: './runtime.ts' } };\n`,
    modules: [
      {
        file: 'generators/runtime.generator.ts',
        contents: customActionGenerator(
          'runtime',
          `[{ type: 'test/prepare' }, { type: 'test/write' }]`,
        ),
      },
    ],
  });
  await addFixture(capture, repo);

  let loads = 0;
  await runCli(['runtime'], {
    ...baseOptions(capture, repo),
    runtimeHandlerLoader: async () => {
      loads += 1;
      return {
        'test/prepare': async (_action: unknown, context: RunContext) => {
          await Promise.resolve();
          context.answers.message = 'prepared';
          stageFile(context, join(context.basePath, 'prepared.txt'), 'prepared\n');
        },
        'test/write': (_action: unknown, context: RunContext) => {
          stageFile(context, join(context.basePath, 'result.txt'), `${context.answers.message}\n`);
        },
      } as never;
    },
  });

  assert.equal(loads, 1);
  assert.equal(readFileSync(join(capture.cwd, 'prepared.txt'), 'utf8'), 'prepared\n');
  assert.equal(readFileSync(join(capture.cwd, 'result.txt'), 'utf8'), 'prepared\n');
});

test('a rejecting async runtime handler commits no staged output', async () => {
  const capture = makeCapture();
  const repo = writeRepo(makeTempDir('neew-runtime-actions-'), {
    barrel:
      `export default { generators: ['./generators/*.generator.ts'], ` +
      `runtime: { handlers: './runtime.ts' } };\n`,
    modules: [
      {
        file: 'generators/runtime.generator.ts',
        contents: customActionGenerator(
          'runtime',
          `[{ type: 'test/stage' }, { type: 'test/fail' }]`,
        ),
      },
    ],
  });
  await addFixture(capture, repo);

  await assert.rejects(
    () =>
      runCli(['runtime'], {
        ...baseOptions(capture, repo),
        runtimeHandlerLoader: async () =>
          ({
            'test/stage': (_action: unknown, context: RunContext) => {
              stageFile(context, join(context.basePath, 'partial.txt'), 'partial\n');
            },
            'test/fail': async () => {
              throw new Error('runtime handler failed');
            },
          }) as never,
      }),
    /runtime handler failed/,
  );
  assert.equal(existsSync(join(capture.cwd, 'partial.txt')), false);
});

test('runtime modules stay uninitialized until a generator runs', async () => {
  const capture = makeCapture();
  const marker = join(makeTempDir('neew-runtime-marker-'), 'initialized');
  const repo = writeRepo(makeTempDir('neew-runtime-module-'), {
    barrel:
      `export default { generators: ['./generators/*.generator.ts'], ` +
      `runtime: { handlers: './runtime.ts' } };\n`,
    modules: [{ file: 'generators/runtime.generator.ts', contents: generatorModule('runtime') }],
  });
  writeFile(
    join(repo, 'runtime.ts'),
    `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'loaded');\nexport default {};\n`,
  );

  await addFixture(capture, repo);
  await runCli(['list'], baseOptions(capture, repo));
  await runCli([], baseOptions(capture, repo));
  await runCli(['runtime', '--help'], baseOptions(capture, repo));
  assert.equal(existsSync(marker), false);

  await runCli(['runtime'], baseOptions(capture, repo));
  assert.equal(existsSync(marker), true);
});

test('force overwrites existing files while a collision fails without it', async () => {
  const capture = makeCapture();
  await addFixture(capture);
  const target = join(capture.cwd, 'src', 'components', 'foo', 'Foo.tsx');
  writeFile(target, '// existing\n');

  await assert.rejects(
    () => runCli(['component', '--name', 'Foo'], baseOptions(capture, FIXTURE_APP)),
    /Refusing to overwrite/,
  );
  assert.equal(readFileSync(target, 'utf8'), '// existing\n');

  await runCli(['component', '--name', 'Foo', '--force'], baseOptions(capture, FIXTURE_APP));
  assert.match(readFileSync(target, 'utf8'), /Foo/);
});

test('--version prints the package version', async () => {
  const capture = makeCapture();
  const result = await runCli(['--version'], baseOptions(capture, FIXTURE_APP));
  assert.equal(result.kind, 'version');
  assert.match(capture.stdout[0], /^\d+\.\d+\.\d+/);
});
