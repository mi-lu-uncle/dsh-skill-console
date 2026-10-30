/**
 * Tests the filesystem-backed commands (uninstall / update / doctor) and the
 * shared helpers against a throwaway local git remote. Run with Node 22+:
 *
 *   node test/manager.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  apply,
  doctorReport,
  ensureRepo,
  findSkills,
  installSkills,
  listPanelSkills,
  parseFrontmatter,
  previewRepo,
  readJson,
  repoNameFromSource,
  skipForRepo,
  syncRepo,
  uninstallSkill,
  updateMirrors,
} from '../lib/index.js';

// ---- parseFrontmatter ----
assert.deepEqual(parseFrontmatter('---\nname: foo\ndescription: hello\n---\nbody'), { name: 'foo', description: 'hello' });
assert.deepEqual(parseFrontmatter('---\nname: "bar"\ndescription: "quoted desc"\n---\n'), { name: 'bar', description: 'quoted desc' });
assert.equal(parseFrontmatter('no frontmatter'), null);

// ---- syncRepo against a real remote ----
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', env: process.env });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-mgr-'));
const origin = path.join(tmp, 'origin.git');
sh('git', ['init', '--bare', '--initial-branch=main', origin]);
const repo = path.join(tmp, 'mirror');
sh('git', ['clone', '--quiet', origin, repo]);
const dest = path.join(tmp, 'dest');

const mkSkill = (root, cat, name) => {
  const dir = path.join(root, 'skills', cat, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: d\n---\nbody`);
};
const commit = (root, msg) => {
  sh('git', ['-C', root, 'add', '.']);
  sh('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', msg]);
  sh('git', ['-C', root, 'push', '--quiet', 'origin', 'main']);
};

mkSkill(repo, 'engineering', 'aaa');
mkSkill(repo, 'misc', 'zzz');
commit(repo, 'initial');

const skip = new Set(['deprecated', 'misc']);
assert.deepEqual(findSkills(repo, skip).map((f) => f.name), ['aaa']);

const r1 = await syncRepo(repo, dest, skip);
assert.equal(r1.ok, true);
assert.equal(r1.linked, 1, 'links aaa only, misc skipped');
assert.ok(fs.existsSync(path.join(dest, 'aaa')));
assert.ok(!fs.existsSync(path.join(dest, 'zzz')), 'misc not linked');

// Upstream change from a second clone: add bbb, delete aaa.
const contrib = path.join(tmp, 'contrib');
sh('git', ['clone', '--quiet', origin, contrib]);
mkSkill(contrib, 'engineering', 'bbb');
fs.rmSync(path.join(contrib, 'skills', 'engineering', 'aaa'), { recursive: true, force: true });
commit(contrib, 'change');

const r2 = await syncRepo(repo, dest, skip);
assert.equal(r2.ok, true);
assert.ok(fs.existsSync(path.join(dest, 'bbb')), 'new skill linked');
assert.ok(!fs.existsSync(path.join(dest, 'aaa')), 'dead link removed');
assert.equal(r2.removed, 1);

// ---- uninstallSkill ----
assert.equal(uninstallSkill(dest, 'bbb').ok, true);
assert.ok(!fs.existsSync(path.join(dest, 'bbb')));
assert.equal(uninstallSkill(dest, 'missing').ok, false);

// ---- repoNameFromSource ----
assert.equal(repoNameFromSource('https://github.com/org/my-skills.git'), 'my-skills');
assert.equal(repoNameFromSource('git@github.com:org/my-skills.git'), 'my-skills');
assert.equal(repoNameFromSource('/Users/me/local-skills'), 'local-skills');

// ---- ensureRepo / previewRepo / installSkills ----
const installRepos = path.join(tmp, 'install-repos');
const installDest = path.join(tmp, 'install-dest');
const cloneDir = await ensureRepo(installRepos, origin); // origin now has bbb + zzz
const preview = previewRepo(installDest, cloneDir);
assert.deepEqual(preview.map((s) => s.name).sort(), ['bbb', 'zzz']);
assert.ok(preview.every((s) => s.installed === false && s.userOnly === false));
const installed = installSkills(installDest, cloneDir, ['bbb', 'zzz']);
assert.deepEqual(installed.installed.sort(), ['bbb', 'zzz']);
assert.ok(fs.existsSync(path.join(installDest, 'bbb')));
assert.ok(fs.existsSync(path.join(installDest, 'zzz')));
assert.deepEqual(installSkills(installDest, cloneDir, ['nope']).missing, ['nope']);
fs.rmSync(path.join(installDest, 'bbb')); // replace the symlink with a real dir to force a conflict
fs.mkdirSync(path.join(installDest, 'bbb'));
assert.deepEqual(installSkills(installDest, cloneDir, ['bbb']).conflicts, ['bbb']);

// ---- skipForRepo keeps preview / install / update on one skip set ----
assert.ok(skipForRepo('mattpocock-skills').has('misc'), 'mattpocock mirrors skip misc');
assert.ok(!skipForRepo('some-repo').has('misc'), 'other repos only skip deprecated');
assert.deepEqual([...skipForRepo('unknown')].sort(), ['deprecated']);

// ---- readJson ----
assert.deepEqual(await readJson({ body: '{"a":1}' }), { a: 1 });
assert.deepEqual(await readJson({ body: '{"name":"x"}' }), { name: 'x' });
const streamReq = (text) => ({ body: undefined, async *[Symbol.asyncIterator]() { if (text) yield Buffer.from(text); } });
assert.deepEqual(await readJson(streamReq('{"name":"x"}')), { name: 'x' });
assert.deepEqual(await readJson(streamReq('')), {});

// ---- doctorReport ----
fs.symlinkSync(path.join(repo, 'skills', 'nowhere'), path.join(dest, 'ghost')); // dead link
const badDir = path.join(dest, 'baddir');
fs.mkdirSync(badDir); // real dir with invalid frontmatter
fs.writeFileSync(path.join(badDir, 'SKILL.md'), 'no frontmatter here');
const reposDir = path.join(tmp, 'repos');
fs.mkdirSync(reposDir);
fs.mkdirSync(path.join(reposDir, 'orphan-repo')); // mirror with no linked skills
const doc = doctorReport(dest, reposDir);
assert.ok(doc.dead.includes('ghost'), 'detects dead link');
assert.ok(doc.invalid.some((s) => s.startsWith('baddir')), 'detects invalid frontmatter');
assert.ok(doc.orphans.includes('orphan-repo'), 'detects orphan mirror');

// ---- updateMirrors: one repo, every repo, and failures ----
const updRepos = path.join(tmp, 'update-mirrors');
fs.mkdirSync(updRepos);
const mirrorA = path.join(updRepos, 'mirror-a');
sh('git', ['clone', '--quiet', origin, mirrorA]);
const updDest = path.join(tmp, 'update-dest');
const updAll = await updateMirrors(updRepos, updDest, null);
assert.equal(updAll.ok, true);
assert.equal(updAll.repos, 1);
assert.equal(updAll.results[0].repo, 'mirror-a');
assert.equal(updAll.results[0].ok, true);
assert.ok(fs.existsSync(path.join(updDest, 'bbb')), 'all-mode links new skills');
assert.ok(fs.existsSync(path.join(updDest, 'zzz')), 'non-mattpocock repos do not skip misc');
const updOnly = await updateMirrors(updRepos, updDest, 'mirror-a');
assert.equal(updOnly.ok, true);
assert.equal(updOnly.results.length, 1);
assert.equal((await updateMirrors(updRepos, updDest, 'nope')).ok, false);
const emptyRepos = path.join(tmp, 'empty-repos');
fs.mkdirSync(emptyRepos);
assert.deepEqual(await updateMirrors(emptyRepos, updDest), { ok: true, repos: 0, results: [] });

// ---- apply() wires four commands + six routes using config dirs ----
const registered = [];
const routes = [];
const fakeRes = () => {
  const res = { statusCode: 0, body: null };
  res.writeHead = (status) => { res.statusCode = status; };
  res.end = (text) => { res.body = JSON.parse(text); };
  return res;
};
apply(
  {
    commands: { register: (d) => registered.push(d) },
    skills: { snapshot: async () => ({ complete: true, skills: [] }) },
    webServer: { register: (r) => { routes.push(r); return () => {}; } },
    effect: (fn) => { const d = fn(); return () => (typeof d === 'function' ? d() : undefined); },
  },
  { skillsDir: dest, reposDir: reposDir },
);
assert.deepEqual(registered.map((d) => d.name), ['skills', 'skills-uninstall', 'skills-update', 'skills-doctor']);
assert.equal(routes.length, 6, 'wires the six panel API routes');

fs.symlinkSync(repo, path.join(dest, 'foo'));
const unRes = await registered[1].handler({ rawInput: 'foo' });
assert.equal(unRes.kind, 'success');
assert.match(unRes.text, /已卸载/);
assert.ok(!fs.existsSync(path.join(dest, 'foo')));

const updRes = await registered[2].handler({ rawInput: '' }); // default mattpocock-skills missing here
assert.equal(updRes.kind, 'error');

const docRes = await registered[3].handler({});
assert.equal(docRes.kind, 'success');
assert.match(docRes.text, /技能体检/);

// ---- POST /api/skill-console/update with {} updates every mirror ----
const updRoute = routes.find((r) => r.path === '/api/skill-console/update');
const routeRes = fakeRes();
await updRoute.handler({ method: 'POST', headers: {}, body: '{}' }, routeRes);
assert.equal(routeRes.statusCode, 200);
assert.equal(routeRes.body.ok, true);
assert.equal(routeRes.body.repos, 1, 'doctorReport reposDir has one dir: orphan-repo (kept apart from git sync)');
assert.equal(routeRes.body.results[0].ok, false, 'orphan-repo is not a git repo — reported, not crashed');

// ---- listPanelSkills merges managed + discovery; discovery is read-only ----
fs.symlinkSync(path.join(repo, 'skills', 'engineering', 'bbb'), path.join(dest, 'zzz-mgr'));
const panel = await listPanelSkills(dest, reposDir, {
  snapshot: async () => ({
    complete: true,
    skills: [
      { name: 'bbb', description: 'duplicate surface', invocation: { modelInvocable: true, userInvocable: true }, source: 'user-dsh' },
      { name: 'office-docx', description: 'bundled docs skill', invocation: { modelInvocable: true, userInvocable: false }, source: 'bundled' },
      { name: 'sealed', description: 'x', invocation: { modelInvocable: false, userInvocable: false }, source: 'custom' },
    ],
  }),
});
const managedBbb = panel.find((s) => s.name === 'bbb');
assert.ok(managedBbb, 'managed entry present');
assert.equal(managedBbb.managed, true, 'managed entry wins name collision');
assert.ok(managedBbb.path.includes('zzz-mgr'), 'managed entry path follows the real link');
const office = panel.find((s) => s.name === 'office-docx');
assert.equal(office.managed, false, 'discovery-only entry is read-only');
assert.equal(office.invocation, 'model-only');
assert.equal(panel.find((s) => s.name === 'sealed').invocation, 'none', 'both-sides-off is none');
const alone = await listPanelSkills(dest, reposDir, {
  snapshot: async () => { throw new Error('no discovery here'); },
});
assert.ok(alone.some((s) => s.name === 'bbb'), 'discovery failure degrades to the managed list');

// ---- uninstall resolves a frontmatter name that differs from the entry ----
const fmRes = uninstallSkill(dest, 'bbb');
assert.equal(fmRes.ok, true);
assert.equal(fmRes.entry, 'zzz-mgr', 'resolves SKILL.md name -> entry');
assert.ok(!fs.existsSync(path.join(dest, 'zzz-mgr')));
assert.equal(uninstallSkill(dest, 'bbb').ok, false, 'gone is gone');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('manager: OK');
