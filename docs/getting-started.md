# Getting started

Neew runs generators that live in Git repositories. You register a repository once, then run its generators by name from any directory. This page covers the whole path: write a generator repository, register it, run a generator.

## Install

```sh
pnpm add -g @trut/neew
```

Or run it without installing:

```sh
pnpm dlx @trut/neew list
```

The package ships one binary, `neew`.

## 1. Write a generator repository

A generator repository is any Git repository with a `generators.ts` barrel at its root. The barrel lists the glob patterns that point at generator modules. A minimal repository:

```
my-generators/
  generators.ts
  generators/
    component.generator.ts
    templates/
      component/
        Component.tsx.eta
        index.ts
```

`generators.ts`:

```ts
import { defineGenerators } from '@trut/neew';

export default defineGenerators({
  generators: ['./generators/*.generator.ts'],
});
```

`generators/component.generator.ts`:

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

`generators/templates/component/Component.tsx.eta`:

```tsx
export const <%= it.format.pascalCase(it.answers.name) %> = () => <div />;
```

`generators/templates/component/index.ts`:

```ts
export * from './Component';
```

The `name` `component` is what users type on the command line. The `name` prompt becomes a `--name` flag. Every file the generator writes stays below `basePath`, which resolves from the directory the generator runs in. Push the repository to GitHub.

The full contract is in [generator-repository.md](generator-repository.md).

### Project templates without placeholder content

For a generator that initializes a project, its text files can look exactly
like the finished project. Export the project's existing name and prompt for its
replacement:

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

Running `neew project --project-name "My App"` replaces recognized forms such
as `Template Name`, `TemplateName`, and `template-name` in supported text
files. Images and other unsupported assets are copied unchanged. Output paths
continue to use Gen's normal path placeholders and Eta action expressions.

## 2. Register the repository

```sh
neew add gh:acme/my-generators
```

Neew fetches the repository, loads the barrel, resolves the generator modules, checks the names against every repository already registered, and writes the result to your user registry. On success it prints the source and the generators it found:

```
Added github.com/acme/my-generators
  component    Create a React component
```

Registration runs once per repository. Re-running `neew add` on the same link refetches and re-indexes it.

## 3. Run a generator

From the directory you want output in:

```sh
neew component --name "User profile"
```

This is the same as `neew create component --name "User profile"`. The shortcut is one word shorter and runs the identical code path.

The generator's `basePath` is `src`, so the files land in `./src/components/user-profile`. To write somewhere else:

```sh
neew component --name "User profile" --target ./apps/web
```

Then it writes into `./apps/web/src/components/user-profile`. Preview first with `--dry-run`, and replace existing files with `--force`:

```sh
neew component --name "User profile" --dry-run
neew component --name "User profile" --force
```

## 4. See what is available

```sh
neew list
neew component --help
neew
```

`neew list` reads the registry and never touches the network. `neew <generator> --help` lists that generator's parameters. Bare `neew` prints the commands and the generators you can run.

## Where state lives

| Data                                                 | Location                   |
| ---------------------------------------------------- | -------------------------- |
| Registry (repositories and their indexed generators) | `~/.config/neew/neew.json` |
| Fetched repositories                                 | `~/.cache/neew/sources/**` |

Both paths follow the platform convention (XDG on Linux, `Application Support` and `Caches` on macOS, `APPDATA` and `LOCALAPPDATA` on Windows). Override them with `NEEW_CONFIG_DIR` and `NEEW_CACHE_DIR`.

## Modules

| Module                                             | Domain                                               |
| -------------------------------------------------- | ---------------------------------------------------- |
| [generator-repository.md](generator-repository.md) | The contract a generator repository must satisfy     |
| [repository-registry.md](repository-registry.md)   | Registering, removing, listing, collisions           |
| [source-fetching.md](source-fetching.md)           | Source links, change detection, caching, offline use |
| [generator-invocation.md](generator-invocation.md) | Running generators, parameters, targets, dry runs    |
