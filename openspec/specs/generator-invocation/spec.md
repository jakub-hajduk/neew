# generator-invocation Specification

## Purpose

Invokes a registered generator's scaffolding into the current or an explicit target directory.

## Requirements

### Requirement: Bare invocation

Running `neew` with no arguments MUST print the management commands (`add`, `remove`, `list`) and, in a separate section, the available generators.

#### Scenario: No arguments

- **WHEN** the user runs `neew` with no arguments
- **THEN** neew prints the commands followed by a separated list of available generators

### Requirement: create and shortcut

`neew create <generator> [params]` MUST invoke the named generator, and `neew <generator> [params]` MUST be an equivalent shortcut.

#### Scenario: Shortcut equivalence

- **WHEN** the user runs `neew component --name Foo` or `neew create component --name Foo`
- **THEN** both invoke the `component` generator with the same parameters

### Requirement: Parameter resolution

Generator parameters MUST be resolvable from flags and, when interactive, from prompts. A missing required value MUST fail with an error naming its flag.

#### Scenario: Missing required parameter

- **WHEN** a required parameter is neither supplied nor defaulted
- **THEN** neew fails and names the parameter's flag

### Requirement: Generator help

`neew <generator> --help` MUST list that generator's parameters and the available global options, without running it.

#### Scenario: Viewing parameters

- **WHEN** the user runs `neew component --help`
- **THEN** neew lists `component`'s parameters and global options and does not generate files

### Requirement: Target directory

Generation MUST write into the current working directory, or into an explicit target directory when one is supplied.

#### Scenario: Explicit target

- **WHEN** the user supplies a target directory
- **THEN** generated files are written there instead of the current directory

### Requirement: Source ensured before invocation

Before running, neew MUST ensure the generator's repository is present and current via the fetch engine, and MUST refresh the indexed generator set when the source changed.

#### Scenario: Source changed

- **WHEN** change detection reports a new commit
- **THEN** neew refreshes the cached repository and its indexed generators before running

### Requirement: Delegation to the generation runtime

Neew MUST run generators through the `@trut/gen` runtime so that staging, collision handling, and the dry-run and force options behave as that runtime prescribes.

#### Scenario: Dry run

- **WHEN** the user passes the dry-run option
- **THEN** neew reports the files that would be written without writing them

### Requirement: Unknown generator

A name with no registered generator MUST fail with an error listing the available generators.

#### Scenario: Unknown name

- **WHEN** the user invokes a generator name that is not registered
- **THEN** neew fails and lists the available generators

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
