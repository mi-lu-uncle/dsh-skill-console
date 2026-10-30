import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureRepo, syncRepo, uninstallSkill } from '../lib/index.js';

const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-security-'));
const git = (...args) => execFileSync('git', args, { stdio: 'ignore' });
try {
  for (const test of process.argv[2] ? [process.argv[2]] : ['uninstall', 'conflict', 'source', 'diverged']) {
  const tmp = path.join(rootTmp, test);
  fs.mkdirSync(tmp);
  if (test === 'uninstall') {
    const dest = path.join(tmp, 'skills');
    fs.mkdirSync(dest);
    const outside = path.join(tmp, 'outside-link');
    fs.symlinkSync(tmp, outside);
    assert.equal(uninstallSkill(dest, '../outside-link').ok, false);
    assert.ok(fs.lstatSync(outside).isSymbolicLink());
  } else if (test === 'conflict') {
    const repo = path.join(tmp, 'repo');
    const dest = path.join(tmp, 'skills');
    const existing = path.join(tmp, 'existing');
    git('init', '--initial-branch=main', repo);
    fs.mkdirSync(path.join(repo, 'same'));
    fs.writeFileSync(path.join(repo, 'same', 'SKILL.md'), '---\nname: same\ndescription: test\n---\n');
    git('-C', repo, 'add', '.');
    git('-C', repo, '-c', 'user.name=test', '-c', 'user.email=t@t', 'commit', '-m', 'initial');
    const remote = path.join(tmp, 'remote.git');
    git('clone', '--bare', repo, remote);
    git('-C', repo, 'remote', 'add', 'origin', remote);
    git('-C', repo, 'fetch', 'origin');
    git('-C', repo, 'branch', '--set-upstream-to=origin/main', 'main');
    fs.mkdirSync(dest);
    fs.mkdirSync(existing);
    fs.symlinkSync(existing, path.join(dest, 'same'));
    const result = await syncRepo(repo, dest);
    assert.equal(result.ok, true);
    assert.deepEqual(result.conflicts, ['same']);
    assert.equal(fs.readlinkSync(path.join(dest, 'same')), existing);
  } else if (test === 'diverged') {
    const remote = path.join(tmp, 'remote.git');
    const repo = path.join(tmp, 'repo');
    const other = path.join(tmp, 'other');
    git('init', '--bare', '--initial-branch=main', remote);
    git('clone', remote, repo);
    fs.writeFileSync(path.join(repo, 'initial'), 'initial');
    git('-C', repo, 'add', '.');
    git('-C', repo, '-c', 'user.name=test', '-c', 'user.email=t@t', 'commit', '-m', 'initial');
    git('-C', repo, 'push', '-u', 'origin', 'main');
    git('clone', remote, other);
    fs.writeFileSync(path.join(repo, 'local'), 'local');
    git('-C', repo, 'add', '.');
    git('-C', repo, '-c', 'user.name=test', '-c', 'user.email=t@t', 'commit', '-m', 'local');
    const localHead = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    fs.writeFileSync(path.join(other, 'remote'), 'remote');
    git('-C', other, 'add', '.');
    git('-C', other, '-c', 'user.name=test', '-c', 'user.email=t@t', 'commit', '-m', 'remote');
    git('-C', other, 'push', 'origin', 'main');
    const result = await syncRepo(repo, path.join(tmp, 'skills'));
    assert.equal(result.ok, false);
    assert.equal(execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), localHead);
    assert.ok(fs.existsSync(path.join(repo, 'local')));
  } else if (test === 'source') {
    const a = path.join(tmp, 'a', 'same.git');
    const b = path.join(tmp, 'b', 'same.git');
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.mkdirSync(path.dirname(b), { recursive: true });
    git('init', '--bare', '--initial-branch=main', a);
    git('init', '--bare', '--initial-branch=main', b);
    const repos = path.join(tmp, 'repos');
    await ensureRepo(repos, a);
    await assert.rejects(() => ensureRepo(repos, b), /来源|source|origin/i);
  } else {
    throw new Error('expected uninstall, conflict, source, or diverged');
  }
  }
} finally {
  fs.rmSync(rootTmp, { recursive: true, force: true });
}
