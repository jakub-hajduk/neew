# Spec Delta

## Purpose

Lets project generators retain ready-to-use text files while replacing their
declared project identity with the project name supplied for a generation run.

## ADDED Requirements

### Requirement: Project-name rendering opt-in

When a generator module declares a non-empty `projectName` string and a
`projectName` prompt, neew MUST render that generator with project-name
replacement. A generator without the declaration MUST retain the default Gen
template rendering behavior.

#### Scenario: Opted-in project generator

- **WHEN** a generator declares `projectName` as `Template Name` and the user provides `--project-name "My App"`
- **THEN** neew renders the generator with `Template Name` as the source identity and `My App` as the target identity

#### Scenario: Generator without a project identity

- **WHEN** a generator does not declare `projectName`
- **THEN** neew invokes it with Gen's default template rendering behavior

### Requirement: Case-preserving identity replacement

For an opted-in generator, neew MUST replace every recognized textual case
form of the declared project identity with the corresponding case form of the
requested project name in every supported text template file. The supported
forms MUST include title, Pascal, camel, kebab, snake, and constant case.

#### Scenario: Mixed identity forms

- **WHEN** text files contain `Template Name`, `TemplateName`, `templateName`, `template-name`, `template_name`, and `TEMPLATE_NAME`
- **THEN** generated files contain the corresponding forms of the requested project name

### Requirement: Text-only rendering

Neew MUST render project identity replacements only in files recognized by its
text-file allowlist and MUST copy every other template file without applying
identity replacement.

#### Scenario: Non-text template asset

- **WHEN** an opted-in generator includes a template file outside neew's text-file allowlist
- **THEN** the asset is copied without identity replacement

### Requirement: Strict rendered output

For an opted-in generator whose requested project name differs from its
declared project identity, neew MUST fail the run before committing files when
a recognized source-identity form remains in rendered text.

#### Scenario: Unreplaced source identity

- **WHEN** rendered text still contains a recognized form of the declared project identity
- **THEN** neew fails without writing the staged generation output

### Requirement: Standard output path handling

Project-name rendering MUST NOT introduce a neew-specific mechanism for output
directories or output file names. Generator authors MUST continue to use Gen's
path placeholders and action destination settings for those paths.

#### Scenario: Dynamic output file name

- **WHEN** an opted-in generator uses a Gen path placeholder for a generated file name
- **THEN** Gen expands that placeholder using the supplied prompt value independently of identity replacement
