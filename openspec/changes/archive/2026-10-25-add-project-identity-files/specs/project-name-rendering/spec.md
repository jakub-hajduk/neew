# Spec Delta

## MODIFIED Requirements

### Requirement: Text-only rendering

Neew MUST render project identity replacements only in files recognized by its
text-file allowlist and MUST copy every other template file without applying
identity replacement. The allowlist MUST recognize `.mod` files, `.env`, and
every filename beginning with `.env.`.

#### Scenario: Globally recognized Go module file

- **WHEN** an opted-in generator includes a `go.mod` template file
- **THEN** neew applies project identity replacement to that file

#### Scenario: Globally recognized environment file

- **WHEN** an opted-in generator includes a `.env.staging` template file
- **THEN** neew applies project identity replacement to that file

#### Scenario: Non-text template asset

- **WHEN** an opted-in generator includes a template file outside neew's text-file allowlist
- **THEN** the asset is copied without identity replacement
