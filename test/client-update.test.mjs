import assert from 'node:assert/strict';
import fs from 'node:fs';

let states = [];
let index = 0;
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }),
  useState: (initial) => {
    const i = index++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
  },
  useRef: (value) => ({ current: value }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
};
const captured = [];
const windowStub = { __ModuleLoader__: { load: (definition) => captured.push(definition) } };
globalThis.document = { createElement: () => ({ setAttribute() {}, remove() {} }), head: { appendChild() {} } };
const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
new Function('window', source)(windowStub);
const client = captured[0].factory((name) => {
  if (name === 'react') return react;
  throw new Error('optional package absent');
});
let dictionary;
const slots = [];
client.apply({
  effect: (fn) => fn(),
  locale: { register: (_ns, values) => { dictionary = values.zh; }, bind: () => (key) => dictionary[key] || key },
  slots: { inject: (_name, fn) => fn(), register: (config, component) => { slots.push({ config, component }); return () => {}; } },
});
const t = (key) => dictionary[key] || key;
const main = slots.find((slot) => slot.config.name === 'main').component;
globalThis.fetch = async (url) => ({
  json: async () => url.endsWith('/update')
    ? { ok: true, results: [{ repo: 'mirror-a', ok: true, before: 'abc', after: 'abc', conflicts: ['shared'] }] }
    : { ok: true, skills: [] },
});
let buttons;
function render(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(render).join('');
  if (typeof node.type === 'function') return render(node.type(node.props));
  const children = render(node.props.children);
  if (node.type === 'button') buttons.push({ text: children, onClick: node.props.onClick });
  return children;
}
function view() { index = 0; buttons = []; return render(main({ t })); }
view();
assert.ok(buttons.every((button) => !['安装技能', '更新', '体检'].includes(button.text)), 'management is hidden until mode is known');
states[3] = { status: 'ready', skills: [], managementMode: 'standalone' };
view();
const update = buttons.find((button) => button.text === '更新');
assert.ok(update, 'update button is rendered');
await update.onClick();
const result = view();
assert.match(result, /冲突/, 'update result must tell the user about skipped conflicts');
assert.match(result, /shared/, 'update result must identify the affected skill');
states[3] = { status: 'ready', skills: [{ name: 'alpha', source: 'DSH用户', invocation: 'model-and-user', managed: true }], managementMode: 'cc-switch' };
states[7] = states[3].skills[0];
const unified = view();
assert.match(unified, /CC Switch/, 'unified mode identifies where to manage skills');
assert.ok(buttons.every((button) => !['安装技能', '更新', '体检', '卸载'].includes(button.text)), 'unified mode has no management buttons');
console.log('client update conflict: OK');
