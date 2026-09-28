#!/usr/bin/env node
/**
 * Mobile responsiveness pin: every PUBLIC route at phone widths must render without horizontal
 * overflow, without accidental text clipping, with no visible text under 12px, and with
 * thumb-sized controls. The shipped contract is 390x844 primary and 360x640 floor; the
 * session-gated desks carry their own width harnesses (verify:reader, verify:dashboard:browser),
 * so this pin covers the surfaces a signed-out visitor can reach.
 *
 * Puppeteer entry is PUPPETEER_MODULE when set (an installed puppeteer-core directory), CHROME_PATH
 * selects the browser. Serves the built docs/ locally, like the other harnesses.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const docs = resolve('docs');
if (!existsSync(resolve(docs, 'index.html'))) { console.error('Build first: npm run build'); process.exit(2); }

const require = createRequire(import.meta.url);
let modulePath = process.env.PUPPETEER_MODULE || 'puppeteer-core';
if (existsSync(modulePath)) modulePath = pathToFileURL(require.resolve(resolve(modulePath))).href;
const puppeteer = (await import(modulePath)).default;
const executablePath = [process.env.CHROME_PATH,
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && resolve(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
].find((p) => p && existsSync(p));
if (!executablePath) { console.error('No browser found (set CHROME_PATH)'); process.exit(2); }

const ROUTES = [
  '/', '/login', '/mydesk', '/stocks', '/definitely-not-a-page',
  '/projects/scorecontroller', '/projects/provisioning-console', '/projects/scoreboard-configurator',
  '/projects/production-test-jig', '/projects/catan-settlement-optimizer',
];
const WIDTHS = [[390, 844], [360, 640]];
const MIN = 43.5;      // 44px target, forgiving sub-pixel layout
const MIN_TEXT = 12;   // body/label text floor

const server = createServer(async (req, res) => {
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
const BASE = `http://127.0.0.1:${server.address().port}`;

const MEASURE = (min, minText) => {
  const vw = document.documentElement.clientWidth;
  const desc = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  // Mock product windows are illustrations, not controls.
  const inMock = (el) => Boolean(el.closest('.project-visual, .phone-mock, .console-mock, .tester-mock, .scoreboard-mock, .catan-mock, .scoreboard-display'));
  // A segment of a multi-button control is one target with its siblings: the group carries the floor.
  const segmentGroup = (el) => (el.tagName === 'BUTTON' && el.parentElement ? [...el.parentElement.children].filter((c) => c.tagName === 'BUTTON').length : 0) > 1;
  const failures = [];
  const overflow = document.documentElement.scrollWidth - vw;
  if (overflow > 1) failures.push(`overflow ${overflow}px`);
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (r.width > vw + 1 && !inScroller(el) && !inMock(el)) failures.push(`wider than viewport ${desc(el)}=${Math.round(r.width)}`);
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip')
      && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0
      && cs.textOverflow !== 'ellipsis') failures.push(`clipped ${desc(el)} ${el.clientWidth}<${el.scrollWidth}`);
    if (el.children.length === 0 && text.length > 1 && r.height > 4
      && parseFloat(cs.fontSize) < minText && el.getAttribute('aria-hidden') !== 'true') failures.push(`text ${cs.fontSize} ${desc(el)} "${text.slice(0, 24)}"`);
    if (!el.matches('a[href], button, summary, input, select, textarea') || inMock(el)) continue;
    const inlineLink = el.tagName === 'A' && el.closest('p') && (el.closest('p').textContent || '').trim().length > text.length + 25;
    if (inlineLink) continue;
    if (segmentGroup(el)) {
      const group = el.parentElement.getBoundingClientRect();
      if (group.height < min) failures.push(`segment group ${Math.round(group.width)}x${Math.round(group.height)}`);
      continue;
    }
    if (r.height < min || (r.width < min && r.width < 44)) failures.push(`target ${desc(el)}=${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return { failures: [...new Set(failures)].slice(0, 12), path: location.pathname };
};

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--no-first-run'] });
let passed = 0, failed = 0;
try {
  for (const [width, height] of WIDTHS) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
    await page.setViewport({ width, height });
    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1200));
      const m = await page.evaluate(MEASURE, MIN, MIN_TEXT);
      const problems = [...m.failures];
      if (pageErrors.length) problems.push(`page error: ${pageErrors[0]}`);
      if (problems.length) { failed += 1; console.log(`  [FAIL] ${width}px ${route} -> ${m.path}`); for (const p of problems) console.log(`         - ${p}`); }
      else { passed += 1; console.log(`  [PASS] ${width}px ${route}`); }
      pageErrors.length = 0;
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n  ${passed}/${passed + failed} responsive checks passed`);
if (failed) { console.log('  Responsive contract broken - fix before shipping.'); process.exit(1); }
