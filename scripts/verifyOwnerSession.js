import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/ownerAuth.ts'), 'utf8');
const built = buildSync({
  stdin: { contents: `${source}\nexport { sessionFrom };`, resolveDir: resolve(root, 'src'), sourcefile: 'ownerAuth.ts', loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' }, write: false, logLevel: 'silent',
});
const compiled = new Module(resolve(root, 'scripts/owner-session-test.cjs'));
compiled._compile(built.outputFiles[0].text, compiled.id);
const { sessionFrom } = compiled.exports;
const payload = { access_token: 'SYNTHETIC-ACCESS', refresh_token: 'SYNTHETIC-REFRESH', expires_in: 120, user: { id: 'synthetic-owner-a' } };
const before = Date.now();
const signedIn = sessionFrom(payload, 'owner@example.invalid');
assert.equal(signedIn.user_id, payload.user.id, 'Provider user identity must survive sign-in and refresh for device-only review namespacing');
assert.equal(signedIn.access_token, payload.access_token);
assert.equal(signedIn.refresh_token, payload.refresh_token);
assert.equal(signedIn.email, 'owner@example.invalid');
assert(signedIn.expires_at >= before + 120_000 && signedIn.expires_at <= Date.now() + 120_000);
assert.equal(sessionFrom({ ...payload, user: { id: 'synthetic-owner-b' } }, '').user_id, 'synthetic-owner-b', 'Different identities never share a review namespace');
for (const user of [undefined, null, {}, { id: '' }, { id: 42 }, { id: '   ' }]) {
  assert.equal(sessionFrom({ ...payload, user }, '').user_id, undefined, 'Missing provider identity stays session-only, never an empty shared namespace');
}
assert.equal(sessionFrom({ ...payload, user: undefined }, 'legacy@example.invalid').email, 'legacy@example.invalid', 'Legacy/link sessions retain the existing email and token flow');
console.log('Owner session regression passed: provider identity, legacy fallback, tokens, and expiry preserved.');
