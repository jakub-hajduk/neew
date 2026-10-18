import { dirname, join, relative } from 'node:path';
import type { Jiti } from 'jiti';
import { discoverGenerators, resolveGeneratorModules } from '@trut/gen/runtime';
import type { Environment } from '../config/paths';
import { createRepositoryJiti } from '../config/create-loader';
import { loadBarrel } from '../config/load-barrel';
import {
  readRegistry,
  writeRegistry,
  type IndexedGenerator,
  type RegistryEntry,
} from '../config/registry-file';
import { ensure, type EnsureDeps } from '../engine/ensure';
import { removeCacheEntry } from '../engine/cache';
import { parseSource, canonicalSource, type ParsedSource } from '../engine/source';

export interface RegistryDeps extends EnsureDeps {
  env?: Environment;
}

export interface GeneratedIndexEntry {
  name: string;
  path: string;
  description?: string;
  moduleDir: string;
  modulePath: string;
}

export function sourceFromEntry(entry: RegistryEntry): ParsedSource {
  return {
    ...parseSource(entry.url),
    ...(entry.ref ? { ref: entry.ref } : {}),
    ...(entry.subdir ? { subdir: entry.subdir } : {}),
  };
}

export async function indexRepository(
  dir: string,
  patterns: string[],
  jiti: Jiti,
): Promise<IndexedGenerator[]> {
  for (const pattern of patterns) {
    const matches = await resolveGeneratorModules([pattern], dir);
    if (matches.length === 0) {
      throw new Error(
        `Pattern "${pattern}" matched no files in ${dir}. Every pattern in the generators barrel must resolve to at least one generator module.`,
      );
    }
  }
  const discovered = await discoverGenerators({ configDir: dir, patterns, jiti });
  if (discovered.length === 0) {
    throw new Error(`No generators were discovered in ${dir}.`);
  }
  return discovered.map((entry) => ({
    name: entry.generator.name,
    path: relative(dir, entry.modulePath),
    ...(entry.generator.description ? { description: entry.generator.description } : {}),
  }));
}

export interface Collision {
  name: string;
  path: string;
  description?: string;
  existingSource: string;
}

function collisionKey(sourceId: string, generatorPath: string): string {
  return `${sourceId}::${generatorPath}`;
}

export function findCollisions(
  registry: { repositories: Record<string, RegistryEntry> },
  canonical: string,
  indexed: IndexedGenerator[],
): Collision[] {
  const names = new Map<string, { entry: RegistryEntry; source: string }>();
  const paths = new Map<string, { source: string }>();
  for (const [sourceId, entry] of Object.entries(registry.repositories)) {
    if (sourceId === canonical) continue;
    for (const generator of entry.generators) {
      names.set(generator.name, { entry, source: sourceId });
      paths.set(collisionKey(sourceId, generator.path), { source: sourceId });
    }
  }
  const conflicts: Collision[] = [];
  for (const generator of indexed) {
    const byName = names.get(generator.name);
    const byPath = paths.get(collisionKey(canonical, generator.path));
    const existing = byName ?? byPath;
    if (!existing) continue;
    conflicts.push({
      name: generator.name,
      path: generator.path,
      ...(generator.description ? { description: generator.description } : {}),
      existingSource: existing.source,
    });
  }
  return conflicts;
}

export class CollisionError extends Error {
  readonly conflicts: Collision[];

  constructor(conflicts: Collision[]) {
    const lines = conflicts
      .map(
        (conflict) =>
          `  - ${conflict.name}${
            conflict.description ? ` (${conflict.description})` : ''
          } conflicts with ${conflict.existingSource}`,
      )
      .join('\n');
    super(`Repository cannot be added: generator name collision(s):\n${lines}`);
    this.name = 'CollisionError';
    this.conflicts = conflicts;
  }
}

export async function addSource(link: string, deps: RegistryDeps): Promise<RegistryEntry> {
  const source = parseSource(link);
  const canonical = canonicalSource(source);
  const registry = readRegistry(deps.env);
  const ensured = await ensure(source, deps);
  try {
    const jiti = createRepositoryJiti(ensured.dir);
    const barrel = await loadBarrel(ensured.dir, { jiti });
    const generators = await indexRepository(ensured.dir, barrel.config.generators, jiti);
    const conflicts = findCollisions(registry, canonical, generators);
    if (conflicts.length > 0) throw new CollisionError(conflicts);
    const entry: RegistryEntry = {
      source: canonical,
      url: source.url,
      ...(source.ref ? { ref: source.ref } : {}),
      ...(source.subdir ? { subdir: source.subdir } : {}),
      generators,
    };
    writeRegistry({ repositories: { ...registry.repositories, [canonical]: entry } }, deps.env);
    return entry;
  } catch (error) {
    if (ensured.changed) removeCacheEntry(deps.cacheRoot, source);
    throw error;
  }
}

export function findEntryForLink(
  registry: { repositories: Record<string, RegistryEntry> },
  source: ParsedSource,
): { canonical: string; entry: RegistryEntry } | undefined {
  const canonical = canonicalSource(source);
  const exact = registry.repositories[canonical];
  if (exact) return { canonical, entry: exact };
  for (const [sourceId, entry] of Object.entries(registry.repositories)) {
    if (entry.url === source.url) return { canonical: sourceId, entry };
  }
  return undefined;
}

export function removeSource(link: string, deps: RegistryDeps): RegistryEntry {
  const source = parseSource(link);
  const registry = readRegistry(deps.env);
  const match = findEntryForLink(registry, source);
  if (!match) {
    throw new Error(`Repository "${canonicalSource(source)}" is not registered.`);
  }
  const repositories = { ...registry.repositories };
  delete repositories[match.canonical];
  writeRegistry({ repositories }, deps.env);
  removeCacheEntry(deps.cacheRoot, sourceFromEntry(match.entry));
  return match.entry;
}

export function listRegistered(deps: { env?: Environment }): RegistryEntry[] {
  return Object.values(readRegistry(deps.env).repositories);
}

export interface LocatedGenerator {
  entry: RegistryEntry;
  indexed: IndexedGenerator;
}

export function findGeneratorByName(
  entries: RegistryEntry[],
  name: string,
): LocatedGenerator | undefined {
  for (const entry of entries) {
    const indexed = entry.generators.find((generator) => generator.name === name);
    if (indexed) return { entry, indexed };
  }
  return undefined;
}

export function generatorModuleDir(repositoryDir: string, indexed: IndexedGenerator): string {
  return dirname(join(repositoryDir, indexed.path));
}
