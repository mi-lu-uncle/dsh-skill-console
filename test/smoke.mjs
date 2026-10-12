/**
 * Offline smoke test: runs the plugin against fake `commands` and `skills`
 * services to check registration and the rendered `/skills` output. Run with
 * any Node 22+:
 *
 *   node test/smoke.mjs
 */
import assert from 'node:assert/strict';
import { apply, inject, name } from '../lib/index.js';

assert.equal(name, 'skill-console');
assert.deepEqual(inject, ['commands', 'skills', 'webServer']);

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
        ],
      };
    },
  },
};

apply(ctx);

assert.equal(registered.length, 4, 'registers exactly four commands');
assert.equal(registeredRoutes.length, 1, 'registers the panel API route');
assert.equal(registeredRoutes[0].path, '/api/skill-console/list');
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
assert.match(all.text, /当前会话可用技能（3）：/);
assert.match(all.text, /- \/dsh-skill-authoring \[模型\+用户 · 来源:项目\]/);
assert.match(all.text, /- \/office-docx \[模型\+用户 · 来源:内置\]/);
assert.match(all.text, /- \/secret-runbook \[仅用户 · 来源:DSH用户\]/);
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

console.log('smoke: OK');
