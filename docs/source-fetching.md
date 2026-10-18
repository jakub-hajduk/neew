# Source fetching and caching

Neew keeps a local copy of every registered repository and refreshes it only when the remote ref actually moves. This module covers how links parse, how neew detects changes, where the copies live, and how offline use works.

## Link formats

A link points at a repository, with an optional ref and an optional subdirectory:

```sh
neew add https://github.com/acme/my-generators
neew add github.com/acme/my-generators
neew add gh:acme/my-generators
neew add acme/my-generators
```

All four name the same repository. The scheme is optional, a bare `owner/repo` defaults to GitHub, and these host prefixes expand:

| Prefix              | Host            |
| ------------------- | --------------- |
| `gh:`, `github:`    | `github.com`    |
| `gl:`, `gitlab:`    | `gitlab.com`    |
| `bb:`, `bitbucket:` | `bitbucket.org` |

A first path segment that contains a dot and comes with at least two more segments is read as an explicit host, so `gitlab.com/acme/my-generators` sets the host to `gitlab.com`.

### Refs and subdirectories

Append `#ref` to pin a branch, tag, or commit. Append `::subdir`, or extra path segments, to point at a subdirectory:

```sh
neew add gh:acme/monorepo::packages/generators
neew add gh:acme/my-generators#v2
neew add gh:acme/monorepo/packages/generators
```

The last two forms are equivalent: everything after `owner/repo` is the subdirectory.

## Canonical identity

Neew normalizes a link to one identity, `host/owner/repo[::subdir][#ref]`. The scheme, a trailing slash, a `.git` suffix, and host case do not change it. The registry is keyed by this identity, which is why these remove the same entry:

```sh
neew remove https://github.com/acme/my-generators
neew remove github.com/acme/my-generators/
neew remove gh:acme/my-generators
```

A different ref or subdirectory is a different identity, so `gh:acme/my-generators#main` and `gh:acme/my-generators#v2` are two entries.

## Change detection

Neew resolves the requested ref to a commit, then compares it with the commit recorded for the cached copy.

Resolution uses one request over the Git HTTP protocol (via `isomorphic-git`) and never spawns a `git` binary. Without a `#ref`, neew reads the remote's `HEAD` symref to find the default branch. An annotated tag is peeled to the commit it points at.

- Same commit and a cached copy exists: neew reuses the copy and downloads nothing.
- Different commit: neew fetches the new copy and replaces the cached one.
- No cached copy: neew fetches it.

A commit change anywhere in the repository moves the commit, so a change to any file triggers a refetch. There is no per-generator tracking.

## Cache layout

```
~/.cache/neew/
  sources/<host>/<owner>/<repo>@<ref-or-HEAD>/
    .neew.json
    <extracted repository>
  tmp/
```

The ref segment is the ref text, URI-encoded, or `HEAD` when the link had no ref. The `.neew.json` file records the source details and the resolved commit:

```json
{
  "url": "https://github.com/acme/my-generators",
  "ref": null,
  "subdir": null,
  "commit": "9f2c1a...",
  "fetchedAt": "2026-10-18T17:08:00.000Z"
}
```

The commit lives with the cache, not in the registry, so deleting the cache deletes the commit record with it.

The cache root follows the platform convention:

| Platform             | Path                    |
| -------------------- | ----------------------- |
| `NEEW_CACHE_DIR` set | `$NEEW_CACHE_DIR`       |
| `XDG_CACHE_HOME` set | `$XDG_CACHE_HOME/neew`  |
| macOS                | `~/Library/Caches/neew` |
| Windows              | `%LOCALAPPDATA%\neew`   |
| Linux and other      | `~/.cache/neew`         |

## Atomic replacement

A refetch extracts into `tmp/` under the same cache root, writes the metadata, then swaps the new directory into place: the old entry is renamed aside, the new one is renamed in, and the old one is deleted. An interrupted fetch leaves the previous copy intact, and no partial copy is ever observable as the cache entry.

`tmp/` sits under the cache root so the rename never crosses filesystems.

## Hosts

Downloads run through a per-host adapter chosen from the source host. GitHub is the only adapter today. It fetches the tarball for the resolved commit at `https://codeload.github.com/<owner>/<repo>/tar.gz/<commit>` and extracts it, keeping only the subdirectory when the link names one.

A host without an adapter fails with:

```
Unsupported host "<host>". Supported hosts: github.com.
```

## Offline use

If neew cannot reach the remote to resolve the ref and a cached copy exists, it warns and uses the copy:

```
warning: Could not check https://github.com/acme/my-generators for updates (<reason>); using the cached copy.
```

`neew list` never contacts the network, so it always works. If resolution fails and there is no cached copy, the command fails.

## Clearing the cache

Delete the cache root, or just the `sources/` directory, to drop every fetched copy. The registry keeps the list of repositories, so the next run refetches what it needs. To drop one repository's state, use `neew remove <link>`, which clears its entry and its cache.
