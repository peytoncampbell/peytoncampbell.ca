import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/StockEvidence.tsx');
assert(existsSync(source), 'The real evidence presentation component must exist');
const code = buildSync({ entryPoints: [source], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom/server'], loader: { '.css': 'empty' } }).outputFiles[0].text;
const compiled = new Module(source);
compiled.filename = source;
compiled.paths = Module._nodeModulePaths(root);
compiled._compile(code, source);
const { StockNewsEvidence, PublishedCallEvaluation } = compiled.exports;
const row = (overrides = {}) => ({ as_of: '2026-09-25', generated_at: '2026-09-26T02:00:00Z', summary: 'Global desk text must not leak', tickers: [{ ticker: 'TEST', read: 'Latest ticker-specific read', sentiment: 'neutral' }], stories: [], ...overrides });
const news = rows => renderToStaticMarkup(createElement(StockNewsEvidence, { ticker: 'TEST', rows }));
const html = news([row({ as_of: '2026-09-24', tickers: [{ ticker: 'TEST', read: 'Older read' }] }), row(), row({ as_of: '2026-09-26', tickers: [{ ticker: 'OTHER', read: 'Other stock read' }] })]);
assert.match(html, /Generated desk summary/);
assert.match(html, /Latest ticker-specific read/);
assert.match(html, /Source snapshot:.*2026-09-25/);
assert(!/Older read|Other stock read|Global desk text|2026-09-26T02:00/.test(html));
assert.match(news([row({ tickers: [] })]), /No generated desk summary published for TEST/);
assert.match(news([]), /No cited articles published for TEST/);
console.log('PASS wire ticker summary and source snapshot stay separate from global summary and publication dates');

const story = (overrides = {}) => ({ ticker: 'TEST', title: 'Recent article', url: 'https://example.test/recent', source: 'Synthetic Wire', published: '2026-09-24T09:30:00-04:00', image: null, ...overrides });
const articles = news([
  row({ stories: [story({ title: 'Older article', url: 'https://example.test/old', published: '2026-09-23T10:00:00Z' }), story({ ticker: 'TEST.X', title: 'Wrong listing' }), story({ title: 'Undated article', url: 'https://example.test/undated', published: null }), story({ title: 'Unsafe readable article', url: 'javascript:alert(1)', published: null })] }),
  row({ stories: [story(), story({ title: 'Recent article', published: '2026-09-23T09:30:00-04:00' }), ...Array.from({ length: 12 }, (_, index) => story({ title: `Extra headline ${index}`, url: `https://example.test/extra/${index}`, published: '2026-09-22T12:00:00Z' }))] }),
]);
assert.match(articles, /Recent article/);
assert.equal((articles.match(/Recent article/g) || []).length, 1, 'Deduplicate across snapshots through normalizeNews');
assert(!articles.includes('Wrong listing'));
assert(articles.indexOf('Recent article') < articles.indexOf('Older article'));
assert(articles.indexOf('Older article') < articles.indexOf('Publication date unavailable'));
assert(articles.indexOf('Extra headline 11') < articles.indexOf('Publication date unavailable'));
assert.match(articles, /2026-09-24T09:30:00-04:00/);
assert.match(articles, /Synthetic Wire/);
assert.match(articles, /target="_blank" rel="noopener noreferrer"/);
assert.match(articles, /Unsafe readable article/);
assert(!articles.includes('javascript:') && !articles.includes('<img'));
assert(!articles.includes('2026-09-26T02:00:00Z'));
console.log('PASS all exact-ticker articles aggregate, dedupe, sort by publication, preserve zones, keep unsafe text and undated group last');

assert.equal(typeof PublishedCallEvaluation, 'function', 'PublishedCallEvaluation export must exist');
const evaluation = { rule_version: 'synthetic-rule-v1', as_of: '2026-09-25', call: 'Hold', conditions: [
  { label: 'Published rating condition', observed: 80, operator: '<', threshold: 60, status: 'met' },
  { label: 'Published weekly count', observed: 2, operator: '>=', threshold: 3, status: 'reported' },
  { label: 'Missing reading', observed: null, operator: '<=', threshold: null, status: 'unknown' },
  { label: 'Zero reading', observed: 0, operator: '<', threshold: 10, status: 'not_met' },
], streak_verified: false, note: 'Synthetic published disclaimer; no independently verified streak.' };
const call = (value, overrides = {}) => renderToStaticMarkup(createElement(PublishedCallEvaluation, { evaluation: value, expectedAsOf: '2026-09-25', expectedCall: 'Hold', ...overrides }));
const evaluated = call(evaluation);
assert.match(evaluated, /Published rating condition/);
assert.match(evaluated, /Observed: 80/);
assert.match(evaluated, /&lt; 60/);
assert.match(evaluated, /Status: met/); // Deliberately contradicts arithmetic: render published status, never recompute.
assert.match(evaluated, /Published qualifying readings/);
assert.match(evaluated, /Published weekly count/);
assert.match(evaluated, /Status: reported/);
assert.match(evaluated, /not verified consecutive weeks/);
assert(evaluated.indexOf('not verified consecutive weeks') < evaluated.indexOf('<details'));
assert.match(evaluated, /Observed: unavailable/);
assert.match(evaluated, /&lt;= unavailable/);
assert.match(evaluated, /Observed: 0/);
assert.match(evaluated, /Status: not_met/);
assert.match(evaluated, /synthetic-rule-v1/);
assert.match(evaluated, /Synthetic published disclaimer/);
assert.match(evaluated, /2026-09-25/);
const unavailable = /Detailed conditions not published for this call/;
for (const invalid of [undefined, null, [], {}, { ...evaluation, as_of: '2026-09-24' }, { ...evaluation, call: 'Sell' }, { ...evaluation, as_of: '2026-02-30' }, { ...evaluation, rule_version: {} }, { ...evaluation, note: {} }, { ...evaluation, streak_verified: true }, { ...evaluation, conditions: [] }, { ...evaluation, conditions: [null] }]) {
  assert.match(call(invalid), unavailable);
}
for (const field of ['observed', 'threshold']) for (const value of [Infinity, NaN, '2', {}, undefined]) {
  assert.match(call({ ...evaluation, conditions: [{ ...evaluation.conditions[0], [field]: value }] }), unavailable);
}
for (const change of [{ label: {} }, { status: 'confirmed' }, { operator: '>' }]) {
  assert.match(call({ ...evaluation, conditions: [{ ...evaluation.conditions[0], ...change }] }), unavailable);
}
assert.match(call(evaluation, { expectedCall: 'hold' }), unavailable);
assert.match(call(evaluation, { expectedAsOf: '2026-09-26' }), unavailable);
console.log('PASS published conditions preserve labels, values, operators and status; matching stamps, finite/null inputs and reported limitations enforced');

const cssPath = resolve(root, 'src/StockEvidence.css');
assert(existsSync(cssPath), 'Scoped evidence typography must exist');
const css = readFileSync(cssPath, 'utf8');
assert.match(css, /14px/);
assert.match(css, /12px/);
assert.match(css, /IBM Plex Sans/);
assert.match(css, /var\(--sd-/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert(!/overflow(?:-y)?:\s*(auto|scroll)|max-height|line-clamp/.test(css), 'Parent remains sole scroll surface; evidence never truncates');
assert.match(readFileSync(source, 'utf8'), /import '\.\/StockEvidence.css'/);
console.log('PASS scoped typography, natural wrapping and no nested scrolling or clipping');
