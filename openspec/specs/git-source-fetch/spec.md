# git-source-fetch Specification

## Purpose

Resolves and fetches generator repositories from remote Git sources, reusing a local cache until the source's commit changes.

## Requirements

### Requirement: URL-first source input

Neew MUST accept a repository URL, with or without a scheme, including an optional subdirectory and an optional `#ref`.

#### Scenario: Scheme optional

- **WHEN** the user passes `https://github.com/acme/templates` or `github.com/acme/templates`
- **THEN** both address the same repository

### Requirement: Optional giget-style shorthand

Neew MUST accept giget-style shorthand (`gh:owner/repo`, `github:owner/repo`, bare `owner/repo`, and a `::` subdirectory separator) and normalize it to the same source identity as the equivalent URL.

#### Scenario: Shorthand equals URL

- **WHEN** the user passes `gh:acme/templates#main` and `https://github.com/acme/templates#main`
- **THEN** both resolve to the same source identity

### Requirement: Canonical source identity

Scheme, a trailing slash, a `.git` suffix, and host case MUST NOT affect source identity.

#### Scenario: Normalized removal

- **WHEN** a repository was added as `https://github.com/acme/templates`
- **THEN** `neew remove github.com/acme/templates` removes that same entry

### Requirement: Change detection by resolved commit

Neew MUST resolve the requested ref to its current commit using a single metadata request that does not clone the repository, and MUST compare it with the commit recorded for the cached copy. Resolution MUST NOT spawn a `git` binary.

#### Scenario: Unchanged ref reuses cache

- **WHEN** the resolved commit equals the recorded commit and a cached copy exists
- **THEN** neew reuses the cached copy without downloading

#### Scenario: Changed ref refetches

- **WHEN** the resolved commit differs from the recorded commit
- **THEN** neew fetches the new copy and replaces the cached one

#### Scenario: No ref given

- **WHEN** the source has no `#ref`
- **THEN** neew resolves the repository's default branch and detects changes against it

### Requirement: Atomic cache replacement

Replacing a cached copy MUST be atomic: a partially fetched copy MUST NOT be observable as the cache entry.

#### Scenario: Interrupted fetch

- **WHEN** a fetch is interrupted before completion
- **THEN** the previous cached copy remains intact

### Requirement: Per-host download adapters

Downloads MUST be performed by a per-host adapter selected from the source host and MUST fetch only the requested ref, and subdirectory when given. A host without an adapter MUST fail with a clear unsupported-host error.

#### Scenario: Unsupported host

- **WHEN** the source host has no adapter
- **THEN** neew fails and reports the host as unsupported

### Requirement: Cache metadata lives with the cache

The resolved commit and source details MUST be stored inside the cache entry, not in the user configuration, and MUST be discarded together with it.

#### Scenario: Cache removed

- **WHEN** a cache entry is deleted
- **THEN** no stale commit information remains to be read from the configuration

### Requirement: Offline fallback

If change detection cannot reach the remote and a cached copy exists, neew MUST warn and use the cached copy.

#### Scenario: Remote unreachable

- **WHEN** resolving the ref fails due to a network error and a cached copy exists
- **THEN** neew warns and proceeds with the cached copy
