# Running generators

Once a repository is registered, its generators run from any directory. This module covers the commands, parameters, targets, and the checks neew runs before writing.

## Two forms, one path

```sh
neew component --name "User profile"
neew create component --name "User profile"
```

`neew <generator>` is a shortcut for `neew create <generator>`. Both parse the same arguments, resolve the same parameters, and run the same generator. Use whichever reads better.

## Parameters

Each prompt in a generator becomes a flag. The flag is the kebab-case form of the prompt key, so `componentName` becomes `--component-name`. A value passed on the command line skips the prompt.

```sh
neew component --name "User profile"
neew service --port 3000 --enabled
neew docs --tags a,b
```

When a value is missing:

- A prompt with a `default` uses it.
- On a terminal, neew prompts for it interactively.
- Otherwise, neew fails and names the flag:

```
Missing required value for "name". Provide it with --name.
```

Prompt cancellation exits with code 130.

## Generator help

```sh
neew component --help
```

Prints the generator's description, its usage, its parameters with defaults and required markers, and the global options. It writes no files:

```
neew component - Create a React component

Usage:
  neew component [options]
  neew create component [options]

Parameters:
  --name <value>  Component name (required)

Options:
  --target <dir>  Write generated files into <dir> instead of the current directory
  --dry-run       Report the files that would be written without writing them
  --force         Replace existing files that collide with generated output
  -h, --help      Show this help
  -v, --version   Show the version
```

## Target directory

Generators write into the current directory by default. Pass `--target` to write elsewhere. The path resolves relative to the current directory.

```sh
neew component --name "User profile" --target ./apps/web
```

The generator's `basePath` resolves from the target, so a generator with `basePath: 'src'` writes into `./apps/web/src`.

## Dry run and force

```sh
neew component --name "User profile" --dry-run
neew component --name "User profile" --force
```

`--dry-run` reports the files that would be written and writes nothing:

```
Dry run for "component": 2 file(s) would be written.
  src/components/user-profile/Component.tsx
  src/components/user-profile/index.ts
```

`--force` replaces existing files that collide with generated output. Without it, a collision fails the run.

A normal run reports what it wrote:

```
Generator "component" wrote 2 file(s).
  ...
```

Both flags pass straight through to the `@trut/gen` runtime, so staging, collision handling, and the dry-run set follow that runtime's rules.

## The refetch before a run

Before running, neew ensures the generator's repository is present and current. If the remote commit changed since the last run, neew fetches the new copy, re-reads the barrel, and updates the registry's index for that repository. The run then uses the refreshed module set.

If the refetch renamed or removed the generator you invoked, neew fails and lists what the repository provides now:

```
Generator "component" is no longer provided by github.com/acme/my-generators. Available generators: button, form
```

## Unknown generators

A name with no registered generator fails and lists what is available:

```
Unknown generator "nope". Available generators: component, button
```

If nothing is registered, the list reads `(none)`.

## Command list

```sh
neew
```

Bare `neew` prints the commands, the global options, and the available generators. If the registry is malformed, it prints a warning to stderr and still shows the command list.

## Exit codes

| Code | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| 0    | Success                                                                      |
| 1    | Any error (unknown generator, missing parameter, refetch failure, and so on) |
| 130  | The user cancelled an interactive prompt                                     |

Errors print to stderr.
