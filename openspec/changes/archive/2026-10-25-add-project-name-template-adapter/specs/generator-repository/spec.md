# Spec Delta

## ADDED Requirements

### Requirement: Optional project identity export

A generator module MAY named-export a non-empty string named `projectName` to
declare the project identity embedded in its templates. A module with that
export MUST declare a `projectName` prompt so users can supply the target
project name.

#### Scenario: Project generator declaration

- **WHEN** a module exports `projectName = 'Template Name'` and declares a `projectName` text prompt
- **THEN** neew recognizes the module as opting into project-name rendering

#### Scenario: Missing project-name prompt

- **WHEN** a module exports `projectName` but does not declare a `projectName` prompt
- **THEN** neew fails invocation before generation and identifies the missing prompt

#### Scenario: Existing generator module

- **WHEN** a generator module does not export `projectName`
- **THEN** neew accepts it under the existing generator repository contract
