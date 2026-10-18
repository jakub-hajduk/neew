export interface ParsedSource {
  host: string;
  owner: string;
  repo: string;
  ref?: string;
  subdir?: string;
  url: string;
}

const HOST_ALIASES: Record<string, string> = {
  gh: 'github.com',
  github: 'github.com',
  gl: 'gitlab.com',
  gitlab: 'gitlab.com',
  bb: 'bitbucket.org',
  bitbucket: 'bitbucket.org',
};

const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const PREFIX_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

function cleanSubdir(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed === '' ? undefined : trimmed;
}

export function parseSource(input: string): ParsedSource {
  const original = input.trim();
  if (original === '') throw new Error('A repository link is required.');

  let rest = original;
  let ref: string | undefined;
  const hash = rest.indexOf('#');
  if (hash !== -1) {
    ref = rest.slice(hash + 1).trim() || undefined;
    rest = rest.slice(0, hash);
  }

  let subdir: string | undefined;
  const separator = rest.indexOf('::');
  if (separator !== -1) {
    subdir = cleanSubdir(rest.slice(separator + 2));
    rest = rest.slice(0, separator);
  }

  rest = rest.replace(SCHEME_PATTERN, '').replace(/^\/+/, '');

  let host: string | undefined;
  const prefix = PREFIX_PATTERN.exec(rest);
  if (prefix) {
    const alias = HOST_ALIASES[prefix[1].toLowerCase()];
    if (alias) {
      host = alias;
      rest = rest.slice(prefix[0].length).replace(/^\/+/, '');
    }
  }

  const segments = rest
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) throw new Error(`Could not parse repository link "${original}".`);

  if (!host) {
    if (segments[0].includes('.') && segments.length >= 3) {
      host = segments.shift()!.toLowerCase();
    } else {
      host = 'github.com';
    }
  }
  host = host.toLowerCase();

  const owner = segments[0];
  if (!owner) throw new Error(`Could not parse a repository owner from "${original}".`);
  const rawRepo = segments[1];
  if (!rawRepo) throw new Error(`Could not parse a repository name from "${original}".`);
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!subdir && segments.length > 2) {
    subdir = cleanSubdir(segments.slice(2).join('/'));
  }

  return {
    host,
    owner,
    repo,
    ...(ref ? { ref } : {}),
    ...(subdir ? { subdir } : {}),
    url: `https://${host}/${owner}/${repo}`,
  };
}

export function canonicalSource(source: ParsedSource): string {
  let identity = `${source.host}/${source.owner}/${source.repo}`;
  if (source.subdir) identity += `::${source.subdir}`;
  if (source.ref) identity += `#${source.ref}`;
  return identity;
}

export function sourceDisplayName(source: ParsedSource): string {
  return canonicalSource(source);
}
