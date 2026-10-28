import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Match the CLI loader: published policies resolve failproofai to its SDK bundle.
const sdkPath = new URL('../node_modules/failproofai/dist/index.js', import.meta.url).href;
const sdk = 'data:text/javascript,' + encodeURIComponent(`import sdk from '${sdkPath}'; export const {customPolicies, allow, deny, getCustomHooks} = sdk;`);
registerHooks({ resolve(specifier, context, nextResolve) {
  return specifier === 'failproofai' ? { url: sdk, shortCircuit: true } : nextResolve(specifier, context);
}});
const { getCustomHooks } = await import('failproofai');
await import('../recovery-guards.mjs');
const policy = getCustomHooks().find(p => p.name === 'block-recovery-guard-edits');
test('registers an installable default-enabled PreToolUse policy', () => {
  assert.ok(policy);
  assert.equal(policy.defaultEnabled, true);
  assert.deepEqual(policy.match.events, ['PreToolUse']);
  assert.ok(policy.description && policy.category);
});
const call = (toolName, file_path, extra = {}) => policy.fn({eventType:'PreToolUse', toolName,
  payload: {cwd:'/repo/cascade-zero'}, toolInput: {file_path, ...extra}});
for (const file of ['backend/api/__init__.py','backend/ai/planner.py','backend/ai/policy.py',
                    'backend/coordinator/__init__.py','backend/risk/__init__.py']) {
  for (const tool of ['Write','Edit','MultiEdit']) {
    test(`${tool} denies ${file}`, async () => {
      const result = await call(tool, file);
      assert.equal(result.decision, 'deny');
      assert.match(result.reason, /human review/i);
    });
  }
}
for (const file of ['/repo/cascade-zero/backend/api/__init__.py',
                    'C:\\work\\cascade-zero\\backend\\risk\\__init__.py',
                    './backend/ai/../api/__init__.py',
                    'api/__init__.py']) {
  test(`normalizes ${file}`, async () => {
    const result = await policy.fn({eventType:'PreToolUse', toolName:'Edit',
      payload:{cwd:'/repo/cascade-zero/backend'}, toolInput:{file_path:file}});
    assert.equal(result.decision, 'deny');
  });
}
for (const file of ['README.md','tests/api/test_contract.py','backend/api/__init__.py.bak',
                    'mybackend/api/__init__.py','backend/risk/notes.md','backend/ai/client.py']) {
  test(`allows ordinary edit ${file}`, async () => assert.equal((await call('Edit',file)).decision,'allow'));
}
for (const tool of ['Read','Grep','Bash']) {
  test(`leaves ${tool} outside its declared scope`, async () =>
    assert.equal((await call(tool,'backend/api/__init__.py')).decision,'allow'));
}
test('allows unrelated events and missing inputs', async () => {
  assert.equal((await policy.fn({eventType:'PostToolUse',toolName:'Edit',toolInput:{file_path:'backend/api/__init__.py'}})).decision,'allow');
  assert.equal((await policy.fn({eventType:'PreToolUse',toolName:'Edit'})).decision,'allow');
});
