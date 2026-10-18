import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { resolveConfigRoot, type Environment } from './paths';

export interface IndexedGenerator {
  name: string;
  path: string;
  description?: string;
}

export interface RegistryEntry {
  source: string;
  url: string;
  ref?: string;
  subdir?: string;
  generators: IndexedGenerator[];
}

export interface RegistryFile {
  repositories: Record<string, RegistryEntry>;
}

export const REGISTRY_FILENAME = 'neew.json';

export function registryFilePath(env: Environment = process.env): string {
  return join(resolveConfigRoot(env), REGISTRY_FILENAME);
}

function emptyRegistry(): RegistryFile {
  return { repositories: {} };
}

export function readRegistry(env: Environment = process.env): RegistryFile {
  const path = registryFilePath(env);
  if (!existsSync(path)) return emptyRegistry();
  const text = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse the neew registry at ${path}: ${message}. ` +
        `Fix or remove the file; neew will not overwrite it.`,
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid neew registry at ${path}: expected a JSON object.`);
  }
  const repositories = (parsed as RegistryFile).repositories;
  if (!repositories || typeof repositories !== 'object' || Array.isArray(repositories)) {
    throw new Error(`Invalid neew registry at ${path}: expected a "repositories" object.`);
  }
  return { repositories };
}

export function writeRegistry(file: RegistryFile, env: Environment = process.env): void {
  const path = registryFilePath(env);
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${randomUUID()}`;
  writeFileSync(temp, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  renameSync(temp, path);
}
