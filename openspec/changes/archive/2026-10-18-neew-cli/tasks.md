# Tasks

## 1. Setup and public surface

- [x] 1.1 Add the `isomorphic-git` dependency (with its HTTP client) and a `bin` entry for `neew`; verify `pnpm install` and `pnpm build` succeed.
- [x] 1.2 Implement `defineGenerators` and export it from `src/index.ts`; verify a unit test writes a barrel and reads back its `generators` array without importing the runtime.
- [x] 1.3 Document the repository contract (`generators.ts` + `defineGenerators`) and verify the documented example loads through the same loader the tests use.

## 2. Source parsing and normalization

- [x] 2.1 Implement URL and shorthand parsing into a `ParsedSource`; verify unit tests cover scheme-optional URLs, `gh:`/bare shorthand, the `::` subdirectory separator, and an optional `#ref`.
- [x] 2.2 Implement canonical source identity; verify tests show `add`, `remove`, and lookup agree across scheme, trailing-slash, `.git`, and host-case variants.

## 3. Fetch engine

- [x] 3.1 Implement ref resolution via `isomorphic-git.listServerRefs`, including the default branch from `HEAD`; verify tests assert the resolved commit and that no `git` process is spawned.
- [x] 3.2 Implement the cache layout and cache metadata read/write; verify metadata lives inside the cache entry and is discarded with it.
- [x] 3.3 Implement `ensure()`: reuse the cache when the commit is unchanged, and download into `tmp/` plus atomic swap when it differs; verify unchanged refs reuse without network, changed refs replace, and an interrupted fetch leaves the previous copy intact.
- [x] 3.4 Implement per-host download adapters (GitHub tarball first) and the unsupported-host error; verify only the requested ref and subdirectory are fetched and an unknown host fails clearly.
- [x] 3.5 Implement offline fallback; verify that when resolution fails and a cached copy exists, neew warns and proceeds with the cache.

## 4. Repository registry

- [x] 4.1 Implement the user-level JSON config path with atomic writes and a loud parse failure; verify a malformed file errors and is not overwritten.
- [x] 4.2 Implement `add` (fetch, load the barrel with the loader, discover generators, index them); verify a successful add persists the source and its generator index.
- [x] 4.3 Implement `add` validation (barrel exists, every pattern resolves, modules load) with abort, cache deletion, and an unchanged registry; verify each failure mode leaves the registry untouched.
- [x] 4.4 Implement global collision detection over names and paths; verify a collision fails with conflicting names/descriptions and discards the download, while an unused name succeeds.
- [x] 4.5 Implement `remove` (scheme optional) and offline `list`; verify the entry and its cache are removed and that `list` works with the network unreachable.

## 5. Generator invocation

- [x] 5.1 Implement bare `neew` output; verify it prints the management commands and, in a separate section, the available generators.
- [x] 5.2 Implement `create` and the `neew <generator>` shortcut with parameter resolution via the `@trut/gen` flag helpers, running through `runGenerator` into the current or supplied target directory; verify both forms produce identical files and the target directory is honored.
- [x] 5.3 Implement `neew <generator> --help`; verify it lists the generator's parameters and global options and writes no files.
- [x] 5.4 Implement ensure-before-invoke with index refresh when the source changed; verify a changed source re-indexes and a renamed or removed generator fails clearly.
- [x] 5.5 Implement the unknown-generator error; verify it fails and lists the available generators.
- [x] 5.6 Honor dry-run and force pass-through; verify dry-run reports planned files without writing and force overwrites existing files.

## 6. Integration and cleanup

- [x] 6.1 Add an end-to-end test that adds a fixture repository, invokes its generator, and verifies files land below the working directory, including collision and force behavior.
- [x] 6.2 Remove the `giget` dependency and document the CLI usage (`add`, `remove`, `list`, `create`/shortcut, `--help`) in the README; verify `pnpm build`, `pnpm check`, and `pnpm test` pass.
- [x] 6.3 Run the full suite (`pnpm check` and `pnpm test`) and confirm the registry, engine, and invocation specs each have passing coverage.

## Workflow follow-up

- Archive the change once review requirements are satisfied.
- Verify the archived spec set matches the intended capabilities.
