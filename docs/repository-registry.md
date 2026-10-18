# Repository registry

The registry is the list of repositories neew knows about, together with the generators each one exposes. `neew add`, `neew remove`, and `neew list` manage it. Nothing else writes it.

## The registry file

The registry is a JSON file at `~/.config/neew/neew.json`. Its only top-level property is `repositories`, keyed by canonical source identity:

```json
{
  "repositories": {
    "github.com/acme/my-generators": {
      "source": "github.com/acme/my-generators",
      "url": "https://github.com/acme/my-generators",
      "generators": [
        {
          "name": "component",
          "path": "generators/component.generator.ts",
          "description": "Create a React component"
        }
      ]
    }
  }
}
```

`ref` and `subdir` appear on an entry only when the registered link included them. The generators array is the index neew uses to resolve a name to a module without a network round trip.

The file is written atomically: neew writes a temp file and renames it over the target, so a crash mid-write cannot leave a half-written registry.

The location follows the platform convention:

| Platform              | Path                                           |
| --------------------- | ---------------------------------------------- |
| `NEEW_CONFIG_DIR` set | `$NEEW_CONFIG_DIR/neew.json`                   |
| `XDG_CONFIG_HOME` set | `$XDG_CONFIG_HOME/neew/neew.json`              |
| macOS                 | `~/Library/Application Support/neew/neew.json` |
| Windows               | `%APPDATA%\neew\neew.json`                     |
| Linux and other       | `~/.config/neew/neew.json`                     |

## Malformed registry

If the file cannot be parsed, neew fails loudly and does not overwrite it:

```
Failed to parse the neew registry at <path>: <reason>. Fix or remove the file; neew will not overwrite it.
```

Every command that reads the registry stops with this error, so a broken file cannot be clobbered by an add or a remove. Bare `neew` prints the warning to stderr and shows the command list without generators. Fix the JSON or delete the file to recover.

## add

```sh
neew add <link>
```

`add` runs these steps in order:

1. Parse the link into a source.
2. Fetch the repository into the cache, reusing a current copy (see [source-fetching.md](source-fetching.md)).
3. Load `generators.ts` and resolve every generator module.
4. Check the resulting names against every other registered repository.
5. Write the source and its indexed generators to the registry.

It prints the source and the generators it indexed:

```
Added github.com/acme/my-generators
  component    Create a React component
```

Adding the same source again replaces its entry with a fresh index.

If any step from 3 to 4 fails, neew leaves the registry unchanged. When the failure happened on a freshly downloaded copy, it deletes that copy. A cache entry that was already current is kept.

## Global name uniqueness

Generator names are unique across every registered repository. Before writing an entry, `add` checks every name against all other repositories. A clash aborts the add, discards the downloaded copy, and reports each conflict with the repository it clashes with:

```
Repository cannot be added: generator name collision(s):
  - component (Create a React component) conflicts with github.com/other/templates
```

This is what lets `neew component` resolve to exactly one module with no network request. Within one repository, two generators with the same name fail earlier, when the repository is resolved.

## remove

```sh
neew remove <link>
```

`remove` deletes the matching entry and its cache directory. The link may omit the scheme, so all of these remove the same entry:

```sh
neew remove https://github.com/acme/my-generators
neew remove github.com/acme/my-generators
neew remove gh:acme/my-generators
```

If nothing matches, it fails with `Repository "<source>" is not registered.`

## list

```sh
neew list
```

`list` reads the registry and prints each source with its generators:

```
github.com/acme/my-generators
  component    Create a React component
```

It never contacts the network, so it works offline. With no repositories registered it prints `No repositories registered.`

## One repository, several registrations

The registry key is the canonical source, which includes an optional `#ref` and an optional `::subdir`. Registering the same repository at a different ref or subdirectory creates a separate entry with its own cache:

```sh
neew add gh:acme/my-generators#main
neew add gh:acme/my-generators#v2
```

These are two entries. See [source-fetching.md](source-fetching.md) for how links normalize to a key.
