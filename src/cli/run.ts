import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverGenerators,
  parseGlobalFlags,
  parsePromptValues,
  resolvePrompts,
  runGenerator,
  flagNameFor,
} from '@trut/gen/runtime';
import type { PromptAdapter, DiscoveredGenerator } from '@trut/gen/runtime';
import type { AnyPrompt } from '@trut/gen';
import type { Environment } from '../config/paths';
import { resolveCacheRoot } from '../config/paths';
import { createRepositoryJiti } from '../config/create-loader';
import { loadBarrel } from '../config/load-barrel';
import { readRegistry, writeRegistry, type RegistryEntry } from '../config/registry-file';
import type { DownloadDeps } from '../engine/adapters';
import type { EnsureDeps } from '../engine/ensure';
import type { ResolveRefDeps } from '../engine/resolve-ref';
import { ensure } from '../engine/ensure';
import {
  addSource,
  findGeneratorByName,
  listRegistered,
  removeSource,
  sourceFromEntry,
  type RegistryDeps,
} from '../registry/operations';
import { createClackAdapter } from './prompt-adapter';
import { createProjectNameTemplateAdapter } from './project-name-template-adapter';

export interface CliOptions {
  env?: Environment;
  cwd?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
  adapter?: PromptAdapter;
  resolveCommit?: EnsureDeps['resolveCommit'];
  download?: EnsureDeps['download'];
  downloadDeps?: DownloadDeps;
  resolveDeps?: ResolveRefDeps;
}

export type CliResult =
  | { kind: 'help' }
  | { kind: 'version'; version: string }
  | { kind: 'added'; entry: RegistryEntry }
  | { kind: 'removed'; entry: RegistryEntry }
  | { kind: 'list'; entries: RegistryEntry[] }
  | { kind: 'generator-help'; generator: string }
  | { kind: 'run'; generator: string; files: string[]; written: boolean };

interface Context {
  env: Environment;
  cwd: string;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  adapter: PromptAdapter;
  registryDeps: RegistryDeps;
}

const GLOBAL_OPTIONS: Array<[string, string]> = [
  ['--target <dir>', 'Write generated files into <dir> instead of the current directory'],
  ['--dry-run', 'Report the files that would be written without writing them'],
  ['--force', 'Replace existing files that collide with generated output'],
  ['-h, --help', 'Show this help'],
  ['-v, --version', 'Show the version'],
];

function usageText(entries: RegistryEntry[]): string {
  const lines: string[] = [];
  lines.push('neew - manage and run remote generator repositories');
  lines.push('');
  lines.push('Usage:');
  lines.push('  neew add <link>');
  lines.push('  neew remove <link>');
  lines.push('  neew list');
  lines.push('  neew create <generator> [options]');
  lines.push('  neew <generator> [options]');
  lines.push('');
  lines.push('Options:');
  for (const [flag, description] of GLOBAL_OPTIONS) {
    lines.push(`  ${flag.padEnd(16)} ${description}`);
  }
  lines.push('');
  lines.push('Generators:');
  const generatorLines = entries.flatMap((entry) =>
    entry.generators.map(
      (generator) =>
        `  ${generator.name}${generator.description ? `    ${generator.description}` : ''}`,
    ),
  );
  if (generatorLines.length === 0) {
    lines.push('  (none registered)');
  } else {
    lines.push(...generatorLines);
  }
  return lines.join('\n');
}

function parameterLines(generator: DiscoveredGenerator): string[] {
  const prompts = (generator.generator.prompts ?? {}) as Record<string, AnyPrompt>;
  const keys = Object.keys(prompts);
  if (keys.length === 0) return ['  (no parameters)'];
  return keys.map((key) => {
    const prompt = prompts[key];
    const flag = `--${flagNameFor(key)}`;
    const value = prompt.type === 'confirm' ? '' : ' <value>';
    const alias = prompt.alias ? `-${prompt.alias}, ` : '';
    const required = prompt.default === undefined ? ' (required)' : '';
    const fallback = prompt.default === undefined ? '' : ` [default: ${prompt.default}]`;
    const description = prompt.message ? `  ${prompt.message}` : '';
    return `  ${alias}${flag}${value}${description}${required}${fallback}`;
  });
}

function generatorHelpText(generator: DiscoveredGenerator): string {
  const name = generator.generator.name;
  const lines: string[] = [];
  lines.push(
    `neew ${name}${generator.generator.description ? ` - ${generator.generator.description}` : ''}`,
  );
  lines.push('');
  lines.push('Usage:');
  lines.push(`  neew ${name} [options]`);
  lines.push(`  neew create ${name} [options]`);
  lines.push('');
  lines.push('Parameters:');
  lines.push(...parameterLines(generator));
  lines.push('');
  lines.push('Options:');
  for (const [flag, description] of GLOBAL_OPTIONS) {
    if (flag === '--target <dir>') lines.push(`  ${flag.padEnd(16)} ${description}`);
  }
  lines.push('  --dry-run          Report the files that would be written without writing them');
  lines.push('  --force            Replace existing files that collide with generated output');
  lines.push('  -h, --help         Show this help');
  lines.push('  -v, --version      Show the version');
  return lines.join('\n');
}

function readVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
          name?: string;
          version?: string;
        };
        if (pkg.name === '@trut/neew') return pkg.version ?? '0.0.0';
      } catch {
        // ignore and keep walking up
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return '0.0.0';
    dir = parent;
  }
}

function availableNames(entries: RegistryEntry[]): string {
  const names = entries.flatMap((entry) => entry.generators.map((generator) => generator.name));
  return names.length === 0 ? '(none)' : names.join(', ');
}

function printUsage(context: Context): void {
  let entries: RegistryEntry[] = [];
  try {
    entries = listRegistered(context.registryDeps);
  } catch (error) {
    context.stderr(`warning: ${error instanceof Error ? error.message : String(error)}`);
  }
  context.stdout(usageText(entries));
}

function report(
  stdout: (message: string) => void,
  generatorName: string,
  files: string[],
  dryRun: boolean,
): void {
  if (dryRun) {
    stdout(`Dry run for "${generatorName}": ${files.length} file(s) would be written.`);
  } else {
    stdout(`Generator "${generatorName}" wrote ${files.length} file(s).`);
  }
  for (const file of files) stdout(`  ${file}`);
}

function extractTarget(args: string[], cwd: string): { targetDir: string; rest: string[] } {
  const rest: string[] = [];
  let target: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--target') {
      target = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
      continue;
    }
    rest.push(arg);
  }
  return { targetDir: target ? resolve(cwd, target) : cwd, rest };
}

async function addCommand(rest: string[], context: Context): Promise<CliResult> {
  const link = rest.find((arg) => !arg.startsWith('-'));
  if (!link) throw new Error('Usage: neew add <link>');
  const entry = await addSource(link, context.registryDeps);
  context.stdout(`Added ${entry.source}`);
  for (const generator of entry.generators) {
    context.stdout(
      `  ${generator.name}${generator.description ? `    ${generator.description}` : ''}`,
    );
  }
  return { kind: 'added', entry };
}

function removeCommand(rest: string[], context: Context): CliResult {
  const link = rest.find((arg) => !arg.startsWith('-'));
  if (!link) throw new Error('Usage: neew remove <link>');
  const entry = removeSource(link, context.registryDeps);
  context.stdout(`Removed ${entry.source}`);
  return { kind: 'removed', entry };
}

function listCommand(context: Context): CliResult {
  const entries = listRegistered(context.registryDeps);
  if (entries.length === 0) {
    context.stdout('No repositories registered.');
    return { kind: 'list', entries };
  }
  for (const entry of entries) {
    context.stdout(entry.source);
    if (entry.generators.length === 0) {
      context.stdout('  (no generators)');
    }
    for (const generator of entry.generators) {
      context.stdout(
        `  ${generator.name}${generator.description ? `    ${generator.description}` : ''}`,
      );
    }
  }
  return { kind: 'list', entries };
}

async function loadGenerator(
  name: string,
  context: Context,
): Promise<{ found: DiscoveredGenerator; entry: RegistryEntry; repoDir: string }> {
  const entries = listRegistered(context.registryDeps);
  const located = findGeneratorByName(entries, name);
  if (!located) {
    throw new Error(
      `Unknown generator "${name}". Available generators: ${availableNames(entries)}.`,
    );
  }
  const source = sourceFromEntry(located.entry);
  const ensured = await ensure(source, context.registryDeps);
  const jiti = createRepositoryJiti(ensured.dir);
  const barrel = await loadBarrel(ensured.dir, { jiti });
  const discovered = await discoverGenerators({
    configDir: ensured.dir,
    patterns: barrel.config.generators,
    jiti,
  });
  if (ensured.changed) {
    const indexed = discovered.map((entry) => ({
      name: entry.generator.name,
      path: relative(ensured.dir, entry.modulePath),
      ...(entry.generator.description ? { description: entry.generator.description } : {}),
    }));
    const registry = readRegistry(context.env);
    writeRegistry(
      {
        repositories: {
          ...registry.repositories,
          [located.entry.source]: { ...located.entry, generators: indexed },
        },
      },
      context.env,
    );
  }
  const found = discovered.find((entry) => entry.generator.name === name);
  if (!found) {
    const names = discovered.map((entry) => entry.generator.name);
    throw new Error(
      `Generator "${name}" is no longer provided by ${located.entry.source}. Available generators: ${
        names.length === 0 ? '(none)' : names.join(', ')
      }.`,
    );
  }
  return { found, entry: located.entry, repoDir: ensured.dir };
}

async function projectNameFromModule(
  modulePath: string,
  repositoryDir: string,
): Promise<string | undefined> {
  const moduleExports = await createRepositoryJiti(repositoryDir).import(modulePath);
  if (typeof moduleExports !== 'object' || moduleExports === null) return undefined;

  const projectName = (moduleExports as Record<string, unknown>).projectName;
  if (projectName === undefined) return undefined;
  if (typeof projectName !== 'string' || projectName.trim() === '') {
    throw new Error(
      `Generator module ${modulePath} exports "projectName" but it is not a non-empty string.`,
    );
  }
  return projectName;
}

async function invoke(argv: string[], context: Context, isCreate: boolean): Promise<CliResult> {
  const argOffset = isCreate ? 1 : 0;
  const generatorArgv = argv.slice(argOffset);
  const { global, generatorName } = parseGlobalFlags(generatorArgv);
  if (global.version) {
    const version = readVersion();
    context.stdout(version);
    return { kind: 'version', version };
  }
  if (!generatorName) {
    printUsage(context);
    return { kind: 'help' };
  }

  const { found, repoDir } = await loadGenerator(generatorName, context);

  if (global.help) {
    context.stdout(generatorHelpText(found));
    return { kind: 'generator-help', generator: generatorName };
  }

  const sourceProjectName = await projectNameFromModule(found.modulePath, repoDir);
  if (sourceProjectName && !Object.hasOwn(found.generator.prompts ?? {}, 'projectName')) {
    throw new Error(
      `Generator "${generatorName}" exports "projectName" but does not declare a "projectName" prompt.`,
    );
  }
  const { targetDir, rest } = extractTarget(generatorArgv, context.cwd);
  const values = parsePromptValues(rest, found.generator.prompts ?? {});
  const answers = await resolvePrompts({
    prompts: found.generator.prompts,
    values,
    adapter: context.adapter,
  });
  const result = await runGenerator({
    generator: found.generator,
    configDir: targetDir,
    moduleDir: found.moduleDir || repoDir,
    answers,
    dryRun: global.dryRun,
    force: global.force,
    ...(sourceProjectName
      ? { templateAdapter: createProjectNameTemplateAdapter(sourceProjectName) }
      : {}),
  });
  report(context.stdout, generatorName, result.files, global.dryRun);
  return {
    kind: 'run',
    generator: generatorName,
    files: result.files,
    written: result.written,
  };
}

export async function runCli(argv: string[], options: CliOptions = {}): Promise<CliResult> {
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = options.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));
  const cacheRoot = resolveCacheRoot(env);
  const context: Context = {
    env,
    cwd: options.cwd ?? process.cwd(),
    stdout,
    stderr,
    adapter: options.adapter ?? createClackAdapter(),
    registryDeps: {
      cacheRoot,
      env,
      ...(options.resolveCommit ? { resolveCommit: options.resolveCommit } : {}),
      ...(options.download ? { download: options.download } : {}),
      ...(options.downloadDeps ? { downloadDeps: options.downloadDeps } : {}),
      ...(options.resolveDeps ? { resolveDeps: options.resolveDeps } : {}),
      warn: (message) => stderr(`warning: ${message}`),
    },
  };

  const [command, ...rest] = argv;
  if (command === undefined) {
    printUsage(context);
    return { kind: 'help' };
  }
  if (command === '-h' || command === '--help') {
    printUsage(context);
    return { kind: 'help' };
  }
  if (command === '-v' || command === '--version') {
    const version = readVersion();
    context.stdout(version);
    return { kind: 'version', version };
  }
  if (command === 'add') return addCommand(rest, context);
  if (command === 'remove') return removeCommand(rest, context);
  if (command === 'list') return listCommand(context);
  if (command === 'create') return invoke(argv, context, true);
  return invoke(argv, context, false);
}
