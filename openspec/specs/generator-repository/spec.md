# generator-repository Specification

## Purpose

Defines the contract a remote generator repository must satisfy so neew can discover, index, and invoke the generators it exposes.

## Requirements

### Requirement: Root generators barrel

Every generator repository MUST provide a single barrel file named `generators.ts` at its root that exports a `generators` array of paths or glob patterns resolved relative to the repository root.

#### Scenario: Barrel present

- **WHEN** a repository root contains `generators.ts` exporting a `generators` array
- **THEN** neew treats it as a generator repository and resolves the listed patterns

#### Scenario: Barrel missing

- **WHEN** a repository root has no `generators.ts`
- **THEN** resolving that repository fails and reports the missing barrel

### Requirement: defineGenerators authoring helper

The `defineGenerators` helper exported by the package MUST produce a valid `generators.ts` barrel and MUST be usable without loading any runtime engine.

#### Scenario: Authoring a barrel

- **WHEN** a repository author writes `export default defineGenerators({ generators: ['./generators/*.generator.ts'] })`
- **THEN** the file loads as a barrel whose `generators` array holds the given patterns

### Requirement: Patterns resolve to modules

Every path or glob in the barrel MUST resolve to at least one generator module; a pattern that matches nothing MUST fail resolution.

#### Scenario: Dangling pattern

- **WHEN** a barrel lists a pattern that matches no file
- **THEN** resolution fails and names the unmatched pattern

### Requirement: Names unique within a repository

Generator names MUST be unique within a single repository; two resolved generators sharing a name MUST fail resolution.

#### Scenario: Duplicate name in one repository

- **WHEN** two modules in the same repository declare generators with the same name
- **THEN** resolution fails and lists the conflicting name

### Requirement: Generators declare prompts as parameters

Each resolved generator MUST be a `@trut/gen` generator declaring a name and optionally a description; its prompts define the parameters neew accepts for it.

#### Scenario: Parameter surface

- **WHEN** a generator declares prompts such as a `name` text prompt
- **THEN** neew exposes `--name` as that generator's parameter

### Requirement: Optional project identity export

A generator module MAY named-export a non-empty string named `projectName` to
declare the project identity embedded in its templates. A module with that
export MUST declare a `projectName` prompt so users can supply the target
project name.

#### Scenario: Project generator declaration

- **WHEN** a module exports `projectName = 'Template Name'` and declares a `projectName` text prompt
- **THEN** neew recognizes the module as opting into project-name rendering

#### Scenario: Missing project-name prompt

- **WHEN** a module exports `projectName` but does not declare a `projectName` prompt
- **THEN** neew fails invocation before generation and identifies the missing prompt

#### Scenario: Existing generator module

- **WHEN** a generator module does not export `projectName`
- **THEN** neew accepts it under the existing generator repository contract

### Requirement: Optional runtime handler declaration

A generator repository MAY declare a runtime handler module in its root barrel alongside its generator patterns. The declaration MUST be a repository-relative module path and its absence MUST preserve the existing repository contract and registration behavior.

#### Scenario: Repository without runtime handlers

- **WHEN** a repository barrel declares only its generator patterns
- **THEN** neew registers and invokes its generators as before

#### Scenario: Repository declares runtime handlers

- **WHEN** a repository barrel declares a valid runtime handler module path
- **THEN** neew accepts the declaration without indexing the handler module during registration

### Requirement: Runtime handler module contract

A declared runtime handler module MUST export a handler registry compatible with `@trut/gen` custom actions. Handlers MAY be asynchronous and receive the generation runtime context, including resolved answers and staged files.

#### Scenario: Custom action handler

- **WHEN** a declared registry provides a handler for a custom action used by the invoked generator
- **THEN** the handler is available to the generation runtime with its action and run context

#### Scenario: Handler prepares later action data

- **WHEN** an asynchronous handler adds derived data to the run context answers
- **THEN** a later action can use that data in the same generation run
