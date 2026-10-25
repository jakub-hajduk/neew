# Design

## Context

Neew currently loads a generator module through Jiti, resolves its prompts, and
calls `runGenerator` without a template adapter. Its `generators.ts` barrel is
kept intentionally small and generator modules are already arbitrary loaded
code. Gen 0.2.0 adds the per-run `templateAdapter` option but keeps Eta as its
default adapter.

The selected module path is already available after discovery. This lets neew
read per-generator metadata without changing the barrel contract or adopting
Gen's repository-wide `gen.config.*` convention.

## Goals / Non-Goals

**Goals:**

- Let a project generator hold ordinary, ready-to-use text files whose embedded
  project identity is replaced at generation time.
- Keep source identity local to the generator module and the target identity in
  the existing `projectName` prompt.
- Preserve Gen's staging, dry-run, collision, output-path, and default Eta
  behavior.

**Non-Goals:**

- Transform template directory names or file names based on source identity.
- Infer naming conventions from arbitrary paths or add another path templating
  language.
- Make identity rendering mandatory for every generator.
- Render binary or unsupported file types.

## Decisions

### Use a named `projectName` export as the opt-in signal

A project generator will declare its embedded identity alongside its default
generator export:

```ts
export const projectName = 'Template Name';

export default defineGenerator({
  prompts: {
    projectName: text({ message: 'Project name' }),
  },
  // ...
});
```

Neew will re-import the selected module and validate that this optional named
export is a non-empty string. When present, it will also require a prompt with
the same key before running anything. This keeps target input conventional for
project initialization and avoids an exposed internal answer value.

Alternative considered: configure `templateAdapter` in `gen.config.*`. Gen
applies that setting to every generator in a configuration, which cannot carry
a different source identity per generator. Alternative considered: attach the
identity to Gen's `Generator` object. That changes Gen's typed public shape and
would require a nonstandard property; a named module export is local and does
not affect generator discovery.

### Create the adapter in neew and pass it per run

Neew will upgrade to `@trut/gen` 0.2.0 and construct a project-name adapter
only for an opted-in generator. It passes the adapter directly to
`runGenerator`; generators with no `projectName` export pass no adapter and
therefore continue to use Eta.

The adapter closes over the exported source identity and reads the requested
target identity from `answers.projectName`. It first delegates dynamic strings
to Gen's Eta adapter, preserving existing action destinations, then builds a
replacement table using Gen's provided formatters. At minimum it covers capital
or title, Pascal, camel, kebab, snake, and constant forms. It replaces matches
globally, checking longer forms before shorter forms, then verifies that no
source form remains when source and target differ.

The adapter's `resolveOutputPath` recognizes only text files and returns their
unchanged relative paths. The initial allowlist covers common project source,
configuration, documentation, and markup extensions: `.css`, `.csv`, `.env`,
`.html`, `.htm`, `.ini`, `.js`, `.jsx`, `.json`, `.jsonc`, `.md`, `.mdx`,
`.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`, `.toml`, `.txt`, `.vue`,
`.xml`, `.yaml`, `.yml`, `.scss`, `.sass`, `.less`, `.svg`, `.sh`, and `.zsh`.
It also recognizes extensionless project files `Dockerfile` and `Makefile` and
dotfiles `.gitignore`, `.npmrc`, `.prettierrc`, and `.eslintrc`. Other files
return `undefined` and Gen copies them unchanged.

Alternative considered: a suffix such as `.eta` or `.tpl` to identify rendered
files. That would reintroduce template-shaped source trees, which this change
avoids. Alternative considered: render every file. That risks decoding or
corrupting binary assets.

### Keep output paths entirely in Gen

The adapter must not derive output file names or directories from the source
identity. Authors use Gen placeholders in source paths and standard Eta
expressions in `addTemplates({ to })` for destinations as they do today. Because
Gen invokes the adapter for dynamic action strings too, project generators must
not place literal source identity values in those strings; use `projectName`
expressions instead.

### Validate through staged runs

Identity replacement errors are thrown while Gen stages output. Gen's existing
commit step therefore ensures a strict-rendering failure cannot leave partial
files, including under `--dry-run`. Tests will use generated text files with
multiple identity forms, unsupported assets, legacy Eta generators, and a
missing `projectName` prompt.

## Risks / Trade-offs

- [A common source identity can occur in unrelated prose] -> Template authors
  choose a distinctive identity; all recognized occurrences intentionally
  change.
- [The fixed allowlist omits a textual file type] -> The file is copied
  unchanged; add extensions deliberately with coverage rather than rendering
  unknown files.
- [Gen 0.2.0 changes runtime package surfaces] -> Update fixtures and execute
  the existing CLI, registry, and end-to-end suites after the dependency bump.

## Migration Plan

1. Upgrade the dependency and lockfile.
2. Add the optional generator-module convention and neew adapter.
3. Document the convention and supported file types.
4. Release without migration work: existing repositories have no `projectName`
   export and continue using Eta.

Rollback consists of removing the opt-in export from a generator repository or
reverting neew; generated projects have no runtime dependency on the feature.
