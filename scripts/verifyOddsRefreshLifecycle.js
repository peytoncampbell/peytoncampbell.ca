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

function harness() {
  const slots = [], effects = [], boardRequests = [], watched = [];
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
  const element = (type, props) => ({ type, props: props ?? {} });
  const context = {
    hooks, exports: {}, module: { exports: {} }, AbortController, DOMException, Date,
    config: { AUTH_CONFIGURED: true, SUPABASE_URL: 'https://synthetic.supabase.invalid',
      SUPABASE_ANON_KEY: 'SYNTHETIC-PUBLIC-KEY' },
    require: name => {
      assert.equal(name, 'react/jsx-runtime');
      return { jsx: element, jsxs: element, Fragment: 'fragment' };
    },
    fetch: (url, options) => {
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
  return { render, unmount, boardRequests, watched,
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
assert.equal(refreshed.boardRequests.length, 1);
find(tree, 'input').props.onChange({ target: { value: '000000' } });
tree = refreshed.render();
find(tree, 'form').props.onSubmit({ preventDefault() {} });
await flush();
refreshed.render();
assert.equal(refreshed.watched.length, 1, 'The accepted job is actually watched');
refreshed.watched[0].resolve({ state: 'complete', job_id: job });
await flush();
assert.equal(refreshed.boardRequests.length, 2, 'Completion loads the newly published board');
refreshed.boardRequests[1].resolve(board('SYNTHETIC-FRESH-BOARD'));
await flush();
const beforeLateResponse = find(refreshed.render(), 'iframe')?.props.srcDoc;
refreshed.boardRequests[0].resolve(board('SYNTHETIC-OLD-BOARD'));
await flush();
const afterLateResponse = find(refreshed.render(), 'iframe')?.props.srcDoc;

// The same lifecycle guard must prevent a completed request from updating an unmounted page.
const departed = harness();
departed.render();
departed.unmount();
departed.boardRequests[0].resolve(board('SYNTHETIC-LATE-BOARD'));
await flush();
assert.deepEqual({ beforeLateResponse, afterLateResponse,
  writesAfterUnmount: departed.writesAfterUnmount }, {
  beforeLateResponse: 'SYNTHETIC-FRESH-BOARD',
  afterLateResponse: 'SYNTHETIC-FRESH-BOARD', writesAfterUnmount: 0,
}, 'Only the current mounted board load may update the displayed odds');
console.log('Odds refresh lifecycle passed: completed publication wins over late loads; unmount ignores late results.');
