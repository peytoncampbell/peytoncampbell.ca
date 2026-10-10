import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/oddsRefresh.ts', import.meta.url), 'utf8');
const code = transformSync(source.replace(/import \{[^}]+\} from '\.\/ownerAuth';/,
  'const { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } = globalThis.config;'),
  { loader: 'ts', format: 'cjs' }).code;
const calls = [];
let responses = [];
const context = {
  exports: {}, module: { exports: {} }, Error, DOMException, AbortController,
  setTimeout: resolve => { resolve(); return 1; }, clearTimeout: () => {},
  config: { AUTH_CONFIGURED: true, SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_ANON_KEY: 'PUBLIC' },
  fetch: async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected request');
    return { ok: next.http !== 500, status: next.http ?? 200, json: async () => next };
  },
};
context.exports = context.module.exports;
vm.runInNewContext(code, context);
const api = context.module.exports;
const job = '00000000-0000-4000-8000-000000000001';
await assert.rejects(() => api.submitRefresh('bad'), /6.*10/);
assert.equal(calls.length, 0, 'Invalid input never sends a request');
responses = [{ state: 'denied', message: 'Incorrect PIN.' }];
const denied = await api.submitRefresh('654321');
assert.equal(denied.state, 'denied');
assert.equal(calls[0].url, 'https://synthetic.invalid/rest/v1/rpc/pc_odds_request_refresh');
assert.equal(calls[0].options.method, 'POST');
assert.equal(JSON.parse(calls[0].options.body).pin, '654321');
assert.ok(!calls[0].url.includes('654321'), 'PIN stays out of URLs');
responses = [{ state: 'job', job_state: 'queued', job_id: job }];
const accepted = await api.submitRefresh('654321');
assert.equal(accepted.state, 'queued', 'Actual SQL acceptance starts status polling');
assert.equal(accepted.job_id, job);
responses = [{ state: 'queued', job_id: job }, { state: 'running', job_id: job },
  { state: 'complete', job_id: job, details: { credits_spent: 0 } }];
const updates = [];
const done = await api.watchRefresh(job, status => updates.push(status.state), new AbortController().signal);
assert.equal(done.state, 'complete');
assert.equal(done.details.credits_spent, 0);
assert.deepEqual(updates, ['queued', 'running', 'complete']);
for (const call of calls.slice(2)) {
  assert.equal(call.url, 'https://synthetic.invalid/rest/v1/rpc/pc_odds_refresh_status');
  assert.deepEqual(JSON.parse(call.options.body), { job_id: job });
  assert.equal(call.options.headers.apikey, 'PUBLIC');
}
responses = [{ state: 'failed', job_id: job, message: 'Refresh failed. Previous board kept.' }];
const failed = await api.watchRefresh(job, () => {}, new AbortController().signal);
assert.equal(failed.state, 'failed');
const aborted = new AbortController(); aborted.abort();
const before = calls.length;
await assert.rejects(() => api.watchRefresh(job, () => {}, aborted.signal), /abort/i);
assert.equal(calls.length, before, 'Unmounted view never starts another request');
responses = [{ state: 'running', job_id: job }, { state: 'running', job_id: job }];
await assert.rejects(() => api.watchRefresh(job, () => {}, new AbortController().signal, 2), /still running/i);
responses = [{ state: 'unknown' }];
await assert.rejects(() => api.submitRefresh('654321'), /invalid response/i);
console.log('Odds refresh transport checks passed: POST-only PIN, status-only polling, failure, cancellation and timeout.');
