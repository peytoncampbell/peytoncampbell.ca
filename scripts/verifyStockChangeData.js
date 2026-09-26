import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function load(name) {
  const file = resolve(root, `src/${name}.ts`);
  assert(existsSync(file), `Missing real ${name} module`);
  const built = buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' });
  const module = new Module(resolve(root, `scripts/${name}-test.cjs`));
  module._compile(built.outputFiles[0].text, module.id);
  return module.exports;
}
const api = load('stockChangeData');
const { compareSnapshots } = load('stockInsights');
const cutoff = '2026-09-26';
const meta = { schema_version: 1, model_version: 'v1', scope: 'book', subject_id: 'ABC', cohort_id: 'set-a', cohort_size: 2 };
const holding = { ticker: 'ABC', call: 'HOLD', reason: null, rating: 0, score_meta: meta, pillars: { quality: 0 } };
const book = (date, changes = {}) => ({ as_of: date, holdings: [{ ...holding, ...changes }] });
let pair = api.changePair('book', [book(cutoff, { call: 'SELL' }), book('2026-09-25')], 'ok', cutoff);
assert.equal(pair.state, 'ready');
assert.equal(pair.current.asOf, cutoff);
assert.equal(pair.previous.asOf, '2026-09-25');
assert.deepEqual((await compareSnapshots(pair.previous, pair.current)).events.map(e => e.field), ['call']);
assert.equal(api.changePair('book', [book(cutoff)], 'ok', cutoff).previous, null);
for (const rows of [null, [], [null], [{ as_of: cutoff }], [book(cutoff), null], [book(cutoff), book(cutoff)], [book(cutoff), book('2026-09-27')], [book('2099-01-01')], [book('2026-02-30')], [book(cutoff, { ticker: ' ABC' })], [{ as_of: cutoff, holdings: [holding, holding] }], [book(cutoff), {}, book('2026-09-24')]]) {
  assert.equal(api.changePair('book', rows, 'ok', cutoff).state, 'unavailable');
}
for (const state of ['failed', 'loading']) {
  pair = api.changePair('book', [book(cutoff), book('2026-09-25')], state, cutoff);
  assert.equal(pair.state, state === 'failed' ? 'unavailable' : 'loading');
  assert.equal(pair.current, null);
}
pair = api.changePair('book', [book(cutoff, { score_meta: null, rating: 100 }), book('2026-09-25', { score_meta: null })], 'ok', cutoff);
assert.equal(pair.current.holdings[0].rating, null);
assert.equal((await compareSnapshots(pair.previous, pair.current)).events.length, 0);
console.log('PASS book validation, exact identities, legacy numeric safety and real comparison');
const weekly = (date, changes = {}) => ({ as_of: date, gate: 'PASSED', actionable: [{ ...holding, score_meta: { ...meta, scope: 'universe' }, broker_ok: false, broker_note: 'Blocked', ...changes }] });
pair = api.changePair('weekly', [weekly(cutoff, { rating: 80, broker_ok: true }), weekly('2026-09-25')], 'ok', cutoff);
assert.equal(pair.state, 'ready');
assert.deepEqual((await compareSnapshots(pair.previous, pair.current)).events.map(e => e.field).sort(), ['availability', 'rating']);
assert.equal(api.changePair('weekly', [{ ...weekly(cutoff), gate: null }], 'ok', cutoff).state, 'unavailable');
const plan = date => ({ as_of: date, holdings: [{ ticker: 'ABC', action: 'HOLD' }], entries: [], today: { as_of: date, ticket_as_of: date, comparison_meta: { schema_version: 1, ticket_status: 'ok', watch_status: 'ok', source_as_of: date }, sells: [], trims: [], buys: [], watch: [], unfunded: [], not_fillable: [] } });
let calls = 0;
const authority = row => { calls++; return { selectedOrders: [{ id: 'ABC:buy', subjectId: 'ABC', action: 'BUY', route: row.as_of === cutoff ? 'market' : 'limit', amountCad: 123, qty: null, localLimit: null }], normalizedFunding: { raised: 0, needed: 123, gap: 123 } }; };
pair = api.changePair('plan', [plan(cutoff), plan('2026-09-25')], 'ok', cutoff, authority);
assert.equal(pair.state, 'ready');
assert.equal(calls, 2);
assert.deepEqual((await compareSnapshots(pair.previous, pair.current)).events.map(e => e.field), ['route']);
assert.equal(pair.current.holdings[0].rating, null);
assert.equal(pair.current.normalizedFunding.raised, 0);
for (const mutate of [r => delete r.today.watch, r => r.today.comparison_meta.watch_status = 'partial', r => r.today.comparison_meta.watch_status = 'unavailable', r => r.today.ticket_as_of = '2026-09-25', r => r.today.comparison_meta.ticket_status = 'missing', r => delete r.entries, r => r.today.watch = [null]]) {
  const raw = plan(cutoff); mutate(raw); calls = 0;
  assert.equal(api.changePair('plan', [raw], 'ok', cutoff, authority).state, 'unavailable');
  assert.equal(calls, 0);
}
for (const output of [{ selectedOrders: [{ id: 'x', subjectId: 'ABC', action: 'BUY', qty: NaN }], normalizedFunding: null }, { selectedOrders: [], normalizedFunding: { raised: undefined, needed: 0, gap: 0 } }, { selectedOrders: [{ id: 'x', subjectId: 'ABC', action: 'BUY' }, { id: 'x', subjectId: 'DEF', action: 'BUY' }], normalizedFunding: null }]) assert.equal(api.changePair('plan', [plan(cutoff)], 'ok', cutoff, () => output).state, 'unavailable');
assert.equal(api.changePair('plan', [plan(cutoff)], 'ok', cutoff, () => { throw Error('authority failed'); }).state, 'unavailable');
const watched = plan(cutoff); watched.today.watch = [{ ticker: 'ABC', why: 'One published reading', readings: 1 }, { ticker: 'UNKNOWN', why: 'Not a holding' }];
pair = api.changePair('plan', [watched], 'ok', cutoff, authority);
assert.equal(pair.current.holdings.length, 1);
assert.match(pair.current.holdings[0].watch, /One published reading/);
console.log('PASS weekly gates and injected plan authority, completeness and exact watch attachment');
assert.equal(typeof api.ratingsFor, 'function');
let ratings = api.ratingsFor('book', [book('2099-01-01'), book(cutoff), { as_of: '2026-09-25', holdings: [] }, book('2026-09-24')], 'ABC', 'book', cutoff);
assert.deepEqual(ratings.map(r => [r.date, r.rating]), [['2026-09-24', 0], ['2026-09-25', null], [cutoff, 0]]);
assert.equal(ratings.at(-1).scoreMeta, meta);
assert.equal(api.ratingsFor('book', [book(cutoff, { score_meta: undefined })], 'ABC', 'book', cutoff)[0].rating, null);
assert.equal(api.ratingsFor('book', [book(cutoff)], 'abc', 'book', cutoff)[0].rating, null);
assert.equal(api.ratingsFor('book', [book(cutoff)], 'ABC', 'universe', cutoff)[0].rating, null);
assert.equal(api.ratingsFor('weekly', [{ ...weekly(cutoff), gate: 'FAILED' }], 'ABC', 'universe', cutoff)[0].rating, null);
assert.equal(api.ratingsFor('weekly', [weekly(cutoff)], 'ABC', 'universe', cutoff)[0].rating, 0);
assert.equal(api.ratingsFor('book', [book(cutoff), book(cutoff)], 'ABC', 'book', cutoff)[0].rating, null);
ratings = api.ratingsFor('book', [book(cutoff), book('bad'), book('2026-09-25')], 'ABC', 'book', cutoff);
assert(ratings.some(r => r.date === '' && r.rating === null));
assert.deepEqual(api.ratingsFor('book', [], 'ABC', 'book', cutoff), []);
assert.deepEqual(api.ratingsFor('book', [book(cutoff)], 'ABC', 'book', 'invalid'), [{ date: '', rating: null, scoreMeta: null }]);
const lots = Array.from({ length: 500 }, (_, i) => book(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10)));
assert.equal(api.ratingsFor('book', lots, 'ABC', 'book', cutoff).length, 400);
assert.equal(api.ratingsFor('book', [...lots, book('bad')], 'ABC', 'book', cutoff).length, 400);
console.log('PASS actual rating archive, future cutoff, gaps, opaque identity and 400-row cap');
// Authority may only see complete pairs; malformed optional financial/watch inputs are not trusted.
for (const mutate of [r => r.today.buys = [42], r => r.today.buys = [{ ticker: 'ABC', qty: '10' }], r => r.today.watch = [{ ticker: 'ABC', readings: [Infinity] }], r => r.today.not_fillable = [{ ticker: 'ABC', why: {} }]]) {
  const raw = plan('2026-09-25'); mutate(raw); calls = 0;
  assert.equal(api.changePair('plan', [plan(cutoff), raw], 'ok', cutoff, authority).state, 'unavailable');
  assert.equal(calls, 0);
}
const protectedResult = api.changePair('plan', [plan(cutoff)], 'ok', cutoff, () => ({ selectedOrders: [], normalizedFunding: null, status: 'failed', holdings: [{ subjectId: 'INJECTED' }] }));
assert.equal(protectedResult.current.status, 'ok');
assert.equal(protectedResult.current.holdings[0].subjectId, 'ABC');
pair = api.changePair('book', [book(cutoff, { pillars: { quality: Infinity, growth: '22', arbitrary: 40 } }), book('2026-09-25')], 'ok', cutoff);
assert.deepEqual(pair.current.holdings[0].readings, { growth: null, quality: null });
pair = api.changePair('weekly', [weekly(cutoff, { score_meta: { ...meta, scope: 'universe', model_version: 'v2' }, rating: 80 }), weekly('2026-09-25')], 'ok', cutoff);
assert.deepEqual((await compareSnapshots(pair.previous, pair.current)).events.map(e => e.field), ['scoreBoundary']);
const empty = api.changePair('book', [{ as_of: cutoff, holdings: [] }], 'ok', cutoff);
assert.equal((await compareSnapshots(empty.previous, empty.current)).status, 'baseline');
assert.equal(api.changePair('weekly', [{ as_of: cutoff, gate: 'PASSED', actionable: [] }], 'ok', cutoff).state, 'ready');
console.log('PASS pair preflight, malformed financial/watch rows, authority isolation and numeric boundaries');
const fixedAuthority = row => row.as_of === cutoff
  ? { selectedOrders: [{ id: 'ABC:proposal', subjectId: 'ABC', action: 'BUY', amountCad: 200.01, qty: 0, localLimit: 12.3456, currency: 'CAD' }], normalizedFunding: { raised: 0, needed: 200.01, gap: null } }
  : { selectedOrders: [{ id: 'ABC:proposal', subjectId: 'ABC', action: 'BUY', amountCad: 100, qty: null, localLimit: 12.3455, currency: 'CAD' }], normalizedFunding: { raised: null, needed: 100, gap: null } };
pair = api.changePair('plan', [plan(cutoff), plan('2026-09-25')], 'ok', cutoff, fixedAuthority);
assert.deepEqual(pair.current.selectedOrders, fixedAuthority({ as_of: cutoff }).selectedOrders);
assert.deepEqual(pair.current.normalizedFunding, fixedAuthority({ as_of: cutoff }).normalizedFunding);
const financialEvents = (await compareSnapshots(pair.previous, pair.current)).events;
assert.deepEqual(financialEvents.map(e => e.field).sort(), ['amountCad', 'funding:needed', 'funding:raised', 'localLimit', 'qty']);
assert.deepEqual(financialEvents.find(e => e.field === 'qty').before, null);
assert.deepEqual(financialEvents.find(e => e.field === 'qty').after, 0);
console.log('PASS unchanged authority outputs through real proposal/funding comparison');
