import git, { type ServerRef } from 'isomorphic-git';
import http, { type HttpClient } from 'isomorphic-git/http/node';
import type { ParsedSource } from './source';

export type ListServerRefs = (options: {
  http: HttpClient;
  url: string;
  symrefs?: boolean;
  peelTags?: boolean;
  corsProxy?: string;
}) => Promise<ServerRef[]>;

export interface ResolveRefDeps {
  listServerRefs?: ListServerRefs;
  http?: HttpClient;
  corsProxy?: string;
}

function refCandidates(ref: string): string[] {
  if (ref.startsWith('refs/')) return [ref];
  return [`refs/heads/${ref}`, `refs/tags/${ref}`];
}

export function pickCommit(refs: ServerRef[], source: ParsedSource): string {
  if (source.ref) {
    for (const candidate of refCandidates(source.ref)) {
      const match = refs.find((entry) => entry.ref === candidate);
      if (match) return match.peeled ?? match.oid;
    }
    const suffix = refs.find(
      (entry) => entry.ref === source.ref || entry.ref.endsWith(`/${source.ref}`),
    );
    if (suffix) return suffix.peeled ?? suffix.oid;
    throw new Error(`Ref "${source.ref}" was not found at ${source.url}.`);
  }
  const head = refs.find((entry) => entry.ref === 'HEAD');
  if (head?.target) {
    const branch = refs.find((entry) => entry.ref === head.target);
    if (branch) return branch.peeled ?? branch.oid;
  }
  const fallback = refs.find(
    (entry) => entry.ref === 'refs/heads/main' || entry.ref === 'refs/heads/master',
  );
  if (fallback) return fallback.peeled ?? fallback.oid;
  throw new Error(`Could not determine the default branch for ${source.url}.`);
}

export async function resolveCommit(
  source: ParsedSource,
  deps: ResolveRefDeps = {},
): Promise<string> {
  const listServerRefs = deps.listServerRefs ?? git.listServerRefs;
  const refs = await listServerRefs({
    http: deps.http ?? http,
    url: source.url,
    symrefs: true,
    peelTags: true,
    ...(deps.corsProxy ? { corsProxy: deps.corsProxy } : {}),
  });
  return pickCommit(refs, source);
}
