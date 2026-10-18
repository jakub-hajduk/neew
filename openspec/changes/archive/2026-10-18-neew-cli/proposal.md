# Proposal

## Why

Scaffolding new packages and apps from remote boilerplate currently means either
vendoring templates or re-downloading them blindly. `neew` turns remote generator
repositories into reusable commands: register a repository once, invoke its
generators by name from any directory, and let a small fetch engine reuse a local
cache until the remote ref actually moves.

## What Changes

- New package and binary `neew` (`@trut/neew`): a CLI that manages generator
  repositories and invokes the generators they expose.
- New remote-repository contract: a root `generators.ts` barrel exposing a
  `generators` array of paths/glob patterns, authored with a new `defineGenerators`
  helper.
- New CLI-managed user config `~/.config/neew/neew.json` whose only property is
  `repositories`.
- New CLI surface:
  - `neew add <link>` / `neew remove <link>` / `neew list` manage repositories.
  - bare `neew` prints available commands, then a separate list of available
    generators.
  - `neew create <generator> [params]` with the shortcut `neew <generator> [params]`.
  - `neew <generator> --help` lists that generator's parameters (prompt inputs).
- New fetch engine (giget-inspired, git-only): URL-first parsing with optional
  giget-style shorthand, change detection by resolved commit, a per-repository disk
  cache with atomic replacement, and per-host download adapters.
- Generation delegates to `@trut/gen`'s runtime (`discoverGenerators`,
  `resolveGenerator`, `resolvePrompts`, `runGenerator`) writing into the current
  working directory (or an explicit target directory).

## Capabilities

### New Capabilities

- `generator-repository`: the contract a remote generator repository must satisfy
  — the root `generators.ts` barrel and the `defineGenerators` authoring helper.
- `git-source-fetch`: resolving and fetching remote Git sources — URL/shorthand
  parsing, ref-to-commit change detection, cache reuse and atomic replacement,
  and the per-host adapter boundary.
- `repository-registry`: the local `neew.json` registry — `add`, `remove`, `list`,
  generator indexing, and global collision rules.
- `generator-invocation`: invoking a generator — `create` and its shortcut,
  parameter resolution, `--help`, the bare command output, and running the
  generator through `@trut/gen`.

### Modified Capabilities

None. This is greenfield; the project has no existing specs.

## Impact

- New runtime dependency: `isomorphic-git` (plus `isomorphic-git/http/node`) for
  provider-agnostic ref resolution without spawning the `git` binary.
- Existing dependencies reused: `@trut/gen` (declaration helpers + runtime),
  and a TypeScript/JSON module loader for `generators.ts`.
- `giget` is a scaffolded dependency today; the custom engine supersedes it, so it
  is expected to be removed from `package.json` once the engine lands.
- Source layout: `src/engine/**`, `src/cli/**`, `src/config/**`, `src/registry/**`,
  and the public entry `src/index.ts`; a `bin` entry for `neew`.
- User-side state: `~/.config/neew/neew.json` (config) and `~/.cache/neew/**`
  (fetched repositories and their cache metadata).
