import type { ParsedSource } from '../source';

export interface DownloadOptions {
  ref: string;
  subdir?: string;
}

export interface DownloadDeps {
  fetch?: typeof globalThis.fetch;
}

export interface DownloadAdapter {
  host: string;
  download(
    source: ParsedSource,
    dest: string,
    options: DownloadOptions,
    deps: DownloadDeps,
  ): Promise<void>;
}
