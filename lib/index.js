/**
 * DSH skill console — a complete, human-facing skill management console.
 *
 * DSH ships no skill picker UI, so this plugin provides the missing surface in
 * two places: a panel (client half) and the `/` command menu (host half):
 *   - Panel — the merged catalog (managed ~/.dsh/skills root plus DSH's own
 *     discovery: bundled, project, user-agents), browse / search / filter it,
 *     and act on the managed half: install, uninstall, update, health check.
 *   - `/skills`             list skills (name, invocation, source repo)
 *   - `/skills-uninstall`   remove an installed skill
 *   - `/skills-update`      pull a repo mirror and re-sync its symlinks
 *   - `/skills-doctor`      health check: dead links, invalid frontmatter, orphans
 *
 * Both surfaces operate on the filesystem (symlinks + git); DSH's skill watcher
 * then hot-reloads the result automatically, so nothing needs a restart.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  join,
  resolve,
  sep,
} from 'node:path';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';

const run = promisify(execFile);

/** Cordis plugin identity. */
export const name = 'skill-console';

/** Services this plugin uses: the command registry, the skill registry, and the web server. */
export const inject = ['commands', 'skills', 'webServer'];

/** Default managed skill root (all DSH skills live here). */
const DEFAULT_SKILLS_DIR = () => join(homedir(), '.dsh', 'skills');
/** Default directory holding the cloned repo mirrors. */
const DEFAULT_REPOS_DIR = () => join(homedir(), '.dsh', 'repos');

/**
 * Directories inside a repo mirror that should never surface, by mirror
 * basename: `previewRepo` / `installSkills` / `syncRepo` must all use the same
 * set for a given repo, or install lets you install what update then ignores.
 */
const MIRROR_SKIP = {
  'mattpocock-skills': ['deprecated', 'misc'],
};
const DEFAULT_MIRROR_SKIP = ['deprecated'];

/** The skip set for one mirror basename. */
function skipForRepo(repoName) {
  return new Set(MIRROR_SKIP[repoName] ?? DEFAULT_MIRROR_SKIP);
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DESCRIPTION_MAX = 110;

/** Collapse a description to one bounded line. */
function oneLine(text, max = DESCRIPTION_MAX) {
  const flat = String(text ?? '').replace(/\s+/gu, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/** Whether `p` is a symbolic link (dangling links included). */
function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Whether `p` is a directory. */
function isDir(p) {
  try {
    return lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Absolute resolved target of a symlink, or null. */
function symlinkTarget(p) {
  if (!isSymlink(p)) return null;
  try {
    return resolve(dirname(p), readlinkSync(p));
  } catch {
    return null;
  }
}

/** Parse `name` + `description` from a SKILL.md frontmatter block, or null. */
function parseFrontmatter(content) {
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) return null;
  const body = m[1];
  const get = (key) => {
    const r = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(body);
    if (!r) return undefined;
    let v = r[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  };
  return { name: get('name'), description: get('description') };
}

/**
 * Find all skills under a repo mirror as `{ dir, name }`, skipping any
 * directory whose basename is in `skip` (plus `.git` and `node_modules`).
 */
function findSkills(repoDir, skip = new Set()) {
  const out = [];
  const skipAlways = new Set(['.git', 'node_modules']);
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipAlways.has(entry.name) || skip.has(entry.name)) continue;
        walk(p);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        out.push({ dir, name: basename(dir) });
      }
    }
  };
  walk(repoDir);
  return out;
}

/** Run `git -C <repo> ...` and return trimmed stdout. */
async function git(repo, args) {
  const { stdout } = await run('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout.trim();
}

/**
 * Pull a repo mirror fast-forward, then reconcile its symlinks into `destDir`:
 * link new/moved skills, remove dead links (deleted upstream). Skills whose
 * directory basename is in `skip` are never linked, but existing links are
 * only removed when they go dead (so manual additions survive).
 */
async function syncRepo(repoDir, destDir, skip = new Set()) {
  const before = await git(repoDir, ['rev-parse', '--short', 'HEAD']).catch(() => null);
  if (before === null) return { ok: false, error: `不是 git 仓库：${repoDir}` };

  try {
    await git(repoDir, ['fetch', 'origin', '--prune']);
    const branch = await git(repoDir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).catch(() => 'origin/main');
    const remoteHead = await git(repoDir, ['rev-parse', '--short', branch]);
    let note = '';
    if (remoteHead !== before) {
      try {
        await git(repoDir, ['pull', '--ff-only']);
      } catch (error) {
        return { ok: false, error: `无法快进更新仓库，请检查本地改动或分叉历史：${repoDir}（${error instanceof Error ? error.message : String(error)}）` };
      }
    }
    const after = await git(repoDir, ['rev-parse', '--short', 'HEAD']);

    mkdirSync(destDir, { recursive: true });
    let linked = 0;
    const conflicts = [];
    for (const { dir, name: skillName } of findSkills(repoDir, skip)) {
      const target = join(destDir, skillName);
      const current = symlinkTarget(target);
      if (current === dir) continue;
      if (current !== null && current !== repoDir && !current.startsWith(repoDir + sep)) {
        conflicts.push(skillName);
        continue;
      }
      if (existsSync(target) && !isSymlink(target)) {
        conflicts.push(skillName);
        continue;
      }
      rmSync(target, { force: true });
      symlinkSync(dir, target);
      linked += 1;
    }

    let removed = 0;
    for (const entry of readdirSync(destDir)) {
      const p = join(destDir, entry);
      const t = symlinkTarget(p);
      if (t === null || !(t === repoDir || t.startsWith(repoDir + sep))) continue;
      if (!existsSync(join(p, 'SKILL.md'))) {
        rmSync(p, { force: true });
        removed += 1;
      }
    }

    return { ok: true, before, after, linked, removed, conflicts, note };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Find the managed-root entry whose SKILL.md frontmatter `name` (or its
 * single-`.md` filename) matches `skillName`, or null. The panel addresses
 * skills by their frontmatter name, which can differ from the directory
 * entry the link was created with.
 */
function findManagedEntry(destDir, skillName) {
  let entries;
  try {
    entries = readdirSync(destDir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const p = join(destDir, entry);
    const skillFile = isDir(p) || isSymlink(p) ? join(p, 'SKILL.md') : entry.endsWith('.md') ? p : null;
    if (skillFile === null) continue;
    try {
      if (fmValue(readFileSync(skillFile, 'utf8'), 'name') === skillName) return entry;
    } catch /* unreadable SKILL.md — keep scanning */ {
    }
  }
  return null;
}

/** Remove one skill from the managed root; never touches real (non-symlink) entries. */
function uninstallSkill(destDir, skillName) {
  if (typeof skillName !== 'string' || !KEBAB.test(skillName)) {
    return { ok: false, error: `技能名不合法：${String(skillName)}` };
  }
  const direct = join(destDir, skillName);
  let p = direct;
  if (!existsSync(direct) && !isSymlink(direct)) {
    const entry = findManagedEntry(destDir, skillName);
    if (entry === null) return { ok: false, error: `没有技能「${skillName}」` };
    p = join(destDir, entry);
  }
  if (!isSymlink(p)) {
    return { ok: false, error: `「${skillName}」是真实目录/文件而非链接，为安全起见我不会自动删除。` };
  }
  const target = symlinkTarget(p);
  rmSync(p, { force: true });
  return { ok: true, name: skillName, entry: basename(p), target };
}

/** Health check over the managed root and the mirror directory. */
function doctorReport(destDir, reposDir) {
  const dead = [];
  const invalid = [];
  let total = 0;
  for (const entry of readdirSync(destDir)) {
    const p = join(destDir, entry);
    const t = symlinkTarget(p);
    const dir = isSymlink(p) ? t : p;
    if (dir === null || !existsSync(dir)) {
      dead.push(entry);
      continue;
    }
    total += 1;
    let content;
    try {
      content = readFileSync(join(p, 'SKILL.md'), 'utf8');
    } catch {
      invalid.push(`${entry}（找不到 SKILL.md）`);
      continue;
    }
    const fm = parseFrontmatter(content);
    if (fm === null || !fm.name || !KEBAB.test(fm.name) || !fm.description) {
      invalid.push(`${entry}（frontmatter 缺失或 name/description 不合法）`);
    }
  }

  const orphans = [];
  if (isDir(reposDir)) {
    for (const repo of readdirSync(reposDir)) {
      const repoDir = join(reposDir, repo);
      if (!isDir(repoDir)) continue;
      let linked = false;
      for (const entry of readdirSync(destDir)) {
        const t = symlinkTarget(join(destDir, entry));
        if (t !== null && (t === repoDir || t.startsWith(repoDir + sep))) {
          linked = true;
          break;
        }
      }
      if (!linked) orphans.push(repo);
    }
  }
  return { total, dead, invalid, orphans };
}

/** Map the two invocability flags onto a stable invocation key. */
function invocationOf(modelInvocable, userInvocable) {
  if (!modelInvocable) return userInvocable ? 'user-only' : 'none';
  return userInvocable ? 'model-and-user' : 'model-only';
}

const INVOCATION_LABELS = {
  'model-and-user': '模型+用户',
  'user-only': '仅用户',
  'model-only': '仅模型',
  none: '未开放',
};

/** Render which invocation surfaces a skill exposes. */
function invocationLabel(skill) {
  const model = skill.invocation?.modelInvocable !== false;
  const user = skill.invocation?.userInvocable !== false;
  return INVOCATION_LABELS[invocationOf(model, user)];
}

/** Resolve a skill to a short source label (repo name when it is a symlink into a mirror). */
function sourceOfSkill(skill, reposDir) {
  const dir = skill.resourceBase?.kind === 'directory'
    ? skill.resourceBase.directory
    : skill.path
      ? dirname(skill.path)
      : null;
  const t = dir ? symlinkTarget(dir) : null;
  if (t !== null && t.startsWith(reposDir + sep)) {
    return t.slice(reposDir.length + 1).split(sep)[0];
  }
  const labels = {
    bundled: '内置',
    'user-dsh': 'DSH用户',
    'user-agents': '用户agents',
    'project-dsh': '项目',
    'project-agents': '项目agents',
    custom: '自定义',
  };
  return labels[skill.source] ?? skill.source ?? '未知';
}

/** Read a scalar frontmatter value (unquoted, trimmed), or undefined. */
function fmValue(content, key) {
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) return undefined;
  const line = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(m[1]);
  if (!line) return undefined;
  let v = line[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

/** Read a boolean frontmatter value, or undefined when absent/unparseable. */
function fmBool(content, key) {
  const v = String(fmValue(content, key) ?? '').trim().toLowerCase();
  if (['true', 'yes', 'on', '1'].includes(v)) return true;
  if (['false', 'no', 'off', '0'].includes(v)) return false;
  return undefined;
}

/** Global (session-independent) skill catalog for the settings panel. */
function listGlobalSkills(skillsDir, reposDir) {
  const roots = [
    { dir: skillsDir, label: 'DSH用户' },
  ];
  const out = [];
  for (const { dir: root, label } of roots) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === '.system') continue;
      const full = join(root, entry.name);
      // Follow symlinks: repo skills in ~/.dsh/skills are symlinks to
      // directories, which `Dirent.isDirectory()` would otherwise miss.
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      let skillFile = null;
      let containerDir = root;
      if (stat.isDirectory()) {
        skillFile = join(full, 'SKILL.md');
        containerDir = full;
      } else if (stat.isFile() && entry.name.endsWith('.md')) {
        skillFile = full;
      }
      if (skillFile === null) continue;
      let content;
      try {
        content = readFileSync(skillFile, 'utf8');
      } catch {
        continue;
      }
      const name = fmValue(content, 'name');
      const description = fmValue(content, 'description') ?? '';
      if (!name || !KEBAB.test(name)) continue;
      const modelInvocable = fmBool(content, 'disable-model-invocation') !== true;
      const userInvocable = fmBool(content, 'user-invocable') !== false;
      const target = symlinkTarget(containerDir);
      let source = label;
      if (target !== null && target.startsWith(reposDir + sep)) {
        source = target.slice(reposDir.length + 1).split(sep)[0];
      }
      out.push({
        name,
        description,
        invocation: invocationOf(modelInvocable, userInvocable),
        source,
        path: skillFile,
        managed: true,
      });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * The panel's merged catalog: the managed root plus everything DSH's own
 * discovery reports (bundled, project, user-agents…). Managed entries win
 * name collisions — they are the ones uninstall can act on. Discovery is
 * optional: without a skills service (tests, unusual hosts) the managed
 * list stands alone.
 */
async function listPanelSkills(skillsDir, reposDir, skillsService) {
  const byName = new Map(listGlobalSkills(skillsDir, reposDir).map((skill) => [skill.name, skill]));
  try {
    const snapshot = await skillsService?.snapshot?.();
    if (Array.isArray(snapshot?.skills)) {
      for (const skill of snapshot.skills) {
        if (!skill || typeof skill.name !== 'string' || !KEBAB.test(skill.name) || byName.has(skill.name)) continue;
        const dir = skill.resourceBase?.kind === 'directory'
          ? skill.resourceBase.directory
          : skill.path
            ? dirname(skill.path)
            : null;
        byName.set(skill.name, {
          name: skill.name,
          description: String(skill.description ?? ''),
          invocation: invocationOf(skill.invocation?.modelInvocable !== false, skill.invocation?.userInvocable !== false),
          source: sourceOfSkill(skill, reposDir),
          path: dir ? join(dir, 'SKILL.md') : null,
          managed: false,
        });
      }
    }
  } catch /* discovery unavailable here — the managed list stands alone */ {
  }
  const out = [...byName.values()];
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Read and JSON-parse a request body, bounded to 1 MiB. */
async function readJson(req, maxBytes = 1024 * 1024) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body === '' ? {} : JSON.parse(req.body);
    if (Buffer.isBuffer(req.body)) return req.body.length === 0 ? {} : JSON.parse(req.body.toString('utf8'));
    return req.body ?? {};
  }
  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.byteLength;
    if (received > maxBytes) throw new Error('请求体过大');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Derive a mirror directory name from a git URL or local path. */
function repoNameFromSource(source) {
  const clean = String(source).replace(/\.git\/?$/, '');
  const name = clean.split(/[/\\]/).filter(Boolean).pop() ?? 'skills';
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

/** Ensure a mirror exists under `reposDir`, cloning (or pulling) as needed. */
async function ensureRepo(reposDir, source) {
  const repoDir = join(reposDir, repoNameFromSource(source));
  if (existsSync(join(repoDir, '.git'))) {
    const origin = await git(repoDir, ['remote', 'get-url', 'origin']);
    const sameSource = origin === source ||
      (existsSync(origin) && existsSync(source) && resolve(origin) === resolve(source));
    if (!sameSource) throw new Error(`仓库名称冲突：${repoDir} 已对应其他来源 ${origin}`);
    await git(repoDir, ['pull', '--ff-only']);
    return repoDir;
  }
  mkdirSync(reposDir, { recursive: true });
  // Local paths can't be shallow-cloned reliably; use a full (hard-linked) clone.
  const args = existsSync(source) ? ['clone', source, repoDir] : ['clone', '--depth', '1', source, repoDir];
  await run('git', args, {
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return repoDir;
}

/** Repo-basename guard: a mirror name must name one child directory. */
function mirrorNameOf(value) {
  const name = String(value ?? '').trim();
  return /^[^/\\]+$/.test(name) && name !== '.' && !name.includes('..') && name !== '' ? name : null;
}

/**
 * Update one mirror, or every mirror under `reposDir` when `only` is null.
 * Each mirror syncs independently (one bad repo must not block the rest);
 * the per-repo results carry their own ok/linked/removed/error.
 */
async function updateMirrors(reposDir, skillsDir, only = null) {
  if (only !== null) {
    const repoDir = join(reposDir, only);
    if (!isDir(repoDir)) return { ok: false, error: `仓库「${only}」不存在` };
    const result = await syncRepo(repoDir, skillsDir, skipForRepo(only));
    return { ok: result.ok, error: result.error, repos: 1, results: [{ repo: only, ...result }] };
  }
  if (!isDir(reposDir)) return { ok: true, repos: 0, results: [] };
  const names = readdirSync(reposDir).filter((n) => isDir(join(reposDir, n)));
  const results = await Promise.all(
    names.map(async (repo) => ({ repo, ...(await syncRepo(join(reposDir, repo), skillsDir, skipForRepo(repo))) })),
  );
  return { ok: true, repos: names.length, results };
}

/** Describe the skills a mirror offers, flagging already-installed ones. */
function previewRepo(skillsDir, repoDir) {
  const skip = skipForRepo(basename(repoDir));
  return findSkills(repoDir, skip).map(({ dir, name }) => {
    let description = '';
    let userOnly = false;
    try {
      const content = readFileSync(join(dir, 'SKILL.md'), 'utf8');
      description = parseFrontmatter(content)?.description ?? '';
      userOnly = fmBool(content, 'disable-model-invocation') === true;
    } catch { /* ignore unreadable SKILL.md */ }
    return { name, description, userOnly, installed: existsSync(join(skillsDir, name)) };
  });
}

/** Symlink the named skills from a mirror into the managed root. */
function installSkills(skillsDir, repoDir, names) {
  mkdirSync(skillsDir, { recursive: true });
  const byName = new Map(findSkills(repoDir, skipForRepo(basename(repoDir))).map((s) => [s.name, s.dir]));
  const installed = [];
  const conflicts = [];
  const missing = [];
  for (const name of names) {
    const dir = byName.get(name);
    if (dir === undefined) { missing.push(name); continue; }
    const target = join(skillsDir, name);
    if (existsSync(target) && !isSymlink(target)) { conflicts.push(name); continue; }
    if (isSymlink(target) && symlinkTarget(target) !== dir) { conflicts.push(name); continue; }
    rmSync(target, { force: true });
    symlinkSync(dir, target);
    installed.push(name);
  }
  return { installed, conflicts, missing };
}

/** Send a JSON response. */
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** Reject cross-site requests (same-origin fence, per the skin-center pattern). */
function isSameOriginRequest(req) {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site === 'cross-site') return false;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    const host = req.headers.host;
    if (typeof host !== 'string' || host === '') return false;
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function requireSameOrigin(req, res) {
  if (isSameOriginRequest(req)) return true;
  json(res, 403, { ok: false, error: 'cross-site-request-rejected' });
  return false;
}

/**
 * Register commands and the panel API routes. CC Switch mode exposes only
 * the read-only listing command and rejects legacy management API calls.
 * @param ctx - Context carrying the command, skill and web-server registries.
 * @param config - `{ skillsDir?, reposDir?, managementMode? }` overrides.
 */
export function apply(ctx, config = {}) {
  const skillsDir = typeof config.skillsDir === 'string' && config.skillsDir
    ? config.skillsDir
    : DEFAULT_SKILLS_DIR();
  const reposDir = typeof config.reposDir === 'string' && config.reposDir ? config.reposDir : DEFAULT_REPOS_DIR();
  const unified = config.managementMode === 'cc-switch';
  const unifiedMessage = '技能由 CC Switch 统一管理；请使用 CC Switch 或 skill-maintenance 管理技能。';

  ctx.commands.register({
    name: 'skills',
    description: 'List the skills available in this session, optionally filtered by a keyword',
    input: { hint: '[filter]' },
    recordInput: false,
    async handler({ agent, rawInput, signal }) {
      const filter = rawInput.trim().toLowerCase();
      let snapshot;
      try {
        snapshot = await ctx.skills.snapshot({
          cwd: agent?.session?.header?.cwd,
          scope: agent,
          signal,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { kind: 'error', text: `读取技能目录失败：${message}` };
      }
      const matched = snapshot.skills.filter((skill) => {
        if (filter === '') return true;
        const haystack = `${skill.name} ${String(skill.description ?? '')} ${String(skill.whenToUse ?? '')}`.toLowerCase();
        return haystack.includes(filter);
      });
      if (matched.length === 0) {
        return {
          kind: 'success',
          text: filter === ''
            ? unified ? '当前会话没有可用技能，请在 CC Switch 中管理技能。' : '当前会话没有可用技能。把 SKILL.md 放进 <工作区>/.dsh/skills/<名字>/ 或 ~/.dsh/skills/<名字>/ 即可。'
            : `没有匹配「${rawInput.trim()}」的技能。去掉参数可列出全部。`,
        };
      }
      const lines = matched.map(
        (skill) =>
          `- /${skill.name} [${invocationLabel(skill)} · 来源:${sourceOfSkill(skill, reposDir)}] — ${oneLine(skill.description)}`,
      );
      const note = snapshot.complete === false ? '\n\n注意：本次发现未完成，列表可能不完整，稍后重试。' : '';
      return {
        kind: 'success',
        text: [
          `当前会话可用技能（${matched.length}）：`,
          '',
          ...lines,
          '',
          '用法：在消息里写 /名字 即可把该技能的正文注入这一步；模型也会按描述自动加载。',
        ].join('\n') + note,
      };
    },
  });

  if (!unified) {
    ctx.commands.register({
      name: 'skills-uninstall',
      description: 'Remove an installed skill from the managed skill root',
      input: { hint: '<技能名>' },
      async handler({ rawInput }) {
        const skillName = rawInput.trim();
        if (!skillName) return { kind: 'error', text: '用法：/skills-uninstall <技能名>（名字见 /skills）' };
        const result = uninstallSkill(skillsDir, skillName);
        if (!result.ok) return { kind: 'error', text: result.error };
        const repo = result.target && result.target.startsWith(reposDir + sep)
          ? result.target.slice(reposDir.length + 1).split(sep)[0]
          : null;
        const extra = repo ? `\n镜像还在 ~/.dsh/repos/${repo}，如要一并删除请告诉我。` : '';
        return { kind: 'success', text: `已卸载「${skillName}」。目录会自动刷新，无需重启。${extra}` };
      },
    });

    ctx.commands.register({
      name: 'skills-update',
      description: 'Pull a repo mirror and re-sync its skill links (default: mattpocock-skills)',
      input: { hint: '[仓库名]' },
      async handler({ rawInput }) {
        const repoName = rawInput.trim() || 'mattpocock-skills';
        const safeName = mirrorNameOf(repoName);
        if (safeName === null) {
          return { kind: 'error', text: `仓库名不能带路径分隔符或「..」：${rawInput.trim()}` };
        }
        const repoDir = join(reposDir, safeName);
        if (!isDir(repoDir)) {
          const repos = isDir(reposDir)
            ? readdirSync(reposDir).filter((r) => isDir(join(reposDir, r))).join(', ')
            : '';
          return { kind: 'error', text: `仓库「${safeName}」不存在。已装仓库：${repos || '(无)'}` };
        }
        const r = await syncRepo(repoDir, skillsDir, skipForRepo(safeName));
        if (!r.ok) return { kind: 'error', text: `更新失败：${r.error}` };
        const lines = [r.before === r.after ? `已是最新（${r.after}）。` : `已更新：${r.before} → ${r.after}${r.note}。`];
        lines.push(`链接：新增/修正 ${r.linked} 个；清理死链 ${r.removed} 个。`);
        if (r.conflicts.length > 0) lines.push(`冲突（同名被占用，未动）：${r.conflicts.join(', ')}`);
        return { kind: 'success', text: lines.join('\n') };
      },
    });

    ctx.commands.register({
      name: 'skills-doctor',
      description: 'Health check: dead links, invalid frontmatter, orphaned repo mirrors',
      recordInput: false,
      async handler() {
        const { total, dead, invalid, orphans } = doctorReport(skillsDir, reposDir);
        const lines = [`技能体检（${skillsDir}）：`, '', `共 ${total} 个技能。`];
        lines.push(`死链：${dead.length === 0 ? '无' : dead.join(', ')}`);
        lines.push(`格式无效（会被 DSH 忽略）：${invalid.length === 0 ? '无' : invalid.join(', ')}`);
        lines.push(`孤儿镜像（~/.dsh/repos 里无技能链接）：${orphans.length === 0 ? '无' : orphans.join(', ')}`);
        const problems = dead.length + invalid.length + orphans.length;
        lines.push('', problems === 0 ? '✅ 一切正常。' : `⚠️ 发现 ${problems} 个问题。`);
        return { kind: 'success', text: lines.join('\n') };
      },
    });
  }

  // Panel management routes. `webServer` is a declared service, so the routes
  // register whenever the web server is available. All are same-origin fenced.
  const route = (method, path, handler) => ({
    kind: 'exact',
    path,
    handler: async (req, res) => {
      if (req.method !== method) return json(res, 405, { ok: false, error: 'method-not-allowed' });
      if (!requireSameOrigin(req, res)) return;
      // Preview clones or pulls a mirror too, so all four POST routes are writes.
      if (unified && (method === 'POST' || path === '/api/skill-console/doctor')) return json(res, 403, { ok: false, error: unifiedMessage });
      try {
        await handler(req, res);
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  });

  try {
    ctx.effect(() => {
      const disposers = [
        route('GET', '/api/skill-console/list', async (req, res) => {
          json(res, 200, { ok: true, managementMode: unified ? 'cc-switch' : 'standalone', skills: await listPanelSkills(skillsDir, reposDir, ctx.skills) });
        }),
        route('POST', '/api/skill-console/uninstall', async (req, res) => {
          const { name } = await readJson(req);
          if (typeof name !== 'string' || name === '') return json(res, 400, { ok: false, error: '技能名不能为空' });
          if (!KEBAB.test(name)) return json(res, 400, { ok: false, error: `技能名不合法：${name}` });
          const result = uninstallSkill(skillsDir, name);
          json(res, result.ok ? 200 : 404, result);
        }),
        route('POST', '/api/skill-console/install/preview', async (req, res) => {
          const { source } = await readJson(req);
          if (typeof source !== 'string' || source === '') return json(res, 400, { ok: false, error: '请提供仓库地址或本地路径' });
          const repoDir = await ensureRepo(reposDir, source);
          json(res, 200, { ok: true, repo: repoDir, skills: previewRepo(skillsDir, repoDir) });
        }),
        route('POST', '/api/skill-console/install', async (req, res) => {
          const { source, names } = await readJson(req);
          if (typeof source !== 'string' || source === '') return json(res, 400, { ok: false, error: '请提供仓库地址或本地路径' });
          if (!Array.isArray(names) || names.length === 0) return json(res, 400, { ok: false, error: '请至少选择一个技能' });
          const repoDir = await ensureRepo(reposDir, source);
          json(res, 200, { ok: true, ...installSkills(skillsDir, repoDir, names) });
        }),
        route('POST', '/api/skill-console/update', async (req, res) => {
          const { repo } = await readJson(req);
          let only = null;
          if (typeof repo === 'string' && repo !== '') {
            only = mirrorNameOf(repo);
            if (only === null) return json(res, 400, { ok: false, error: '仓库名不能带路径分隔符或「..」' });
          }
          const result = await updateMirrors(reposDir, skillsDir, only);
          json(res, result.ok ? 200 : 400, result);
        }),
        route('GET', '/api/skill-console/doctor', async (req, res) => {
          json(res, 200, { ok: true, ...doctorReport(skillsDir, reposDir) });
        }),
      ].map((r) => ctx.webServer.register(r));
      return () => { for (const d of disposers) d(); };
    }, 'skill-console: routes');
  } catch (error) {
    console.error('[skill-console] route registration failed:', error);
  }
}

/** Exposed for tests. */
export {
  findSkills,
  parseFrontmatter,
  syncRepo,
  uninstallSkill,
  findManagedEntry,
  doctorReport,
  symlinkTarget,
  listGlobalSkills,
  listPanelSkills,
  invocationOf,
  skipForRepo,
  mirrorNameOf,
  updateMirrors,
  readJson,
  repoNameFromSource,
  ensureRepo,
  previewRepo,
  installSkills,
};
