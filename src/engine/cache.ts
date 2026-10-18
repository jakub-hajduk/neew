import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedSource } from './source';

export const METADATA_FILENAME = '.neew.json';

export interface CacheMetadata {
  url: string;
  ref: string | null;
  subdir: string | null;
  commit: string;
  fetchedAt: string;
}

export function sourceRefName(source: Pick<ParsedSource, 'ref'>): string {
  return source.ref ?? 'HEAD';
}

export function cacheSourcesDir(cacheRoot: string): string {
  return join(cacheRoot, 'sources');
}

export function cacheTmpDir(cacheRoot: string): string {
  return join(cacheRoot, 'tmp');
}

export function cacheEntryDir(cacheRoot: string, source: ParsedSource): string {
  return join(
    cacheSourcesDir(cacheRoot),
    source.host,
    source.owner,
    `${source.repo}@${encodeURIComponent(sourceRefName(source))}`,
  );
}

export function readMetadata(entryDir: string): CacheMetadata | undefined {
  const path = join(entryDir, METADATA_FILENAME);
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as CacheMetadata;
    if (!parsed || typeof parsed.commit !== 'string') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function writeMetadata(entryDir: string, metadata: CacheMetadata): void {
  mkdirSync(entryDir, { recursive: true });
  writeFileSync(
    join(entryDir, METADATA_FILENAME),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8',
  );
}

export function removeCacheEntry(cacheRoot: string, source: ParsedSource): void {
  rmSync(cacheEntryDir(cacheRoot, source), { recursive: true, force: true });
}
