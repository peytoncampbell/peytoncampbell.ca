#!/usr/bin/env node
/**
 * Built-app regression for the reader desk (/mydesk); synthetic data only; fail-closed network.
 * Usage: PUPPETEER_MODULE=/path/to/puppeteer-core CHROME_PATH=/path/to/chrome
 *   node scripts/verifyReaderDesk.mjs [--mode gate|render|all] [--url http://127.0.0.1:8787] [--out DIR]
 * Without --url, serves existing docs on an owned ephemeral localhost port; never builds.
 * Screenshots are ONLY written with --out. No profile reuse and no real account credentials:
 * the render mode injects a synthetic session and intercepts the reader view response, so the
 * page renders real code against contract-shaped data with nothing leaving localhost.
 *
 * Contracts asserted:
 *   gate   - 'Your desk' heading, email/password fields, Sign in + Email me a link, noindex meta,
 *            the blush canvas token, and no horizontal overflow at 1280/390.
 *   render - the console shell (KPIs: book value, account return, day change, account mix), the
 *            portfolio table (a row per position with day %, book rating and the desk's call),
 *            'Today's plan' (sell/trim row, add band, exit watch, note), the candidates panel,
 *            'Standing out' / 'Needs watching' lists, the attention flag, sign-out via the
 *            Account menu returning to the gate, and no horizontal overflow at 1280/390.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = { mode: 'all' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') { console.log((await readFile(fileURLToPath(import.meta.url), 'utf8')).split(' */')[0]); process.exit(0); }
  assert(['--mode', '--url', '--out'].includes(args[i]), `Unknown argument ${args[i]}`);
  assert(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value for ${args[i]}`);
  options[args[i].slice(2)] = args[++i];
}
assert(['gate', 'render', 'all'].includes(options.mode), 'Invalid --mode');
if (options.out) {
  options.out = resolve(options.out);
  assert(options.out !== root && !options.out.startsWith(root + sep), '--out must be caller scratch, outside the repository');
  await mkdir(options.out, { recursive: true });
}
const require = createRequire(import.meta.url);
let modulePath = process.env.PUPPETEER_MODULE || 'puppeteer-core';
if (existsSync(modulePath)) {
  const entry = (await stat(modulePath)).isDirectory() ? require.resolve(resolve(modulePath)) : resolve(modulePath);
  modulePath = pathToFileURL(entry).href;
}
const puppeteer = (await import(modulePath)).default;
const candidates = [process.env.CHROME_PATH,
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && resolve(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = candidates.find((p) => p && existsSync(p));
assert(executablePath, 'Supply CHROME_PATH to an installed Chrome/Chromium browser');

const SYNTH = {
  schema: 'reader-digest/1',
  generated_at: '2026-09-27T14:00:00Z',
  as_of: '2026-09-27 09:27 GMT-04:00',
  fx_usd_cad: 1.4141,
  model: { universe_size: 1073 },
  accounts: [{ name: 'TSYN', value_cad: 1234.56, pl_cad: 234.56, day_cad: 15.8, positions: 2, scored: 1 }],
  totals: { value_cad: 1234.56, pl_cad: 234.56, cost_cad: 1000, day_cad: 15.8, day_pct: 1.33, ret_pct: 23.46 },
  positions: [
    { ticker: 'SYN01', name: 'Synthetic One Corp', account: 'TSYN', cur: 'CAD', qty: 10, price: 100, value: 1000, pl: 123.4, ret_pct: 12.34, value_cad: 1000, day_cad: 20.5, day_pct: 2.1, weight_account_pct: 81.0, call: 'ADD', call_why: "rising revisions, an uptrend, and a weight still small against the desk's target", rating_book: 66.6, model: { in_universe: true, rank_global: 12, universe_size: 1073, composite: 61.4, peak_margin_flag: true } },
    { ticker: 'SYN02', name: 'Synthetic Two Ltd', account: 'TSYN', cur: 'USD', qty: 2, price: 117.28, value: 234.56, pl: -12.34, ret_pct: -5.0, value_cad: 331.7, day_cad: -4.7, day_pct: -1.4, weight_account_pct: 19.0, call: 'SELL', call_why: 'catastrophic: 97% below the 3-year entry and 75% behind SPY over 6 months', rating_book: 41.2, model: { in_universe: false } },
  ],
  plan: {
    exits: [{ ticker: 'SYN02', why: 'catastrophic: 97% below the 3-year entry and 75% behind SPY over 6 months' }],
    trims: [],
    adds: [{ ticker: 'SYN01', rating: 66.6 }],
    watch: [{ ticker: 'SYN02', weeks: 1, rating: 41.2 }],
  },
  plan_counts: { exits: 1, trims: 0, adds: 1, holds: 0, watch: 1 },
  plan_as_of: '2026-09-27',
  plan_note: null,
  candidates: [{ ticker: 'CPAY', name: 'Synthetic Candidate Inc', rating: 70.7, timing: 'buyable now (at or near its 50-day)', currency: 'USD', region: 'US' }],
  notes: ['Synthetic note for the render test.'],
  read: {
    scored_count: 1,
    unscored_count: 1,
    note: 'Model read for the holdings inside the desk universe.',
    strongest: [{ ticker: 'SYN01', name: 'Synthetic One Corp', composite: 61.4, rank_global: 12 }],
    weakest: [{ ticker: 'SYN02', name: 'Synthetic Two Ltd', composite: 20.1, rank_global: 900 }],
    flags: [{ ticker: 'SYN01', name: 'Synthetic One Corp' }],
  },
};
const SESSION = {
  access_token: 'synthetic-token',
  refresh_token: 'synthetic-refresh',
  expires_at: Date.now() + 3600_000,
  email: 'reader@example.com',
  user_id: '00000000-0000-0000-0000-000000000001',
};

let server;
let browser;
let base;
const failures = [];
let passed = 0;

function check(label, ok, detail = '') {
  if (ok) passed += 1;
  else failures.push(detail ? `${label} (${detail})` : label);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` -- ${detail}` : ''}`);
}

async function localServer() {
  const docs = resolve(root, 'docs');
  assert(existsSync(resolve(docs, 'index.html')), 'Build docs first (this harness never rebuilds)');
  server = createServer(async (req, res) => {
    try {
      let name = resolve(docs, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!name.startsWith(docs + sep) && name !== docs) { res.writeHead(403).end(); return; }
      if (!extname(name) || !existsSync(name)) name = resolve(docs, 'index.html');
      const body = await readFile(name);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' })[extname(name)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  return `http://127.0.0.1:${server.address().port}`;
}

/** Fail-closed boundary: localhost always continues; the reader view is answered with synthetic
 *  data (CORS headers included, preflight handled); everything else is aborted. */
function installBoundary(page, base) {
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith(base)) return req.continue();
    if (url.includes('/rest/v1/pc_reader_view')) {
      if (req.method() === 'OPTIONS') {
        return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS' } });
      }
      return req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ payload: SYNTH, updated_at: '2026-09-27T14:00:00Z' }]) });
    }
    return req.abort();
  });
}

async function gateChecks(page, width, height) {
  await page.setViewport({ width, height });
  await page.goto(`${base}/mydesk`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.rd-gate-card h1', { timeout: 15000 });
  const h1 = await page.$eval('.rd-gate-card h1', (el) => el.textContent.trim());
  check(`gate h1 at ${width}`, h1 === 'Your desk', `got "${h1}"`);
  const fields = await page.$$eval('.rd-field input', (els) => els.map((e) => e.type));
  check(`gate fields at ${width}`, fields.includes('email') && fields.includes('password'), fields.join(','));
  const buttons = await page.$$eval('.rd-form button', (els) => els.map((e) => e.textContent.trim()));
  check(`gate actions at ${width}`, buttons.some((b) => /Sign in/.test(b)) && buttons.some((b) => /Email me a link/.test(b)), buttons.join(' | '));
  const noindex = await page.$eval('meta[name="robots"]', (el) => el.content).catch(() => null);
  check(`gate noindex at ${width}`, noindex === 'noindex,nofollow', String(noindex));
  const bg = await page.$eval('.rd-root', (el) => getComputedStyle(el).backgroundColor);
  check(`gate blush canvas at ${width}`, bg === 'rgb(250, 240, 239)', bg);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`gate no overflow at ${width}`, overflow <= 1, `${overflow}px`);
  if (options.out) await page.screenshot({ path: resolve(options.out, `reader-gate-${width}.png`) });
}

async function renderChecks(page, width, height) {
  await page.setViewport({ width, height });
  await page.goto(`${base}/mydesk`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sd-kpis', { timeout: 15000 });
  const kpis = await page.$$eval('.sd-kpis strong', (els) => els.map((e) => e.textContent.trim()));
  check(`book value at ${width}`, kpis[0] === 'C$1,234.56', kpis.join(' | '));
  check(`account return at ${width}`, kpis[1] === '+23.46%', kpis[1]);
  check(`day change at ${width}`, kpis[2] === '+C$15.80', kpis[2]);
  check(`account mix at ${width}`, kpis[3] === '100.0%', kpis[3]);
  const rows = await page.$$eval('.sd-portfolio-row', (els) => els.map((r) => r.innerText.replace(/\s+/g, ' ')));
  check(`row count at ${width}`, rows.length === 2, `${rows.length} rows`);
  check(`SYN01 row at ${width}`,
    rows.some((r) => r.includes('SYN01') && r.includes('+2.10%') && r.includes('66.6') && r.includes('ADD')),
    rows[0]?.slice(0, 100));
  check(`SYN02 row at ${width}`,
    rows.some((r) => r.includes('SYN02') && r.includes('-1.40%') && r.includes('41.2') && r.includes('SELL')),
    rows[1]?.slice(0, 100));
  const callCells = await page.$$eval('.rd-call', (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  check(`call column at ${width}`, ['ADD', 'SELL'].every((c) => callCells.includes(c)), callCells.join(','));
  const heads = await page.$$eval('.sd-order-side h3', (els) => els.map((e) => e.textContent.trim()));
  check(`read lists at ${width}`, heads.some((h) => h.startsWith('Standing out')) && heads.some((h) => h.startsWith('Needs watching')), heads.join(' | '));
  const panels = await page.$$eval('.sd-panel', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  const planText = panels.find((t) => t.includes("Today's plan")) || '';
  check(`plan panel at ${width}`, planText.includes('Sell / trim') && planText.includes('Add'), planText.slice(0, 110));
  check(`plan exit row at ${width}`, planText.includes('SYN02') && /catastrophic/.test(planText), planText.slice(0, 140));
  check(`plan watch at ${width}`, planText.includes('1 of 2 weekly readings'), '');
  check(`plan note at ${width}`, planText.includes('Synthetic note'), '');
  const candText = panels.find((t) => t.includes('Candidates')) || '';
  check(`candidate row at ${width}`, candText.includes('CPAY') && candText.includes('70.7') && /buyable/.test(candText), candText.slice(0, 110));
  const flags = await page.$$eval('.sd-attention li', (els) => els.map((e) => e.textContent).join('\n'));
  check(`attention flag at ${width}`, /SYN01/.test(flags), flags.slice(0, 70));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`render no overflow at ${width}`, overflow <= 1, `${overflow}px`);
  if (options.out) await page.screenshot({ path: resolve(options.out, `reader-desk-${width}.png`) });
}

async function main() {
  base = options.url ? options.url.replace(/\/+$/, '') : await localServer();
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--no-first-run'] });

  if (options.mode === 'gate' || options.mode === 'all') {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String((error && error.message) || error)));
    await page.setRequestInterception(true);
    installBoundary(page, base);
    await gateChecks(page, 1280, 800);
    await gateChecks(page, 390, 844);
    check('gate: no page errors', pageErrors.length === 0, pageErrors[0] || '');
    await page.close();
  }

  if (options.mode === 'render' || options.mode === 'all') {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String((error && error.message) || error)));
    await page.setRequestInterception(true);
    installBoundary(page, base);
    await page.evaluateOnNewDocument((session) => {
      try { window.localStorage.setItem('pc-desk-session', JSON.stringify(session)); } catch { /* private mode */ }
    }, SESSION);
    await renderChecks(page, 1280, 800);
    await renderChecks(page, 390, 844);
    await page.setViewport({ width: 1280, height: 800 });
    await page.click('.sd-account summary');
    await page.click('.rd-signout');
    await page.waitForSelector('.rd-field input[type="password"]', { timeout: 10000 }).then(
      () => check('sign-out returns to the gate', true),
      () => check('sign-out returns to the gate', false, 'gate form never appeared'));
    check('render: no page errors', pageErrors.length === 0, pageErrors[0] || '');
    await page.close();
  }

  await browser.close();
  if (server) server.close();
  console.log(`\n  ${passed}/${passed + failures.length} checks passed`);
  if (failures.length) { console.log('  failures:'); for (const f of failures) console.log(`    - ${f}`); }
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close().catch(() => {});
  if (server) server.close();
  process.exit(1);
});
