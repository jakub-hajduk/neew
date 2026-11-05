# Spec Delta

## ADDED Requirements

### Requirement: Lazy runtime handler loading

When an invoked generator's repository declares runtime handlers, neew MUST load the handler module only for an execution that will run the generator. It MUST NOT load that module while adding or listing repositories, rendering general help, or rendering generator help.

#### Scenario: Adding a repository with runtime handlers

- **WHEN** a user runs `neew add` for a repository that declares runtime handlers
- **THEN** neew indexes the generators without initializing the runtime handler module

#### Scenario: Viewing generator help

- **WHEN** a user runs `neew <generator> --help` for a repository that declares runtime handlers
- **THEN** neew displays the generator help without initializing the runtime handler module

#### Scenario: Running a generator with runtime handlers

- **WHEN** a user invokes a generator from a repository that declares runtime handlers
- **THEN** neew loads that repository's handler registry and supplies it to the generation runtime

### Requirement: Handler failure preserves atomic generation

If a runtime handler rejects or throws, neew MUST fail the invocation and MUST NOT write any staged generator output to the target directory.

#### Scenario: Asynchronous handler failure

- **WHEN** an asynchronous runtime handler fails after an earlier action staged output
- **THEN** the invocation fails and none of that run's staged output is committed
