# Design

## Context

See proposal.md for motivation. Relevant current state:

- The package is already scaffolded: TypeScript, ESM, `tsdown` build, `oxlint`/`oxfmt`,
  `release-it`, pnpm. `src/index.ts` is empty.
- `@trut/gen` supplies the pieces we build on: declaration helpers and types at the
  root, and a runtime with `discoverGenerators`, `resolveGenerator`,
  `resolvePrompts`, `runGenerator`, staging/render primitives, and flag helpers.
  Its config discovery (`loadGenConfig`) is hardcoded to the `gen.config.*`
  basename and cannot be pointed at `generators.ts`.
- `isomorphic-git` resolves refs over HTTP without spawning a `git` binary.
- `giget` is a scaffolded dependency; it has no change detection — its cache is
  keyed by name+ref and is either always overwritten (online) or reused blindly
  (`preferOffline`).

## Goals / Non-Goals

**Goals:**

- A CLI that registers remote generator repositories and invokes their generators
  by name from any directory.
- A fetch engine that reuses a cached copy until the remote ref's commit changes,
  with no `git` binary and no REST rate limits.
- Deterministic hand-off to `@trut/gen` for discovery, prompting, and writing.

**Non-Goals:**

- Custom or user-supplied template providers (git repositories only).
- SSH remotes (HTTP(S) only).
- Semantic version tracking, lockfiles, drift reporting, or repository aliases.
- Project-local configuration (only a user-level registry).
- Separate "package" vs "app" modes; the generator's `basePath`/`to` and an
  optional target directory decide placement.

## Decisions

### Custom fetch engine instead of `giget`

We implement a small engine rather than wrapping `giget`, because the required
"reuse cache if unchanged, else replace" behavior does not exist in `giget`; adding
it on top would duplicate `giget`'s parsing and cache anyway. `giget` is expected to
be removed from dependencies once the engine lands. We keep `giget`-style shorthand
parsing and the per-host adapter idea as inspiration, not as a dependency.

### Change detection by resolved commit

Identity is the commit SHA of the requested ref.

- **Ref alone** cannot detect a moved branch (`main` == `main`).
- **Content hashing** requires downloading, defeating the purpose.
- **Commit SHA** is one small metadata request and exact at repository level.
- Non-goal granularity: a change anywhere in the repo bumps the commit and forces a
  refetch; acceptable for generator repositories and rare.

Resolution uses `isomorphic-git.listServerRefs({ http, url, symrefs: true })` — one
git-protocol HTTP request, provider-agnostic, no REST rate limits, no `git` spawn.
`HEAD`'s symref yields the default branch when no `#ref` is given. Alternatives
rejected: `git ls-remote` (spawns `git`), host REST commits API (per-host code,
60/h unauthenticated limit). Annotated tags need peeling to their commit; branches
and lightweight tags resolve directly.

### URL-first input with optional shorthand

Both a URL (`https://github.com/acme/templates[/subdir][#ref]`, scheme optional) and
giget-style shorthand (`gh:owner/repo`, bare `owner/repo`, `::` subdir separator)
normalize to one source identity. Canonical identity strips scheme, trailing slash,
`.git`, and host case, so `add`/`remove`/`list` agree regardless of how the link is
written. A bare host URL cannot be passed to a provider parser directly, so neew
owns this normalization.

### User config is plain JSON, CLI-managed

The registry is `~/.config/neew/neew.json` (override via env), whose only top-level
property is `repositories`, keyed by canonical source. Since only the CLI writes it,
plain JSON beats C12 here: deterministic parse, no code execution, simple atomic
writes (temp file + rename). A malformed file fails loudly and is never overwritten.
Platform config/cache roots come from the OS convention (XDG on Linux, the
equivalent on macOS/Windows), with env overrides for tests.

### Repository contract: `generators.ts` + `defineGenerators`

Remote repositories expose a root `generators.ts` barrel exporting a `generators`
array of paths/globs, authored with `defineGenerators` (exported from the package,
mirroring `@trut/gen`'s `defineConfig` but a distinct, neew-owned name). Because
`@trut/gen`'s `loadGenConfig` only finds `gen.config.*`, neew loads `generators.ts`
itself with `jiti` (the same loader `@trut/gen` uses internally) and then calls
`discoverGenerators({ configDir, patterns })` from `@trut/gen/runtime`. Generator
names must be unique within a repository.

### Registry indexing and global collisions

`add` fetches the repository, loads the barrel, resolves modules, and persists the
source plus an index of `{ name, path, description }` per generator. Collision
detection is global across registered repositories; on any conflict `add` fails,
prints the conflicting names/descriptions, deletes the downloaded copy, and leaves
the registry untouched. This guarantees `neew <name>` maps to exactly one generator
without a network round-trip.

### Cache layout and atomic replacement

```
~/.cache/neew/
  sources/<host>/<owner>/<repo>@<ref>/
    .neew.json        # { url, ref, subdir, commit, fetchedAt }
    <extracted repo>
  tmp/                # staging, same filesystem as sources/
```

The commit lives with the cache entry, not in `neew.json`, so it disappears with the
cache and can never go stale in config. Replacement extracts into `tmp/`, then
removes the old directory and renames the new one into place; `tmp/` sits under the
same cache root so the rename never crosses filesystems.

### Invocation delegates to `@trut/gen`

`create` (and the `neew <generator>` shortcut) ensures the source via the engine,
then runs `runGenerator({ generator, configDir: targetDir, moduleDir: <cache module
dir>, answers })`. Passing `configDir` = current directory (or explicit target)
anchors the generator's `basePath` in the working directory, while `moduleDir` =
the module's directory in the cached repository anchors `addTemplates` `from`.
Dry-run/force and prompt/flag resolution reuse the runtime's behavior. When
`ensure` reports the source changed, neew re-scans the barrel and updates the index
before running, so the index cannot drift from the cache.

### CLI shape and parsing

Bare `neew` prints management commands and a separate generator list. Management
commands (`add`, `remove`, `list`) use a minimal hand-rolled parser; generator
parameters reuse `@trut/gen`'s exported flag helpers (`parseGlobalFlags`,
`parsePromptValues`, `flagNameFor`, `argumentSpecFor`) so the parameter surface
matches `@trut/gen` exactly. This avoids adding a CLI framework dependency.

## Risks / Trade-offs

- `isomorphic-git` is heavier than a single `fetch` → used only inside `resolveRef`;
  the download path stays on tarball endpoints.
- HTTP(S) only, no SSH → documented; sources are trusted HTTPS repositories.
- Annotated tag refs need peeling → resolve the tag to its commit, with a clear
  error if peeling is impossible.
- Index drift when a source changes → handled by re-scanning the barrel on `ensure`
  change before invoking.
- Remote generator code is executed → accepted risk; trusted sources only
  (requirement 5).
- `add` and a later `create` each resolve the ref (two metadata requests) → minor,
  and correctness-favoring; caching resolution is a possible later optimization.
- A changed source could rename or remove the invoked generator → the refresh step
  re-indexes and fails clearly if the name no longer exists.

## Migration Plan

Greenfield: add the `bin` entry and `isomorphic-git` dependency, implement the
engine/registry/CLI, then drop `giget`. No data migration; removing the config and
cache directories resets state. Rollback is reverting the change.

## Open Questions

- Exact archive endpoints per host beyond GitHub (GitLab/Bitbucket/SourceHut) can be
  finalized during implementation without affecting the specs.
- Whether `list` should optionally annotate cache/commit status can be added later;
  the spec only requires registry data.
