/**
 * Offline smoke test: runs the plugin against fake `commands` and `skills`
 * services to check registration, the rendered `/skills` output, and the
 * panel's merged list route. Run with any Node 22+:
 *
 *   node test/smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply, inject, name } from '../lib/index.js';

assert.equal(name, 'skill-console');
assert.deepEqual(inject, ['commands', 'skills', 'webServer']);

// Hermetic skills root: the panel route must not touch the real ~/.dsh.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-console-smoke-'));
const skillsDir = path.join(tmp, 'skills');
const reposDir = path.join(tmp, 'repos');
fs.mkdirSync(skillsDir, { recursive: true });
fs.mkdirSync(path.join(skillsDir, 'alpha'), { recursive: true });
fs.writeFileSync(path.join(skillsDir, 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: ma\n---\nbody');

const registered = [];
const calls = [];
const registeredRoutes = [];
const ctx = {
  webServer: { register: (route) => { registeredRoutes.push(route); return () => {}; } },
  effect: (fn) => { const d = fn(); return () => (typeof d === 'function' ? d() : undefined); },
  commands: { register: (definition) => registered.push(definition) },
  skills: {
    snapshot: async (options) => {
      calls.push(options);
      return {
        complete: true,
        skills: [
          {
            name: 'dsh-skill-authoring',
            description: '编写本地 skill 时加载：扫描根、frontmatter 规范与排查清单',
            invocation: { modelInvocable: true, userInvocable: true },
            source: 'project-dsh',
          },
          {
            name: 'office-docx',
            description: 'Create, read, edit, and check Word documents (.docx).',
            invocation: { modelInvocable: true, userInvocable: true },
            source: 'bundled',
          },
          {
            name: 'secret-runbook',
            description: '内部应急手册',
            invocation: { modelInvocable: false, userInvocable: true },
            source: 'user-dsh',
          },
          {
            name: 'sealed-ritual',
            description: 'Neither surface can invoke it.',
            invocation: { modelInvocable: false, userInvocable: false },
            source: 'custom',
          },
        ],
      };
    },
  },
};

apply(ctx, { skillsDir, reposDir });

assert.equal(registered.length, 4, 'registers exactly four commands');
assert.equal(registeredRoutes.length, 6, 'registers the six panel API routes');
assert.deepEqual(
  registeredRoutes.map((r) => r.path),
  [
    '/api/skill-console/list',
    '/api/skill-console/uninstall',
    '/api/skill-console/install/preview',
    '/api/skill-console/install',
    '/api/skill-console/update',
    '/api/skill-console/doctor',
  ],
);
assert.deepEqual(
  registered.map((d) => d.name),
  ['skills', 'skills-uninstall', 'skills-update', 'skills-doctor'],
);

const command = registered[0];
assert.equal(command.name, 'skills');
assert.equal(typeof command.handler, 'function');
assert.equal(command.recordInput, false);
assert.deepEqual(command.input, { hint: '[filter]' });

const agent = { session: { header: { cwd: '/tmp/workspace' } } };
const all = await command.handler({ agent, rawInput: '', signal: undefined });
assert.equal(all.kind, 'success');
assert.match(all.text, /当前会话可用技能（4）：/);
assert.match(all.text, /- \/dsh-skill-authoring \[模型\+用户 · 来源:项目\]/);
assert.match(all.text, /- \/office-docx \[模型\+用户 · 来源:内置\]/);
assert.match(all.text, /- \/secret-runbook \[仅用户 · 来源:DSH用户\]/);
assert.match(all.text, /- \/sealed-ritual \[未开放 · 来源:自定义\]/, 'both sides off renders 未开放');
assert.deepEqual(calls.at(-1), { cwd: '/tmp/workspace', scope: agent, signal: undefined });

const filtered = await command.handler({ agent, rawInput: 'docx', signal: undefined });
assert.match(filtered.text, /（1）：/);
assert.match(filtered.text, /office-docx/);
assert.doesNotMatch(filtered.text, /dsh-skill-authoring/);

const filteredByBody = await command.handler({ agent, rawInput: 'frontmatter', signal: undefined });
assert.match(filteredByBody.text, /dsh-skill-authoring/, 'filter also matches the description');

const empty = await command.handler({ agent, rawInput: '不存在的关键词', signal: undefined });
assert.match(empty.text, /没有匹配/);

const brokenRegistered = [];
apply({
  webServer: { register: () => () => {} },
  effect: () => () => {},
  commands: { register: (definition) => brokenRegistered.push(definition) },
  skills: { snapshot: async () => { throw new Error('discovery exploded'); } },
});
const failed = await brokenRegistered[0].handler({ agent, rawInput: '', signal: undefined });
assert.equal(failed.kind, 'error');
assert.match(failed.text, /discovery exploded/);

// ---- GET /api/skill-console/list: managed ⊕ discovery, managed wins ----
const fakeRes = () => {
  const res = { statusCode: 0, body: null };
  res.writeHead = (status) => { res.statusCode = status; };
  res.end = (text) => { res.body = JSON.parse(text); };
  return res;
};
const listRoute = registeredRoutes.find((r) => r.path === '/api/skill-console/list');
const res = fakeRes();
await listRoute.handler({ method: 'GET', headers: {} }, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.ok, true);
const sorted = res.body.skills.map((s) => s.name);
assert.deepEqual([...sorted].sort(), sorted, 'list is name-sorted');
// Managed root entry:
const alpha = res.body.skills.find((s) => s.name === 'alpha');
assert.ok(alpha, 'managed skill present');
assert.equal(alpha.managed, true);
assert.ok(alpha.path && alpha.path.startsWith(skillsDir));
// Discovery-only entries surface too, read-only:
const office = res.body.skills.find((s) => s.name === 'office-docx');
assert.ok(office, 'bundled skill visible in the panel');
assert.equal(office.managed, false);
assert.equal(office.invocation, 'model-and-user');
const sealed = res.body.skills.find((s) => s.name === 'sealed-ritual');
assert.equal(sealed.invocation, 'none', 'both sides off -> none, not a fake user-only');
// Discovery failing must not break the route:
const resCb = fakeRes();
const routesBeforeCb = registeredRoutes.length;
apply({
  webServer: { register: (r) => { registeredRoutes.push(r); return () => {}; } },
  effect: (fn) => { fn(); return () => {}; },
  commands: { register: () => {} },
  skills: { snapshot: async () => { throw new Error('boom'); } },
}, { skillsDir, reposDir });
const routeCb = registeredRoutes[routesBeforeCb];
assert.equal(routeCb.path, '/api/skill-console/list');
await routeCb.handler({ method: 'GET', headers: {} }, resCb);
assert.equal(resCb.statusCode, 200);
assert.ok(resCb.body.skills.some((s) => s.name === 'alpha'), 'managed list stands alone');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('smoke: OK');
