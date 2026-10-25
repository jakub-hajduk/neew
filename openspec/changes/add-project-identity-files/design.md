# Design

## Context

The project-name template adapter currently classifies files from their basename
and extension before choosing whether to render identity replacements. See
proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**

- Extend the existing global classification with Go module and environment-file
  naming rules.
- Keep unsupported files on the existing copy-without-replacement path.

**Non-Goals:**

- Add generator-defined file lists, paths, or glob patterns.
- Change `@trut/gen` or its template-adapter API.
- Infer text content from arbitrary files.

## Decisions

### Retain the global allowlist

The adapter will continue deciding from the template filename. `.mod` joins the
extension allowlist. Environment files are recognized by the basename rule:
`.env` or a name beginning with `.env.`. This handles every environment-file
variant without a growing list of individual names.

Generator-scoped patterns were considered but rejected because Gen currently
passes the adapter a path relative to each `addTemplates` source directory. That
does not identify a template file relative to its generator module, so supporting
the requested declaration would require an upstream Gen API change.

## Risks / Trade-offs

- [A future textual format remains unrecognized] -> It is copied unchanged,
  preserving the existing binary-safety boundary until a deliberate allowlist
  extension is made.
- [A file named `.env.*` contains non-text data] -> The global rule assumes the
  established environment-file naming convention denotes text configuration.

## Migration Plan

1. Release the updated allowlist as a backward-compatible neew version.
2. No generator migration is required; newly recognized files receive the same
   replacement behavior as existing recognized templates.
3. Roll back by restoring the prior allowlist; generated projects have no
   runtime dependency on this behavior.
