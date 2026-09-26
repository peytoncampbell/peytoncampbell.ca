#!/usr/bin/env node
// Execute the actual hook with deterministic React hook slots and synthetic auth transport.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('../src/ownerAuth.ts', import.meta.url), 'utf8');
const code = transformSync(source.replace(/import \{[^}]+\} from 'react';/, 'const { useCallback, useEffect, useRef, useState } = globalThis.hooks;'), {
  loader: 'ts', format: 'cjs', define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://synthetic.supabase.invalid', VITE_SUPABASE_ANON_KEY: 'SYNTHETIC-PUBLIC-KEY' }) },
}).code;
const session = (token = 'SYNTHETIC-OLD', expiry = Date.now() + 86400000) => ({ access_token: token, refresh_token: 'SYNTHETIC-REFRESH', expires_at: expiry, email: 'owner@example.invalid' });
const payload = token => ({ access_token: token, refresh_token: 'SYNTHETIC-REFRESH', expires_in: 3600, user: { email: 'owner@example.invalid' } });
const response = (data, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(data) });
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function harness(initial = session()) {
  const storage = new Map(initial ? [['pc-desk-session', JSON.stringify(initial)]] : []);
  const slots = [], effects = [], calls = [];
  let cursor = 0;
  let respond = () => { throw new Error('Unexpected synthetic auth request'); };
  const hooks = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
    useCallback(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) slots[i] = { fn, deps };
      return slots[i].fn;
    },
  };
  const context = { hooks, exports: {}, module: { exports: {} }, Date, URLSearchParams,
    window: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, location: { hash: '' } },
    fetch: async (url, options) => {
      assert.match(url, /^https:\/\/synthetic\.supabase\.invalid\/auth\/v1\/(token\?grant_type=(refresh_token|password)|logout)$/);
      assert.equal(options.method, 'POST'); calls.push(url); return respond(url, options);
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  const render = () => { cursor = 0; const hook = context.module.exports.useOwnerSession(); while (effects.length) effects.shift()(); return hook; };
  const startup = render();
  return { render, startup, storage, calls, respond: fn => { respond = fn; } };
}
let passed = 0, failed = 0;
async function test(label, run) {
  try { await run(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failed++; console.error(`FAIL ${label}: ${error.message}`); }
}
await test('invalidation synchronously clears storage and memory, including captured fresh callback', async () => {
  const h = harness(); const hook = h.render(); const captured = hook.ensureFresh;
  assert.equal((await captured()).access_token, 'SYNTHETIC-OLD');
  hook.invalidateSession();
  assert.equal(h.storage.has('pc-desk-session'), false);
  assert.equal(await captured(), null, 'Revocation applies before a rerender');
  assert.equal(h.render().session, null);
  assert.equal(await captured(), null);
  assert.equal(h.calls.length, 0, 'Local invalidation never waits on remote logout');
});
await test('late successful renewal cannot restore an invalidated session', async () => {
  const h = harness(session('SYNTHETIC-OLD', 0)), pending = deferred();
  h.respond(() => pending.promise);
  const hook = h.render(), refreshing = hook.ensureFresh();
  hook.invalidateSession();
  pending.resolve(response(payload('SYNTHETIC-LATE')));
  assert.equal(await refreshing, null, 'Invalidated renewal returns no token');
  assert.equal(h.storage.has('pc-desk-session'), false);
  assert.equal(h.render().session, null);
});
await test('legitimate new sign-in works after local invalidation', async () => {
  const h = harness(); const hook = h.render(); hook.invalidateSession();
  h.respond(() => response(payload('SYNTHETIC-NEW')));
  assert.equal(await hook.signIn('owner@example.invalid', 'SYNTHETIC-NOT-A-PASSWORD'), true);
  assert.equal((await h.render().ensureFresh())?.access_token, 'SYNTHETIC-NEW');
});
for (const status of [200, 400]) await test(`late renewal HTTP ${status} cannot overwrite or revoke a subsequent sign-in`, async () => {
  const h = harness(session('SYNTHETIC-OLD', 0)), pending = deferred();
  h.respond(url => url.endsWith('refresh_token') ? pending.promise : response(payload('SYNTHETIC-NEW')));
  const hook = h.render(), refreshing = hook.ensureFresh();
  hook.invalidateSession();
  await hook.signIn('owner@example.invalid', 'SYNTHETIC-NOT-A-PASSWORD');
  pending.resolve(response(payload('SYNTHETIC-LATE'), status));
  assert.equal(await refreshing, null);
  assert.equal(h.render().session.access_token, 'SYNTHETIC-NEW');
  assert.equal(JSON.parse(h.storage.get('pc-desk-session')).access_token, 'SYNTHETIC-NEW');
});
await test('sign-out invalidates locally despite hung logout and late renewal', async () => {
  const h = harness(session('SYNTHETIC-OLD', 0)), renewal = deferred(), logout = deferred();
  h.respond(url => url.endsWith('logout') ? logout.promise : renewal.promise);
  const hook = h.render(), refreshing = hook.ensureFresh(), signingOut = hook.signOut();
  assert.equal(h.storage.has('pc-desk-session'), false);
  assert.equal(h.render().session, null);
  renewal.resolve(response(payload('SYNTHETIC-LATE')));
  assert.equal(await refreshing, null);
  assert.equal(h.storage.has('pc-desk-session'), false);
  logout.resolve(response(null)); await signingOut;
});
await test('normal fresh and expired sessions retain existing renewal behavior', async () => {
  const fresh = harness(); assert.equal((await fresh.render().ensureFresh()).access_token, 'SYNTHETIC-OLD'); assert.equal(fresh.calls.length, 0);
  const expired = harness(session('SYNTHETIC-OLD', 0)); expired.respond(() => response(payload('SYNTHETIC-RENEWED')));
  assert.equal((await expired.render().ensureFresh()).access_token, 'SYNTHETIC-RENEWED');
  assert.equal(expired.render().session.access_token, 'SYNTHETIC-RENEWED');
  assert.equal(JSON.parse(expired.storage.get('pc-desk-session')).access_token, 'SYNTHETIC-RENEWED');
});
// Keep the same hook instance: a route remount would hide the captured-closure defect.
for (const rerender of [false, true]) {
  const timing = rerender ? 'after rerender' : 'before rerender';
  await test(`captured fresh callback cannot return revoked credentials after new sign-in ${timing}`, async () => {
    const h = harness(), old = h.render();
    old.invalidateSession();
    h.respond(() => response(payload('SYNTHETIC-NEW')));
    await old.signIn('owner@example.invalid', 'SYNTHETIC-NOT-A-PASSWORD');
    if (rerender) h.render();
    const returned = await old.ensureFresh();
    assert.notEqual(returned?.access_token, 'SYNTHETIC-OLD');
    assert.equal(returned, null);
    assert.equal(h.calls.length, 1, 'Only the legitimate password request is allowed');
    assert.equal(h.render().session.access_token, 'SYNTHETIC-NEW');
    assert.equal(JSON.parse(h.storage.get('pc-desk-session')).access_token, 'SYNTHETIC-NEW');
    assert.equal((await h.render().ensureFresh()).access_token, 'SYNTHETIC-NEW');
  });
  for (const status of [200, 400]) await test(`captured expired callback cannot renew/replace/revoke new sign-in with HTTP ${status} ${timing}`, async () => {
    const h = harness(session('SYNTHETIC-OLD', 0)), old = h.render();
    old.invalidateSession();
    h.respond(() => response(payload('SYNTHETIC-NEW')));
    await old.signIn('owner@example.invalid', 'SYNTHETIC-NOT-A-PASSWORD');
    h.respond(() => response(payload('SYNTHETIC-OLD-RENEWED'), status));
    if (rerender) h.render();
    const returned = await old.ensureFresh();
    assert.equal(h.render().session?.access_token, 'SYNTHETIC-NEW');
    assert.equal(JSON.parse(h.storage.get('pc-desk-session')).access_token, 'SYNTHETIC-NEW');
    assert.equal(returned, null);
    assert.equal(h.calls.length, 1, 'Stale callback must not even send a renewal');
    assert.equal(h.render().error, null);
    assert.equal((await h.render().ensureFresh()).access_token, 'SYNTHETIC-NEW');
  });
}
await test('startup callback retains storage fallback within its original lifecycle', async () => {
  const h = harness();
  assert.equal(h.startup.session, null);
  assert.equal((await h.startup.ensureFresh()).access_token, 'SYNTHETIC-OLD');
  assert.equal(h.calls.length, 0);
  const expired = harness(session('SYNTHETIC-OLD', 0));
  expired.respond(() => response(payload('SYNTHETIC-RENEWED')));
  assert.equal((await expired.startup.ensureFresh()).access_token, 'SYNTHETIC-RENEWED');
  assert.equal(expired.calls.length, 1);
  assert.equal(expired.render().session.access_token, 'SYNTHETIC-RENEWED');
  assert.equal(JSON.parse(expired.storage.get('pc-desk-session')).access_token, 'SYNTHETIC-RENEWED');
  assert.equal(await harness(null).startup.ensureFresh(), null);
});
console.log(JSON.stringify({ passed, failed }));
if (failed) process.exitCode = 1;
