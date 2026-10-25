# neew

`neew` turns remote generator repositories into reusable commands. Register a
repository once, invoke its generators by name from any directory, and let a
small fetch engine reuse a local cache until the remote ref actually moves.

## Documentation

Start with [docs/getting-started.md](docs/getting-started.md), then read the module for the domain you need:

- [generator-repository.md](docs/generator-repository.md): the repository contract
- [repository-registry.md](docs/repository-registry.md): registering, removing, listing, collisions
- [source-fetching.md](docs/source-fetching.md): links, change detection, caching, offline use
- [generator-invocation.md](docs/generator-invocation.md): running generators, parameters, targets

## Install

```sh
pnpm add -g @trut/neew
```

## The generator repository contract

Any Git repository becomes a `neew` generator repository by adding a single
barrel file, `generators.ts`, at its root. The barrel default-exports a
`generators` array of paths or glob patterns resolved relative to the repository
root. Author it with the `defineGenerators` helper exported by this package:

<!-- example:barrel -->

```ts
import { defineGenerators } from '@trut/neew';

export default defineGenerators({
  generators: ['./generators/*.generator.ts'],
});
```

Each pattern must match at least one generator module. A module declares a
`@trut/gen` generator with a unique `name`, an optional `description`, and the
prompts that become the parameters neew accepts. For example
`generators/component.generator.ts`:

<!-- example:generator -->

```ts
import { addTemplates, defineGenerator, text } from '@trut/gen';

export default defineGenerator({
  name: 'component',
  description: 'Create a component',
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

Generator names must be unique within the repository; two resolved generators
sharing a name fail resolution.

### Project templates

A generator that initializes a project can keep ordinary, ready-to-use text
files and replace its embedded project identity at generation time. Export the
name present in those files and expose the target name through a `projectName`
prompt:

```ts
import { addTemplates, defineGenerator, text } from '@trut/gen';

export const projectName = 'Template Name';

export default defineGenerator({
  name: 'project',
  basePath: '.',
  prompts: {
    projectName: text({ message: 'Project name' }),
  },
  actions: [
    addTemplates({
      from: 'templates/project',
      to: '<%= it.format.kebabCase(it.answers.projectName) %>',
    }),
  ],
});
```

Neew replaces title, Pascal, camel, kebab, snake, and constant forms of the
exported name in supported text files. Output paths remain Gen's responsibility:
use its normal path placeholders and dynamic action strings. Files outside the
text-file allowlist are copied unchanged; generators without the export retain
the default Eta behavior.

## CLI usage

```sh
neew add <link>                     # register a repository and index its generators
neew remove <link>                  # unregister a repository and drop its cache
neew list                           # list repositories and their generators (offline)
neew create <generator> [options]   # run a generator
neew <generator> [options]          # shortcut for create
neew <generator> --help             # list a generator's parameters
neew                                # list the commands and available generators
```

Options:

- `--target <dir>`: write generated files into `<dir>` instead of the current
  directory.
- `--dry-run`: report the files that would be written without writing them.
- `--force`: replace existing files that collide with generated output.
- `-h, --help`, `-v, --version`.

Every generator prompt is exposed as a CLI flag (for example a `name` prompt
becomes `--name`). Missing values are prompted interactively on a TTY and fail
otherwise. The state lives in `~/.config/neew/neew.json` (registry) and
`~/.cache/neew/**` (fetched repositories).
