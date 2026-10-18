import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { getDownloadAdapter, type DownloadDeps, type DownloadOptions } from './adapters';
import {
  cacheEntryDir,
  cacheTmpDir,
  type CacheMetadata,
  readMetadata,
  writeMetadata,
} from './cache';
import { resolveCommit, type ResolveRefDeps } from './resolve-ref';
import type { ParsedSource } from './source';

export interface EnsureDeps {
  cacheRoot: string;
  resolveCommit?: (source: ParsedSource) => Promise<string>;
  download?: (source: ParsedSource, dest: string, options: DownloadOptions) => Promise<void>;
  downloadDeps?: DownloadDeps;
  resolveDeps?: ResolveRefDeps;
  warn?: (message: string) => void;
}

export interface EnsureResult {
  dir: string;
  metadata: CacheMetadata;
  changed: boolean;
  offline: boolean;
}

function swapIntoPlace(entryDir: string, stagingDir: string): void {
  mkdirSync(dirname(entryDir), { recursive: true });
  const backup = `${entryDir}.bak-${randomUUID()}`;
  const hadPrevious = existsSync(entryDir);
  if (hadPrevious) renameSync(entryDir, backup);
  try {
    renameSync(stagingDir, entryDir);
  } catch (error) {
    if (hadPrevious) renameSync(backup, entryDir);
    throw error;
  }
  if (hadPrevious) rmSync(backup, { recursive: true, force: true });
}

export async function ensure(source: ParsedSource, deps: EnsureDeps): Promise<EnsureResult> {
  const entryDir = cacheEntryDir(deps.cacheRoot, source);
  const existing = existsSync(entryDir) ? readMetadata(entryDir) : undefined;
  const resolve = deps.resolveCommit ?? ((target) => resolveCommit(target, deps.resolveDeps));

  let commit: string;
  try {
    commit = await resolve(source);
  } catch (error) {
    if (existing) {
      deps.warn?.(
        `Could not check ${source.url} for updates (${
          error instanceof Error ? error.message : String(error)
        }); using the cached copy.`,
      );
      return { dir: entryDir, metadata: existing, changed: false, offline: true };
    }
    throw error;
  }

  if (existing && existing.commit === commit) {
    return { dir: entryDir, metadata: existing, changed: false, offline: false };
  }

  const staging = join(cacheTmpDir(deps.cacheRoot), `${source.repo}-${randomUUID()}`);
  mkdirSync(staging, { recursive: true });
  const download =
    deps.download ??
    ((target, dest, options) => {
      const adapter = getDownloadAdapter(target.host);
      return adapter.download(target, dest, options, deps.downloadDeps ?? {});
    });
  try {
    await download(source, staging, {
      ref: commit,
      ...(source.subdir ? { subdir: source.subdir } : {}),
    });
    const metadata: CacheMetadata = {
      url: source.url,
      ref: source.ref ?? null,
      subdir: source.subdir ?? null,
      commit,
      fetchedAt: new Date().toISOString(),
    };
    writeMetadata(staging, metadata);
    swapIntoPlace(entryDir, staging);
    return { dir: entryDir, metadata, changed: true, offline: false };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}
