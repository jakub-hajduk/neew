# Generator repositories

A generator repository is a Git repository that neew can register and index. This module defines the contract: what the repository must contain, how neew reads it, and what makes registration fail.

## The barrel

Every generator repository needs one file at its root, `generators.ts`. It default-exports an object with a `generators` array of paths or glob patterns, resolved relative to the repository root. Author it with `defineGenerators`:

```ts
import { defineGenerators } from '@trut/neew';

export default defineGenerators({
  generators: ['./generators/*.generator.ts'],
});
```

`defineGenerators` is a typed identity function, so your editor checks the shape without running anything. The loader also accepts a named `generators` export, but the default export is the form to use.

A repository without `generators.ts` fails to register with the message `Repository contract violated: no generators.ts found at <dir>`.

## Patterns resolve to modules

Each pattern must match at least one generator module. A pattern that matches nothing fails registration and names the pattern:

```
Pattern "generators/*.generator.ts" matched no files in <dir>. Every pattern in the generators barrel must resolve to at least one generator module.
```

Patterns are globs over the repository root, so `./generators/*.generator.ts` and `./packages/*/generators/*.ts` both work.

## Generator modules

A matched module default-exports a `@trut/gen` generator, built with `defineGenerator`:

```ts
import { addTemplates, defineGenerator, text } from '@trut/gen';

export default defineGenerator({
  name: 'component',
  description: 'Create a React component',
  basePath: 'src',
  prompts: {
    name: text({ message: 'Component name', placeholder: 'UserProfile' }),
  },
  actions: [
    addTemplates({
      from: 'templates/component',
      to: 'components/<%= it.format.kebabCase(it.answers.name) %>',
    }),
  ],
});
```

A module may also export an array of generators or an object with a `generators` array, and may name-export generators. The common case is one default-exported generator per file.

Fields:

- `name` (required): the command users type. The file name does not affect it.
- `description` (optional): shown next to the name in `neew list` and in help.
- `basePath` (required): the directory every written file stays below, resolved from the directory the generator runs in.
- `prompts` (optional): the inputs, which become neew parameters.
- `actions` (required): the ordered list of changes to stage.

Generator names must be unique within a repository. Two resolved modules that declare the same name fail registration and report the name.

## Prompts become parameters

Each prompt key becomes a CLI flag in kebab case (`componentName` becomes `--component-name`). A value passed on the command line skips the interactive prompt. A missing value with a `default` uses the default; a missing value with no default fails and names the flag.

| Constructor   | Value    | Flag                                |
| ------------- | -------- | ----------------------------------- |
| `text`        | string   | `--name <value>`                    |
| `password`    | string   | `--token <value>`                   |
| `number`      | number   | `--count <value>`                   |
| `confirm`     | boolean  | `--enabled` / `--no-enabled`        |
| `select`      | string   | `--framework <value>`               |
| `multiselect` | string[] | `--tags a --tags b` or `--tags a,b` |

Common prompt options are `message`, `description`, `alias` (short flag), `default`, `validate`, and `format`. Run `neew <generator> --help` to list a generator's parameters.

## Templates and actions

`@trut/gen` provides three actions:

- `addTemplates({ from, to })` copies the `from` directory into `to`. `from` resolves relative to the module that declares the generator, `to` relative to `basePath`. A file ending in `.eta` is rendered and written without that extension; other files are copied as-is.
- `updateImports({ file, from, members })` merges imports into a source file.
- `updateExports({ file, from, members })` merges exports into a source file.

Templates use [Eta](https://eta.js.org) delimiters. The render context exposes `it.answers` (the resolved prompt values) and `it.format` (the `change-case` formatters: `pascalCase`, `kebabCase`, `camelCase`, and more).

Directory and file names inside a `from` tree expand two placeholder forms: `{name}` inserts the raw input, and `{formatter:name}` applies a formatter, so `{pascalCase:name}.tsx.eta` becomes `UserProfile.tsx`. A placeholder with no matching input or an unknown formatter fails the run before anything is written.

The full action and template reference lives in the `@trut/gen` README.

## Dependencies

You do not need to install `@trut/gen` or `@trut/neew` in the generator repository. When neew loads the barrel it aliases `@trut/gen`, `@trut/gen/runtime`, and `@trut/neew` to its own copies. The imports resolve without a local install.

## What makes registration fail

Registration reads the barrel, resolves every pattern, loads every module, and checks names before it writes anything. It fails, and leaves the registry unchanged, when:

- `generators.ts` is missing.
- A pattern matches no files.
- The barrel has no `generators` array of strings.
- A module throws while loading.
- Two generators in the repository share a name.
- A generator name collides with one in another registered repository.

The last case is covered in [repository-registry.md](repository-registry.md).
