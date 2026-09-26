import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { buildSync } from 'esbuild';
import { stockDashboardFixture } from './fixtures/stockDashboard.js';
const source = readFileSync(new URL('../src/OwnerStocks.tsx', import.meta.url), 'utf8');
assert(source.includes('const planAuthority:'), 'Missing actual-helper plan authority');
const built = buildSync({ stdin: { contents: `${source}\nexport { planAuthority, orderGroups, fundingSummary };\nexport { changePair, compareSnapshots };`, resolveDir: new URL('../src/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, write: false, logLevel: 'silent' });
const mod = new Module(new URL('./changes-test.cjs', import.meta.url).pathname); mod._compile(built.outputFiles[0].text, mod.id);
const { planAuthority, orderGroups, fundingSummary, changePair, compareSnapshots } = mod.exports;
const current = structuredClone(stockDashboardFixture().routes.pc_playbook[0]);
function complete(row, date) { row.as_of = date; Object.assign(row.today, { as_of: date, ticket_as_of: date, comparison_meta: { schema_version: 1, ticket_status: 'ok', watch_status: 'ok', source_as_of: date } }); for (const key of ['sells','trims','buys','watch','unfunded','not_fillable']) row.today[key] ??= []; return row; }
complete(current, '2026-09-25'); const previous = complete(structuredClone(current), '2026-09-24');
delete current.today.funding.raised_cad; delete current.today.funding.shortfall_cad;
const selected = orderGroups(current.today).flatMap(group => group.lines);
selected[0].qty = 0; selected[0].limit_local = 0.000123456789;
// A different route for the same selected BUY remains the same proposal identity.
const selectedBuy = orderGroups(current.today).find(group => group.key === 'buys').lines[0];
for (const line of previous.today.buys.filter(line => line.ticker === selectedBuy.ticker)) { line.market_order = false; line.kind = 'NEW'; }
selectedBuy.market_order = true; selectedBuy.funded = true;
previous.today.sells[0].qty = null;
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
freeze(current); freeze(previous);
let calls = 0;
const pair = changePair('plan', [current, previous], 'ok', '2026-09-26', row => { calls++; return planAuthority(row); });
assert.equal(pair.state, 'ready'); assert.equal(calls, 2);
assert.equal(pair.current.selectedOrders.length, selected.length);
assert.equal(pair.current.selectedOrders.filter(o => o.action === 'BUY').length, new Set(pair.current.selectedOrders.filter(o => o.action === 'BUY').map(o => o.subjectId)).size);
for (const snapshot of [pair.current, pair.previous]) { const raw = snapshot === pair.current ? current : previous; const funding = fundingSummary(raw.today, orderGroups(raw.today)); assert.deepEqual(snapshot.normalizedFunding, funding && { raised: funding.raised, needed: funding.needed, gap: funding.gap }); }
assert.equal(pair.current.selectedOrders[0].qty, 0); assert.equal(pair.current.selectedOrders[0].localLimit, 0.000123456789);
assert.equal(pair.current.selectedOrders[0].id, pair.previous.selectedOrders[0].id);
for (const group of orderGroups(current.today)) for (const line of group.lines) {
  const order = pair.current.selectedOrders.find(order => order.id === `${group.label}:${line.ticker}`);
  assert.equal(order.amountCad, line.est_cad ?? null); assert.equal(order.qty, line.qty ?? null);
  assert.equal(order.localLimit, line.limit_local ?? null); assert.equal(order.currency, line.currency ?? null);
  if (line.why) assert(order.reason.includes(line.why));
  if (line.reason_kind === 'funding') assert(order.reason.startsWith('Funding sale'));
  if (line.reason_kind === 'exit_rule') assert(order.reason.startsWith('Exit rule'));
}
const unknownFunding = structuredClone(current); unknownFunding.today.funding = {};
const unknownPair = changePair('plan', [unknownFunding], 'ok', '2026-09-26', planAuthority);
assert.deepEqual(unknownPair.current.normalizedFunding, { raised: null, needed: null, gap: null });
const zeroFunding = structuredClone(current); zeroFunding.today.funding = { raised_cad: 0, needed_cad: 0, shortfall_cad: 0 };
assert.deepEqual(changePair('plan', [zeroFunding], 'ok', '2026-09-26', planAuthority).current.normalizedFunding, { raised: 0, needed: 0, gap: 0 });
const comparison = await compareSnapshots(pair.previous, pair.current);
assert.equal(comparison.status, 'ready'); assert(comparison.events.some(e => e.entity === `proposal:BUY:${selectedBuy.ticker}` && e.field === 'route'), 'Route revisions use the same stable BUY ID'); assert(comparison.events.some(e => e.field === 'qty' && e.before === null && e.after === 0)); assert(comparison.events.some(e => e.field === 'localLimit' && e.after === 0.000123456789));
let invalidCalls = 0; const invalid = structuredClone(previous); delete invalid.today.comparison_meta;
assert.equal(changePair('plan', [current, invalid], 'ok', '2026-09-26', () => { invalidCalls++; throw Error(); }).state, 'unavailable'); assert.equal(invalidCalls, 0);
console.log('PASS actual helper integration: both rows, exclusive buys, normalized funding fallback, stable IDs, null/zero, local precision, frozen inputs, preflight before authority, real comparator');
