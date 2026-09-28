#!/usr/bin/env node
// Exercise the real load and clearPrivate callbacks, not a replacement cache model.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('../src/OwnerStocks.tsx', import.meta.url), 'utf8');
function callback(name, endMarker) {
  const start = source.indexOf(`  const ${name} = useCallback(`);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start);
  return transformSync(source.slice(start, end).replace(`const ${name} =`, `globalThis.${name} =`), { loader: 'ts', target: 'es2022' }).code;
}
const clearCode = callback('clearPrivate', '\n  // Neither');
const loadCode = callback('load', '\n\n  useEffect');
const ok = rows => ({ ok: true, status: 200, rows });
const failed = status => ({ ok: false, status, rows: [] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const state = {};
  let respond = () => ok([{ marker: 'cached' }]);
  const context = { ownerIdentity: 'owner-A', loadSequence: { current: 0 }, useCallback: f => f,
    ensureFresh() {}, invalidateSession() { state.invalidated = true; },
    onSignedOut() { assert.equal(state.invalidated, true, 'Local invalidation precedes navigation'); state.signedOut = true; },
    onReaderDesk() { state.handOffs = (state.handOffs || 0) + 1; },
    ownerFetch: async path => respond(path.split('?')[0]) };
  for (const name of ['DataOwner', 'Priv', 'Pub', 'News', 'WeeklyRows', 'PlaybookRows', 'Quant', 'SourceWarnings', 'ComparisonRead', 'Compared', 'HistoryPage', 'Refreshing', 'Error']) context[`set${name}`] = value => { state[name] = value; };
  context.signedOutCallback = { current: context.onSignedOut };
  context.readerDeskCallback = { current: context.onReaderDesk };
  vm.createContext(context);
  vm.runInContext(clearCode + loadCode, context);
  return { state, context, load: () => context.load(), respond: fn => { respond = fn; } };
}
function cleared(state, empty = false) {
  assert.equal(state.DataOwner, null, 'authoritative gate clears owner');
  assert.equal(empty ? state.Priv.length : state.Priv, empty ? 0 : null, 'authoritative gate clears book');
  for (const key of ['Pub', 'News', 'WeeklyRows', 'PlaybookRows', 'SourceWarnings']) assert.equal(state[key].length, 0, `${key} cleared`);
  assert.equal(state.Quant, null);
  assert.equal(state.Compared, null, 'Derived comparison cache cleared');
  assert.deepEqual(Object.values(state.ComparisonRead), ['failed', 'failed', 'failed']);
  assert.equal(state.Refreshing, false);
}
let passed = 0, failedCount = 0;
async function test(label, run) {
  try { await run(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failedCount++; console.error(`FAIL ${label}: ${error.message}`); }
}
for (const [label, gate] of [['403', failed(403)], ['401', failed(401)], ['empty', ok([])]]) {
  await test(`${label} plus rejected secondary clears every cache; recovery cannot revive old data`, async () => {
    const h = harness(); await h.load(); assert.equal(h.state.PlaybookRows[0].marker, 'cached');
    h.respond(table => table === 'pc_digest_private' ? gate : table === 'pc_news' ? Promise.reject(new Error('synthetic network failure')) : ok([{ marker: 'late' }]));
    await h.load(); cleared(h.state, label === 'empty');
    assert.equal(h.state.handOffs ?? 0, label === 'empty' ? 1 : 0, 'only the valid-empty gate probes the reader view');
    assert.equal(Boolean(h.state.signedOut), label === '401');
    assert.equal(Boolean(h.state.invalidated), label === '401');
    h.respond(table => table === 'pc_digest_private' ? ok([{ marker: 'new' }]) : failed(500));
    await h.load(); assert.equal(h.state.Priv[0].marker, 'new');
    for (const key of ['Pub', 'News', 'WeeklyRows', 'PlaybookRows']) assert.equal(h.state[key].length, 0, `${key} never revives`);
    assert.equal(h.state.Quant, null); assert.equal(h.state.SourceWarnings.length, 5);
  });
  await test(`${label} clears before hung secondary settles; late rejection is handled`, async () => {
    const h = harness(); await h.load(); const pending = deferred();
    h.respond(table => table === 'pc_digest_private' ? gate : pending.promise);
    const loading = h.load(); await turn();
    try { cleared(h.state, label === 'empty'); }
    finally { pending.reject(new Error('synthetic late rejection')); await loading; await turn(); }
  });
}
await test('a valid empty private result with a reader row hands the account over exactly once', async () => {
  const h = harness(); await h.load();
  h.respond(table => table === 'pc_digest_private' ? ok([]) : ok([{ marker: 'reader-row' }]));
  await h.load();
  assert.equal(h.state.Priv.length, 0, 'the private workspace stays cleared');
  assert.equal(h.state.handOffs, 1, 'the hand-off fires exactly once, from the probe result');
  assert.equal(Boolean(h.state.Error), false, 'no console error is raised when the account belongs on the reader desk');
  assert.equal(Boolean(h.state.signedOut), false, 'the hand-off is not a sign-out');
});
await test('a valid empty private result with no reader row keeps the console message and never hands off', async () => {
  const h = harness(); await h.load();
  h.respond(table => table === 'pc_digest_private' ? ok([]) : failed(500));
  await h.load();
  assert.equal(h.state.Priv.length, 0);
  assert.equal(h.state.handOffs ?? 0, 0, 'an unconfirmed account stays on the console');
  assert.match(String(h.state.Error), /No private book rows returned/);
});
await test('a readable private book never probes the reader view', async () => {
  const seen = [];
  const h = harness();
  h.respond(table => { seen.push(table); return ok([{ marker: 'rows' }]); });
  await h.load();
  assert.equal(seen.includes('pc_reader_view'), false, "the owner's path is untouched");
  assert.equal(h.state.handOffs ?? 0, 0);
});
for (const kind of ['private-500', 'private-network', 'secondary-500', 'secondary-network']) {
  await test(`${kind} retains same-owner cache with warning`, async () => {
    const h = harness(); await h.load();
    h.respond(table => (kind.startsWith('private') ? table === 'pc_digest_private' : table !== 'pc_digest_private')
      ? kind.endsWith('network') ? Promise.reject(new Error('synthetic network failure')) : failed(500) : ok([{ marker: 'cached' }]));
    await h.load(); assert.equal(h.state.Priv[0].marker, 'cached'); assert.equal(h.state.PlaybookRows[0].marker, 'cached');
    assert(h.state.Error || h.state.SourceWarnings.length, 'retention is accompanied by warning');
    assert.equal(h.state.Refreshing, false);
  });
}
for (const boundary of ['revocation', 'owner-change']) for (const stage of ['primary', 'secondary']) {
  await test(`late ${stage} cannot restore after ${boundary}`, async () => {
    const h = harness(); await h.load(); const pending = deferred();
    h.respond(table => (stage === 'primary' ? table === 'pc_digest_private' : table !== 'pc_digest_private') ? pending.promise : ok([{ marker: 'old-load' }]));
    const oldLoad = h.load(); await turn();
    if (boundary === 'revocation') { h.respond(table => table === 'pc_digest_private' ? failed(403) : ok([])); await h.load(); }
    else { h.context.ownerIdentity = 'owner-B'; h.context.clearPrivate(); }
    cleared(h.state);
    pending.resolve(ok([{ marker: 'old-load' }])); await oldLoad;
    cleared(h.state);
    h.respond(() => ok([{ marker: 'new-owner-load' }])); await h.load();
    assert.equal(h.state.DataOwner, h.context.ownerIdentity); assert.equal(h.state.PlaybookRows[0].marker, 'new-owner-load');
  });
}
await test('comparison states track loading, independent failure and empty success honestly', async () => {
  const h = harness(); await h.load();
  assert(Object.values(h.state.ComparisonRead).every(value => value === 'ok'));
  const pending = deferred(); h.respond(() => pending.promise); const loading = h.load(); await turn();
  assert(Object.values(h.state.ComparisonRead).every(value => value === 'loading'));
  pending.resolve(ok([])); await loading; cleared(h.state, true);
  h.respond(table => table === 'pc_weekly' ? failed(500) : table === 'pc_playbook' ? ok([]) : ok([{ marker: 'new' }]));
  await h.load(); assert.equal(h.state.ComparisonRead.book, 'ok'); assert.equal(h.state.ComparisonRead.weekly, 'failed'); assert.equal(h.state.ComparisonRead.plan, 'ok'); assert.equal(h.state.PlaybookRows.length, 0);
});
console.log(JSON.stringify({ passed, failed: failedCount }));
if (failedCount) process.exitCode = 1;
