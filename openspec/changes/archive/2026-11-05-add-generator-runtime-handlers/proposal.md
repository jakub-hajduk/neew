# Proposal

## Why

`@trut/gen` can execute asynchronous handlers for custom actions, but neew currently provides no repository-level mechanism to supply those handlers at invocation time. Generator repositories therefore cannot safely use custom asynchronous actions while neew remains independent of their integrations.

## What Changes

- Extend the generator-repository barrel contract with an optional runtime-handler module declaration.
- Lazily load a repository's handler module only for an actual generator run, then pass its handler registry to `@trut/gen`.
- Expose a typed, generic authoring contract for handler modules without coupling neew to generator-specific action types or dependencies.
- Add dependency-injection seams for runtime-handler loading so integrations can be tested without external services.
- Document custom asynchronous actions, their handlers, lazy-loading behavior, and failure semantics.
- Preserve the behavior of repositories that do not declare runtime handlers.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `generator-repository`: Repository barrels may optionally declare a runtime-handler module and define the module's portable handler-registry contract.
- `generator-invocation`: Invocations load and delegate configured asynchronous handler registries only when executing a generator, preserving atomic failure behavior and help-mode isolation.

## Impact

- Affects generator-barrel configuration and public exports in `src/config/` and `src/index.ts`.
- Affects the invocation path in `src/cli/run.ts` and adds a lazy runtime-module loader.
- Adds CLI, registry, and integration-style tests plus generator-repository documentation.
- Uses the existing `@trut/gen` handler API; adds no AI-, Codex-, or generator-specific dependencies.
