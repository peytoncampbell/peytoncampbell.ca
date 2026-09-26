import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/stockInsightData.ts');
assert(existsSync(source), 'The snapshot-bound insights adapter must exist');
const code = buildSync({ entryPoints: [source], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const compiled = new Module(source);
compiled.filename = source;
compiled.paths = Module._nodeModulePaths(root);
compiled._compile(code, source);
const api = compiled.exports;
const snapshot = { as_of: '2026-09-25', generated_at: '2026-09-25T12:00:00.123456+00:00' };
assert.equal(typeof api.insightsPath, 'function');
const path = api.insightsPath(snapshot);
const query = new URL(path, 'https://synthetic.invalid/rest/v1/');
assert.equal(query.pathname, '/rest/v1/pc_playbook');
assert.equal(query.searchParams.get('select'), 'as_of,generated_at,insights');
assert.equal(query.searchParams.get('as_of'), `eq.${snapshot.as_of}`);
assert.equal(query.searchParams.get('generated_at'), `eq.${snapshot.generated_at}`, 'Preserve exact sub-millisecond snapshot identity');
assert.equal(query.searchParams.get('limit'), '1');
for (const invalid of [null, {}, { ...snapshot, generated_at: null }, { ...snapshot, generated_at: 'invalid' }, { ...snapshot, as_of: '2026-02-30' }]) {
  assert.equal(api.insightsPath(invalid), null, 'Invalid or legacy snapshot identity cannot request a guessed history');
}
console.log('PASS explicit lazy history query is bound to exact date and publication identity');

const series = {
  status: 'ok', instrument_id: 'Yahoo Finance:ABC.NE:CAD', listing_symbol: 'ABC.NE', underlying_symbol: 'ABC', currency: 'CAD',
  source: 'Yahoo Finance', adjustment_basis: 'provider-adjusted close', fetched_at: '2026-09-26T10:00:01Z',
  coverage_start: '2026-09-23', coverage_end: '2026-09-25', timezone: 'America/Toronto',
  observations: [{ date: '2026-09-23', value: 0 }, { date: '2026-09-24', value: null }, { date: '2026-09-25', value: 12.34567 }],
};
const envelope = { schema_version: 1, as_of: snapshot.as_of, snapshot_generated_at: snapshot.generated_at, generated_at: '2026-09-26T10:00:00Z', series: { ABC: series } };
const row = { ...snapshot, insights: envelope };
assert.equal(typeof api.publishedPrice, 'function');
const now = Date.parse('2026-09-26T12:00:00Z');
const read = (rows = [row], expected = snapshot, ticker = 'ABC', currency = 'CAD') => api.publishedPrice(rows, expected, ticker, currency, now);
const before = JSON.stringify(row);
const result = read();
assert.equal(result.state, 'ready');
assert.deepEqual(result.identity, { instrumentId: series.instrument_id, listingSymbol: 'ABC.NE', underlyingSymbol: 'ABC', currency: 'CAD' });
assert.deepEqual(result.history.observations, series.observations, 'Keep real zero, null gap and source precision');
assert.equal(JSON.stringify(row), before, 'Never mutate published history');
for (const rows of [null, [], [row, row], [{ ...row, as_of: '2026-09-24' }],
  [{ ...row, generated_at: '2026-09-25T12:00:00.123457+00:00' }],
  [{ ...row, insights: null }], [{ ...row, insights: { ...envelope, schema_version: 2 } }],
  [{ ...row, insights: { ...envelope, as_of: '2026-09-24' } }],
  [{ ...row, insights: { ...envelope, generated_at: 'invalid' } }],
  [{ ...row, insights: { ...envelope, series: [] } }],
  [{ ...row, insights: { ...envelope, series: { ABC: { ...series, observations: [{ date: 'bad', value: 5 }] } } } }],
]) {
  const unavailable = read(rows);
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(unavailable.history, null);
  assert.equal(unavailable.identity, null);
  assert(unavailable.message, 'Explain each unavailable state');
}
assert.equal(read([row], {}, 'ABC', 'CAD').state, 'unavailable');
assert.equal(read([row], snapshot, 'abc', 'CAD').state, 'unavailable', 'Do not normalize a different ticker into this listing');
assert.equal(read([row], snapshot, 'ABC', 'USD').state, 'unavailable', 'Never substitute another currency');
assert.equal(read([row], snapshot, 'ABC', null).state, 'unavailable', 'Do not guess an unpublished quote currency');
const unpublished = read([{ ...row, insights: { ...envelope, series: { ABC: { ...series, status: 'unavailable', reason: 'currency_mismatch' } } } }]);
assert.equal(unpublished.state, 'unavailable');
assert.match(unpublished.message, /currency_mismatch/);
console.log('PASS exact snapshot envelope, published listing/currency and real series validation');

for (const stamp of [undefined, null, '2026-09-25T12:00:00.123455+00:00', '2026-09-25T11:00:00Z']) {
  const stale = read([{ ...row, insights: { ...envelope, snapshot_generated_at: stamp } }]);
  assert.equal(stale.state, 'unavailable', 'A retained insights column cannot adopt a newer same-day financial version');
}
assert.equal(read().state, 'ready');
console.log('PASS retained same-day insights requires its exact original financial publication stamp');

for (const patch of [
  { generated_at: '2026-09-26T13:00:00Z' },
  { generated_at: '2026-09-25T11:00:00Z' },
  { series: { ABC: { ...series, fetched_at: '2026-09-26T13:00:00Z' } } },
  { series: { ABC: { ...series, fetched_at: '2026-09-26T09:00:00Z' } } },
  { generated_at: '2026-09-26T00:00:00Z', series: { ABC: { ...series, fetched_at: '2026-09-26T00:30:00Z', coverage_end: '2026-09-26', observations: [...series.observations, { date: '2026-09-26', value: 14 }] } } },
]) {
  assert.equal(read([{ ...row, insights: { ...envelope, ...patch } }]).state, 'unavailable', 'Reject impossible build/fetch chronology or observations after the provider-local fetch date');
}
for (const invalidNow of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
  assert.equal(api.publishedPrice([row], snapshot, 'ABC', 'CAD', invalidNow).state, 'unavailable', 'Invalid now fails closed');
}
for (const equivalentStamp of ['2026-09-25T12:00:00.123456Z', '2026-09-25T08:00:00.123456-04:00', '2026-09-25T12:00:00.1234560+00:00']) {
  assert.equal(read([{ ...row, generated_at: equivalentStamp }]).state, 'unavailable', 'Outer snapshot binding is exact, not instant equality');
  assert.equal(read([{ ...row, insights: { ...envelope, snapshot_generated_at: equivalentStamp } }]).state, 'unavailable', 'Envelope financial binding is exact, not instant equality');
}
for (const malformed of ['invalid', '2026-02-30T12:00:00.123456Z', '2026-09-25T12:00:00.123456', '2026-09-25T12:00:00.123456+24:00']) {
  assert.equal(read([{ ...row, insights: { ...envelope, generated_at: malformed } }]).state, 'unavailable');
  assert.equal(read([{ ...row, insights: { ...envelope, series: { ABC: { ...series, fetched_at: malformed } } } }]).state, 'unavailable');
}
const tooMany = Array.from({ length: 401 }, (_, index) => ({ date: new Date(Date.parse('2026-09-25') - (400 - index) * 86400000).toISOString().slice(0, 10), value: index }));
const oversized = { ...series, observations: tooMany, coverage_start: tooMany[0].date, coverage_end: tooMany.at(-1).date };
assert.equal(read([{ ...row, insights: { ...envelope, series: { ABC: oversized } } }]).state, 'unavailable', 'The publisher contract caps each listing at 400 observations');
assert.equal(read().state, 'ready', 'Weekend endpoints remain useful; do not invent a trading-calendar freshness rule');
console.log('PASS bounded published observations, fetch chronology and provider-local future-date rejection');

const precisionCases = [
  ['exact equality', '2026-09-25T12:00:00.123456Z', '2026-09-25T12:00:00.123456Z', '2026-09-25T12:00:00.123456Z', 'ready'],
  ['equal differing fractional lengths', '2026-09-25T12:00:00.1234Z', '2026-09-25T12:00:00.123400Z', '2026-09-25T12:00:00.123400000Z', 'ready'],
  ['absent fraction equals zero', '2026-09-25T12:00:00Z', '2026-09-25T12:00:00.0Z', '2026-09-25T12:00:00.000000Z', 'ready'],
  ['one microsecond ascending', '2026-09-25T12:00:00.123455Z', '2026-09-25T12:00:00.123456Z', '2026-09-25T12:00:00.123457Z', 'ready'],
  ['unequal differing fractional lengths', '2026-09-25T12:00:00.1234001Z', '2026-09-25T12:00:00.1234Z', '2026-09-25T12:00:00.1235Z', 'unavailable'],
  ['beyond numeric fractional precision', '2026-09-25T12:00:00.12345678901234567891Z', '2026-09-25T12:00:00.12345678901234567890Z', '2026-09-25T12:00:00.123457Z', 'unavailable'],
  ['offset equivalent instants', '2026-09-25T12:00:00.123456Z', '2026-09-25T17:30:00.123456+05:30', '2026-09-25T08:00:00.123456-04:00', 'ready'],
  ['offset crossing date boundary equality', '2026-09-25T23:30:00.123456Z', '2026-09-26T01:30:00.123456+02:00', '2026-09-25T19:30:00.123456-04:00', 'ready'],
  ['offset crossing date boundary reversal', '2026-09-25T23:30:00.123456Z', '2026-09-26T01:30:00.123455+02:00', '2026-09-25T19:30:00.123457-04:00', 'unavailable'],
  ['offset fetch reversal', '2026-09-25T23:30:00.123455Z', '2026-09-26T01:30:00.123457+02:00', '2026-09-25T19:30:00.123456-04:00', 'unavailable'],
  ['build beyond millisecond now', '2026-09-26T12:00:00.123Z', '2026-09-26T12:00:00.123001Z', '2026-09-26T12:00:00.123002Z', 'unavailable', Date.parse('2026-09-26T12:00:00.123Z')],
  ['fetch beyond millisecond now', '2026-09-26T12:00:00.123Z', '2026-09-26T12:00:00.123Z', '2026-09-26T12:00:00.123001Z', 'unavailable', Date.parse('2026-09-26T12:00:00.123Z')],
  ['equal millisecond now', '2026-09-26T12:00:00.123Z', '2026-09-26T12:00:00.123000Z', '2026-09-26T08:00:00.1230000-04:00', 'ready', Date.parse('2026-09-26T12:00:00.123Z')],
  ['build one microsecond before snapshot', '2026-09-25T12:00:00.123456Z', '2026-09-25T12:00:00.123455Z', '2026-09-25T12:00:00.123456Z', 'unavailable'],
  ['fetch one microsecond before build', '2026-09-25T12:00:00.123456Z', '2026-09-25T12:00:00.123457Z', '2026-09-25T12:00:00.123456Z', 'unavailable'],
];
const precisionFailures = [];
for (const [name, snapshotAt, buildAt, fetchedAt, state, bound = now] of precisionCases) {
  const expected = { ...snapshot, generated_at: snapshotAt };
  const payload = [{ ...expected, insights: { ...envelope, snapshot_generated_at: snapshotAt, generated_at: buildAt, series: { ABC: { ...series, fetched_at: fetchedAt } } } }];
  const original = JSON.stringify(payload);
  const actual = api.publishedPrice(payload, expected, 'ABC', 'CAD', bound);
  try {
    assert.equal(actual.state, state, name);
    assert.equal(JSON.stringify(payload), original, `${name}: input remains unchanged`);
    if (state === 'unavailable') {
      assert.equal(actual.history, null);
      assert.equal(actual.identity, null);
      assert.match(actual.message, /chronology/);
    } else {
      assert.equal(actual.history.fetchedAt, fetchedAt, 'Keep original timestamp precision and zone');
    }
    console.log(`PASS precision: ${name}`);
  } catch (error) {
    precisionFailures.push(`${name}: expected ${state}, actual ${actual.state}; ${error.message}`);
  }
}
assert.deepEqual(precisionFailures, [], precisionFailures.join('\n'));
