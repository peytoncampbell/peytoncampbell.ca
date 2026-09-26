import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/stockInsights.ts');
assert(existsSync(file), 'Missing real stockInsights module');
const built = buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' });
const compiled = new Module(resolve(root, 'scripts/insights-test.cjs'));
compiled._compile(built.outputFiles[0].text, compiled.id);
const api = compiled.exports;
assert.equal(typeof api.normalizeFactor, 'function');
for (const value of [0, 50, 100]) assert.equal(api.normalizeFactor(value), value);
for (const value of [null, undefined, '', '50', NaN, Infinity, -1, 101]) assert.equal(api.normalizeFactor(value), null);
console.log('PASS factor boundaries and real zero');
const meta = { schema_version: 1, model_version: 'v1', scope: 'book', subject_id: 'ABC', cohort_id: 'set-a', cohort_size: 14 };
assert.equal(typeof api.normalizeScoreStamp, 'function');
const stamp = api.normalizeScoreStamp(meta);
assert.deepEqual(stamp, { modelVersion: 'v1', scope: 'book', subjectId: 'ABC', cohortId: 'set-a', cohortSize: 14 });
assert.equal(api.scoreCompatibility(stamp, stamp), 'compatible');
assert.equal(api.scoreCompatibility(null, stamp), 'unknown');
for (const field of ['model_version', 'scope', 'subject_id', 'cohort_id', 'cohort_size']) {
  assert.equal(api.normalizeScoreStamp({ ...meta, [field]: null }), null);
}
for (const [field, value] of Object.entries({ modelVersion: 'v2', scope: 'universe', subjectId: 'DEF', cohortId: 'set-b', cohortSize: 15 })) {
  assert.equal(api.scoreCompatibility(stamp, { ...stamp, [field]: value }), 'boundary');
}
assert.equal(api.normalizeScoreStamp({ ...meta, cohort_size: 0 }), null);
assert.equal(api.normalizeScoreStamp({ ...meta, cohort_size: 1.5 }), null);
assert.equal(api.normalizeScoreStamp({ ...meta, model_version: ' ' }), null);
assert.equal(api.normalizeScoreStamp({ ...meta, schema_version: 2 }), null);
for (const [wire, normalized] of [['model_version', 'modelVersion'], ['subject_id', 'subjectId'], ['cohort_id', 'cohortId']]) {
  for (const bad of [' v1', 'v1 ', 'v 1', 'v\t1']) {
    assert.equal(api.normalizeScoreStamp({ ...meta, [wire]: bad }), null, `${wire} must remain exact`);
    assert.equal(api.scoreCompatibility({ ...stamp, [normalized]: bad }, { ...stamp, [normalized]: bad }), 'unknown');
  }
}
assert.equal(api.scoreCompatibility(api.normalizeScoreStamp({ ...meta, cohort_id: 'set a' }), api.normalizeScoreStamp({ ...meta, cohort_id: 'set  a' })), 'unknown');
console.log('PASS strict score stamp compatibility');
assert.equal(typeof api.normalizeNews, 'function');
assert.equal(api.normalizeDate('2024-02-29'), '2024-02-29');
for (const d of ['2025-02-29', '2026-04-31', '09/01/2026', '2026-01-01T00:00:00Z', null]) assert.equal(api.normalizeDate(d), null);
for (const u of ['javascript:alert(1)', 'data:text/html,x', '/relative', 'https://user:pass@example.com']) assert.equal(api.safeEvidenceUrl(u), null);
assert.equal(api.safeEvidenceUrl('https://example.com/news'), 'https://example.com/news');
const news = api.normalizeNews([
  { title: ' First  story ', url: 'https://example.com/a', date: null, fetched_at: '2026-09-26' },
  { title: 'First story', url: 'https://example.com/a', date: '2026-09-25' },
  { title: 'First story', url: 'https://example.com/a', date: '2026-09-25' },
  { title: 'Undated', url: 'javascript:alert(1)', date: 'bad', fetched_at: '2026-09-26' },
]);
assert.equal(news.length, 2);
assert.equal(news[0].date, '2026-09-25');
assert.deepEqual(news[1], { title: 'Undated', url: null, date: null, published: null, source: null });
const wireNews = api.normalizeNews([
  { ticker: 'ABC', title: 'Same headline', url: 'https://example.com/old', source: 'Old', published: null },
  { ticker: 'DEF', title: ' SAME  headline ', url: 'https://example.com/new', source: 'Reuters', published: '2026-09-25T19:00:00+00:00' },
  { ticker: 'ABC', title: 'Updated headline', url: 'https://example.com/new', source: 'Reuters', published: '2026-09-25T20:00:00Z' },
  { ticker: 'ABC', title: 'Earlier', url: 'https://example.com/earlier', source: 'AP', published: '2026-09-25T09:00:00Z' },
  { ticker: 'ABC', title: 'No timestamp', url: 'https://user:pass@example.com', source: 'Wire', published: '2026-02-30T00:00:00Z', fetched_at: '2026-09-26T00:00:00Z' },
]);
assert.deepEqual(wireNews.map(n => n.title), ['Updated headline', 'Earlier', 'No timestamp']);
assert.equal(wireNews[0].published, '2026-09-25T20:00:00Z');
assert.equal(wireNews[0].source, 'Reuters');
assert.equal(wireNews[0].date, '2026-09-25');
assert.equal(wireNews[2].published, null);
assert.equal(wireNews[2].date, null);
assert.equal(wireNews[2].url, null);
for (const published of ['2026-09-25', '2026-09-25T24:00:00Z', '2026-09-25T10:00:00', '2026-09-25T00:00:00+25:00']) {
  assert.equal(api.normalizeNews([{ title: 'Invalid', published }])[0].published, null);
}
assert.equal(api.normalizeNews([{ title: 'Tie', published: '2026-09-25T00:00:00Z', source: 'First' }, { title: 'tie', published: '2026-09-25T00:00:00Z', source: 'Second' }])[0].source, 'First');
console.log('PASS dates, safe evidence, dated/undated deduplication');
assert.equal(typeof api.normalizeHistory, 'function');
const identity = { instrumentId: 'Yahoo Finance:ABC:CAD', listingSymbol: 'ABC', underlyingSymbol: 'ABC', currency: 'CAD' };
const series = { status: 'ok', instrument_id: identity.instrumentId, listing_symbol: 'ABC', underlying_symbol: 'ABC', currency: 'CAD', source: 'Yahoo Finance', adjustment_basis: 'provider-adjusted close', fetched_at: '2026-09-26T10:00:00+00:00', coverage_start: '2026-09-23', coverage_end: '2026-09-25', timezone: 'America/Toronto', observations: [{ date: '2026-09-23', value: 0 }, { date: '2026-09-24', value: null }, { date: '2026-09-25', value: 5 }] };
for (const field of ['fetched_at', 'coverage_start', 'coverage_end', 'timezone']) {
  const missing = { ...series }; delete missing[field];
  assert.equal(api.normalizeHistory(missing, identity).status, 'unavailable', `missing ${field}`);
}
assert.equal(api.normalizeHistory({ ...series, underlying_symbol: null }, { ...identity, underlyingSymbol: null }).status, 'ready');
for (const bound of [401, 10000, -1, 1.5, NaN, null]) assert.equal(api.normalizeHistory(series, identity, bound).status, 'unavailable');
for (const [field, value] of [['fetched_at', '2026-02-30T00:00:00Z'], ['fetched_at', '2026-09-26'], ['timezone', 'Mars/Olympus'], ['coverage_start', '2026-09-22'], ['coverage_end', '2026-09-26']]) {
  assert.equal(api.normalizeHistory({ ...series, [field]: value }, identity).status, 'unavailable');
}
const history = api.normalizeHistory(series, identity, 2);
assert.equal(history.source, 'Yahoo Finance');
assert.equal(history.timezone, 'America/Toronto');
assert.equal(history.fetchedAt, series.fetched_at);
assert.equal(history.coverageStart, series.coverage_start);
assert.equal(history.coverageEnd, series.coverage_end);
assert.equal(api.normalizeHistory({ ...series, observations: [{ date: 'bad', value: 0 }, ...series.observations] }, identity, 2).status, 'unavailable');
assert.equal(api.normalizeHistory({ ...series, observations: series.observations.map(p => ({ ...p, value: null })) }, identity).status, 'empty');
assert.equal(api.normalizeHistory({ ...series, observations: series.observations.map(p => ({ ...p, value: -1 })) }, identity).status, 'unavailable');
assert.deepEqual(api.normalizeHistory(series, identity, 2).observations, series.observations.slice(-2));
assert.equal(api.normalizeHistory(series, identity).pointCount, 2);
assert.equal(api.normalizeHistory({ ...series, coverage_start: null, coverage_end: null, observations: [] }, identity).status, 'empty');
assert.equal(api.normalizeHistory({ ...series, coverage_end: '2026-09-23', observations: [series.observations[0]] }, identity).status, 'single');
assert.equal(api.normalizeHistory({ ...series, observations: [] }, identity).status, 'unavailable');
for (const observations of [[...series.observations].reverse(), [series.observations[0], series.observations[0]], [{ date: '2026-02-30', value: 1 }], [{ date: '2026-09-23', value: NaN }], [{ date: '2026-09-23', value: '1' }]]) {
  assert.equal(api.normalizeHistory({ ...series, observations }, identity).status, 'unavailable');
}
for (const field of ['instrument_id', 'listing_symbol', 'underlying_symbol', 'currency', 'source', 'adjustment_basis']) assert.equal(api.normalizeHistory({ ...series, [field]: 'wrong' }, identity).status, 'unavailable');
assert.equal(api.normalizeHistory({ ...series, status: 'unavailable' }, identity).observations.length, 0);
assert.equal(api.normalizeHistory(series, identity, 0).status, 'unavailable');
const longObservations = Array.from({ length: 405 }, (_, i) => ({ date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), value: i === 404 ? null : i }));
const longSeries = { ...series, coverage_start: longObservations[0].date, coverage_end: longObservations.at(-1).date, observations: longObservations };
assert.deepEqual(api.normalizeHistory(longSeries, identity).observations, longObservations.slice(-400));
assert.equal(api.normalizeHistory({ ...longSeries, observations: [{ ...longObservations[0], value: Infinity }, ...longObservations.slice(1)] }, identity).status, 'unavailable');
assert.equal(api.normalizeHistory(series, identity, 1).status, 'single');
assert.equal(api.normalizeHistory({ ...series, timezone: '+01:00' }, identity).status, 'unavailable');
console.log('PASS bounded honest history, gaps, identity and chronology');
assert.equal(typeof api.compareSnapshots, 'function');
const snapshot = (asOf = '2026-09-25') => ({ source: 'book', asOf, status: 'ok', holdings: [{ subjectId: 'ABC', call: 'HOLD', rating: 50, scoreStamp: stamp }], candidates: [], selectedOrders: [], normalizedFunding: null });
assert.equal((await api.compareSnapshots(null, snapshot())).status, 'baseline');
const absentPredecessor = { ...snapshot('2026-09-24'), status: 'missing', holdings: [] };
const typedBaseline = await api.compareSnapshots(absentPredecessor, snapshot());
assert.equal(typedBaseline.status, 'baseline', 'An explicitly missing predecessor is a baseline, not a failed comparison');
assert.deepEqual(typedBaseline.events, [], 'Missing predecessor never makes current holdings new');
for (const status of ['failed', 'incomplete']) {
  assert.equal((await api.compareSnapshots({ ...absentPredecessor, status }, snapshot())).status, 'unavailable', 'Failed or incomplete predecessor is not a baseline');
}
assert.equal((await api.compareSnapshots(absentPredecessor, { ...snapshot(), status: 'missing' })).status, 'unavailable', 'Missing current data is not a baseline');
assert.equal((await api.compareSnapshots({ ...absentPredecessor, source: 'weekly' }, snapshot())).status, 'unavailable', 'Missing predecessor cannot hide a source mismatch');
for (const bad of [{ ...snapshot(), status: 'failed' }, { ...snapshot(), status: 'missing' }, { ...snapshot(), status: 'incomplete' }, { ...snapshot(), asOf: 'invalid' }]) {
  const result = await api.compareSnapshots(snapshot('2026-09-24'), bad);
  assert.equal(result.status, 'unavailable'); assert.deepEqual(result.events, []);
}
assert.equal((await api.compareSnapshots(snapshot(), snapshot())).status, 'unavailable');
assert.equal((await api.compareSnapshots(snapshot(), { ...snapshot('2026-09-26'), source: 'weekly' })).status, 'unavailable');
assert.equal((await api.compareSnapshots(snapshot(), snapshot('2026-09-26'))).status, 'ready');
const emptyComplete = { ...snapshot(), holdings: [] };
assert.equal((await api.compareSnapshots(null, emptyComplete)).status, 'baseline');
assert.equal((await api.compareSnapshots(emptyComplete, { ...emptyComplete, asOf: '2026-09-26' })).status, 'ready');
assert.equal((await api.compareSnapshots(null, { ...emptyComplete, status: 'incomplete' })).status, 'unavailable');
assert.equal((await api.compareSnapshots(null, { ...snapshot(), holdings: [{ subjectId: '' }] })).status, 'unavailable');
assert.equal((await api.compareSnapshots(null, { ...snapshot(), source: 'invalid' })).status, 'unavailable');
const finalOrder = await api.compareSnapshots({ ...emptyComplete, selectedOrders: [{ id: 'last', subjectId: 'ABC', action: 'BUY', qty: 0.125, localLimit: 0.00123 }] }, { ...emptyComplete, asOf: '2026-09-26' });
assert.equal(finalOrder.status, 'ready');
assert.equal(finalOrder.events[0].field, 'proposalRemoved');
assert.equal(finalOrder.events[0].before.qty, 0.125);
assert.equal(finalOrder.events[0].before.localLimit, 0.00123);
console.log('PASS snapshot baseline and source/date/failure guards');
const old = snapshot(); old.holdings[0].reason = 'steady thesis';
const next = snapshot('2026-09-26'); next.holdings[0].call = 'TRIM'; next.holdings[0].reason = ' steady   thesis ';
let comparison = await api.compareSnapshots(old, next);
assert.equal(comparison.events.length, 1);
assert.equal(comparison.events[0].field, 'call');
assert.match(comparison.events[0].id, /^[a-f0-9]{64}$/);
assert.deepEqual(await api.compareSnapshots(old, next), comparison);
const revised = structuredClone(next); revised.holdings[0].call = 'SELL';
assert.notEqual((await api.compareSnapshots(old, revised)).events[0].id, comparison.events[0].id);
assert.notEqual((await api.compareSnapshots({ ...old, asOf: '2026-09-24' }, next)).events[0].id, comparison.events[0].id);
const added = { ...next, holdings: [...next.holdings, { subjectId: 'NEW', call: 'HOLD' }] };
assert((await api.compareSnapshots(next, { ...added, asOf: '2026-09-27' })).events.some(e => e.field === 'added'));
assert((await api.compareSnapshots(added, { ...next, asOf: '2026-09-27' })).events.some(e => e.field === 'removed'));
assert.deepEqual((await api.compareSnapshots(added, { ...added, asOf: '2026-09-27', holdings: [...added.holdings].reverse(), generated_at: 'ignored' })).events, []);
assert.equal((await api.compareSnapshots(old, { ...next, holdings: [...next.holdings, next.holdings[0]] })).status, 'unavailable');
const retained = { ...snapshot(), holdings: [{ subjectId: 'ABC', call: 'HOLD', reason: ' steady  thesis ', availability: 'ok', watch: 'review', rating: 0, scoreStamp: stamp, readings: { z: 0, a: ' steady  ' } }] };
const retainedBefore = JSON.stringify(retained);
const removal = await api.compareSnapshots(retained, { ...emptyComplete, asOf: '2026-09-26' });
assert.deepEqual(removal.events[0].before, { subjectId: 'ABC', call: 'HOLD', reason: 'steady thesis', availability: 'ok', watch: 'review', rating: 0, scoreStamp: stamp, readings: { a: 'steady', z: 0 } });
assert.equal(removal.events[0].after, null);
const reorderedRetained = structuredClone(retained);
reorderedRetained.holdings[0].readings = { a: 'steady', z: 0 };
reorderedRetained.holdings[0].scoreStamp = Object.fromEntries(Object.entries(stamp).reverse());
assert.deepEqual(await api.compareSnapshots(reorderedRetained, { ...emptyComplete, asOf: '2026-09-26' }), removal);
const revisedRetained = structuredClone(retained); revisedRetained.holdings[0].watch = 'different';
assert.notEqual((await api.compareSnapshots(revisedRetained, { ...emptyComplete, asOf: '2026-09-26' })).events[0].id, removal.events[0].id);
assert.equal(JSON.stringify(retained), retainedBefore);
console.log('PASS calls, membership, opaque revision-aware deterministic IDs');
const rated = snapshot('2026-09-26'); rated.holdings[0].rating = 0; rated.holdings[0].availability = 'unavailable'; rated.holdings[0].watch = 'watch'; rated.holdings[0].readings = { trend: 0 };
comparison = await api.compareSnapshots(snapshot(), rated);
for (const field of ['rating', 'availability', 'watch', 'reading:trend']) assert(comparison.events.some(e => e.field === field));
const legacy = structuredClone(rated); delete legacy.holdings[0].scoreStamp;
comparison = await api.compareSnapshots(snapshot(), legacy);
assert(!comparison.events.some(e => e.field === 'rating' || e.field.startsWith('reading:')));
assert.equal(comparison.notices.length, 1);
const boundary = structuredClone(rated); boundary.holdings[0].scoreStamp.cohortId = 'new-cohort';
comparison = await api.compareSnapshots(snapshot(), boundary);
assert(comparison.events.some(e => e.field === 'scoreBoundary'));
assert(!comparison.events.some(e => e.field === 'rating'));
const mismatched = structuredClone(rated); mismatched.holdings[0].scoreStamp.subjectId = 'OTHER';
assert(!(await api.compareSnapshots(snapshot(), mismatched)).events.some(e => e.field === 'rating'));
console.log('PASS compatible ratings/readings, availability/watch, legacy and cohort boundaries');
const order = { id: 'buy-ABC', subjectId: 'ABC', action: 'BUY', route: 'cash', amountCad: 100.01, qty: 2, localLimit: 50.005, currency: 'CAD', reason: 'steady thesis' };
const ordered = { ...snapshot(), source: 'plan', selectedOrders: [order] };
const changedOrder = { ...ordered, asOf: '2026-09-26', selectedOrders: [{ ...order, route: 'funded', amountCad: 100.02, qty: 3, localLimit: 50.006, currency: 'USD' }] };
comparison = await api.compareSnapshots(ordered, changedOrder);
for (const field of ['route', 'amountCad', 'qty', 'localLimit', 'currency']) assert(comparison.events.some(e => e.field === field));
assert.deepEqual((await api.compareSnapshots(ordered, { ...ordered, asOf: '2026-09-26', selectedOrders: [{ ...order, amountCad: 100.01000000001, reason: ' steady   thesis ' }] })).events, []);
const removedOrder = await api.compareSnapshots(ordered, { ...ordered, asOf: '2026-09-26', selectedOrders: [] });
assert.equal(removedOrder.events[0].field, 'proposalRemoved');
assert(!JSON.stringify(removedOrder).includes('executed'));
assert.equal((await api.compareSnapshots(ordered, { ...ordered, asOf: '2026-09-26', selectedOrders: [order, { ...order, route: 'alternative' }] })).status, 'unavailable');
assert((await api.compareSnapshots({ ...ordered, selectedOrders: [] }, changedOrder)).events.some(e => e.field === 'proposalAdded'));
console.log('PASS selected proposals, cents, local precision and alternative duplicate rejection');
const funded = { ...ordered, normalizedFunding: { raised: 10.01, needed: 30.02, gap: 20.01 } };
const fundingChanged = { ...funded, asOf: '2026-09-26', normalizedFunding: { raised: 10.01, needed: 30.02, gap: 0 } };
comparison = await api.compareSnapshots(funded, fundingChanged);
assert.deepEqual(comparison.events.map(e => [e.field, e.before, e.after]), [['funding:gap', 20.01, 0]]);
assert((await api.compareSnapshots(funded, { ...fundingChanged, normalizedFunding: null })).events.every(e => e.after === null));
assert.deepEqual((await api.compareSnapshots(funded, { ...funded, asOf: '2026-09-26', normalizedFunding: { ...funded.normalizedFunding, gap: 20.0100000000001 } })).events, []);
assert.equal((await api.compareSnapshots(snapshot(), { ...snapshot('2026-09-26'), normalizedFunding: { raised: 0, needed: 0, gap: 0 } })).events.length, 3);
const inputBefore = JSON.stringify([funded, fundingChanged]);
await api.compareSnapshots(funded, fundingChanged);
assert.equal(JSON.stringify([funded, fundingChanged]), inputBefore);
console.log('PASS exact normalized funding, unknown versus zero, no financial recomputation or mutation');
const boundaryAgain = structuredClone(boundary);
boundaryAgain.holdings[0].scoreStamp = Object.fromEntries(Object.entries(boundaryAgain.holdings[0].scoreStamp).reverse());
assert.deepEqual(await api.compareSnapshots(snapshot(), boundaryAgain), await api.compareSnapshots(snapshot(), boundary));
assert.equal((await api.compareSnapshots(null, { ...snapshot(), selectedOrders: [order, order] })).status, 'unavailable');
const manyOld = { ...snapshot(), holdings: Array.from({ length: 14 }, (_, i) => ({ subjectId: `LEGACY${i}`, rating: 50 })) };
const manyNew = { ...manyOld, asOf: '2026-09-26', holdings: manyOld.holdings.map(r => ({ ...r, rating: 0 })) };
comparison = await api.compareSnapshots(manyOld, manyNew);
assert.equal(comparison.events.length, 0); assert.equal(comparison.notices.length, 1);
console.log('PASS canonical stamp fingerprints, baseline validation and single legacy limitation');
