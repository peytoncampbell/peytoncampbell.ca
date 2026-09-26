import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { stockDashboardFixture } from './fixtures/stockDashboard.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/OwnerStocks.tsx'), 'utf8');
assert(source.includes('function DashboardOrderRow'), 'Missing real compact order row component');
const built = buildSync({ stdin: { contents: `${source}\nimport { renderToStaticMarkup } from 'react-dom/server';\nexport const renderOrder = (line, action) => renderToStaticMarkup(<DashboardOrderRow line={line} action={action} />);\nexport const renderTicket = today => renderToStaticMarkup(<TodayTicket today={today} />);\nexport { orderGroups, fundingSummary };`, resolveDir: resolve(root, 'src'), sourcefile: 'OwnerStocks.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{}' }, write: false, logLevel: 'silent' });
const compiled = new Module(resolve(root, 'scripts/dashboard-test.cjs'));
compiled._compile(built.outputFiles[0].text, compiled.id);
const { renderOrder, orderGroups } = compiled.exports;
const fixture = stockDashboardFixture();
const ticket = fixture.routes.pc_playbook[0].today;
const before = JSON.stringify(ticket);
const buys = orderGroups(ticket).find(g => g.key === 'buys').lines;
assert.deepEqual(buys, fixture.expectedBuys, 'Use existing funded alternative selection and order priority');
for (const line of [...buys, ...fixture.sales]) {
  const html = renderOrder(line, fixture.sales.includes(line) ? line.action : 'BUY');
  assert(html.includes(line.ticker));
  assert(html.includes(`C$${line.est_cad.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`));
  assert(html.includes(line.market_order ? 'Market' : 'Limit'));
  if (!line.market_order) assert(html.includes('Est. C$'), 'Limit totals and proceeds are estimates, not guaranteed fills');
  if (line.market_order) { assert(html.includes('no price protection')); assert(!html.includes(' @ ')); }
  else { assert(html.includes(`${line.qty} @ `)); assert(html.includes(line.currency)); }
  if (line.reason_kind) assert(html.includes(line.reason_kind === 'funding' ? 'funding' : 'exit rule'));
}
assert(renderOrder({ ticker: 'UNKNOWN', est_cad: null }, 'BUY').includes('Amount unavailable'));
assert(renderOrder({ ticker: 'WAIT', funded: false, market_order: true }, 'BUY').includes('Waiting on cash'));
assert.equal(JSON.stringify(ticket), before, 'Rendering cannot mutate financial payload');
const unavailable = compiled.exports.renderTicket({ not_fillable: [{ ticker: 'BLOCKED', name: 'Unavailable listing', why: 'Published listing restriction', est_cad: 125.12 }] });
assert(unavailable.includes('BLOCKED') && unavailable.includes('Published listing restriction'), 'Published not-fillable queue must remain reachable');
assert(unavailable.includes('Not fillable'), 'A restriction is not an order or a funding failure');
const fallbackTicket = structuredClone(ticket);
delete fallbackTicket.funding.raised_cad;
delete fallbackTicket.funding.shortfall_cad;
const normalized = compiled.exports.fundingSummary(fallbackTicket, orderGroups(fallbackTicket));
const expectedRaised = fixture.sales.reduce((sum, line) => sum + line.est_cad, 0);
assert.equal(normalized.raised, expectedRaised, 'Overview receives the same supported source total as the full ticket');
assert.equal(normalized.needed, ticket.funding.needed_cad);
assert.equal(normalized.gap, Math.max(0, normalized.needed - expectedRaised));
const fallbackHtml = compiled.exports.renderTicket(fallbackTicket);
for (const amount of [normalized.raised, normalized.needed, normalized.gap]) {
  if (amount > 0) assert(fallbackHtml.includes(`C$${amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`), 'Normalized amounts agree with full ticket');
}
const unknownTicket = structuredClone(ticket);
unknownTicket.funding = {};
const unknown = compiled.exports.fundingSummary(unknownTicket, orderGroups(unknownTicket));
assert.equal(unknown?.raised ?? null, null, 'Absent proceeds remain unknown');
assert.equal(unknown?.needed ?? null, null, 'Absent need remains unknown');
assert.equal(unknown?.gap ?? null, null, 'Unknown gap is not zero');
assert.equal(JSON.stringify(ticket), before, 'Normalization cannot mutate financial payload');
console.log('Dashboard order regression passed: exact amounts, local limits, risk, sale reason, selection, missing data, shared funding fallback.');
const dashboardPath = resolve(root, 'src/StockDashboard.tsx');
let dashboardSource;
try { dashboardSource = readFileSync(dashboardPath, 'utf8'); } catch { assert.fail('Missing viewport dashboard component'); }
const shellBuild = buildSync({ stdin: { contents: `${dashboardSource}\nimport { renderToStaticMarkup } from 'react-dom/server';\nexport const renderDashboard = props => renderToStaticMarkup(<StockDashboard {...props} />);`, resolveDir: resolve(root, 'src'), sourcefile: 'StockDashboard.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, logLevel: 'silent' });
const shellModule = new Module(resolve(root, 'scripts/dashboard-shell-test.cjs'));
shellModule._compile(shellBuild.outputFiles[0].text, shellModule.id);
const props = { portfolio: [{ ticker: 'HOLDING', summary: 'Holding exact values' }], buys: [{ ticker: 'BUY', summary: 'Buy exact values' }], sells: [{ ticker: 'SALE', summary: 'Sell exact values' }], details: {}, kpis: [{ label: 'Book value', value: '--', note: 'Cost basis unavailable' }], attention: ['Source missing'], candidates: [], sections: {}, funding: 'Funding unavailable', sessions: 'Venue unknown', status: 'As of unavailable', brief: null, onRefresh() {}, onHome() {}, onSignOut() {} };
const shell = shellModule.exports.renderDashboard(props);
for (const name of ['portfolio', 'orders', 'context']) assert(shell.includes(`data-dashboard-panel="${name}"`));
for (const ticker of ['HOLDING', 'BUY', 'SALE']) assert.equal((shell.match(new RegExp(`data-stock-ticker="${ticker}"`, 'g')) || []).length, 1);
assert(shell.includes('aria-label="Primary"'));
assert(shell.includes('Source missing'));
assert(shell.includes('Funding unavailable'));
assert(!/cash available/i.test(shell));
assert(!/all healthy/i.test(shell));
assert(shell.includes('Proposed'));
assert(shell.includes('attention · Details'), 'Warnings have a persistent native disclosure');
const candidateShell = shellModule.exports.renderDashboard({ ...props, candidates: [
  { ticker: 'BLOCKED', rating: '99.0', availability: 'Unavailable', note: 'Published restriction' },
  { ticker: 'UNKNOWN', rating: '98.0', availability: 'Unknown', note: 'Broker availability not confirmed' },
] });
assert(candidateShell.includes('Unavailable') && candidateShell.includes('Published restriction'));
assert(candidateShell.includes('Unknown') && candidateShell.includes('Broker availability not confirmed'));
assert(candidateShell.indexOf('BLOCKED') < candidateShell.indexOf('UNKNOWN'), 'Availability labels do not rerank candidates');
console.log('Dashboard shell regression passed: primary navigation, three regions, both sides, honest missing data.');
