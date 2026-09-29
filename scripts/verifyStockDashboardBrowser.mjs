#!/usr/bin/env node
/**
 * Real built-app regression; synthetic data only; fail-closed network boundary.
 * Usage: PUPPETEER_MODULE=/path/to/puppeteer-core CHROME_PATH=/path/to/chrome
 *   node scripts/verifyStockDashboardBrowser.mjs [--mode all|structure|interactions|universe|depth-shell|depth-data|depth-inspector|depth-evidence|depth-history|depth-changes|stress|reflow|resilience]
 *     [--url http://127.0.0.1:8787/stocks] [--out /caller/scratch/screenshots]
 * Without --url, serves existing docs on an owned ephemeral localhost port; never builds.
 * Default all is strict acceptance. Narrow modes are incremental diagnostics, not acceptance.
 * Screenshots are ONLY written with --out. No profile reuse or real account credentials.
 *
 * Shared UI contract (put data-stock-ticker on ONE complete interactive row, not a nested label):
 * .stock-dashboard; [data-dashboard-panel="portfolio"|"orders"|"context"];
 * [data-order-side="buy"|"sell"] (side container OR complete row; sell includes trims);
 * [data-stock-ticker="SYN01"]. A row itself or its child button opens the inspector.
 * One visible nav landmark named "Primary" (or "Primary navigation").
 * Inspector: dialog role, accessible name includes ticker; Close button; Escape and close
 * restore opener focus. Full order fields may be in inspector; amount/type always in buy row.
 * Buttons/links/tabs/summary accessible names include Research, Reports, Model, Brief,
 * Full book, History, Overview (or Dashboard), Refresh. Reports exposes Weekly report.
 * Research renders RES01, reports synthetic report evidence, Model synthetic model evidence,
 * Brief synthetic daily brief, Full book final holding, History all twelve dates/rows.
 * Pagination: Next portfolio page / Next buy page (or a Next button inside respective panel/side).
 * Panel summaries preserve total count (30 holdings / 25 buys) and complete funding figures.
 * No optional hooks bypass acceptance. All modes return nonzero on failed assertions.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve, extname, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { stockDashboardFixture } from './fixtures/stockDashboard.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = { mode: 'all' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') { console.log((await readFile(fileURLToPath(import.meta.url), 'utf8')).split(' */')[0]); process.exit(0); }
  assert(['--mode', '--url', '--out'].includes(args[i]), `Unknown argument ${args[i]}`);
  assert(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value for ${args[i]}`);
  options[args[i].slice(2)] = args[++i];
}
assert(['all', 'structure', 'interactions', 'universe', 'depth-shell', 'depth-data', 'depth-inspector', 'depth-evidence', 'depth-history', 'depth-changes', 'stress', 'reflow', 'resilience'].includes(options.mode), 'Invalid --mode');
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
const executablePath = candidates.find(p => p && existsSync(p));
assert(executablePath, 'Supply CHROME_PATH to an installed Chrome/Chromium browser');
let server;
let browser;
const failures = [];
let passed = 0;
const panel = name => `[data-dashboard-panel="${name}"]`;
const portfolioRows = `${panel('portfolio')} [data-stock-ticker]`;
const side = name => `${panel('orders')} [data-order-side="${name}"]`;
const sideRows = name => `${side(name)}[data-stock-ticker], ${side(name)} [data-stock-ticker]`;
const numeric = value => value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = text => text.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();

async function localServer() {
  const docs = resolve(root, 'docs');
  assert(existsSync(resolve(docs, 'index.html')), 'Build docs first (this harness never rebuilds)');
  server = createServer(async (req, res) => {
    try {
      let name = resolve(docs, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!name.startsWith(docs + sep) && name !== docs) { res.writeHead(403).end(); return; }
      if (!extname(name)) name = resolve(docs, 'index.html');
      const body = await readFile(name);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' })[extname(name)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  return `http://127.0.0.1:${server.address().port}/stocks`;
}

async function scenario(label, run) {
  try { await run(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failures.push({ label, error: error.message }); console.error(`FAIL ${label}: ${error.message}`); }
}

async function openFixture(viewport, fixture = stockDashboardFixture()) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const requests = new Map();
  const queries = [];
  const probes = [];
  const unexpected = [];
  const errors = [];
  await page.setViewport(viewport);
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  // Everything non-local is intercepted, including auth, custom Supabase domains,
  // images, analytics, and unknown endpoints. Fake authorization never leaves this page.
  page.on('request', request => {
    const url = new URL(request.url());
    const table = url.pathname.match(/\/rest\/v1\/([^/]+)/)?.[1];
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'content-type': 'application/json' };
    if (table || /\/auth\/v1\//.test(url.pathname) || /supabase\./.test(url.hostname)) {
      if (request.method() === 'OPTIONS') { void request.respond({ status: 204, headers }); return; }
      if (table && fixture.routes[table] && request.method() === 'GET') {
        requests.set(table, (requests.get(table) || 0) + 1);
        queries.push({ table, select: url.searchParams.get('select'), limit: url.searchParams.get('limit'), as_of: url.searchParams.get('as_of'), generated_at: url.searchParams.get('generated_at') });
        if (table === 'pc_playbook' && url.searchParams.get('select') === 'as_of,generated_at,insights') {
          if (fixture.historyHang) { (fixture.historyPending ||= []).push(request); return; }
          void request.respond({ status: fixture.historyStatus ?? 200, headers, body: JSON.stringify(fixture.historyRows ?? []) }); return;
        }
        // Fault injection is restricted to the same six explicitly allowed synthetic GETs.
        if (fixture.abortTables?.includes(table)) { void request.abort('failed'); return; }
        if (fixture.hangTables?.includes(table)) { (fixture.pendingRequests ||= []).push(request); return; }
        void request.respond({ status: fixture.statuses?.[table] ?? 200, headers, body: JSON.stringify(fixture.routes[table]) }); return;
      }
      // After a valid-but-empty private gate the console probes the reader view once, through the
      // same auth.uid() gate the reader desk reads, to decide whether the account belongs on
      // /mydesk (account routing). Declared per fixture so a stray probe anywhere else still lands
      // in `unexpected`; served empty by default, which keeps the console's own message.
      if (table === 'pc_reader_view' && fixture.probes?.includes(table) && request.method() === 'GET') {
        probes.push({ select: url.searchParams.get('select'), limit: url.searchParams.get('limit') });
        void request.respond({ status: 200, headers, body: JSON.stringify(fixture.probeRows ?? []) }); return;
      }
      unexpected.push(`${request.method()} ${url.pathname}`);
      void request.respond({ status: 403, headers, body: '{"error":"Unexpected synthetic API route"}' }); return;
    }
    const local = url.origin === new URL(options.url).origin;
    const hasAuth = Boolean(request.headers().authorization);
    if ((local && !hasAuth) || ['data:', 'blob:'].includes(url.protocol)) void request.continue();
    else { if (hasAuth) unexpected.push(`Blocked authorization outside fixture routes: ${url.pathname}`); void request.abort('blockedbyclient'); }
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    // Fixture vintages must not acquire new stale-data alerts as the real calendar advances.
    const NativeDate = Date;
    const instant = NativeDate.parse('2026-09-26T14:00:00Z');
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [instant])); }
      static now() { return instant; }
    };
    localStorage.clear();
    localStorage.setItem('pc-desk-session', JSON.stringify({ access_token: 'SYNTHETIC-NOT-A-REAL-JWT',
      refresh_token: 'SYNTHETIC-NEVER-REFRESH', expires_at: Date.now() + 86400000, email: 'synthetic-owner@example.invalid' }));
  });
  await page.goto(options.url, { waitUntil: 'networkidle0' });
  assert.deepEqual([...requests.keys()].sort(), Object.keys(fixture.routes).sort(), 'All six real owner-fetch routes must consume fixtures');
  if (fixture.routes.pc_digest_private.length && (fixture.statuses?.pc_digest_private ?? 200) === 200) {
    await page.waitForFunction(() => document.body.innerText.includes('SYN01'));
  }
  return { page, context, fixture, requests, queries, probes, unexpected, errors };
}

async function withFixture(label, viewport, fixture, run) {
  let state;
  await scenario(label, async () => {
    try {
      state = await openFixture(viewport, fixture);
      const expectedProbes = fixture.probes?.includes('pc_reader_view') ? 1 : 0;
      assert.equal(state.probes.length, expectedProbes, expectedProbes
        ? 'A valid empty private gate probes the reader view exactly once'
        : 'No reader-view probe unless the private gate returns a valid empty result');
      assert.deepEqual(state.unexpected, [], 'No unexpected auth/API requests during load');
      assert.deepEqual(state.errors, [], 'Fixture renders without browser errors');
      console.log(`LOADED ${label}: ${state.requests.size} intercepted tables; ${fixture.holdings.length} holdings; ${fixture.expectedBuys.length} unique buys; ${fixture.sales.length} sales`);
      await run(state);
      // the scenario may declare a valid-empty gate mid-run, so read the expectation after it
      const expectedAfter = fixture.probes?.includes('pc_reader_view') ? 1 : 0;
      assert.equal(state.probes.length, expectedAfter, expectedAfter
        ? 'A valid empty private gate probes the reader view exactly once'
        : 'No reader-view probe unless the private gate returns a valid empty result');
      assert.deepEqual(state.unexpected, [], 'No unexpected auth/API requests');
      assert.deepEqual(state.errors, [], 'No uncaught browser errors');
    } finally {
      if (state) {
        if (options.out) await state.page.screenshot({ path: resolve(options.out, `${label.replace(/[^a-z0-9-]/gi, '-')}.png`), fullPage: true });
        await state.context.close();
      }
    }
  });
}

async function geometry(page, selectors, { reflow = false } = {}) {
  return page.evaluate(({ selectors, reflow }) => {
    const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const d = document.documentElement;
    const errors = [];
    const eps = 2;
    if (d.scrollWidth > innerWidth + eps) errors.push(`document horizontal overflow ${d.scrollWidth}/${innerWidth}`);
    if (!reflow && d.scrollHeight > innerHeight + eps) errors.push(`document vertical overflow ${d.scrollHeight}/${innerHeight}`);
    for (const selector of selectors) {
      for (const e of document.querySelectorAll(selector)) {
        if (!visible(e)) { errors.push(`hidden row/panel ${selector} ${e.dataset.stockTicker || ''}`); continue; }
        const r = e.getBoundingClientRect();
        const name = `${selector} ${e.dataset.stockTicker || ''}`;
        if (r.left < -eps || r.right > innerWidth + eps || (!reflow && (r.top < -eps || r.bottom > innerHeight + eps))) errors.push(`outside viewport: ${name} [${r.left},${r.top},${r.right},${r.bottom}]`);
        for (let a = e; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a), b = a.getBoundingClientRect();
          if ((!reflow && a.scrollHeight > a.clientHeight + eps && /auto|scroll|hidden|clip/.test(s.overflowY)) ||
              (a.scrollWidth > a.clientWidth + eps && /auto|scroll|hidden|clip/.test(s.overflowX))) {
            errors.push(`scroll/clipping ancestor: ${name} ${a.className}`); break;
          }
          if (/hidden|clip/.test(s.overflowY) && (r.bottom > b.bottom + eps || r.top < b.top - eps)) { errors.push(`clipped row: ${name}`); break; }
        }
        if (!reflow) {
          const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          if (!hit || (!e.contains(hit) && !hit.contains(e))) errors.push(`occluded: ${name}`);
        }
      }
    }
    return { height: d.scrollHeight, viewport: [innerWidth, innerHeight], errors: [...new Set(errors)] };
  }, { selectors, reflow });
}

async function rowTickers(page, selector) {
  return page.$$eval(selector, elements => elements.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => e.dataset.stockTicker));
}
async function structure({ page, fixture }, { reflow = false, paginated = false } = {}) {
  const measured = await geometry(page, ['.stock-dashboard', ...['portfolio', 'orders', 'context'].map(panel), portfolioRows, sideRows('buy'), sideRows('sell')], { reflow });
  const roots = await page.$$('.stock-dashboard');
  assert.equal(roots.length, 1, `Expected exactly one .stock-dashboard; got ${roots.length}; document ${measured.height}px at ${measured.viewport.join('x')} (${measured.errors.join('; ')})`);
  for (const name of ['portfolio', 'orders', 'context']) assert.equal((await page.$$(panel(name))).length, 1, `Exactly one ${name} panel`);
  const nav = await page.$$eval('nav, [role="navigation"]', elements => elements.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => e.getAttribute('aria-label') || ''));
  assert.equal(nav.filter(name => /primary/i.test(name)).length, 1, `One visible primary navigation; got ${JSON.stringify(nav)}`);
  if (!paginated) {
    assert.deepEqual((await rowTickers(page, portfolioRows)).sort(), fixture.holdings.map(h => h.ticker).sort(), 'All default holdings rows, exactly once');
    const layout = await page.evaluate(() => Object.fromEntries(['.sd-workspace', '.sd-orders .sd-panel-head', '.sd-funding', '.sd-sessions', '.sd-buy h3', '.sd-buy .sd-order-row', '.sd-sell .sd-order-row'].map(selector => [selector, document.querySelector(selector)?.getBoundingClientRect().height])));
    assert.deepEqual((await rowTickers(page, sideRows('buy'))).sort(), fixture.expectedBuys.map(h => h.ticker).sort(), `Unique buys, not duplicate alternatives or payload counts; measured heights ${JSON.stringify(layout)}`);
  }
  assert.deepEqual((await rowTickers(page, sideRows('sell'))).sort(), fixture.sales.map(h => h.ticker).sort(), 'All eight sells/trims simultaneously with buys');
  assert.deepEqual(measured.errors, [], `Geometry ${measured.viewport.join('x')}`);
  const tooSmall = await page.$$eval('.sd-portfolio-row > :last-child, .sd-order-top > *, .sd-order-bottom > *, .sd-funding, .sd-funding small', elements => elements.filter(element => element.getClientRects().length && parseFloat(getComputedStyle(element).fontSize) < 14).map(element => ({ text: element.textContent, size: getComputedStyle(element).fontSize })));
  assert.deepEqual(tooSmall, [], 'Calls, order mode, execution quantities/prices, risk and funding remain at least 14px');
  for (const buy of fixture.expectedBuys) {
    const row = await page.$(`${sideRows('buy').split(', ').map(s => `${s}[data-stock-ticker="${buy.ticker}"]`).join(', ')}`);
    if (!row && paginated) continue;
    assert(row, `Missing buy ${buy.ticker}`);
    const text = compact(await row.evaluate(e => e.innerText));
    assert(text.includes(numeric(buy.est_cad)), `${buy.ticker} preserves exact C$ amount ${numeric(buy.est_cad)}: ${text}`);
    assert.match(text, buy.market_order ? /market/i : /limit/i, `${buy.ticker} preserves selected order type`);
    if (buy.market_order) {
      assert(!/@/.test(text), `${buy.ticker} market route cannot show a limit quote`);
      assert.match(text, /no price protection/i, 'Market execution risk is visible without opening details');
    } else {
      assert(text.includes(`${buy.qty} @ `), `${buy.ticker} exact limit quantity stays in the row`);
      assert(text.includes(numeric(buy.limit_local)), `${buy.ticker} local limit price stays in the row`);
    }
  }
  for (const sale of fixture.sales) {
    const text = compact(await page.$eval(`${sideRows('sell').split(', ').map(s => `${s}[data-stock-ticker="${sale.ticker}"]`).join(', ')}`, e => e.innerText));
    assert(text.includes(numeric(sale.est_cad)), `${sale.ticker} preserves exact CAD proceeds`);
    assert(text.includes(`${sale.qty} @ `) && text.includes(numeric(sale.limit_local)), `${sale.ticker} exact sale execution fields visible`);
    assert.match(text, sale.reason_kind === 'funding' ? /funding/i : /exit[- ]rule/i, 'Funding sales and rule-driven exits remain distinct');
    if (sale.action === 'TRIM') assert.match(text, /trim/i, 'Trim remains distinct from full sale');
  }
  const orders = compact(await page.$eval(panel('orders'), e => e.innerText));
  for (const amount of [fixture.funding.raised_cad, fixture.funding.needed_cad, ...(fixture.funding.shortfall_cad > 0 ? [fixture.funding.shortfall_cad] : [])]) assert(orders.includes(numeric(amount)), `Full funding amount ${numeric(amount)} visible`);
}

async function control(page, pattern, scope = 'body') {
  const handles = await page.$$(`:is(${scope}) button, :is(${scope}) a, :is(${scope}) [role="tab"], :is(${scope}) summary, :is(${scope}) [role="button"]`);
  for (const handle of handles) {
    const info = await handle.evaluate(e => ({ name: e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || e.innerText,
      visible: !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden', disabled: e.disabled || e.getAttribute('aria-disabled') === 'true' }));
    if (info.visible && pattern.test(compact(info.name))) return { handle, disabled: info.disabled };
  }
  throw new Error(`Missing accessible control ${pattern} in ${scope}`);
}
async function clickControl(page, pattern, scope) {
  const c = await control(page, pattern, scope);
  assert(!c.disabled, `Control ${pattern} is enabled`);
  await c.handle.click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function visibleText(page, text) {
  await page.waitForFunction(text => document.body.innerText.includes(text), {}, text);
}
async function inspector(page, selector, ticker) {
  const row = await page.$(selector);
  assert(row, `Missing inspector opener ${ticker}`);
  const opener = await row.$('button, [role="button"], a') || row;
  await opener.focus();
  await opener.click();
  await page.waitForSelector('[role="dialog"], dialog[open]', { visible: true });
  const dialog = await page.$('[role="dialog"], dialog[open]');
  const text = compact(await dialog.evaluate(e => e.innerText));
  const name = await dialog.evaluate(e => e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join(' '));
  assert(name.includes(ticker), `Inspector accessible name contains ${ticker}`);
  assert(text.includes(ticker), 'Selected stock is rendered in inspector');
  return { opener, dialog, text };
}
async function closeInspector(page, opener, escape = true) {
  const origin = await opener.evaluate(e => ({ ticker: e.dataset.stockTicker, origin: e.dataset.stockOrigin, action: e.dataset.stockAction }));
  if (escape) await page.keyboard.press('Escape');
  else await clickControl(page, /close/i, '[role="dialog"], dialog[open]');
  await page.waitForFunction(() => ![...document.querySelectorAll('[role="dialog"], dialog[open]')].some(e => e.getClientRects().length));
  await page.waitForFunction(target => {
    const active = document.activeElement?.closest('[data-stock-origin]');
    return active?.dataset.stockTicker === target.ticker && active?.dataset.stockOrigin === target.origin && active?.dataset.stockAction === target.action;
  }, {}, origin);
  // The candidate list unmounts while its inspector is open. Its replacement must be found by identity.
  if (await opener.evaluate(e => e.isConnected)) assert(await opener.evaluate(e => document.activeElement === e || e.contains(document.activeElement)), 'A still-mounted opener keeps exact focus');
}
async function interactions(state) {
  const { page, fixture, requests } = state;
  await structure(state);
  const first = `${portfolioRows}[data-stock-ticker="SYN01"]`;
  let opened = await inspector(page, first, 'SYN01');
  assert(opened.text.includes(fixture.holdings[0].reason), 'Holding thesis remains reachable');
  const before = requests.get('pc_digest_private');
  await clickControl(page, /refresh/i);
  await page.waitForNetworkIdle();
  assert(requests.get('pc_digest_private') > before, 'Refresh actually refetches data');
  assert(await opened.dialog.evaluate(e => e.isConnected && e.innerText.includes('SYN01')), 'Refresh preserves a still-valid inspector selection');
  await closeInspector(page, opened.opener);
  opened = await inspector(page, first, 'SYN01');
  await closeInspector(page, opened.opener, false);
  // A selected holding that disappears from the refreshed payload cannot leave a stale inspector.
  const disappearing = `${portfolioRows}[data-stock-ticker="SYN09"]`;
  await inspector(page, disappearing, 'SYN09');
  const originalHoldings = fixture.privateRows[0].holdings;
  fixture.privateRows[0].holdings = originalHoldings.filter(h => h.ticker !== 'SYN09');
  await clickControl(page, /refresh/i);
  await page.waitForNetworkIdle();
  assert.equal(await page.$('[role="dialog"]'), null, 'Removed holding clears its inspector');
  fixture.privateRows[0].holdings = originalHoldings;
  await clickControl(page, /refresh/i);
  await page.waitForNetworkIdle();
  for (const line of [...fixture.expectedBuys.filter(b => !b.market_order), fixture.sales[0]]) {
    const selector = `${sideRows(line.action === 'SELL' ? 'sell' : 'buy').split(', ').map(s => `${s}[data-stock-ticker="${line.ticker}"]`).join(', ')}`;
    opened = await inspector(page, selector, line.ticker);
    for (const value of [line.name, line.currency, line.region, numeric(line.limit_local), numeric(line.limit_cad), line.session_et, line.next_open, line.why]) {
      assert(opened.text.includes(value), `${line.ticker} inspector preserves exact field ${value}`);
    }
    assert(new RegExp(`\\b${line.qty}\\b`).test(opened.text), `${line.ticker} exact quantity preserved`);
    assert.match(opened.text, /closed/i, 'Session state preserved');
    if (line.action === 'SELL') assert.match(opened.text, /exit rule/i, 'Sale reason kind preserved');
    await closeInspector(page, opened.opener);
  }
  await clickControl(page, /^research$/i);
  await visibleText(page, 'RES01');
  await visibleText(page, fixture.candidates[6].broker_note);
  // Research owns its contextual tabs; do not demand a second primary Reports entry.
  for (const [name, evidence, inResearch] of [
    [/^reports$/i, 'Synthetic report evidence: gates passed.', true],
    [/^model$|model evidence/i, 'Synthetic model evidence:', true],
    [/^brief$|daily brief/i, 'Synthetic daily brief:', true],
    [/full book/i, fixture.holdings.at(-1).reason, false],
    [/^history$/i, fixture.privateRows.at(-1).book_value_cad.toLocaleString('en-CA', { maximumFractionDigits: 0 }), false],
  ]) {
    await clickControl(page, /^(overview|dashboard)$/i);
    if (inResearch) await clickControl(page, /^research$/i);
    await clickControl(page, name);
    if (/reports/i.test(name.source)) await clickControl(page, /weekly report|full weekly report/i);
    await visibleText(page, evidence);
    if (/history/i.test(name.source)) {
      const rows = await page.$$eval('tbody', bodies => bodies.map(b => b.querySelectorAll('tr').length));
      assert(rows.includes(fixture.privateRows.length), 'All twelve history observations reachable');
    }
  }
}

async function universeRanking({ page, fixture }) {
  await clickControl(page, /^research$/i);
  await clickControl(page, /^universe$/i);
  await visibleText(page, 'Top 15 universe stocks');
  const actual = await page.$$eval('.sd-universe tbody tr', rows => rows.map(row => ({
    symbol: row.querySelector('strong').textContent,
    score: row.lastElementChild.textContent,
    text: row.textContent,
  })));
  assert.equal(actual.length, 15, 'Exactly fifteen universe names are reachable');
  fixture.routes.pc_quant[0].top.forEach((row, i) => {
    assert.equal(actual[i].symbol, row.symbol, 'Keep published universe order, including held names');
    assert.equal(actual[i].score, row.score.toFixed(1), 'Use universe score, not book score');
    assert(actual[i].text.includes(row.name), 'Company name is shown');
  });
  assert(actual.some(row => row.symbol === 'SYN01'), 'Held name stays in the ranking');
  assert(actual.some(row => row.symbol === 'UNI15'), 'Names outside the gated candidates stay in the ranking');
  await visibleText(page, 'Not filtered by buy gates or broker availability');
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    fonts: [...document.querySelectorAll('.sd-universe td, .sd-universe strong')].map(e => parseFloat(getComputedStyle(e).fontSize)),
    navs: [...document.querySelectorAll('nav[aria-label="Primary"]')].filter(e => e.getClientRects().length).length,
  }));
  assert(!geometry.overflow, 'Universe ranking fits the viewport');
  assert(geometry.fonts.every(size => size >= 14), 'Rank and score stay readable');
  assert.equal(geometry.navs, 1, 'Research does not add a second primary navigation');
}

async function paginate(state, kind, expected) {
  const { page } = state;
  const selector = kind === 'portfolio' ? portfolioRows : sideRows('buy');
  const scope = kind === 'portfolio' ? panel('portfolio') : side('buy');
  const summaryScope = kind === 'portfolio' ? panel('portfolio') : panel('orders');
  const seen = new Set();
  let pages = 0;
  while (pages++ < 20) {
    const tickers = await rowTickers(page, selector);
    assert(tickers.length > 0 && tickers.length < expected.length, `${kind} stress case must paginate, not render all rows`);
    for (const ticker of tickers) { assert(!seen.has(ticker), `${kind} duplicate/repeated pagination row ${ticker}`); seen.add(ticker); }
    const summary = await page.$eval(summaryScope, e => e.innerText);
    assert(new RegExp(`\\b${expected.length}\\b`).test(summary), `${kind} full count stays visible on every page`);
    await structure(state, { paginated: true });
    let next;
    try { next = await control(page, new RegExp(`next ${kind === 'portfolio' ? 'portfolio' : 'buy'} page`, 'i')); }
    catch { next = await control(page, /next/i, scope); }
    if (next.disabled) break;
    const previous = tickers.join(',');
    await next.handle.click();
    await page.waitForFunction(({ selector, previous }) => [...document.querySelectorAll(selector)].filter(e => e.getClientRects().length).map(e => e.dataset.stockTicker).join(',') !== previous, {}, { selector, previous });
  }
  assert(pages < 20, `${kind} pagination terminates`);
  assert.deepEqual([...seen].sort(), expected.map(e => e.ticker).sort(), `${kind} every item reachable exactly once`);
}

async function expandedShell({ page }) {
  await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
  await clickControl(page, /open analysis/i, '[role="dialog"]');
  await page.waitForSelector('[data-analysis-ticker="SYN01"]', { visible: true });
  if (options.out) await page.screenshot({ path: resolve(options.out, 'expanded-stock-summary.png'), fullPage: true });
  assert.equal((await page.$$('.sd-kpis > div')).length, 4, 'Analysis retains all four global metrics');
  assert.equal((await page.$$('nav[aria-label="Primary"]')).length, 1, 'Analysis does not add a second primary navigation');
  assert.equal((await page.$$('[data-dashboard-panel]')).length, 0, 'Expanded analysis replaces, not crowds, the main workspace');
  for (const label of [/^summary$/i, /^history$/i, /^news & evidence$/i]) {
    await control(page, label, '[aria-label="Stock analysis sections"]');
  }
  await clickControl(page, /attention.*details/i);
  await page.keyboard.press('Escape');
  assert(await page.$('[data-analysis-ticker="SYN01"]'), 'Escape closes warning disclosure before leaving analysis');
  assert.equal(await page.$eval('.sd-attention-details', e => e.open), false);
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { visible: true });
  assert(await page.evaluate(() => /open analysis/i.test(document.activeElement?.textContent || '')), 'Back from analysis restores focus to its semantic opener');
  await clickControl(page, /close/i, '[role="dialog"]');
  assert(await page.$eval(`${portfolioRows}[data-stock-ticker="SYN01"]`, e => document.activeElement === e), 'Unmounted original row is found semantically after expansion');
}

async function reflowCheck(state, enlarge) {
  const { page } = state;
  if (enlarge) {
    // Real 200% text enlargement, not deviceScaleFactor (which only changes screenshot DPI).
    await page.evaluate(() => {
      const elements = [...document.querySelectorAll('.stock-dashboard, .stock-dashboard *')];
      const sizes = elements.map(e => parseFloat(getComputedStyle(e).fontSize));
      elements.forEach((e, i) => e.style.setProperty('font-size', `${sizes[i] * 2}px`, 'important'));
    });
  }
  await structure(state, { reflow: true });
  // Inspect every actual row after scrolling it into view: never infer mobile correctness
  // from document width alone. Hidden overflow/ellipsis in actionable row text is clipping.
  for (const selector of [portfolioRows, sideRows('buy'), sideRows('sell')]) {
    for (const row of await page.$$(selector)) {
      await row.evaluate(e => e.scrollIntoView({ block: 'center' }));
      const clipped = await row.evaluate(e => [...e.querySelectorAll('*')].filter(child => {
        const s = getComputedStyle(child);
        return child.getClientRects().length && (child.scrollWidth > child.clientWidth + 2 && /hidden|clip/.test(s.overflowX) || child.scrollHeight > child.clientHeight + 2 && /hidden|clip/.test(s.overflowY));
      }).map(e => e.textContent));
      assert.deepEqual(clipped, [], 'Reflow row text cannot be silently clipped');
    }
  }
  await page.evaluate(() => scrollTo(0, 0));
  const opened = await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
  const g = await geometry(page, ['[role="dialog"], dialog[open]'], { reflow: true });
  assert.deepEqual(g.errors, [], 'Mobile/enlarged inspector reflows horizontally');
  await closeInspector(page, opened.opener);
}

function historyFixture() {
  const fixture = stockDashboardFixture();
  const plan = fixture.routes.pc_playbook[0];
  plan.generated_at = '2026-09-25T11:45:00.123456+00:00';
  const series = {
    status: 'ok', instrument_id: 'Yahoo Finance:SYN01:USD', listing_symbol: 'SYN01', underlying_symbol: null, currency: 'USD',
    source: 'Yahoo Finance', adjustment_basis: 'provider-adjusted close', fetched_at: '2026-09-26T10:00:01Z',
    coverage_start: '2026-09-23', coverage_end: '2026-09-25', timezone: 'America/New_York',
    observations: [{ date: '2026-09-23', value: 0 }, { date: '2026-09-24', value: null }, { date: '2026-09-25', value: 123.45678 }],
  };
  fixture.historyRows = [{ as_of: plan.as_of, generated_at: plan.generated_at, insights: {
    schema_version: 1, as_of: plan.as_of, snapshot_generated_at: plan.generated_at, generated_at: '2026-09-26T10:00:00Z', series: { SYN01: series },
  } }];
  fixture.privateRows.forEach((row, i) => {
    row.holdings = row.holdings.map(holding => ({ ...holding, rating: i === 0 ? 0 : i === 1 ? 42 : holding.rating,
      score_meta: i < 2 ? { schema_version: 1, model_version: holding.model_version, subject_id: holding.ticker, scope: 'book', cohort_id: 'synthetic-book', cohort_size: 15 } : null }));
  });
  return fixture;
}

function changesFixture() {
  const fixture = stockDashboardFixture();
  const book = fixture.routes.pc_digest_private[0];
  const priorBook = structuredClone(book); priorBook.as_of = '2026-09-24'; priorBook.holdings[0].call = 'PRIOR CALL';
  fixture.routes.pc_digest_private = [book, priorBook];
  const plan = fixture.routes.pc_playbook[0];
  for (const key of ['sells','trims','buys','watch','unfunded','not_fillable']) plan.today[key] ??= [];
  const priorPlan = structuredClone(plan); priorPlan.as_of = '2026-09-24';
  for (const row of [plan, priorPlan]) Object.assign(row.today, { as_of: row.as_of, ticket_as_of: row.as_of, comparison_meta: { schema_version: 1, ticket_status: 'ok', watch_status: 'ok', source_as_of: row.as_of } });
  priorPlan.today.sells[0].limit_local = 0.000123456789;
  priorPlan.today.sells.push({ ticker: 'OLD:STOCK', qty: 0.123456789, limit_local: 1.23456789, currency: 'JPY', est_cad: 17.23, why: 'Historical funding rationale', reason_kind: 'funding' });
  fixture.routes.pc_playbook = [plan, priorPlan];
  const weekly = fixture.routes.pc_weekly[0]; const priorWeekly = structuredClone(weekly); priorWeekly.as_of = '2026-09-18'; priorWeekly.actionable[0].broker_ok = !weekly.actionable[0].broker_ok;
  fixture.routes.pc_weekly = [weekly, priorWeekly];
  return fixture;
}

async function openStockHistory(page, ticker = 'SYN01', origin = 'portfolio') {
  await inspector(page, `[data-stock-origin="${origin}"][data-stock-ticker="${ticker}"]`, ticker);
  await clickControl(page, /open analysis/i, '[role="dialog"]');
  await clickControl(page, /^history$/i, '[aria-label="Stock analysis sections"]');
  await page.waitForSelector('.sd-history-data', { visible: true, timeout: 3000 });
}

async function expandedHistory({ page, fixture, queries }) {
  const historyQueries = () => queries.filter(query => query.select === 'as_of,generated_at,insights');
  assert.equal(historyQueries().length, 0, 'Overview makes no history requests');
  await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
  assert.equal(historyQueries().length, 0, 'Quick inspector remains lightweight');
  await clickControl(page, /open analysis/i, '[role="dialog"]');
  assert.equal(historyQueries().length, 0, 'Summary does not fetch chart payloads');
  await clickControl(page, /^history$/i, '[aria-label="Stock analysis sections"]');
  await page.waitForSelector('.sd-history-data', { visible: true, timeout: 3000 });
  await page.waitForSelector('.sd-history-chart svg', { visible: true });
  assert.equal(historyQueries().length, 1, 'History mounts one lazy request');
  assert.deepEqual(historyQueries()[0], { table: 'pc_playbook', select: 'as_of,generated_at,insights', limit: '1',
    as_of: `eq.${fixture.routes.pc_playbook[0].as_of}`, generated_at: `eq.${fixture.routes.pc_playbook[0].generated_at}` });
  const text = await page.$eval('.sd-history-data', element => element.innerText);
  assert.match(text, /SYN01 · USD/);
  assert.match(text, /provider-adjusted close/);
  assert.match(text, /2026-09-25, 123\.45678 USD/);
  assert.match(text, /Not live or an execution value/);
  assert.equal((await page.$$('.sd-history-chart svg')).length, 1, 'Only one chart');
  await clickControl(page, /^show observations/i, '.sd-history-data');
  assert.deepEqual(await page.$$eval('.sd-history-observations tbody tr', rows => rows.map(row => row.cells[1].textContent)), ['0', 'Unavailable', '123.45678']);
  if (options.out) await page.screenshot({ path: resolve(options.out, `history-${page.viewport().width}.png`), fullPage: true });
  await clickControl(page, /^rating$/i, '[aria-label="History chart"]');
  await page.waitForFunction(() => document.querySelector('.sd-history-observations caption')?.textContent.includes('rating'));
  const ratingRows = await page.$$eval('.sd-history-observations tbody tr', rows => rows.map(row => [row.cells[0].textContent, row.cells[1].textContent]));
  assert.deepEqual(ratingRows.slice(-2), [['2026-09-24', '42'], ['2026-09-25', '0']]);
  assert(ratingRows.slice(0, -2).every(row => row[1] === 'Unavailable'), 'Legacy scores are not invented comparable history');
  assert.equal(historyQueries().length, 1, 'Rating uses existing daily observations, not another fetch');
  assert.equal((await page.$$('.sd-history-chart svg')).length, 1);
  assert.equal((await page.$$('.sd-kpis > div')).length, 4);
  assert.equal((await page.$$('nav[aria-label="Primary"]')).length, 1);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'History reflows without horizontal clipping');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { visible: true });
  assert.equal(await page.$('.sd-history-data'), null, 'Back unmounts the private history cache');
  assert(await page.evaluate(() => /open analysis/i.test(document.activeElement?.textContent || '')), 'Semantic analysis opener regains focus');
}

function evidenceFixture() {
  const fixture = stockDashboardFixture();
  const current = fixture.routes.pc_news[0];
  fixture.holdings[0].call_evaluation = {
    as_of: fixture.privateRows[0].as_of, call: fixture.holdings[0].call,
    rule_version: 'synthetic-saved-rule', streak_verified: false,
    conditions: [{ label: 'Published weekly readings', observed: 0, operator: '>=', threshold: 2, status: 'reported' }],
    note: 'Synthetic published condition limitation; not a verified streak.',
  };
  const article = (title, url, published) => ({ ticker: 'SYN01', title, url, published, source: 'Synthetic News', image: null });
  current.stories = [article('Latest publication', 'https://news.invalid/latest', '2026-09-25T09:00:00-04:00')];
  fixture.routes.pc_news.push({ ...current, as_of: '2026-09-24', generated_at: '2026-09-24T20:00:00Z',
    tickers: [{ ticker: 'SYN01', read: 'Older generated summary must not replace the latest summary.' }],
    stories: [article('Earlier publication', 'https://news.invalid/earlier', '2026-09-24T17:00:00+09:00'),
      article('Latest publication', 'https://news.invalid/duplicate-title', '2026-09-24T11:00:00Z'),
      article('Unsafe undated headline', 'javascript:alert(1)', null),
      { ...article('Wrong ticker headline', 'https://news.invalid/other', null), ticker: 'SYN010' }],
  });
  return fixture;
}

async function expandedEvidence({ page, fixture, queries }) {
  assert.equal((await page.$$('.se-evidence')).length, 0, 'Advanced evidence is absent from the default dashboard');
  await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
  assert.equal((await page.$$('.se-evidence')).length, 0, 'Quick inspector does not crowd in detailed conditions or headlines');
  await clickControl(page, /open analysis/i, '[role="dialog"]');
  await page.waitForSelector('[aria-label="Published call evaluation"]', { visible: true, timeout: 3000 });
  const summary = await page.$eval('.sd-reading', element => element.innerText);
  assert(summary.includes(fixture.holdings[0].reason), 'Original published rationale remains visible');
  assert.match(summary, /Observed: 0; condition: >= 2/);
  assert.match(summary, /not verified consecutive weeks/);
  await clickControl(page, /^news & evidence$/i, '[aria-label="Stock analysis sections"]');
  await page.waitForSelector('[aria-label="SYN01 news and evidence"]', { visible: true });
  const evidence = await page.$eval('[aria-label="SYN01 news and evidence"]', element => element.innerText);
  assert(evidence.includes('Generated desk summary') && evidence.includes('Source snapshot: 2026-09-25'));
  assert(evidence.includes(fixture.routes.pc_news[0].tickers[0].read));
  assert(!evidence.includes('Older generated summary') && !evidence.includes(fixture.routes.pc_news[0].summary));
  assert(!evidence.includes('Wrong ticker headline'));
  assert.deepEqual(await page.$$eval('.se-articles > li', rows => rows.map(row => row.firstElementChild.textContent)), ['Latest publication', 'Earlier publication', 'Unsafe undated headline']);
  assert(evidence.includes('2026-09-25T09:00:00-04:00') && evidence.includes('2026-09-24T17:00:00+09:00'));
  assert.match(evidence, /Publication date unavailable/);
  assert.equal((await page.$$('.se-articles a')).length, 2, 'Unsafe evidence URLs remain text');
  assert(await page.$$eval('.se-articles a', links => links.every(link => link.target === '_blank' && link.rel.includes('noopener') && link.rel.includes('noreferrer'))));
  assert.equal(queries.filter(query => query.select?.split(',').includes('insights')).length, 0, 'Evidence does not fetch price-history payloads');
  const measured = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    font: getComputedStyle(document.querySelector('.se-articles a')).fontSize,
    navs: document.querySelectorAll('nav[aria-label="Primary"]').length,
    metrics: document.querySelectorAll('.sd-kpis > div').length,
  }));
  assert.equal(measured.overflow, false);
  assert(parseFloat(measured.font) >= 14);
  assert.equal(measured.navs, 1);
  assert.equal(measured.metrics, 4);
  if (options.out) await page.screenshot({ path: resolve(options.out, `evidence-${page.viewport().width}.png`), fullPage: true });
  await clickControl(page, /^summary$/i, '[aria-label="Stock analysis sections"]');
  fixture.holdings[0].call_evaluation.as_of = '2026-09-24';
  await clickControl(page, /^refresh$/i);
  await page.waitForFunction(() => document.querySelector('[aria-label="Published call evaluation"]')?.textContent.includes('Detailed conditions not published'));
  assert((await page.$eval('.sd-reading', element => element.innerText)).includes(fixture.holdings[0].reason));
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { visible: true });
  assert(await page.evaluate(() => /open analysis/i.test(document.activeElement?.textContent || '')), 'Back preserves semantic stock origin');
}

try {
  options.url ||= await localServer();
  const url = new URL(options.url);
  assert(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), '--url must be local HTTP; never point this harness at a live deployment');
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  if (options.mode === 'all' || options.mode === 'structure') {
    for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
      await withFixture(`structure-${width}x${height}`, { width, height }, stockDashboardFixture(), structure);
    }
    for (const [width, height] of [[1280, 720], [390, 844], [320, 640]]) {
      const fixture = stockDashboardFixture();
      fixture.holdings[0].call = 'NO DATA';
      await withFixture(`portfolio-no-data-call-${width}`, { width, height }, fixture, async state => {
        await structure(state, { reflow: width < 1280 });
        assert.equal(await state.page.$eval('.sd-portfolio-row > :last-child', element => element.textContent), 'NO DATA');
      });
    }
  }
  if (options.mode === 'all' || options.mode === 'interactions') await withFixture('interactions', { width: 1440, height: 900 }, stockDashboardFixture(), interactions);
  if (options.mode === 'all' || options.mode === 'universe') {
    for (const [width, height] of [[1280, 800], [390, 844], [360, 640]]) {
      await withFixture(`universe-${width}`, { width, height }, stockDashboardFixture(), universeRanking);
    }
  }
  if (options.mode === 'all' || options.mode === 'depth-shell') await withFixture('expanded-analysis-shell', { width: 1280, height: 720 }, stockDashboardFixture(), expandedShell);
  if (options.mode === 'all' || options.mode === 'depth-evidence') {
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await withFixture(`expanded-evidence-${width}`, { width, height }, evidenceFixture(), expandedEvidence);
    }
  }
  if (options.mode === 'all' || options.mode === 'depth-changes') await withFixture('changes-real-source-events', { width: 1280, height: 720 }, changesFixture(), async ({ page }) => {
    await clickControl(page, /Changes/i); await page.waitForSelector('[data-change-id]');
    const text = await page.$eval('.stock-changes', el => el.innerText);
    assert.match(text, /PRIOR CALL/); assert.match(text, /0.000123456789/); assert.match(text, /2026-09-18/); assert(!text.includes('{"'));
    const removed = await page.$$eval('[data-change-id]', rows => rows.find(row => row.innerText.includes('OLD:STOCK')).dataset.changeId);
    await clickControl(page, /Open stock analysis/, `[data-change-id="${removed}"]`);
    await page.waitForSelector('[data-detail-origin="change"]');
    const historical = await page.$eval('[data-detail-origin="change"]', el => el.innerText);
    assert.match(historical, /Historical funding rationale/); assert.match(historical, /1.23456789 JPY/); assert.match(historical, /Historical/);
    await page.keyboard.press('Escape'); await page.waitForSelector('.stock-changes');
    assert.equal(await page.evaluate(id => document.activeElement?.closest('[data-change-id]')?.dataset.changeId === id, removed), true);
    await clickControl(page, /Mark reviewed/, `[data-change-id="${removed}"]`);
    await clickControl(page, /^Reviewed \(/, '.stock-changes');
    await clickControl(page, /Open stock analysis/, `[data-change-id="${removed}"]`);
    await page.keyboard.press('Escape'); await page.waitForSelector('.stock-changes');
    await clickControl(page, /^Reviewed \(/, '.stock-changes');
    assert(await page.$(`[data-change-id="${removed}"]`), 'Review survives analysis/back');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('stock-change-review:'))), [], 'Legacy session never persists review under email/token');
  });
  if (options.mode === 'all' || options.mode === 'depth-changes') {
    await withFixture('changes-failed-refresh-and-recovery', { width: 1280, height: 720 }, changesFixture(), async ({ page, fixture }) => {
      await clickControl(page, /Changes/i); await page.waitForSelector('[data-change-id]');
      fixture.statuses = { pc_playbook: 500 };
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => document.querySelector('.stock-changes')?.innerText.includes('read failed'));
      assert.equal(await page.$$eval('.stock-changes > section', rows => rows.find(row => row.querySelector('h4')?.textContent === 'plan').querySelectorAll('[data-change-id]').length), 0);
      assert.match(await page.$eval('.stock-changes', el => el.innerText), /PRIOR CALL/);
      fixture.statuses = {}; fixture.routes.pc_playbook = [];
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => document.querySelector('.stock-changes')?.innerText.includes('No complete published snapshot'));
      fixture.routes.pc_playbook = changesFixture().routes.pc_playbook.slice(0, 1);
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => document.querySelector('.stock-changes')?.innerText.includes('Baseline recorded'));
      fixture.statuses = { pc_digest_private: 500 };
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => document.querySelector('.stock-changes')?.innerText.includes('read failed'));
      await clickControl(page, /^Back to Dashboard$/);
      await visibleText(page, 'Changes · comparison unavailable');
      assert(await page.$('[data-dashboard-panel="portfolio"] [data-stock-ticker="SYN01"]'), 'Unavailable comparisons do not erase retained overview');
    });
    await withFixture('changes-crypto-isolation-late-refresh', { width: 1280, height: 720 }, changesFixture(), async ({ page, fixture }) => {
      await clickControl(page, /Changes/i); await page.waitForSelector('[data-change-id]');
      await page.evaluate(() => {
        const original = crypto.subtle.digest.bind(crypto.subtle);
        window.originalDigest = original;
        crypto.subtle.digest = (algorithm, data) => new TextDecoder().decode(data).startsWith('["plan"') ? Promise.reject(new Error('Synthetic crypto failure')) : original(algorithm, data);
      });
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => document.querySelector('.stock-changes')?.innerText.includes('event identity unavailable'));
      assert.match(await page.$eval('.stock-changes', el => el.innerText), /PRIOR CALL/);
      await page.evaluate(() => { window.pendingDigests = []; crypto.subtle.digest = (algorithm, data) => new Promise(resolve => window.pendingDigests.push(() => window.originalDigest(algorithm, data).then(resolve))); });
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => window.pendingDigests.length > 0);
      assert.equal(await page.$$eval('[data-change-id]', rows => rows.length), 0, 'Old events removed while crypto pending');
      fixture.routes.pc_digest_private = [fixture.routes.pc_digest_private[0]]; fixture.routes.pc_playbook = [fixture.routes.pc_playbook[0]]; fixture.routes.pc_weekly = [fixture.routes.pc_weekly[0]];
      await page.evaluate(() => { crypto.subtle.digest = window.originalDigest; });
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => document.querySelector('.stock-changes')?.innerText.includes('Baseline recorded'));
      await page.evaluate(async () => { await Promise.all(window.pendingDigests.map(resolve => resolve())); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.$$eval('[data-change-id]', rows => rows.length), 0, 'Late crypto cannot restore superseded events');
      const fresh = changesFixture(); for (const table of ['pc_digest_private', 'pc_playbook', 'pc_weekly']) fixture.routes[table] = fresh.routes[table];
      await page.evaluate(() => { window.pendingDigests = []; crypto.subtle.digest = (algorithm, data) => new Promise(resolve => window.pendingDigests.push(() => window.originalDigest(algorithm, data).then(resolve))); });
      await clickControl(page, /^Refresh$/); await page.waitForFunction(() => window.pendingDigests.length > 0);
      fixture.statuses = { pc_digest_private: 403 };
      await clickControl(page, /^Refresh$/); await visibleText(page, 'Private book unavailable');
      await page.evaluate(async () => { crypto.subtle.digest = window.originalDigest; await Promise.all(window.pendingDigests.map(resolve => resolve())); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.$('[data-dashboard-panel]'), null, 'Late crypto cannot remount financial panels after authoritative access loss');
      assert(!await page.evaluate(() => /SYN01|OLD:STOCK|PRIOR CALL/.test(document.body.innerText)), 'Late crypto cannot restore private facts');
      assert.equal(await page.$('.stock-changes'), null);

    });
    await withFixture('changes-revision-historical-window', { width: 390, height: 844 }, changesFixture(), async ({ page, fixture, requests }) => {
      await clickControl(page, /Changes/i); await page.waitForSelector('[data-change-id]');
      const splitLabels = await page.$$eval('.stock-changes dl dl dt', labels => {
        if (!labels.length) throw new Error('Expected nested published facts');
        return labels.flatMap(label => {
          const node = label.firstChild;
          if (!node || node.nodeType !== Node.TEXT_NODE) throw new Error('Expected a text fact label');
          return [...node.textContent.matchAll(/\S+/g)].flatMap(match => {
            const range = document.createRange();
            range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
            return range.getClientRects().length > 1 ? [label.textContent] : [];
          });
        });
      });
      assert.deepEqual(splitLabels, [], 'Mobile historical fact labels must not split words into fragments');
      const initialRequests = requests.get('pc_digest_private');
      await page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); window.scrollTo(0, 0); });
      await page.waitForFunction(() => !document.querySelector('.stock-changes')?.innerText.includes('Loading comparison'));
      assert.equal(requests.get('pc_digest_private'), initialRequests, 'Parent scroll rerenders do not restart reads');
      const id = await page.$$eval('.stock-changes article[data-change-id]', rows => rows.find(row => row.innerText.includes('PRIOR CALL')).dataset.changeId);
      await clickControl(page, /Mark reviewed/, `[data-change-id="${id}"]`);
      await clickControl(page, /^Reviewed \(/, '.stock-changes');
      await page.waitForFunction(id => [...document.querySelectorAll(`[data-change-id="${id}"] button`)].some(b => b.isConnected && b.getClientRects().length > 0), {}, id);
      await clickControl(page, /Open stock analysis/, `[data-change-id="${id}"]`);
      await page.waitForSelector('[data-detail-origin="change"]');
      fixture.routes.pc_digest_private[1].holdings[0].call = 'REVISED PRIOR';
      await clickControl(page, /^Refresh$/);
      await page.waitForFunction(() => document.querySelector('[data-detail-origin="change"]')?.innerText.includes('no longer'));
      await page.keyboard.press('Escape'); await page.waitForSelector('.stock-changes');
      await page.waitForFunction(() => document.querySelector('.stock-changes')?.innerText.includes('REVISED PRIOR'));
      assert.equal(await page.$(`[data-change-id="${id}"]`), null);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    });
  }
  if (options.mode === 'all' || options.mode === 'depth-changes') await withFixture('changes-controller-link', { width: 1280, height: 720 }, stockDashboardFixture(), async ({ page }) => {
    await clickControl(page, /Changes/i);
    await page.waitForSelector('.stock-changes');
    assert.match(await page.$eval('.stock-changes', el => el.innerText), /Before:.*After:/s);
  });
  if (options.mode === 'all' || options.mode === 'depth-history') {
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await withFixture(`expanded-history-${width}`, { width, height }, historyFixture(), expandedHistory);
    }
    await withFixture('history-refresh-and-authoritative-recheck', { width: 1280, height: 720 }, historyFixture(), async ({ page, fixture, requests, queries }) => {
      await openStockHistory(page);
      await page.waitForSelector('.sd-history-chart svg');
      fixture.historyStatus = 500;
      await clickControl(page, /^refresh price history$/i, '.sd-history-data');
      await page.waitForNetworkIdle();
      assert(await page.$('.sd-history-chart svg'), 'Same-snapshot ordinary failure retains useful chart');
      assert.match(await page.$eval('.sd-history-data', e => e.innerText), /last successful response; freshness could not be confirmed/);
      const gateReads = requests.get('pc_digest_private');
      fixture.historyStatus = 403;
      await clickControl(page, /^retry price history$/i, '.sd-history-data');
      await page.waitForNetworkIdle();
      assert.equal(requests.get('pc_digest_private'), gateReads + 1, 'A secondary denial asks the actual private gate exactly once');
      assert.equal(await page.$('.sd-history-chart svg'), null, 'Secondary denial removes its local price cache');
      assert(await page.$('.sd-history-data'), 'Successful authoritative check retains the analysis workspace');
      assert(await page.evaluate(() => Boolean(localStorage.getItem('pc-desk-session'))), 'Secondary denial does not log out');
      fixture.statuses = { pc_digest_private: 403 };
      await clickControl(page, /^retry price history$/i, '.sd-history-data');
      await page.waitForSelector('.sd-unavailable');
      assert.equal(await page.$('.sd-history-data'), null, 'Authoritative denial unmounts every history control and cache');
      assert(!await page.evaluate(() => /SYN01|123\.45678/.test(document.body.innerText)), 'No retained private history survives denial');
      const historyCount = queries.filter(q => q.select === 'as_of,generated_at,insights').length;
      fixture.statuses = {}; fixture.historyStatus = 200;
      await clickControl(page, /^refresh$/i);
      await page.waitForSelector('[data-dashboard-panel="portfolio"]');
      await page.waitForNetworkIdle();
      assert.equal(queries.filter(q => q.select === 'as_of,generated_at,insights').length, historyCount, 'Restoring access returns to lightweight overview');
    });
    await withFixture('history-snapshot-refresh-rejects-retained-and-late-data', { width: 1280, height: 720 }, historyFixture(), async ({ page, fixture }) => {
      await openStockHistory(page);
      await page.waitForSelector('.sd-history-chart svg');
      const plan = fixture.routes.pc_playbook[0];
      plan.generated_at = '2026-09-25T11:45:00.123457+00:00';
      await clickControl(page, /^refresh$/i);
      await page.waitForFunction(() => document.querySelector('.sd-history-data')?.textContent.includes('different published snapshot'));
      assert.equal(await page.$('.sd-history-chart svg'), null, 'A same-day financial revision cannot show the prior chart');
      fixture.historyRows[0].generated_at = plan.generated_at;
      await clickControl(page, /^refresh price history$/i, '.sd-history-data');
      await page.waitForFunction(() => document.querySelector('.sd-history-data')?.textContent.includes('older or unverified financial snapshot'));
      assert.equal(await page.$('.sd-history-chart svg'), null, 'Retained optional JSON cannot adopt the new outer timestamp');
      fixture.historyRows[0].insights.snapshot_generated_at = plan.generated_at;
      const lateRows = structuredClone(fixture.historyRows);
      fixture.historyHang = true;
      await clickControl(page, /^refresh price history$/i, '.sd-history-data');
      await page.waitForFunction(() => document.querySelector('.sd-history-data')?.textContent.includes('Loading price history'));
      assert.equal(fixture.historyPending.length, 1);
      fixture.historyHang = false;
      plan.generated_at = '2026-09-25T11:45:00.123458+00:00';
      fixture.historyRows[0].generated_at = plan.generated_at;
      fixture.historyRows[0].insights.snapshot_generated_at = plan.generated_at;
      fixture.historyRows[0].insights.series.SYN01.observations.at(-1).value = 88.12345;
      await clickControl(page, /^refresh$/i);
      await page.waitForFunction(() => document.querySelector('.sd-history-data')?.textContent.includes('88.12345 USD'));
      for (const request of fixture.historyPending) await request.respond({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(lateRows) });
      await page.waitForNetworkIdle();
      const text = await page.$eval('.sd-history-data', e => e.innerText);
      assert(text.includes('88.12345 USD') && !text.includes('123.45678'), 'Superseded lazy response cannot restore an older series');
    });
    const scoped = historyFixture();
    Object.assign(scoped.candidates[0], { ticker: 'SYN01', currency: 'EUR', rating: 97,
      score_meta: { schema_version: 1, model_version: 'synthetic-universe', subject_id: 'SYN01', scope: 'universe', cohort_id: 'synthetic-universe', cohort_size: 100 } });
    scoped.routes.pc_weekly.push({ ...structuredClone(scoped.routes.pc_weekly[0]), as_of: '2026-09-18',
      actionable: [{ ...structuredClone(scoped.candidates[0]), rating: 55 }] });
    await withFixture('history-candidate-keeps-own-scope-and-currency', { width: 1280, height: 720 }, scoped, async ({ page }) => {
      await openStockHistory(page, 'SYN01', 'candidate');
      await page.waitForFunction(() => document.querySelector('.sd-history-data')?.textContent.includes('quote currency'));
      assert.equal(await page.$('.sd-history-chart svg'), null, 'A same-ticker candidate cannot borrow the holding currency to make price history match');
      await clickControl(page, /^rating$/i, '[aria-label="History chart"]');
      assert(await page.$('[aria-label="SYN01 universe history"]'), 'Candidate history stays in universe scope');
      await clickControl(page, /^show observations/i, '.sd-history-data');
      assert.deepEqual(await page.$$eval('.sd-history-observations tbody tr', rows => rows.map(row => [row.cells[0].textContent, row.cells[1].textContent])), [['2026-09-18', '55'], ['2026-09-25', '97']]);
    });
    const unstamped = historyFixture();
    delete unstamped.routes.pc_playbook[0].generated_at;
    unstamped.privateRows[2].as_of = '2026-09-27';
    await withFixture('history-unstamped-plan-and-future-rating', { width: 1280, height: 720 }, unstamped, async ({ page, queries }) => {
      await openStockHistory(page);
      assert.equal(queries.filter(q => q.select === 'as_of,generated_at,insights').length, 0, 'Missing financial generation cannot trigger a guessed history read');
      assert.match(await page.$eval('.sd-history-data', e => e.innerText), /snapshot identity unavailable/);
      await clickControl(page, /^rating$/i, '[aria-label="History chart"]');
      await clickControl(page, /^show observations/i, '.sd-history-data');
      const dates = await page.$$eval('.sd-history-observations tbody tr', rows => rows.map(row => row.cells[0].textContent));
      assert(!dates.includes('2026-09-27'), 'Parent supplies a trusted current-date cutoff rather than an untrusted source date');
      assert(dates.includes('2026-09-25'), 'Rating history remains usable without price payload');
    });
  }
  if (options.mode === 'all' || options.mode === 'depth-inspector') {
    const factors = stockDashboardFixture();
    factors.holdings[0].pillars.growth = 0;
    factors.holdings[0].pillars.revisions = null;
    factors.holdings[0].model_version = '2026-09-25-five-pillar';
    Object.assign(factors.candidates[0], { ticker: 'SYN01', pillars: { growth: 12, revisions: 24, momentum: 36, valuation: 48, quality: 60 }, model_version: '2026-09-25-five-pillar', rating_scope: 'universe' });
    await withFixture('contextual-factors-and-execution', { width: 1280, height: 720 }, factors, async ({ page, fixture }) => {
      let opened = await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
      assert.equal((await opened.dialog.$$('[data-factor-key]')).length, 5, 'Holding inspector exposes exactly five factors, not a second scope');
      assert.equal(await opened.dialog.$eval('[data-factor-key="growth"]', e => e.dataset.factorValue), '0');
      assert.equal(await opened.dialog.$eval('[data-factor-key="revisions"]', e => e.dataset.factorValue), 'unavailable');
      assert.equal(await opened.dialog.$eval('.sd-factor-track > span', e => getComputedStyle(e).width), '0px');
      assert.match(opened.text, /Book factors/);
      assert.match(opened.text, /Weight 27\.2%/);
      assert.match(opened.text, /Input coverage not published/);
      assert(opened.text.includes(fixture.holdings[0].reason));
      if (options.out) await page.screenshot({ path: resolve(options.out, 'factor-inspector.png'), fullPage: true });
      await closeInspector(page, opened.opener);
      opened = await inspector(page, '[data-stock-origin="sell"][data-stock-ticker="SYN01"]', 'SYN01');
      const firstSection = await opened.dialog.$eval('.sd-inspector-content section', e => e.innerText);
      assert.match(firstSection, /^SELL proposal/, 'A held stock clicked from a sale leads with that proposal, not its book call');
      for (const text of [fixture.sales[0].name, fixture.sales[0].why, numeric(fixture.sales[0].est_cad), numeric(fixture.sales[0].limit_local)]) assert(firstSection.includes(text), 'Sale execution facts stay in the leading section');
      await closeInspector(page, opened.opener);
      opened = await inspector(page, '[data-stock-origin="candidate"][data-stock-ticker="SYN01"]', 'SYN01');
      assert.equal((await opened.dialog.$$('[data-factor-key]')).length, 5, 'Candidate uses its own breakdown only');
      assert.equal(await opened.dialog.$eval('[data-factor-key="growth"]', e => e.dataset.factorValue), '12');
      assert.match(opened.text, /Universe factors/);
      assert(!opened.text.includes('Book factors'), 'A same-ticker holding cannot donate its factors to a candidate');
      await closeInspector(page, opened.opener);
      opened = await inspector(page, `${portfolioRows}[data-stock-ticker="${fixture.holdings.at(-1).ticker}"]`, fixture.holdings.at(-1).ticker);
      assert.equal((await opened.dialog.$$('[data-factor-key]')).length, 0);
      assert.match(opened.text, /ETF.*not scored by the equity model/);
      await closeInspector(page, opened.opener);
      await structure({ page, fixture });
    });
  }
  if (options.mode === 'all' || options.mode === 'depth-data') {
    for (const gate of [403, 401, 'empty']) for (const fault of (gate === 401 ? ['success', 'abort', 'hang'] : ['abort', 'hang'])) {
      await withFixture(`private-${gate}-secondary-${fault}`, { width: 1280, height: 720 }, stockDashboardFixture(), async ({ page, fixture, requests: stateRequests }) => {
        await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
        const originalPrivate = fixture.routes.pc_digest_private;
        if (gate === 'empty') { fixture.routes.pc_digest_private = []; fixture.probes = ['pc_reader_view']; }
        else fixture.statuses = { pc_digest_private: gate };
        if (fault !== 'success') fixture[fault === 'abort' ? 'abortTables' : 'hangTables'] = ['pc_news'];
        const navigations = [];
        page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(new URL(frame.url()).pathname); });
        assert(await page.evaluate(() => JSON.parse(localStorage.getItem('pc-desk-session')).expires_at > Date.now()), 'Persisted session is locally unexpired before server denial');
        await clickControl(page, /refresh/i);
        // Do not wait for network idle: the held request must still be pending at invalidation.
        await page.waitForFunction(() => !document.querySelector('[data-dashboard-panel]') && !document.querySelector('[role="dialog"]'), { timeout: 3000 });
        assert(!await page.evaluate(() => /SYN01|BUY01|RES01/.test(document.body.innerText)), 'Private denial clears cached workspace and selection despite secondary fault');
        if (gate === 401) {
          await page.waitForFunction(() => location.pathname === '/login' && !localStorage.getItem('pc-desk-session'), { timeout: 3000 });
          assert(await page.$('input[type="email"]'), 'Stable login form replaces the desk');
        } else assert(await page.evaluate(() => Boolean(localStorage.getItem('pc-desk-session'))), 'Non-401 gates retain session');
        if (fault === 'hang') {
          assert.equal(fixture.pendingRequests?.length, 1, 'Secondary is still held when the gate clears');
          await Promise.all(fixture.pendingRequests.map(request => gate === 401
            ? request.respond({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(fixture.routes.pc_news) })
            : request.abort('failed')));
        }
        fixture.abortTables = []; fixture.hangTables = [];
        await page.waitForNetworkIdle();
        if (gate === 401) {
          const counts = [...stateRequests];
          await new Promise(resolve => setTimeout(resolve, 600));
          assert.equal(new URL(page.url()).pathname, '/login', 'Login remains stable after late completion');
          assert.equal(await page.evaluate(() => localStorage.getItem('pc-desk-session')), null, 'Late completion cannot resurrect session');
          assert.deepEqual([...stateRequests], counts, 'No continued desk request churn');
          assert.deepEqual(navigations, ['/login'], 'No login/desk remount loop');
        }
        assert.equal(await page.$('[data-dashboard-panel]'), null, 'Late secondary rejection cannot restore revoked workspace');
        if (gate !== 401) {
          fixture.routes.pc_digest_private = originalPrivate;
          fixture.statuses = Object.fromEntries(Object.keys(fixture.routes).filter(table => table !== 'pc_digest_private').map(table => [table, 500]));
          await clickControl(page, /refresh/i);
          await page.waitForNetworkIdle();
          assert(await page.$(panel('portfolio')), 'Successful private gate restores the new book');
          assert(!await page.evaluate(() => /BUY01|RES01/.test(document.body.innerText)), 'Failed secondaries cannot revive revoked snapshots');
          assert.equal((await rowTickers(page, sideRows('buy'))).length, 0);
        }
      });
    }
    for (const fault of ['private-500', 'private-abort', 'secondary-500', 'secondary-abort', 'secondary-403', 'secondary-401']) {
      await withFixture(`ordinary-refresh-${fault}`, { width: 1280, height: 720 }, stockDashboardFixture(), async state => {
        const { page, fixture } = state;
        const table = fault.startsWith('private') ? 'pc_digest_private' : 'pc_news';
        if (fault.endsWith('abort')) fixture.abortTables = [table];
        else fixture.statuses = { [table]: Number(fault.split('-')[1]) };
        await clickControl(page, /refresh/i);
        await page.waitForNetworkIdle();
        await structure(state);
        assert(await page.evaluate(() => Boolean(localStorage.getItem('pc-desk-session'))), 'Ordinary and secondary failures retain the session');
        assert.equal(new URL(page.url()).pathname, '/stocks');
        assert.match(await page.evaluate(() => document.body.innerText), /failed|could not|HTTP 500/i, 'Ordinary failures retain the populated workspace with a warning');
      });
    }
    await withFixture('bounded-lightweight-snapshot-reads', { width: 1280, height: 720 }, stockDashboardFixture(), async ({ page, queries }) => {
      const verifyReads = () => {
        const plans = queries.filter(query => query.table === 'pc_playbook');
        assert(plans.length > 0, 'Read the actual owner-gated plan');
        for (const query of plans) {
          assert.equal(query.select, 'as_of,generated_at,holdings,entries,today', 'Initial plan reads exclude optional heavy insights');
          assert.equal(query.limit, '2', 'Fetch the bounded daily current/predecessor pair');
        }
        assert(queries.filter(query => query.table === 'pc_weekly').every(query => query.limit === '2'), 'Weekly comparisons retain their own bounded predecessor');
      };
      verifyReads();
      await clickControl(page, /refresh/i);
      await page.waitForNetworkIdle();
      verifyReads();
      assert.equal(queries.filter(query => query.select?.includes('insights')).length, 0, 'Overview refresh never requests chart payloads');
      await structure({ page, fixture: stockDashboardFixture() });
    });
    await withFixture('private-access-loss-clears-financial-state', { width: 1280, height: 720 }, stockDashboardFixture(), async ({ page, fixture }) => {
      await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
      fixture.statuses = { pc_digest_private: 403 };
      await clickControl(page, /refresh/i);
      await page.waitForNetworkIdle();
      assert.equal(await page.$('[data-dashboard-panel]'), null, 'Forbidden private access discards the retained financial workspace');
      assert.equal(await page.$('[role="dialog"]'), null, 'Forbidden private access clears stock selection');
      assert(!await page.evaluate(() => /SYN01|BUY01|RES01/.test(document.body.innerText)), 'No cached private or secondary stock detail survives access loss');
      await visibleText(page, 'HTTP 403');
      // An unrelated secondary failure cannot revive data from the revoked access period.
      fixture.statuses = { pc_playbook: 500, pc_weekly: 500, pc_news: 500 };
      await clickControl(page, /refresh/i);
      await page.waitForNetworkIdle();
      assert(await page.$(panel('portfolio')), 'A new successful owner-gated book read restores access');
      assert(!await page.evaluate(() => /BUY01|RES01/.test(document.body.innerText)), 'Revoked secondary snapshots were cleared, not silently retained');
      assert.equal((await rowTickers(page, sideRows('buy'))).length, 0);
    });
  }
  if (options.mode === 'all' || options.mode === 'stress') {
    await withFixture('stress-30-holdings-25-buys', { width: 1280, height: 720 }, stockDashboardFixture({ holdingsCount: 30, buysCount: 25 }), async state => {
      await structure(state, { paginated: true });
      await paginate(state, 'portfolio', state.fixture.holdings);
      await paginate(state, 'buy', state.fixture.expectedBuys);
    });
  }
  if (options.mode === 'all' || options.mode === 'resilience') {
    const emptyPrivate = stockDashboardFixture();
    emptyPrivate.routes.pc_digest_private = [];
    emptyPrivate.probes = ['pc_reader_view'];
    await withFixture('private-book-gate', { width: 1280, height: 720 }, emptyPrivate, async ({ page, probes: probeLog }) => {
      assert.deepEqual(probeLog, [{ select: 'updated_at', limit: '1' }], 'The hand-off probe reads one reader-view row and nothing else');
      assert.equal(await page.$('[data-order-side]'), null, 'No derived financial workspace without an approved private book');
      assert(!await page.evaluate(() => document.body.innerText.includes('BUY01')), 'Secondary payload cannot bypass the private-book gate');
      assert.match(await page.evaluate(() => document.body.innerText), /access|private|allowlist|publication/i);
    });
    const fallback = stockDashboardFixture();
    delete fallback.routes.pc_playbook[0].today.funding.raised_cad;
    delete fallback.routes.pc_playbook[0].today.funding.shortfall_cad;
    // The derived shortfall has to be a real one. The queue is capped at the money (2026-09-27), so a
    // plan whose proceeds cover its buys has a shortfall of exactly C$0 - which the panel suppresses by
    // design ("never a float residue that prints as C$0"), making this scenario unfalsifiable with the
    // full sale list. Trim the plan's proceeds below its need so the subtraction the panel owes the
    // owner is a figure, and keep the rendered lines in step with the funding sources.
    const kept = fallback.sales.slice(0, 3);
    fallback.sales = kept;
    const fallbackToday = fallback.routes.pc_playbook[0].today;
    fallbackToday.sells = kept.filter((line) => line.action === 'SELL');
    fallbackToday.trims = kept.filter((line) => line.action === 'TRIM');
    fallbackToday.funding.sources = kept.map((line) => ({ ticker: line.ticker, cad: line.est_cad, reason_kind: line.reason_kind, why: line.why }));
    await withFixture('funding-fallback', { width: 1280, height: 720 }, fallback, async ({ page }) => {
      const text = compact(await page.$eval(panel('orders'), e => e.innerText));
      const raised = fallback.sales.reduce((sum, line) => sum + line.est_cad, 0);
      assert(text.includes(numeric(raised)), 'Overview reuses supported proceeds fallback from funding sources');
      assert(text.includes(numeric(Math.max(0, fallback.funding.needed_cad - raised))), 'Known derived shortfall is not unavailable');
    });
    const failure = stockDashboardFixture();
    failure.statuses = { pc_news: 500 };
    await withFixture('warnings-during-inspection', { width: 1280, height: 720 }, failure, async ({ page }) => {
      const opened = await inspector(page, `${portfolioRows}[data-stock-ticker="SYN01"]`, 'SYN01');
      assert.match(await page.evaluate(() => document.body.innerText), /Brief fetch failed/i, 'Substantive failure stays visible during stock inspection');
      await clickControl(page, /attention.*details/i);
      await visibleText(page, 'HTTP 500');
      assert(await opened.dialog.evaluate(e => e.isConnected), 'Reading warnings does not discard selected stock');
    });
    await withFixture('capacity-grows-with-height', { width: 1280, height: 720 }, stockDashboardFixture({ holdingsCount: 30, buysCount: 25 }), async state => {
      const small = [(await rowTickers(state.page, portfolioRows)).length, (await rowTickers(state.page, sideRows('buy'))).length];
      await state.page.setViewport({ width: 1920, height: 1080 });
      await state.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
      const large = [(await rowTickers(state.page, portfolioRows)).length, (await rowTickers(state.page, sideRows('buy'))).length];
      assert(large.every((n, i) => n > small[i]) && large[0] > 15 && large[1] > 10, `Larger workspace uses available rows beyond the default-size caps: ${small} versus ${large}`);
      await structure(state, { paginated: true });
    });
    const invalid = stockDashboardFixture();
    invalid.routes.pc_weekly[0].gate = 'FAIL';
    invalid.candidates[0].broker_ok = false;
    invalid.candidates[0].broker_note = 'Synthetic top candidate unavailable';
    await withFixture('invalid-weekly-and-candidate-status', { width: 1280, height: 720 }, invalid, async ({ page }) => {
      const context = await page.$eval(panel('context'), e => e.innerText);
      assert.match(context, /gate.*fail|invalid.*weekly/i, 'Invalid weekly data flagged in primary attention');
      const candidate = await page.$eval('.sd-candidates li', e => e.innerText);
      assert.match(candidate, /unavailable|not fillable|blocked/i, 'Unavailable top candidate is marked beside its rating');
    });
    await withFixture('secondary-navigation', { width: 1280, height: 720 }, stockDashboardFixture(), async ({ page }) => {
      await clickControl(page, /^history$/i);
      const history = await page.$$eval('button, a, [role="tab"]', elements => elements.filter(e => e.getClientRects().length && e.innerText.trim() === 'History').length);
      assert.equal(history, 1, 'History is not duplicated in contextual research navigation');
      await clickControl(page, /^dashboard$/i);
      await clickControl(page, /full book/i);
      assert.equal(await page.$eval('nav[aria-label="Primary"] [aria-current]', e => e.innerText), 'Dashboard', 'Expanded portfolio remains under Dashboard');
    });
  }
  if (options.mode === 'all' || options.mode === 'reflow') {
    // Browser zoom halves the CSS viewport and doubles CSS-pixel raster size. Test both
    // factors together; deviceScaleFactor alone would not exercise responsive reflow.
    for (const [label, width, height, enlarge, deviceScaleFactor = 1] of [['mobile-390', 390, 844, false], ['text-200-percent', 1280, 720, true], ['reflow-320', 320, 720, false], ['short-desktop', 1366, 600, false], ['zoom-200-effective-viewport', 640, 360, false, 2]]) {
      await withFixture(label, { width, height, deviceScaleFactor }, stockDashboardFixture(), state => reflowCheck(state, enlarge));
    }
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ mode: options.mode, acceptance: options.mode === 'all', passed, failed: failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
