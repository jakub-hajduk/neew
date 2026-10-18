import { mkdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import * as tar from 'tar';
import type { ParsedSource } from '../source';
import type { DownloadAdapter, DownloadDeps, DownloadOptions } from './types';

export function githubTarballUrl(source: ParsedSource, ref: string): string {
  return `https://codeload.github.com/${source.owner}/${source.repo}/tar.gz/${encodeURIComponent(ref)}`;
}

function subdirFilter(subdir: string): (path: string) => boolean {
  return (path) => {
    const relative = path.split('/').slice(1).join('/');
    return relative === subdir || relative.startsWith(`${subdir}/`);
  };
}

export function tarballStrip(subdir: string | undefined): number {
  return subdir ? 1 + subdir.split('/').filter(Boolean).length : 1;
}

export async function downloadGithub(
  source: ParsedSource,
  dest: string,
  options: DownloadOptions,
  deps: DownloadDeps,
): Promise<void> {
  const url = githubTarballUrl(source, options.ref);
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  if (!response.body) throw new Error(`Failed to download ${url}: empty response body.`);
  mkdirSync(dest, { recursive: true });
  const filter = options.subdir ? subdirFilter(options.subdir) : undefined;
  await pipeline(
    Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
    createGunzip(),
    tar.extract({
      cwd: dest,
      strip: tarballStrip(options.subdir),
      ...(filter ? { filter } : {}),
    }),
  );
}

export const githubAdapter: DownloadAdapter = {
  host: 'github.com',
  download: downloadGithub,
};
