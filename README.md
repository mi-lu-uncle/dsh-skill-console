# @mi-lu-uncle/dsh-skill-manager

A DeepSeek Harness **community plugin** that provides the human-facing skill
management surface DSH does not ship, through the `/` command menu:

- **`/skills`** — list skills (name · invocation · source repo), optionally filtered
- **`/skills-uninstall <名字>`** — remove an installed skill
- **`/skills-update [仓库名]`** — pull a repo mirror and re-sync its links (default `mattpocock-skills`)
- **`/skills-doctor`** — health check: dead links, invalid frontmatter, orphaned mirrors

## Why

DSH skills (`SKILL.md` bundles discovered by `@deepseek-ai/dsh-skill-filesystem`)
are not slash commands, and no shipped UI lists them. This plugin closes that
gap: `/skills` reads the same registry snapshot the model catalog is built from,
and the other commands operate on the symlink layout in `~/.agents/skills`
(`git pull` + reconcile), after which DSH's watcher hot-reloads the result.

## Install

From this GitHub repository (recommended):

```sh
dsh plugin --profile desktop add https://github.com/mi-lu-uncle/dsh-skill-manager.git
```

Or from a local path or tarball:

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-skill-manager
dsh plugin --profile desktop add ./dsh-skill-manager-1.0.0.tgz
```

Note: `link:`-installed plugins are not watched by HMR, so editing
`lib/index.js` requires an app restart to take effect.

## Usage

```
/skills                    # list every skill in this session
/skills docx               # filter by keyword (name, description, whenToUse)
/skills-uninstall pr       # remove the `pr` skill
/skills-update             # update mattpocock-skills (default)
/skills-update my-repo     # update another repo mirror
/skills-doctor             # structural health check
```

Each `/skills` line reads `- /name [invocation · 来源:repo] — description`:

- **invocation** — `模型+用户` / `仅模型` / `仅用户` / `未开放`
- **来源** — the repo mirror a symlink resolves into (e.g. `mattpocock-skills`),
  or a discovery-root label for non-repo skills (`内置`, `DSH用户`, `项目`, …).

## Configuration

Override the managed directories on the `skill-manager` row in your profile
patch (`cordis.patch.yml`) if needed:

```yaml
- id: skill-manager
  config:
    agentsSkillsDir: /Users/you/.agents/skills   # default
    reposDir: /Users/you/.dsh/repos               # default
```

## Distribution

The primary channel is this GitHub repository (install via the git URL above).
Publishing to npm is optional; if you do, the scoped name requires `--access
public`:

```sh
npm login
npm publish --access public
```

The `dsh.compatibility.dshReleases` map gates which DSH runtime versions accept
the bundle; extend it when a new DSH release is verified.

## Layout

| File | Role |
|---|---|
| `lib/index.js` | The plugin: four commands on `ctx.commands` + exported helpers |
| `cordis.patch.yml` | Bundle patch that mounts the package as one host row |
| `package.json` | npm metadata + `dsh.bundle`/`dsh.compatibility` |
| `test/smoke.mjs` | Offline test of `/skills` against fake services |
| `test/manager.test.mjs` | Filesystem commands against a throwaway git remote |

## Test

```sh
node test/smoke.mjs
node test/manager.test.mjs
```
