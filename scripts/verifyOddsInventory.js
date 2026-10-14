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

// Published row keys contain a changing manifest hash. A new capture must keep
// an unambiguous native game selection and use that capture's new object/key.
const inventoryCode = transformSync(readFileSync(new URL('../src/OddsInventory.tsx', import.meta.url), 'utf8'),
  { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code;
const uiContext = { exports: {}, module: { exports: {} }, require: name => {
  assert.ok(['react','react/jsx-runtime','./oddsInventoryData'].includes(name)); return {};
} };
uiContext.exports = uiContext.module.exports;
vm.runInNewContext(inventoryCode, uiContext);
for (const [raw, shown] of [['2.650','2.65'], ['3.000','3'], ['10','10'], ['-3.500','-3.5'],
  ['0.000','0'], ['1.714285714000','1.714285714'],
  ['2.05000000000000000000000000100','2.050000000000000000000000001'], [null,'\u2014']]) {
  assert.equal(uiContext.module.exports.trimDecimal(raw), shown, 'Display trimming preserves every nonzero source digit');
}
const previous = { key: 'old-manifest-event', book: 'betmgm_ca_on', source_event_id: '6:43582', sport: 'Football', object: 'old-object' };
const next = { ...previous, key: 'new-manifest-event', object: 'new-object' };
const update = uiContext.module.exports.updatedEvent;
assert.equal(update([next], previous), next, 'A changed manifest keeps the native game and switches to its current object');
assert.equal(update([next,{ ...next, key: 'ambiguous-manifest' }], previous), null, 'Ambiguous source identities cannot preserve a selected game');
assert.equal(update([{ ...next, book: 'betrivers_ca_on' }], previous), null);
assert.equal(update([{ ...next, sport: 'Basketball' }], previous), null);
assert.equal(update([{ ...next, source_event_id: 'different-event' }], previous), null);
assert.equal(update([{ ...next, source_event_id: undefined }], { ...previous, source_event_id: undefined }), null);
console.log('Inventory UI passed: automatic captures preserve only a unique native game identity.');

// Exercise pagination through the actual component when an automatic capture
// replaces a selected game's 90 matching offers with only two.
const sourceBook = { key: 'betrivers_ca_on', name: 'BetRivers', counts: {}, warnings: [] };
const oldGame = { key: 'old-hash:event', book: sourceBook.key, source_event_id: 'event', sport: 'Football',
  name: 'Home v Away', competition: 'NFL', object: 'old-object', markets: 90, positions: 90 };
const newGame = { ...oldGame, key: 'new-hash:event', object: 'new-object', markets: 2, positions: 2 };
let inventory = { snapshot_id: 'old', events: [oldGame], books: [sourceBook], totals: { events: 1, markets: 90, positions: 90 } };
let cursor = 0;
const slots = [], effects = [];
const sameDeps = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
const hooks = {
  useState(value) {
    const i = cursor++; if (!(i in slots)) slots[i] = value;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
  },
  useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
  useMemo(fn) { cursor++; return fn(); },
  useEffect(fn, deps) {
    const i = cursor++, old = slots[i]; if (old && sameDeps(old.deps,deps)) return;
    const next = { deps }; slots[i] = next;
    effects.push(() => { old?.cleanup?.(); next.cleanup = fn(); });
  },
};
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const componentContext = { exports: {}, module: { exports: {} }, AbortController, require: name => {
  if (name === 'react') return hooks;
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
  assert.equal(name, './oddsInventoryData');
  return { loadInventory: async () => inventory,
    loadMarkets: async (_catalogue, game) => Array.from({ length: game.markets }, (_,i) => ({
      id: String(i), name: `Winner ${i}`, kind: 'straight', variant: '', native_context: '{}', selections: [],
    })) };
} };
componentContext.exports = componentContext.module.exports;
vm.runInNewContext(inventoryCode, componentContext);
const render = (revision = 0) => {
  cursor = 0; const tree = componentContext.module.exports.default({ revision });
  while (effects.length) effects.shift()(); return tree;
};
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const button = (tree, name) => find(tree, n => n.type === 'button' && n.props.children === name);
const cardCount = tree => nodes(tree).filter(n => typeof n.type === 'function' && n.type.name === 'MarketCard').length;
const settle = async (revision = 0) => {
  for (let i = 0; i < 4; i++) { render(revision); await new Promise(resolve => setImmediate(resolve)); }
  return render(revision);
};
let tree = await settle();
find(tree, n => n.type === 'button' && nodes(n.props.children).some(child => child.props?.children === oldGame.name)).props.onClick();
tree = await settle();
find(tree, n => n.type === 'input' && n.props.placeholder.startsWith('Passing yards')).props.onChange({ target: { value: 'Winner' } });
tree = await settle();
for (let i = 0; i < 2; i++) { button(tree, 'Next markets').props.onClick(); tree = await settle(); }
assert.equal(cardCount(tree), 30);
assert.ok(nodes(tree).some(n => n.type === 'span' && JSON.stringify(n.props.children) === '[3," / ",3]'));
inventory = { ...inventory, snapshot_id: 'new', events: [newGame] };
tree = await settle(1);
assert.equal(cardCount(tree), 2, 'A shrinking capture still displays every matching offer');
assert.equal(find(tree, n => n.type === 'input' && n.props.placeholder.startsWith('Passing yards')).props.value, 'Winner');
assert.equal(button(tree, 'Previous markets').props.disabled, true);
assert.equal(button(tree, 'Next markets').props.disabled, true);
assert.ok(nodes(tree).some(n => n.type === 'h2' && n.props.children === oldGame.name));
console.log('Inventory pagination passed: a replacement capture clamps the page while retaining the game and search.');
