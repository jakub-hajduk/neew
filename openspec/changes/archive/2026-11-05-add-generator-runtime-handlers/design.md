# Design

## Context

See `proposal.md` for motivation. The repository barrel is already loaded for registration and invocation, while generator modules are loaded to index their metadata. The current invocation path resolves answers and calls `@trut/gen` without its optional handler registry. `@trut/gen` executes actions in order, awaits handlers, and commits its staged write pool only after all actions succeed.

## Goals / Non-Goals

**Goals:**

- Define a portable repository contract that points to a handler module without importing it as part of repository indexing or help rendering.
- Pass a typed custom-action handler registry to `@trut/gen` only on a real generator execution.
- Make handler resolution replaceable in CLI tests and keep generator-specific integrations owned by their repositories.
- Retain existing behavior for barrels without runtime configuration.

**Non-Goals:**

- Define, bundle, or interpret any generator-specific action type.
- Add AI, Codex, network-client, or other integration dependencies to neew.
- Change `@trut/gen` staging, commit, or action-execution semantics.
- Execute handlers for `add`, `list`, general help, or generator help.

## Decisions

### Add an optional runtime section to the barrel contract

The typed barrel configuration will gain an optional `runtime.handlers` repository-relative module path. A literal path keeps the barrel declarative: reading it exposes configuration but cannot execute handler-module top-level code.

The public entrypoint will expose the configuration and handler-registry types, plus a typed identity helper for authoring handler registries. A handler module will default-export a `Partial<ActionHandlerRegistry>`; its action types remain extensible through `@trut/gen` module augmentation in the generator repository.

**Alternative considered:** export handlers from each generator module. This is rejected because generator modules are loaded during `neew add` and help resolution, violating lazy initialization.

**Alternative considered:** hard-code one custom action or a generator-specific interface in neew. This is rejected because it couples neew to individual repositories and prevents independent extension.

### Isolate lazy loading behind a runtime-handler loader

A dedicated loader will resolve the configured module from the ensured repository directory using the repository Jiti instance. It will accept default-export interoperability consistently with the existing barrel loader, validate that the result is an object registry, and return `undefined` when no handler path is configured.

The invocation flow will call this loader only after the `--help` return and prompt resolution, immediately before `runGenerator`. Its result becomes the runtime's `handlers` option, preserving `@trut/gen` built-in handlers through that package's merge behavior.

`runCli` options will expose the loader as a dependency-injection seam. Tests can supply a fake registry or a failing async handler without importing a real integration module.

**Alternative considered:** eagerly load and cache handler registries in the repository index. This is rejected because it initializes external integrations during `add`, risks stale side effects, and makes help non-isolated.

### Preserve failure propagation and staging boundaries

Neew will await the loader and let module-load or handler errors propagate through the existing CLI error path. It will not catch errors to continue generation or perform writes. Since `@trut/gen` awaits action handlers before committing its staged files, a rejected handler prevents the commit of both earlier and later staged output.

**Alternative considered:** wrap handler errors and continue with built-in actions. This is rejected because it can produce incomplete output and violates the required atomic behavior.

### Document the repository-owned integration boundary

Repository documentation and the README will show a namespaced custom action, an asynchronous handler, staging a file, and sharing derived data through run-context answers. The example will make clear that imports and credentials for an external service belong in the handler module's repository, not in neew.

## Risks / Trade-offs

- [A handler module has top-level side effects] → Keep its path declarative and load it only in the execution branch; test that `add` and `--help` never import it.
- [Invalid handler export produces unclear runtime failures] → Validate the configured path and registry shape at lazy-load time with an error that names the repository module.
- [Custom-action type augmentation is unavailable to consumers] → Re-export the relevant handler types and provide the typed authoring helper while keeping the actual action schema in the repository.
- [A handler failure could appear to leave partial files] → Include a test that stages output before a rejecting handler and assert no output is committed.

## Migration Plan

1. Release the optional barrel field and public handler-authoring types without changing existing configuration.
2. Existing repositories continue to omit `runtime`; no registry migration is required.
3. Repository authors who need custom asynchronous actions add a separate handler module, then opt in through `runtime.handlers`.
4. Rollback consists of omitting the optional runtime declaration; no persistent state or generated configuration requires migration.
