import { githubAdapter } from './github';
import type { DownloadAdapter } from './types';

export type { DownloadAdapter, DownloadDeps, DownloadOptions } from './types';

const SUPPORTED_HOSTS = ['github.com'];

export class UnsupportedHostError extends Error {
  readonly host: string;

  constructor(host: string) {
    super(`Unsupported host "${host}". Supported hosts: ${SUPPORTED_HOSTS.join(', ')}.`);
    this.name = 'UnsupportedHostError';
    this.host = host;
  }
}

export function getDownloadAdapter(host: string): DownloadAdapter {
  if (host === githubAdapter.host || host === `www.${githubAdapter.host}`) {
    return githubAdapter;
  }
  throw new UnsupportedHostError(host);
}
