import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

// Exercise the real component without an owner session or a database connection.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/OwnerStocks.tsx'), 'utf8');
const built = buildSync({
  stdin: {
    contents: `${source}
      import { renderToStaticMarkup } from 'react-dom/server';
      export const renderTicket = today => renderToStaticMarkup(<TodayTicket today={today} />);
      export { orderGroups, ticketCounts };
    `,
    resolveDir: resolve(root, 'src'),
    sourcefile: 'OwnerStocks.tsx',
    loader: 'tsx',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  write: false,
  logLevel: 'silent',
});
const compiled = new Module(resolve(root, 'scripts/ticket-test.cjs'));
compiled._compile(built.outputFiles[0].text, compiled.id);
const { renderTicket, orderGroups, ticketCounts } = compiled.exports;

const limit = {
  ticker: 'EXPENSIVE', action: 'TOP_UP', kind: 'top-up', qty: 0,
  limit_local: 400, limit_cad: 600, est_cad: 150,
  currency: 'USD', whole_shares: true, funded: false,
  funded_via: 'MARKET_FRACTIONAL',
};
const market = {
  ...limit, kind: 'MARKET_FRACTIONAL', market_order: true,
  qty: 0.25, whole_shares: false, funded: true,
};
const whole = {
  ticker: 'WHOLE.TO', action: 'NEW', kind: 'new', qty: 3,
  limit_local: 25.25, limit_cad: 25.25, est_cad: 3 * 25.25,
  currency: 'CAD', whole_shares: true, funded: true,
};
const today = { buys: [limit, market, whole], counts: { buys: 3 } };
const snapshot = JSON.stringify(today);
const groups = orderGroups(today);
assert.deepEqual(groups[0].lines.map(line => line.ticker), ['EXPENSIVE', 'WHOLE.TO'],
  'A market alternative and its limit placeholder must render as one buy, not two');
assert.equal(groups[0].lines[0], market, 'Keep the funded market alternative with its original amount');
assert.equal(ticketCounts(groups), '2 buy', 'Counts must describe unique displayed orders');
const html = renderTicket(today);
assert.equal((html.match(/class="own-ticker">EXPENSIVE</g) || []).length, 1);
assert.ok(!html.includes('Waiting on cash'), 'A funded market alternative must not look unfunded');
assert.ok(!html.includes('0 @ '), 'Do not display the superseded zero-share placeholder');
const wholeHtml = renderTicket({ buys: [whole] });
assert.ok(wholeHtml.includes('Limit order'), 'Every whole-share order must explicitly say Limit order');
assert.ok(wholeHtml.includes('Est. C$75.75'), 'Show the total buy estimate, not the per-share CAD twin');
assert.ok(wholeHtml.includes('3 @ $25.25'), 'Keep the exact quantity and local limit visible');
assert.ok(wholeHtml.includes('<details'), 'Put session and research context behind an accessible disclosure');
assert.ok(html.includes('C$150.00'), 'Market amount stays the desk\'s exact CAD tranche, formatted as money');
assert.ok(!html.includes('C$600'), 'A per-share conversion is not the amount to buy');
assert.equal(JSON.stringify(today), snapshot, 'Rendering must never mutate the financial plan');
assert.equal(orderGroups({ buys: [market, whole, limit] })[0].lines[0], market,
  'Selecting the funded alternative must not depend on payload ordering');
const fundedLimit = { ...limit, qty: 1, funded: true };
assert.equal(orderGroups({ buys: [fundedLimit, { ...market, funded: false }] })[0].lines[0], fundedLimit,
  'Do not replace a funded limit with an unfunded market alternative');
assert.equal(orderGroups({ buys: [fundedLimit, market] })[0].lines[0], market,
  'A funded full-tranche market alternative replaces, rather than adds to, a partial whole-share order');
assert.ok(renderTicket({ buys: [{ ...market, funded: false }] }).includes('Waiting on cash'),
  'A real funding shortfall stays visible');
assert.ok(renderTicket({ buys: [{ ...market, est_cad: null }] }).includes('Amount unavailable'),
  'A missing total must not fall back to a per-share price');
assert.equal(renderTicket(null), '');
assert.ok(renderTicket({ buys: null }).includes('No orders today'));
assert.deepEqual(orderGroups({ buys: [null, {}, whole] })[0].lines, [whole]);
assert.ok(renderTicket({ buys: [{ ...market, kind: 'MARKET_FRACTIONAL', market_order: null }] }).includes('Market order'));
assert.ok(renderTicket({ buys: [{ ...whole, ticker: 'FOREIGN', currency: 'KRW', limit_local: 25000 }] }).includes('₩25,000'));
const shortfallPlan = {
  ...today,
  funding: {
    needed_cad: 300, raised_cad: 100, shortfall_cad: 200,
    sources: [{ ticker: 'FUNDING', cad: 100, reason_kind: 'funding' }],
  },
};
const fundingHtml = renderTicket(shortfallPlan);
assert.ok(fundingHtml.includes('Selling C$100.00 across 1 name to fund C$300.00 of buys.'));
assert.ok(fundingHtml.includes('C$200.00 still short'), 'Consolidating alternatives must preserve a real plan shortfall');
assert.equal((fundingHtml.match(/class="own-ticker">EXPENSIVE</g) || []).length, 1);
console.log('Ticket regression passed: unique stocks, correct count, buy amounts, explicit order types and funding warnings.');
