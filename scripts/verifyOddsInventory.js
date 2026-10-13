// Exercise the browser's actual hash/gzip/identity boundary with synthetic data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const code = transformSync(readFileSync(new URL('../src/oddsInventoryData.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'cjs' }).code;
const id = 'a'.repeat(24);
const path = 'betrivers_ca_on/ab.jsonl.gz';
const event = { key: 'native-game', object: path, markets: 1, positions: 1 };
const market = { id: 'native-market', name: 'Total', kind: 'straight', native_context: '{}',
  selections: [{ id: 'native-selection', label: 'Over', price: '1.714', offered_price: '1.714285714',
    point: '-3.500', pricing_verified: true, source_position: 0 }] };
const pack = value => gzipSync(value, { mtime: 0 });
const digest = raw => createHash('sha256').update(raw).digest('hex');

function harness({ records = [{ key: event.key, markets: [market] }], metadata = {}, pointer = {}, missing = false,
  boardHtml, boardMetadata = {} } = {}) {
  const raw = pack(records.map(row => JSON.stringify(row)).join('\n') + '\n');
  const catalogue = { schema: 1, snapshot_id: id, books: [], events: [event],
    objects: { [path]: { sha256: digest(raw), bytes: raw.length, decoded_bytes: 0, ...metadata } } };
  const catalogRaw = pack(JSON.stringify(catalogue));
  const current = { schema: 1, snapshot_id: id, catalogue: `snapshots/${id}/catalogue.json.gz`,
    sha256: digest(catalogRaw), bytes: catalogRaw.length, ...pointer };
  const boardRaw = boardHtml === undefined ? null : pack(boardHtml);
  if (boardRaw) current.board = { path: `snapshots/${id}/opportunities.html.gz`, sha256: digest(boardRaw),
    bytes: boardRaw.length, generated_at: '2026-10-13T18:00:00+00:00', ...boardMetadata };
  const requests = [];
  const context = { exports: {}, module: { exports: {} }, crypto: webcrypto, Blob, DecompressionStream,
    TextDecoder, DOMException, console,
    require: name => { assert.equal(name, './ownerAuth'); return { SUPABASE_URL: 'https://synthetic.invalid' }; },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (url.endsWith('/current.json')) return new Response(missing ? '' : JSON.stringify(current), { status: missing ? 404 : 200 });
      if (url.endsWith('/catalogue.json.gz')) return new Response(catalogRaw);
      if (url.endsWith('/opportunities.html.gz')) return new Response(boardRaw);
      assert.ok(url.endsWith('/' + path));
      return new Response(raw);
    } };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return { ...context.module.exports, catalogue, requests };
}

const signal = new AbortController().signal;
const good = harness();
const catalog = await good.loadInventory(signal);
assert.equal(good.requests[0].options.cache, 'no-store');
const loaded = await good.loadMarkets(catalog, event, signal);
assert.equal(loaded[0].selections[0].price, '1.714');
assert.equal(loaded[0].selections[0].offered_price, '1.714285714');
assert.equal(loaded[0].selections[0].point, '-3.500');
for (const [configuration, error] of [
  [{ metadata: { sha256: '0'.repeat(64) } }, /integrity check/],
  [{ metadata: { bytes: 1 } }, /unexpected size/],
  [{ records: [{ key: 'other-game', markets: [market] }] }, /identity/],
  [{ records: [{ key: event.key, markets: [market] }, { key: event.key, markets: [market] }] }, /ambiguous/],
  [{ records: [{ key: event.key, markets: [] }] }, /every captured selection/],
]) {
  const bad = harness(configuration);
  await assert.rejects(() => bad.loadMarkets(bad.catalogue, event, signal), error);
}
const badPath = harness();
await assert.rejects(() => badPath.loadMarkets({ ...badPath.catalogue, snapshot_id: '../escape' }, event, signal), /location/);
assert.equal(badPath.requests.length, 0);
const duplicateSelection = harness({ records: [{ key: event.key, markets: [{ ...market,
  selections: [market.selections[0], market.selections[0]] }] }] });
await assert.rejects(() => duplicateSelection.loadMarkets(duplicateSelection.catalogue, { ...event, positions: 2 }, signal), /source position/);
const missingPosition = harness({ records: [{ key: event.key, markets: [{ ...market,
  selections: [{ ...market.selections[0], source_position: 1 }] }] }] });
await assert.rejects(() => missingPosition.loadMarkets(missingPosition.catalogue, event, signal), /original captured source position/);
await assert.rejects(() => harness({ pointer: { snapshot_id: 'b'.repeat(24) } }).loadInventory(signal), /snapshot/);
await assert.rejects(() => harness({ missing: true }).loadInventory(signal), /not been published/);
const aborted = new AbortController(); aborted.abort();
await assert.rejects(() => good.loadMarkets(catalog, event, aborted.signal), { name: 'AbortError' });
assert.equal(await harness().loadNativeBoard(signal), null, 'The preceding capture archive still supports its legacy board');
const nativeHtml = `<meta name="odds-native-snapshot" content="${id}"><p>Pending verification</p>`;
const nativeBoard = await harness({ boardHtml: nativeHtml }).loadNativeBoard(signal);
assert.equal(nativeBoard.html, nativeHtml);
assert.equal(nativeBoard.snapshotId, id);
for (const [configuration, error] of [
  [{ boardHtml: nativeHtml, boardMetadata: { sha256: '0'.repeat(64) } }, /integrity/],
  [{ boardHtml: nativeHtml, boardMetadata: { path: `snapshots/${'b'.repeat(24)}/opportunities.html.gz` } }, /identity/],
  [{ boardHtml: nativeHtml, boardMetadata: { generated_at: '2026-10-13T18:00:00' } }, /identity/],
  [{ boardHtml: '<p>Another snapshot</p>' }, /another inventory/],
]) await assert.rejects(() => harness(configuration).loadNativeBoard(signal), error);
await assert.rejects(() => harness({ boardHtml: nativeHtml }).loadNativeBoard(aborted.signal), { name: 'AbortError' });
console.log('Odds inventory passed: exact prices/lines, hash/size, game identity/counts, location and aborted requests.');
