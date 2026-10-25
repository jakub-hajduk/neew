# Tasks

## 1. Upgrade the generation runtime

- [x] 1.1 Upgrade `@trut/gen` to 0.2.0 and refresh the lockfile; verify `pnpm install --frozen-lockfile` succeeds
- [x] 1.2 Adapt imports and existing fixtures to the Gen 0.2.0 public runtime surface; verify `pnpm test` passes before project-name behavior is added

## 2. Implement project-name rendering

- [x] 2.1 Add a neew-owned project-name template-adapter factory with the documented text-file allowlist and unchanged relative paths; verify focused unit tests cover accepted text paths and skipped assets
- [x] 2.2 Implement case-preserving replacements for title, Pascal, camel, kebab, snake, and constant forms, including strict residual-identity validation; verify focused tests cover all forms and an unreplaced identity failure
- [x] 2.3 Load and validate an optional named `projectName` export from the selected generator module, requiring a matching `projectName` prompt; verify CLI tests cover valid, absent, and invalid opt-in declarations
- [x] 2.4 Pass the adapter only for opted-in generators while leaving path placeholders and `addTemplates({ to })` under Gen control; verify a generated project preserves dynamic output paths and a legacy Eta generator still renders as before

## 3. Document and verify the generator contract

- [x] 3.1 Update README and generator-repository documentation with the `projectName` export, prompt convention, supported text-file types, strict replacement rule, and standard Gen path guidance; verify examples match the implemented CLI behavior
- [x] 3.2 Add end-to-end coverage for a project generator containing multiple identity forms and an unrendered asset, including a `--dry-run` run; verify the run writes expected content, does not alter the asset, and dry-run writes nothing
- [x] 3.3 Run `pnpm check` and `pnpm test`; verify both commands succeed
