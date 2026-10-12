# @mi-lu-uncle/dsh-skill-console

A DeepSeek Harness **community plugin** that gives you both a **visual Skills
panel** and a **command-line skill manager**:

- **Settings → Skills panel** — browse every installed skill (name · invocation · source · path), with search
- **`/skills`** — list skills (name · invocation · source repo), optionally filtered
- **`/skills-uninstall <名字>`** — remove an installed skill
- **`/skills-update [仓库名]`** — pull a repo mirror and re-sync its links (default `mattpocock-skills`)
- **`/skills-doctor`** — health check: dead links, invalid frontmatter, orphaned mirrors

## Why

DSH skills (`SKILL.md` bundles discovered by `@deepseek-ai/dsh-skill-filesystem`)
ship no UI. This plugin closes the gap twice: a read-only Settings panel
(client half) for browsing, and `/` commands (host half) for reading and
writing. The write commands operate on the symlink layout in `~/.dsh/skills`
(`git pull` + reconcile), after which DSH's watcher hot-reloads the result.

## Install

From this GitHub repository (recommended):

```sh
dsh plugin --profile desktop add https://github.com/mi-lu-uncle/dsh-skill-console.git
```

Or from a local path or tarball:

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-skill-console
dsh plugin --profile desktop add ./dsh-skill-console-1.0.0.tgz
```

Note: `link:`-installed plugins are not watched by HMR, so editing
`lib/index.js` or `lib/client.js` requires an app restart to take effect.

## Usage

```
/skills                    # list every skill in this session
/skills docx               # filter by keyword (name, description, whenToUse)
/skills-uninstall pr       # remove the `pr` skill
/skills-update             # update mattpocock-skills (default)
/skills-update my-repo     # update another repo mirror
/skills-doctor             # structural health check
```

The panel lives in the **main sidebar** (the Skills icon, next to Plugins) and
also under **Settings → Skills**. It is a search-centric management console: a
large centred search bar over a full-width card gallery, with the filters
(source / invocation / sort) tucked into a slide-out panel behind the **筛选**
button. Click a card for a slide-over detail drawer with the description,
invocation, source, path, a button that copies its `/name` command, and an
**uninstall** button. The header **installs** skills from a git URL or local path
(preview → select → link), **updates** the mattpocock-skills mirror, and runs a
**health check**. The same actions also exist as `/skills-uninstall`,
`/skills-update` and `/skills-doctor`.

Each `/skills` line reads `- /name [invocation · 来源:repo] — description`:

- **invocation** — `模型+用户` / `仅模型` / `仅用户` / `未开放`
- **来源** — the repo mirror a symlink resolves into (e.g. `mattpocock-skills`),
  or a discovery-root label for non-repo skills (`内置`, `DSH用户`, `项目`, …).

## Configuration

Override the managed directories on the `skill-console` row in your profile
patch (`cordis.patch.yml`) if needed:

```yaml
- id: skill-console
  config:
    skillsDir: /Users/you/.dsh/skills            # default
    reposDir: /Users/you/.dsh/repos              # default
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
| `lib/index.js` | Host half: four commands + the panel's `/api/skill-console/list` route |
| `lib/client.js` | Client half: the Settings "Skills" panel (React) |
| `cordis.patch.yml` | Bundle patch that mounts the package as one host row |
| `package.json` | npm metadata + `dsh.bundle`/`dsh.client`/`dsh.compatibility` |
| `test/smoke.mjs` | Offline test of `/skills` against fake services |
| `test/manager.test.mjs` | Filesystem commands against a throwaway git remote |

## Test

```sh
node test/smoke.mjs
node test/manager.test.mjs
```
