# Tasks

## 1. Extend text-file recognition

- [x] 1.1 Update the project-name template adapter so `.mod` files and `.env` plus every `.env.*` filename are recognized as text templates; verify focused unit tests cover root and nested paths.
- [x] 1.2 Preserve copying for unrecognized assets and verify the focused adapter test still excludes a binary-style path such as `assets/logo.png`.

## 2. Document the supported files

- [x] 2.1 Update the generator-repository documentation with the expanded global allowlist behavior; verify the documented list matches the adapter's supported `.mod` and environment-file rules.

## 3. Verify the change

- [x] 3.1 Run `pnpm test` and `pnpm check` to verify the adapter change passes the repository test and static-quality suites.
