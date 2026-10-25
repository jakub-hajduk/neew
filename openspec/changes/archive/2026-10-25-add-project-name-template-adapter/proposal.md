# Proposal

## Why

Project templates should remain readable, working project files instead of Eta
documents littered with placeholders. Today neew always delegates rendering to
Gen's default Eta adapter, so a generator cannot replace a template's existing
project identity throughout ordinary text files.

## What Changes

- Upgrade `@trut/gen` to version 0.2.0 and use its per-run template-adapter
  API.
- Define an optional generator-module convention: `export const projectName =
  'Template Name'` declares the identity embedded in that generator's files;
  the generator's user-facing project-name prompt is `projectName`.
- When that export is present, run the generator with neew's project-name
  adapter. The adapter renders supported text files in place, replacing known
  case variants of the declared source name with matching variants of
  `answers.projectName`.
- Make identity replacement strict: recognized source-name variants must not
  remain in rendered text. Files outside the adapter's text-extension
  allowlist are copied unchanged.
- Preserve Gen's existing path and output-name mechanisms. Generator actions
  continue to use Gen placeholders and `addTemplates({ to })` for paths.
- Generators without the optional export retain Gen's default Eta behavior.

## Capabilities

### New Capabilities

- `project-name-rendering`: Render a generator's ready-to-use text files by
  replacing its declared project identity with the requested project name.

### Modified Capabilities

- `generator-repository`: Allow generator modules to opt into project-name
  rendering through the optional `projectName` export and prompt convention.

## Impact

- Updates the runtime dependency from `@trut/gen` 0.1.0 to 0.2.0.
- Affects generator loading and invocation in `src/cli/run.ts` and adds a
  neew-owned template adapter.
- Extends documentation, fixtures, and CLI integration coverage for generator
  repositories.
