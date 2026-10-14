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
    'const { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } = globalThis.config;'),
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
  const slots = [], effects = [], boardRequests = [];
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
    setTimeout: (fn, ms) => { const id = ++timerId; deadlines.set(id, { fn, ms }); return id; },
    clearTimeout: id => deadlines.delete(id),
    setInterval: (fn, ms) => { const id = ++timerId; intervals.set(id, { fn, ms }); return id; },
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
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      assert.equal(url,
        'https://synthetic.supabase.invalid/rest/v1/pc_odds?select=generated_at,html&id=eq.1&limit=1');
      const pending = deferred();
      boardRequests.push({ ...pending, options });
      // Intentionally allow a late result after abort: lifecycle guards must still reject it.
      return pending.promise;
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
  return { render, unmount, boardRequests, expireLoads: () => { for (const timer of [...deadlines.values()]) timer.fn(); },
    tickAutomatic: () => { for (const timer of [...intervals.values()]) timer.fn(); },
    intervalDurations: () => [...intervals.values()].map(timer => timer.ms),
    timeoutDurations: () => [...deadlines.values()].map(timer => timer.ms),
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

// A newer automatic publication must win over the initial request already in flight.
const refreshed = harness();
let tree = refreshed.render();
await flush();
assert.equal(refreshed.boardRequests.length, 1);
assert.equal(find(tree, 'native-inventory'), null, 'The site opens on EV opportunities');
assert.equal(find(tree, 'button', props => props.children === 'EV & Arb').props['aria-current'], 'page');
assert.equal(find(tree, 'button', props => ['Refresh', 'Reload'].includes(props.children)), null);
assert.equal(find(tree, 'form'), null, 'There is no manual PIN refresh flow');
const freshHtml = `<meta name="odds-continuous" content="1"><meta name="odds-fast-refresh" content="${job}">SYNTHETIC-FRESH-BOARD`;
refreshed.setContinuous({ job_id: job, html: freshHtml, generated_at: '2026-10-13T12:00:00Z' });
refreshed.tickAutomatic(); await flush();
assert.equal(find(refreshed.render(), 'iframe')?.props.srcDoc, freshHtml);
assert.equal(refreshed.boardRequests[0].options.signal.aborted, true);
refreshed.boardRequests[0].resolve(board('SYNTHETIC-OLD-BOARD')); await flush();
assert.equal(find(refreshed.render(), 'iframe')?.props.srcDoc, freshHtml, 'Late transport cannot overwrite new prices');
refreshed.unmount();

const departed = harness(); departed.render(); await flush(); departed.unmount();
departed.boardRequests[0].resolve(board('SYNTHETIC-LATE-BOARD')); await flush();
assert.equal(departed.writesAfterUnmount, 0, 'Unmount ignores late transport results');
console.log('Automatic board lifecycle passed: no manual controls, new publication wins and unmount ignores late results.');

// The full-catalogue pointer and legacy row must not overwrite the price authority.
const dedicated = harness({ job_id: job, html: '<meta name="odds-fast-refresh">FAST', generated_at: '2026-10-13T12:00:00Z' });
tree = dedicated.render(); await flush();
tree = dedicated.render(); find(tree, 'button', props => props.children === 'EV & Arb').props.onClick();
assert.equal(find(dedicated.render(), 'iframe').props.srcDoc, '<meta name="odds-fast-refresh">FAST');
assert.equal(dedicated.boardRequests.length, 0, 'Dedicated row wins without loading a catalogue or legacy board');
dedicated.unmount();

const hangingBoard = harness();
hangingBoard.render(); await flush(); hangingBoard.expireLoads(); tree = hangingBoard.render();
assert.equal(find(tree, 'iframe'), null);
assert.equal(hangingBoard.boardRequests[0].options.signal.aborted, true, 'The initial board GET has a bounded timeout');
hangingBoard.boardRequests[0].resolve(board('SYNTHETIC-LATE-BOARD')); await flush();
assert.equal(find(hangingBoard.render(), 'iframe'), null, 'Timed-out responses cannot display stale prices');
hangingBoard.unmount();

// Continuous reads advance automatically and cannot roll back displayed prices.
const liveJob = '00000000-0000-4000-8000-000000000002';
const liveHtml = `<meta name="odds-continuous" content="1"><meta name="odds-fast-refresh" content="${liveJob}">LIVE`;
const automatic = harness({ job_id: job, html: '<meta name="odds-fast-refresh">PIN', generated_at: '2026-10-13T12:00:00Z' },
  { job_id: liveJob, html: liveHtml, generated_at: '2026-10-13T12:00:15Z' });
automatic.render(); await flush();
assert.equal(find(automatic.render(), 'iframe').props.srcDoc, liveHtml);
assert.deepEqual(automatic.intervalDurations(), [300000], 'Routine updates run every five minutes');
automatic.setContinuous({ job_id: liveJob, html: liveHtml+'-NEW', generated_at: '2026-10-13T12:00:30Z' });
automatic.tickAutomatic(); await flush();
assert.equal(find(automatic.render(), 'iframe').props.srcDoc, liveHtml+'-NEW', 'Automatic polling displays a newer database publication');
automatic.setContinuous({ job_id: liveJob, html: liveHtml+'-OLDER', generated_at: '2026-10-13T12:00:20Z' });
automatic.tickAutomatic(); await flush();
assert.equal(find(automatic.render(), 'iframe').props.srcDoc, liveHtml+'-NEW', 'A late older database view cannot roll back prices');
automatic.unmount();

// Two-minute money-path expiry must never become a five-minute fresh clock.
const sourceEnd = Date.now()/1000 + 45;
const expiringHtml = `${liveHtml}<script>var GEN = ${sourceEnd-120}, END = ${sourceEnd};</script>`;
const expiring = harness(null, { job_id: liveJob, html: expiringHtml, generated_at: '2026-10-13T12:00:15Z' });
expiring.render(); await flush(); expiring.render();
assert.deepEqual(expiring.intervalDurations(), [300000]);
assert.ok(expiring.timeoutDurations().some(ms => ms >= 15000 && ms < 45000), 'The next read starts before the supplied quote expiry');
expiring.expireLoads(); await flush(); expiring.render();
assert.ok(expiring.intervalDurations().includes(15000), 'An unchanged publication is retried without extending its source clocks');
assert.equal(find(expiring.render(), 'iframe').props.srcDoc, expiringHtml);
expiring.unmount();
assert.deepEqual(expiring.intervalDurations(), [], 'Automatic and expiry retry timers stop on unmount');
assert.deepEqual(expiring.timeoutDurations(), [], 'The pending expiry timeout stops on unmount');
console.log('Automatic UI updates passed: five-minute cadence, early expiry reads and original-clock preservation.');
