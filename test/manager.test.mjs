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
  findSkills,
  parseFrontmatter,
  syncRepo,
  uninstallSkill,
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

// ---- apply() wires four commands using config dirs ----
const registered = [];
apply(
  { commands: { register: (d) => registered.push(d) }, skills: { snapshot: async () => ({ complete: true, skills: [] }) } },
  { agentsSkillsDir: dest, reposDir: reposDir },
);
assert.deepEqual(registered.map((d) => d.name), ['skills', 'skills-uninstall', 'skills-update', 'skills-doctor']);

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

fs.rmSync(tmp, { recursive: true, force: true });
console.log('manager: OK');
