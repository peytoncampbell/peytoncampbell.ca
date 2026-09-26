#!/usr/bin/env node
/**
 * Real built-app regression; synthetic data only; fail-closed network boundary.
 * Usage: PUPPETEER_MODULE=/path/to/puppeteer-core CHROME_PATH=/path/to/chrome
 *   node scripts/verifyStockDashboardBrowser.mjs [--mode all|structure|interactions|stress|reflow|resilience]
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
assert(['all', 'structure', 'interactions', 'stress', 'reflow', 'resilience'].includes(options.mode), 'Invalid --mode');
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
        void request.respond({ status: fixture.statuses?.[table] ?? 200, headers, body: JSON.stringify(fixture.routes[table]) }); return;
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
  return { page, context, fixture, requests, unexpected, errors };
}

async function withFixture(label, viewport, fixture, run) {
  let state;
  await scenario(label, async () => {
    try {
      state = await openFixture(viewport, fixture);
      assert.deepEqual(state.unexpected, [], 'No unexpected auth/API requests during load');
      assert.deepEqual(state.errors, [], 'Fixture renders without browser errors');
      console.log(`LOADED ${label}: ${state.requests.size} intercepted tables; ${fixture.holdings.length} holdings; ${fixture.expectedBuys.length} unique buys; ${fixture.sales.length} sales`);
      await run(state);
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
    assert.deepEqual((await rowTickers(page, sideRows('buy'))).sort(), fixture.expectedBuys.map(h => h.ticker).sort(), 'Unique buys, not duplicate alternatives or payload counts');
  }
  assert.deepEqual((await rowTickers(page, sideRows('sell'))).sort(), fixture.sales.map(h => h.ticker).sort(), 'All eight sells/trims simultaneously with buys');
  assert.deepEqual(measured.errors, [], `Geometry ${measured.viewport.join('x')}`);
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
  if (escape) await page.keyboard.press('Escape');
  else await clickControl(page, /close/i, '[role="dialog"], dialog[open]');
  await page.waitForFunction(() => ![...document.querySelectorAll('[role="dialog"], dialog[open]')].some(e => e.getClientRects().length));
  assert(await opener.evaluate(e => document.activeElement === e || e.contains(document.activeElement)), 'Closing inspector restores exact opener focus');
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

try {
  options.url ||= await localServer();
  const url = new URL(options.url);
  assert(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), '--url must be local HTTP; never point this harness at a live deployment');
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  if (options.mode === 'all' || options.mode === 'structure') {
    for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
      await withFixture(`structure-${width}x${height}`, { width, height }, stockDashboardFixture(), structure);
    }
  }
  if (options.mode === 'all' || options.mode === 'interactions') await withFixture('interactions', { width: 1440, height: 900 }, stockDashboardFixture(), interactions);
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
    await withFixture('private-book-gate', { width: 1280, height: 720 }, emptyPrivate, async ({ page }) => {
      assert.equal(await page.$('[data-order-side]'), null, 'No derived financial workspace without an approved private book');
      assert(!await page.evaluate(() => document.body.innerText.includes('BUY01')), 'Secondary payload cannot bypass the private-book gate');
      assert.match(await page.evaluate(() => document.body.innerText), /access|private|allowlist|publication/i);
    });
    const fallback = stockDashboardFixture();
    delete fallback.routes.pc_playbook[0].today.funding.raised_cad;
    delete fallback.routes.pc_playbook[0].today.funding.shortfall_cad;
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
