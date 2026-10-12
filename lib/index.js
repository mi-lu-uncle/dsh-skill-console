/**
 * DSH skill console — human-facing skill management: a settings panel plus
 * slash commands.
 *
 * DSH ships no skill picker UI, so this plugin provides the missing surface in
 * two places: a Settings sidebar panel (client half, read-only) and the `/`
 * command menu (host half, read + write):
 *   - `/skills`             list skills (name, invocation, source repo)
 *   - `/skills-uninstall`   remove an installed skill
 *   - `/skills-update`      pull a repo mirror and re-sync its symlinks
 *   - `/skills-doctor`      health check: dead links, invalid frontmatter, orphans
 *
 * `/skills` reads the same registry snapshot the model catalog is built from;
 * the other commands operate directly on the filesystem (symlinks + git), and
 * DSH's skill watcher then hot-reloads the result automatically.
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

/** Services this plugin uses: the command registry and the skill registry. */
export const inject = ['commands', 'skills'];

/** Default managed skill root (where repo skills are symlinked). */
const DEFAULT_SKILLS_DIR = () => join(homedir(), '.agents', 'skills');
/** Default directory holding the cloned repo mirrors. */
const DEFAULT_REPOS_DIR = () => join(homedir(), '.dsh', 'repos');
/** Default DSH user skill root (the meta-skills live here). */
const DEFAULT_DSH_SKILLS_DIR = () => join(homedir(), '.dsh', 'skills');

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
      } catch {
        const dirty = await git(repoDir, ['status', '--porcelain']).catch(() => '?');
        if (dirty === '') {
          await git(repoDir, ['reset', '--hard', branch]);
          note = '（上游重写历史，已 reset --hard）';
        } else {
          return { ok: false, error: `本地有未提交改动且无法快进：${repoDir}` };
        }
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

/** Remove one skill from the managed root; never touches real (non-symlink) entries. */
function uninstallSkill(destDir, skillName) {
  const p = join(destDir, skillName);
  if (!existsSync(p) && !isSymlink(p)) return { ok: false, error: `没有技能「${skillName}」` };
  if (!isSymlink(p)) {
    return { ok: false, error: `「${skillName}」是真实目录/文件而非链接，为安全起见我不会自动删除。` };
  }
  const target = symlinkTarget(p);
  rmSync(p, { force: true });
  return { ok: true, name: skillName, target };
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

/** Render which invocation surfaces a skill exposes. */
function invocationLabel(skill) {
  const model = skill.invocation?.modelInvocable !== false;
  const user = skill.invocation?.userInvocable !== false;
  if (model && user) return '模型+用户';
  if (model) return '仅模型';
  if (user) return '仅用户';
  return '未开放';
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
function listGlobalSkills(agentsSkillsDir, dshSkillsDir, reposDir) {
  const roots = [
    { dir: dshSkillsDir, label: 'DSH用户' },
    { dir: agentsSkillsDir, label: '用户agents' },
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
      // Follow symlinks: repo skills in ~/.agents/skills are symlinks to
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
      const invocation = !modelInvocable ? 'user-only' : userInvocable ? 'model-and-user' : 'model-only';
      const target = symlinkTarget(containerDir);
      let source = label;
      if (target !== null && target.startsWith(reposDir + sep)) {
        source = target.slice(reposDir.length + 1).split(sep)[0];
      }
      out.push({ name, description, invocation, source, path: skillFile });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
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
 * Register the four commands and (when a web server is available) the panel's
 * read-only API route.
 * @param ctx - Context carrying the command and skill registries.
 * @param config - `{ agentsSkillsDir?, dshSkillsDir?, reposDir? }` overrides.
 */
export function apply(ctx, config = {}) {
  const agentsSkillsDir = typeof config.agentsSkillsDir === 'string' && config.agentsSkillsDir
    ? config.agentsSkillsDir
    : DEFAULT_SKILLS_DIR();
  const reposDir = typeof config.reposDir === 'string' && config.reposDir ? config.reposDir : DEFAULT_REPOS_DIR();
  const dshSkillsDir = typeof config.dshSkillsDir === 'string' && config.dshSkillsDir
    ? config.dshSkillsDir
    : DEFAULT_DSH_SKILLS_DIR();

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
            ? '当前会话没有可用技能。把 SKILL.md 放进 <工作区>/.dsh/skills/<名字>/ 或 ~/.dsh/skills/<名字>/ 即可。'
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

  ctx.commands.register({
    name: 'skills-uninstall',
    description: 'Remove an installed skill from the managed skill root',
    input: { hint: '<技能名>' },
    async handler({ rawInput }) {
      const skillName = rawInput.trim();
      if (!skillName) return { kind: 'error', text: '用法：/skills-uninstall <技能名>（名字见 /skills）' };
      const result = uninstallSkill(agentsSkillsDir, skillName);
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
      const repoDir = join(reposDir, repoName);
      if (!isDir(repoDir)) {
        const repos = isDir(reposDir)
          ? readdirSync(reposDir).filter((r) => isDir(join(reposDir, r))).join(', ')
          : '';
        return { kind: 'error', text: `仓库「${repoName}」不存在。已装仓库：${repos || '(无)'}` };
      }
      const skip = new Set(repoName === 'mattpocock-skills' ? ['deprecated', 'misc'] : ['deprecated']);
      const r = await syncRepo(repoDir, agentsSkillsDir, skip);
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
      const { total, dead, invalid, orphans } = doctorReport(agentsSkillsDir, reposDir);
      const lines = [`技能体检（${agentsSkillsDir}）：`, '', `共 ${total} 个技能。`];
      lines.push(`死链：${dead.length === 0 ? '无' : dead.join(', ')}`);
      lines.push(`格式无效（会被 DSH 忽略）：${invalid.length === 0 ? '无' : invalid.join(', ')}`);
      lines.push(`孤儿镜像（~/.dsh/repos 里无技能链接）：${orphans.length === 0 ? '无' : orphans.join(', ')}`);
      const problems = dead.length + invalid.length + orphans.length;
      lines.push('', problems === 0 ? '✅ 一切正常。' : `⚠️ 发现 ${problems} 个问题。`);
      return { kind: 'success', text: lines.join('\n') };
    },
  });

  // Panel data route (read-only). Registered only when a web server service is
  // present; its absence never blocks the commands above.
  const webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined;
  if (webServer && typeof webServer.register === 'function') {
    try {
      ctx.effect(() => {
        const dispose = webServer.register({
          kind: 'exact',
          path: '/api/skill-console/list',
          handler: (req, res) => {
            if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method-not-allowed' });
            if (!requireSameOrigin(req, res)) return;
            try {
              json(res, 200, { ok: true, skills: listGlobalSkills(agentsSkillsDir, dshSkillsDir, reposDir) });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          },
        });
        return () => dispose();
      }, 'skill-console: routes');
    } catch (error) {
      console.error('[skill-console] route registration failed:', error);
    }
  }
}

/** Exposed for tests. */
export { findSkills, parseFrontmatter, syncRepo, uninstallSkill, doctorReport, symlinkTarget, listGlobalSkills };
