import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../lib/index.js';

const tmp = mkdtempSync(join(tmpdir(), 'skill-console-unified-'));
try {
  const skillsDir = join(tmp, 'skills');
  const reposDir = join(tmp, 'repos');
  const master = join(tmp, 'master', 'alpha');
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(master, { recursive: true });
  writeFileSync(join(master, 'SKILL.md'), '---\nname: alpha\ndescription: test\n---\n');
  symlinkSync(master, join(skillsDir, 'alpha'));

  const commands = [];
  const routes = [];
  apply({
    commands: { register: (item) => commands.push(item) },
    skills: { snapshot: async () => ({ complete: true, skills: [] }) },
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
    effect: (fn) => fn(),
  }, { skillsDir, reposDir, managementMode: 'cc-switch' });

  assert.deepEqual(commands.map((item) => item.name), ['skills'], 'only the read-only listing command is registered');
  assert.match((await commands[0].handler({ rawInput: '' })).text, /CC Switch/);
  for (const [path, body] of [
    ['/api/skill-console/uninstall', { name: 'alpha' }],
    ['/api/skill-console/install/preview', { source: '/nonexistent/source' }],
    ['/api/skill-console/install', { source: '/nonexistent/source', names: ['alpha'] }],
    ['/api/skill-console/update', {}],
  ]) {
    const response = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
    await routes.find((route) => route.path === path).handler({ method: 'POST', headers: {}, body }, response);
    assert.equal(response.status, 403, `${path} must reject writes before doing work`);
    assert.match(response.body.error, /CC Switch/);
  }
  assert.equal(readlinkSync(join(skillsDir, 'alpha')), master, 'the shared entry is untouched');
  assert.equal(existsSync(reposDir), false, 'preview must not create a mirror');
  const list = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
  await routes.find((route) => route.path === '/api/skill-console/list').handler({ method: 'GET', headers: {} }, list);
  assert.equal(list.status, 200);
  assert.equal(list.body.managementMode, 'cc-switch');
  assert.ok(list.body.skills.some((skill) => skill.name === 'alpha'));
  const doctor = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
  await routes.find((route) => route.path === '/api/skill-console/doctor').handler({ method: 'GET', headers: {} }, doctor);
  assert.equal(doctor.status, 403);
  assert.match(doctor.body.error, /CC Switch/);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log('unified management: OK');
