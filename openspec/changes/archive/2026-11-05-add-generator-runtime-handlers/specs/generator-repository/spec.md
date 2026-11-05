# Spec Delta

## ADDED Requirements

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
