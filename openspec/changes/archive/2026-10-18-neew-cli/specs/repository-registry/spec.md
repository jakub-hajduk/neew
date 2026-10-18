# Spec Delta

## Purpose

Manages the set of registered generator repositories in a user-level config and indexes the generators they expose.

## ADDED Requirements

### Requirement: User-level registry file

The registry MUST be a user-level JSON file whose only top-level property is `repositories`, keyed by canonical source identity. Neew MUST manage it exclusively through the CLI.

#### Scenario: Malformed config

- **WHEN** the registry file cannot be parsed
- **THEN** neew fails loudly and MUST NOT overwrite the file

### Requirement: add registers a repository

`neew add <link>` MUST fetch the repository, read its barrel, resolve its generators, and persist the source and its indexed generators so they become invocable by name.

#### Scenario: Successful add

- **WHEN** `add` receives a repository whose barrel resolves without conflicts
- **THEN** the source and its generators are written to the registry

### Requirement: add validates before persisting

`add` MUST verify the barrel exists, every pattern resolves, and each module loads. Any failure MUST abort the add, remove the downloaded copy, and leave the registry unchanged.

#### Scenario: Validation failure

- **WHEN** a pattern matches nothing or a module fails to load
- **THEN** `add` aborts, deletes the downloaded copy, and does not modify the registry

### Requirement: Global generator-name uniqueness

Generator names MUST be unique across all registered repositories.

#### Scenario: Collision rejected

- **WHEN** a repository exposes a generator whose name or path collides with an already registered generator
- **THEN** `add` fails, lists the conflicting generators with their descriptions, discards the downloaded copy, and reports that the repository cannot be added

#### Scenario: No collision

- **WHEN** all new generator names are unused
- **THEN** the repository is added successfully

### Requirement: remove unregisters a repository

`neew remove <link>` MUST remove the repository entry and its cached copy. The link MAY omit the scheme.

#### Scenario: Remove by scheme-less link

- **WHEN** `remove` receives `github.com/acme/templates`
- **THEN** the matching entry and its cache are removed

### Requirement: list reports registered repositories

`neew list` MUST report the registered repositories and the generators each exposes, without contacting the network.

#### Scenario: Offline listing

- **WHEN** `neew list` runs with no network
- **THEN** it still lists repositories and generators from the registry
