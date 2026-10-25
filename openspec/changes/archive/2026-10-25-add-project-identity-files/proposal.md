# Proposal

## Why

The text-file allowlist does not yet recognize Go module files or every common
environment-file variant. As a result, project identity replacement skips those
known textual files.

## What Changes

- Recognize Go module files and the `.env.*` filename family in neew's global
  text-file allowlist.
- Document the expanded global file recognition rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-name-rendering`: extend the text-only identity-rendering contract
  with globally recognized Go and environment files.

## Impact

- Affects the project-name template adapter.
- No new public API or dependency is required.
- Updates adapter tests and generator-repository documentation.
