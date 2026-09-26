import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Real component, synthetic presentation props only. No finance integration or remote traffic.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const puppeteer = (await import(pathToFileURL(require.resolve(process.env.PUPPETEER_MODULE || 'puppeteer-core')).href)).default;
const out = process.argv[2] && resolve(process.argv[2]);
if (out) { assert(out !== root && !out.startsWith(root + sep)); mkdirSync(out, { recursive: true }); }
const bundle = buildSync({ stdin: { contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import StockDashboard from './StockDashboard';
const root = createRoot(document.getElementById('root'));
const noop = () => {};
let props = {
 portfolio: [{ ticker: 'SYN01', summary: 'SYN01 holding' }],
 buys: [{ ticker: 'SYN01', action: 'BUY', summary: 'SYN01 buy' }],
 sells: [{ ticker: 'SYN01', action: 'TRIM', summary: 'SYN01 trim' }],
 candidates: [{ ticker: 'CAND01', rating: 'Unrated' }], details: {},
 kpis: ['Book value', 'Account return', 'Day change', 'ETF allocation'].map(label => ({ label, value: 'Unavailable', note: 'Synthetic shell test' })),
 attention: ['Synthetic warning: '.repeat(60)], brief: null, funding: 'Synthetic funding', sessions: 'Synthetic sessions', status: 'Synthetic shell', sections: {},
 onRefresh: () => render(), onHome: noop, onSignOut: noop,
 renderDetail: (selection, view) => <section data-detail={JSON.stringify({ ...selection, view })}><h3>{selection.ticker} {view}</h3><p>Origin: {selection.origin}. Action: {selection.action || 'none'}.</p><p>Presentation supplied by the caller.</p></section>,
 changes: { label: 'Review changes', render: open => <button data-change-id="change-1" onClick={() => open({ ticker: 'REMOVED', origin: 'change', changeId: 'change-1' })}>Historical change</button> }
};
function render() { root.render(<StockDashboard {...props} />); }
window.updateShell = next => { props = { ...props, ...next }; render(); };
render();`, resolveDir: resolve(root, 'src'), loader: 'tsx' }, bundle: true, format: 'iife', jsx: 'automatic', write: false });
const css = readFileSync(resolve(root, 'src/StockDashboard.css'), 'utf8');
const server = createServer((req, res) => {
 res.setHeader('Content-Type', req.url === '/app.js' ? 'application/javascript' : 'text/html');
 res.end(req.url === '/app.js' ? bundle.outputFiles[0].text : `<html><head><style>body{margin:0}${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
let browser;
try {
 browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true });
 const page = await browser.newPage();
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.setViewport({ width: 1280, height: 720 });
 await page.setRequestInterception(true);
 page.on('request', request => new URL(request.url()).hostname === '127.0.0.1' ? request.continue() : request.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
 const settle = () => page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
 const click = async selector => { await page.click(selector); await settle(); };
 const detail = () => page.$eval('[data-detail]', e => JSON.parse(e.dataset.detail));
 const focused = selector => page.$eval(selector, e => e === document.activeElement);
 const escape = async () => { await page.keyboard.press('Escape'); await settle(); };
 if (out) await page.screenshot({ path: resolve(out, 'shell-overview-1280.png') });
 for (const [origin, ticker, action] of [['portfolio', 'SYN01', undefined], ['buy', 'SYN01', 'BUY'], ['sell', 'SYN01', 'TRIM'], ['candidate', 'CAND01', undefined]]) {
   await click(`[data-stock-origin="${origin}"]`);
   assert.deepEqual(await detail(), { ticker, origin, ...(action ? { action } : {}), view: 'quick' });
   await click('[data-focus="analysis"]');
   assert.equal((await detail()).view, 'summary');
   assert.equal(await page.$$eval('[data-dashboard-panel]', es => es.length), 0);
   if (out && origin === 'portfolio') await page.screenshot({ path: resolve(out, 'shell-expanded-1280.png') });
   await click('[aria-label="Stock analysis sections"] button:nth-child(2)');
   assert.equal((await detail()).view, 'history');
   await click('.sd-refresh');
   assert(await focused('.sd-refresh'), 'Refresh must not steal focus');
   assert.equal((await detail()).view, 'history');
   await escape();
   assert(await focused('[data-focus="analysis"]'));
   await escape();
   assert(await focused(`[data-stock-origin="${origin}"]`));
 }
 await click('.sd-changes-link button');
 await click('[data-change-id="change-1"]');
 assert.deepEqual(await detail(), { ticker: 'REMOVED', origin: 'change', changeId: 'change-1', view: 'summary' });
 await click('.sd-refresh');
 assert.equal((await detail()).ticker, 'REMOVED', 'Historical selection survives absent current details');
 await escape();
 assert(await focused('[data-change-id="change-1"]'), 'Find mounted change opener by identifier');
 await click('[data-change-id="change-1"]');
 await page.evaluate(() => updateShell({ changes: { label: 'Review changes', render: () => 'No remaining changes' } }));
 await settle();
 await escape();
 assert(await focused('[data-focus="changes"]'), 'Missing change opener falls back to heading');
 await click('.sd-analysis-head button');
 await click('[data-stock-origin="portfolio"]');
 await click('[data-focus="analysis"]');
 await page.evaluate(() => updateShell({ portfolio: [] }));
 await settle();
 assert.equal(await page.$('[data-analysis-ticker]'), null);
 assert(await focused('[data-origin-heading="portfolio"]'), 'Removed origin focuses its own heading');
 assert.match(await page.$eval('[role="status"]', e => e.textContent), /SYN01 is no longer/);
 assert.deepEqual(errors, []);
 console.log('PASS real dashboard shell: four origins, exact action, current view, refresh focus, semantic return, Changes history/fallback, removal notice.');
} finally {
 if (browser) await browser.close();
 await new Promise(ok => server.close(ok));
}
