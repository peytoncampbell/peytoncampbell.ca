#!/usr/bin/env node
// Exercise the actual Odds component with deferred board transport and React hook slots.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/Odds.tsx', import.meta.url), 'utf8');
const code = transformSync(source
  .replace(/import \{[^}]+\} from 'react';/,
    'const { useCallback, useEffect, useRef, useState } = globalThis.hooks;')
  .replace(/import \{[^}]+\} from '\.\/ownerAuth';/,
    'const { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } = globalThis.config;')
  .replace(/import \{[^}]+\} from '\.\/oddsRefresh';/,
    'const { submitRefresh, watchRefresh } = globalThis.refreshApi;'),
  { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code;

const job = '00000000-0000-4000-8000-000000000001';
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const board = html => ({ ok: true, status: 200,
  json: async () => [{ html, generated_at: '2026-10-10T12:00:00Z' }] });
const flush = () => new Promise(resolve => setImmediate(resolve));
const sameDeps = (a, b) => a && b && a.length === b.length &&
  a.every((value, index) => Object.is(value, b[index]));

function harness(fastBoard = null, continuousBoard = null) {
  const slots = [], effects = [], boardRequests = [], watched = [];
  const deadlines = new Map(); let timerId = 0;
  const intervals = new Map();
  let cursor = 0, unmounted = false, writesAfterUnmount = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => {
        if (unmounted) writesAfterUnmount++;
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || !sameDeps(previous.deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (previous && sameDeps(previous.deps, deps)) return;
      const next = { deps, cleanup: null };
      slots[index] = next;
      effects.push(() => {
        previous?.cleanup?.();
        next.cleanup = fn();
      });
    },
  };
  const element = (type, props, key) => ({ type, props: props ?? {}, key });
  const context = {
    hooks, exports: {}, module: { exports: {} }, AbortController, DOMException, Date,
    setTimeout: fn => { const id = ++timerId; deadlines.set(id, fn); return id; },
    clearTimeout: id => deadlines.delete(id),
    setInterval: fn => { const id = ++timerId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    config: { AUTH_CONFIGURED: true, SUPABASE_URL: 'https://synthetic.supabase.invalid',
      SUPABASE_ANON_KEY: 'SYNTHETIC-PUBLIC-KEY' },
    require: name => {
      if (name === './OddsInventory') return { __esModule: true, default: 'native-inventory' };
      if (name === './oddsInventoryData') return { loadNativeBoard: async () => null };
      assert.equal(name, 'react/jsx-runtime');
      return { jsx: element, jsxs: element, Fragment: 'fragment' };
    },
    fetch: (url, options) => {
      if (url.includes('/pc_odds_continuous_board?')) {
        assert.equal(url, 'https://synthetic.supabase.invalid/rest/v1/pc_odds_continuous_board?select=job_id,generated_at,html&id=eq.1&limit=1');
        return Promise.resolve({ ok: true, json: async () => continuousBoard ? [continuousBoard] : [] });
      }
      if (url.includes('/pc_odds_fast_board?')) {
        assert.equal(url, 'https://synthetic.supabase.invalid/rest/v1/pc_odds_fast_board?select=job_id,generated_at,html&id=eq.1&limit=1');
        if (fastBoard) return Promise.resolve({ ok: true, json: async () => [fastBoard] });
        // A completed refresh must load its own dedicated row, not fall back.
        if (watched.length) {
          const pending = deferred();
          boardRequests.push({ ...pending, options });
          return pending.promise;
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      assert.equal(url,
        'https://synthetic.supabase.invalid/rest/v1/pc_odds?select=generated_at,html&id=eq.1&limit=1');
      const pending = deferred();
      boardRequests.push({ ...pending, options });
      // Intentionally allow a late result after abort: lifecycle guards must still reject it.
      return pending.promise;
    },
    refreshApi: {
      submitRefresh: async pin => {
        assert.equal(pin, '000000', 'Only a synthetic PIN is used by this offline test');
        return { state: 'queued', job_id: job };
      },
      watchRefresh: (id, onStatus, signal) => {
        assert.equal(id, job);
        const pending = deferred();
        watched.push({ ...pending, signal });
        return pending.promise.then(status => { if (!signal.aborted) onStatus(status); return status; });
      },
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  const render = () => {
    cursor = 0;
    const tree = context.module.exports.default({ onHome: () => {} });
    while (effects.length) effects.shift()();
    return tree;
  };
  const unmount = () => {
    unmounted = true;
    for (const slot of slots) slot?.cleanup?.();
  };
  return { render, unmount, boardRequests, watched, expireLoads: () => { for (const fn of [...deadlines.values()]) fn(); },
    tickAutomatic: () => { for (const fn of [...intervals.values()]) fn(); },
    setContinuous: value => { continuousBoard = value; },
    get writesAfterUnmount() { return writesAfterUnmount; } };
}

function find(tree, type, matches = () => true) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type && matches(tree.props)) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child, type, matches);
    if (found) return found;
  }
  return null;
}

// A completed refresh must win over the board request that was already in flight.
const refreshed = harness();
let tree = refreshed.render();
await flush();
assert.equal(refreshed.boardRequests.length, 1);
assert.equal(find(tree, 'native-inventory'), null, 'The site opens on EV opportunities');
assert.equal(find(tree, 'button', props => props.children === 'EV & Arb').props['aria-current'], 'page');
find(tree, 'input').props.onChange({ target: { value: '000000' } });
tree = refreshed.render();
find(tree, 'form').props.onSubmit({ preventDefault() {} });
await flush();
refreshed.render();
assert.equal(refreshed.watched.length, 1, 'The accepted job is actually watched');
refreshed.watched[0].resolve({ state: 'complete', job_id: job,
  details: { credits_spent: 0, selections: 17391, edges: 7, arbs: 2, provisional: 1 } });
await flush();
assert.equal(refreshed.boardRequests.length, 2, 'Completion loads the newly published board');
refreshed.boardRequests[1].resolve({ ok: true, json: async () => [{ job_id: job,
  html: '<meta name="odds-fast-refresh">SYNTHETIC-FRESH-BOARD', generated_at: '2026-10-13T12:00:00Z' }] });
await flush();
const beforeLateResponse = find(refreshed.render(), 'iframe')?.props.srcDoc;
assert.equal(beforeLateResponse, '<meta name="odds-fast-refresh">SYNTHETIC-FRESH-BOARD', 'A completed refresh opens its own published price board');
tree = refreshed.render();
const completion = JSON.stringify(tree);
assert.ok(completion.includes('provisional EV') && completion.includes('provisional arb'));
assert.ok(!completion.includes('pending verification'), 'Provisional results replace the pending wall');
find(tree, 'button', props => props.children === 'All markets').props.onClick();
assert.equal(find(refreshed.render(), 'native-inventory').key, 1, 'Completion invalidates the old market inventory too');
tree = refreshed.render();
find(tree, 'button', props => props.children === 'EV & Arb').props.onClick();
refreshed.boardRequests[0].resolve(board('SYNTHETIC-OLD-BOARD'));
await flush();
const afterLateResponse = find(refreshed.render(), 'iframe')?.props.srcDoc;

// The same lifecycle guard must prevent a completed request from updating an unmounted page.
const departed = harness();
departed.render();
await flush();
departed.unmount();
departed.boardRequests[0].resolve(board('SYNTHETIC-LATE-BOARD'));
await flush();
assert.deepEqual({ beforeLateResponse, afterLateResponse,
  writesAfterUnmount: departed.writesAfterUnmount }, {
  beforeLateResponse: '<meta name="odds-fast-refresh">SYNTHETIC-FRESH-BOARD',
  afterLateResponse: '<meta name="odds-fast-refresh">SYNTHETIC-FRESH-BOARD', writesAfterUnmount: 0,
}, 'Only the current mounted board load may update the displayed odds');
console.log('Odds refresh lifecycle passed: completed publication wins over late loads; unmount ignores late results.');
refreshed.unmount();

// The full-catalogue pointer and legacy row must not overwrite the price authority.
const dedicated = harness({ job_id: job, html: '<meta name="odds-fast-refresh">FAST', generated_at: '2026-10-13T12:00:00Z' });
tree = dedicated.render(); await flush();
tree = dedicated.render(); find(tree, 'button', props => props.children === 'EV & Arb').props.onClick();
assert.equal(find(dedicated.render(), 'iframe').props.srcDoc, '<meta name="odds-fast-refresh">FAST');
assert.equal(dedicated.boardRequests.length, 0, 'Dedicated row wins without loading a catalogue or legacy board');
dedicated.unmount();

const hangingBoard = harness();
tree = hangingBoard.render(); await flush();
find(tree, 'input').props.onChange({ target: { value: '000000' } });
tree = hangingBoard.render(); find(tree, 'form').props.onSubmit({ preventDefault() {} });
await flush(); hangingBoard.render();
hangingBoard.watched[0].resolve({ state: 'complete', job_id: job });
await flush();
assert.equal(hangingBoard.boardRequests.length, 2);
hangingBoard.expireLoads(); tree = hangingBoard.render();
assert.equal(find(tree, 'iframe'), null, 'A timed-out final load cannot display the earlier board as this update');
assert.equal(hangingBoard.boardRequests[1].options.signal.aborted, true, 'The final board GET is aborted at the remaining click deadline');
hangingBoard.unmount();

// Continuous reads advance without a PIN and cannot roll back or alter a job load.
const liveJob = '00000000-0000-4000-8000-000000000002';
const liveHtml = `<meta name="odds-continuous" content="1"><meta name="odds-fast-refresh" content="${liveJob}">LIVE`;
const automatic = harness({ job_id: job, html: '<meta name="odds-fast-refresh">PIN', generated_at: '2026-10-13T12:00:00Z' },
  { job_id: liveJob, html: liveHtml, generated_at: '2026-10-13T12:00:15Z' });
automatic.render(); await flush();
assert.equal(find(automatic.render(), 'iframe').props.srcDoc, liveHtml);
automatic.setContinuous({ job_id: liveJob, html: liveHtml+'-NEW', generated_at: '2026-10-13T12:00:30Z' });
automatic.tickAutomatic(); await flush();
assert.equal(find(automatic.render(), 'iframe').props.srcDoc, liveHtml+'-NEW', 'Automatic polling displays a newer database publication');
automatic.setContinuous({ job_id: liveJob, html: liveHtml+'-OLDER', generated_at: '2026-10-13T12:00:20Z' });
automatic.tickAutomatic(); await flush();
assert.equal(find(automatic.render(), 'iframe').props.srcDoc, liveHtml+'-NEW', 'A late older database view cannot roll back prices');
automatic.unmount();
