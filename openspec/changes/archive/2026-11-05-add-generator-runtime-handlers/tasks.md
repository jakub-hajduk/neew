# Tasks

## 1. Repository runtime contract

- [x] 1.1 Extend the typed generator-barrel configuration with optional `runtime.handlers`, add public handler-registry authoring types/helper, and verify existing barrel and public-export tests still pass.
- [x] 1.2 Implement the lazy runtime-handler module loader with repository-relative resolution, default-export interoperability, and actionable invalid-export errors; verify focused loader tests cover absent, valid, and invalid declarations.
- [x] 1.3 Keep repository indexing independent of runtime-handler initialization and add a regression test whose handler module has an observable initialization side effect during `neew add`.
- [x] 1.4 Document the optional barrel field and handler-module export contract in `README.md` and `docs/generator-repository.md`, including a namespaced custom action and asynchronous handler example; verify the example matches exported APIs.

## 2. Invocation integration and isolation

- [x] 2.1 Add the injected runtime-handler loader dependency to the CLI invocation seam and supply its registry to `@trut/gen` only after help handling and prompt resolution; verify a repository without handlers runs unchanged.
- [x] 2.2 Add an invocation test using an injected asynchronous custom-action handler that stages output and prepares data for a later action; verify both effects are committed on success.
- [x] 2.3 Add an invocation test with a rejecting asynchronous handler after earlier staged output; verify the invocation rejects and no output from that run is written.
- [x] 2.4 Add regression tests that a configured runtime module is not initialized by `neew add`, `neew list`, general help, or `neew <generator> --help`, while it is initialized for an actual run.
- [x] 2.5 Document lazy-loading and handler-failure behavior in `docs/generator-invocation.md`; verify documentation links and CLI terminology are consistent.

## 3. Validation

- [x] 3.1 Run `pnpm test`, `pnpm run check`, and `pnpm run build`; resolve all failures and record successful completion.
