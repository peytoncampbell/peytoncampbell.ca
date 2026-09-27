import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
function load(file) {
 assert(existsSync(resolve(root,file)), `${file} must exist`);
 const code=buildSync({entryPoints:[resolve(root,file)],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
 const mod={exports:{}}; new Function('require','module','exports',code)(require,mod,mod.exports); return mod.exports;
}
// Canonical synthetic reports only. Never sent to the application or an API.
const stamp='2026-09-25T20:00:00.123456Z';
const synthetic=()=>({report_id:'synthetic-report',as_of:'2026-09-25',generated_at:stamp,schema_version:1,payload:{schema_version:1,report_id:'synthetic-report',as_of:'2026-09-25',generated_at:stamp,reporting_currency:'CAD',source_cutoff:stamp,ledger_revision:null,reconciliation:{status:'not_imported',broker_data_as_of:null,period_start:null,period_end:null,verified_at:null,issues:['Broker import required.']},decision_window:{total:0,returned:0,has_more:false,items:[]},performance:{status:'unavailable',reason:'Broker import required.',period_start:null,period_end:null,bridge:null,money_weighted:null,time_weighted:null,benchmark:null},model_evidence:{status:'collecting',reason:'Future sessions required.',capture_count:0,first_capture:null,last_capture:null,horizons:[{sessions:20,matured:null,pending:0,excluded:0}],limitations:[]},limitations:['Comparison policy not selected.']}});
const {parseOutcomeReportRow}=load('src/stockOutcomeData.ts');
const parsed=parseOutcomeReportRow(synthetic());
assert.equal(parsed.ok,true); assert.equal(parsed.report.performance.bridge,null); assert.equal(parsed.report.model_evidence.capture_count,0); assert.equal(parsed.report.generated_at,stamp);
for(const value of [null,'{broken',[],{}, {...synthetic(),schema_version:2}]) assert.equal(parseOutcomeReportRow(value).ok,false);
console.log('PASS parser baseline: exact identity/precision, null and zero, malformed/unsupported rows');
const decision=()=>({decision_id:'synthetic-decision',batch_id:'synthetic-batch',as_of:'2026-09-24',generated_at:'2026-09-24T20:00:00Z',captured_at:stamp,publication_state:'observed_existing',ticker:'SYNTH',listing_symbol:null,currency:'USD',action:'Consider purchase',order_type:'limit',quantity:'1.230000',amount_cad:null,limit_native:'12.345678',reason:'Original synthetic proposal.',model_version:null,cohort_id:null,intent:'reported_submitted',execution:{status:'unconfirmed',quantity:null,average_price:null,currency:null,fees:null,reason:'No accepted broker evidence.'}});
const withDecision=()=>{const r=synthetic();r.payload.decision_window={total:2,returned:1,has_more:true,items:[decision()]};return r;};
const originalProse=['Buy only if price < 100 & earnings > 5.','Original line one.\nOriginal line two.','<img src=x onerror="window.outcomeXss=true"> & prose'];
for(const reason of originalProse) {
 const row=withDecision();row.payload.decision_window.items[0].reason=reason;
 const result=parseOutcomeReportRow(row);assert.equal(result.ok,true,`original prose preserved: ${JSON.stringify(reason)}`);
 assert.equal(result.report.decision_window.items[0].reason,reason);
}
for(const field of ['quantity','limit_native']) for(const value of ['0','0.000000']) {
 const row=withDecision();row.payload.decision_window.items[0][field]=value;
 const result=parseOutcomeReportRow(row);assert.equal(result.ok,true,`original ${field} preserves observed ${value}`);
 assert.equal(result.report.decision_window.items[0][field],value);
 assert.equal(result.report.decision_window.items[0].execution.status,'unconfirmed');
 assert.equal(result.report.decision_window.items[0].execution.quantity,null);
}
const reject=(name,mutate,base=withDecision)=>{const r=base();mutate(r);assert.equal(parseOutcomeReportRow(r).ok,false,name);};
for(const [name,mutate] of [
 ['identity',r=>r.payload.report_id='other'],['unknown field',r=>r.payload.raw_account='private'],['invalid currency',r=>r.payload.reporting_currency='ZZZ'],
 ['date rollover',r=>r.payload.decision_window.items[0].as_of='2026-02-30'],['missing zone',r=>r.payload.source_cutoff='2026-09-25T20:00:00'],
 ['fraction chronology',r=>r.payload.source_cutoff='2026-09-25T20:00:00.123457Z'],['bad offset',r=>r.payload.source_cutoff='2026-09-25T20:00:00+25:00'],
 ['false counts',r=>r.payload.decision_window.returned=2],['false total',r=>r.payload.decision_window.total=0],['false more',r=>r.payload.decision_window.has_more=false],
 ['bounds',r=>r.payload.decision_window.items=Array(101).fill(decision())],['duplicate',r=>{r.payload.decision_window={total:2,returned:2,has_more:false,items:[decision(),decision()]};}],
 ['missing',r=>delete r.payload.decision_window.items[0].quantity],['negative quantity',r=>r.payload.decision_window.items[0].quantity='-1'],['negative limit',r=>r.payload.decision_window.items[0].limit_native='-1'],
 ['exponent',r=>r.payload.decision_window.items[0].quantity='1e2'],['NaN',r=>r.payload.decision_window.items[0].amount_cad='NaN'],['precision bound',r=>r.payload.decision_window.items[0].quantity='1'.repeat(81)],
 ['intent enum',r=>r.payload.decision_window.items[0].intent='executed'],['numeric unconfirmed',r=>r.payload.decision_window.items[0].execution.quantity='1'],['confirmed without ledger',r=>r.payload.decision_window.items[0].execution.status='broker_confirmed'],
 ['text bound',r=>r.payload.decision_window.items[0].reason='x'.repeat(2001)],['unsafe path',r=>r.payload.limitations=['C:/Users/owner/private/account.csv']],['markup identity',r=>r.payload.decision_window.items[0].decision_id='<id>'],
 ['model validated',r=>r.payload.model_evidence.status='validated'],['negative count',r=>r.payload.model_evidence.capture_count=-1],['capture bounds',r=>r.payload.model_evidence.last_capture='2027-01-01T00:00:00Z'],
]) reject(name,mutate);
for(const reason of ['bad\0text','bad\u0001text','bad\u202etext','bad\u2066text','C:/Users/owner/private/account.csv','/home/owner/account.csv']) reject('unsafe prose boundary',r=>r.payload.decision_window.items[0].reason=reason);
assert.equal(parseOutcomeReportRow(withDecision()).ok,true);
console.log('PASS strict shape, bounds, decimal strings, exact chronology, window counts, execution and legacy identities');
const reconciled=()=>{const r=withDecision(),p=r.payload;r.payload.ledger_revision='synthetic-ledger';p.reconciliation={status:'reconciled',broker_data_as_of:'2026-09-24',period_start:'2026-09-01',period_end:'2026-09-24',verified_at:stamp,issues:[]};p.performance={status:'available',reason:null,period_start:'2026-09-01',period_end:'2026-09-24',bridge:{opening_equity:'1000.0000',net_external_flows:'0',investment_result:'-10.25',closing_equity:'989.7500',currency:'CAD'},money_weighted:{status:'available',value:'-0.01025',method:'period_mwr_irr',reason:null,period_start:'2026-09-01',period_end:'2026-09-24',currency:'CAD',annualized:false},time_weighted:null,benchmark:null};return r;};
assert.equal(parseOutcomeReportRow(reconciled()).ok,true);
for(const [name,mutate] of [
 ['bridge shape',r=>r.payload.performance.bridge={}],['bridge decimal',r=>r.payload.performance.bridge.closing_equity='Infinity'],['bridge currency',r=>r.payload.performance.bridge.currency='USD'],
 ['unsupported method',r=>r.payload.performance.money_weighted.method='simple'],['method mismatch',r=>r.payload.performance.time_weighted=r.payload.performance.money_weighted],['annualized',r=>r.payload.performance.money_weighted.annualized=true],
 ['metric period',r=>r.payload.performance.money_weighted.period_end='2026-09-23'],['metric value numeric',r=>r.payload.performance.money_weighted.value=0],['metric null',r=>r.payload.performance.money_weighted.value=null],
 ['unavailable numeric',r=>r.payload.performance.money_weighted.status='unavailable'],['reconciliation discrepancy',r=>r.payload.reconciliation.status='discrepancy'],['missing revision',r=>r.payload.ledger_revision=null],['missing provenance',r=>r.payload.reconciliation.verified_at=null],
 ['unsupported benchmark',r=>r.payload.performance.benchmark={status:'available',value:'0.2',policy_id:'fake'}],
]) reject(name,mutate,reconciled);
const zero=reconciled();zero.payload.performance.money_weighted.value='0';assert.equal(parseOutcomeReportRow(zero).ok,true);
const confirmed=reconciled();confirmed.payload.decision_window.items[0].execution={status:'broker_confirmed',quantity:'1.2',average_price:'12.25',currency:'USD',fees:'0',reason:'Accepted ledger event.'};assert.equal(parseOutcomeReportRow(confirmed).ok,true);
for(const field of ['quantity','limit_native']) for(const value of ['-1','NaN','Infinity','-Infinity',true,false,0]) reject(`invalid original ${field}: ${value}`,r=>r.payload.decision_window.items[0][field]=value);
for(const field of ['quantity','average_price']) for(const value of ['0','0.000000','-1','NaN','Infinity',true,false,0]) reject(`invalid execution ${field}: ${value}`,r=>r.payload.decision_window.items[0].execution[field]=value,()=>structuredClone(confirmed));
console.log('PASS original zero quantity/limit preserved; execution quantities/prices remain strictly positive');
console.log('PASS supported reconciled bridge/metrics, signed and zero fractions, provenance gates, benchmark fail-closed');
reject('sparse window',r=>{r.payload.decision_window={total:1,returned:1,has_more:false,items:Array(1)};});
reject('report source date after generation',r=>{r.as_of=r.payload.as_of='2099-01-01';});
reject('decision source date after publication',r=>r.payload.decision_window.items[0].as_of='2099-01-01');
reject('unsupported future period',r=>{r.payload.performance.period_start='2027-01-01';r.payload.performance.period_end='2027-01-02';},synthetic);
const zeroAmount=withDecision();zeroAmount.payload.decision_window.items[0].amount_cad='0';assert.equal(parseOutcomeReportRow(zeroAmount).ok,true,'zero amount is not a missing amount');
const offset=synthetic();offset.payload.source_cutoff='2026-09-25T16:00:00.123456-04:00';assert.equal(parseOutcomeReportRow(offset).ok,true,'offset instant with original spelling');
const fullWindow=synthetic();fullWindow.payload.decision_window={total:100,returned:100,has_more:false,items:Array.from({length:100},(_,i)=>({...decision(),decision_id:`synthetic-${i}`}))};assert.equal(parseOutcomeReportRow(fullWindow).ok,true,'100 decisions accepted');
reject('verification predates supported period',r=>r.payload.reconciliation.verified_at='2026-08-31T20:00:00Z',reconciled);
const {StockOutcomes}=load('src/StockOutcomes.tsx');
const ready=(row,view='decisions')=>{const parsed=parseOutcomeReportRow(row);assert(parsed.ok);return {view,state:{status:'ready',report:parsed.report}};};
const render=props=>renderToStaticMarkup(React.createElement(StockOutcomes,props));
for(const [status,text] of [['loading','Loading outcomes'],['no-report','No outcome report'],['no-owner','Owner access required']]) assert(render({view:'decisions',state:{status}}).includes(text));
assert.match(render({view:'decisions',state:{status:'error',reason:'Report unavailable.',onRetry:()=>{}}}),/Retry/);
for(const reason of originalProse) {
 const row=withDecision();row.payload.decision_window.items[0].reason=reason;
 const html=render(ready(row));
 const escaped=reason.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 assert(html.includes(escaped),'SSR preserves and escapes original prose including newline');
 assert(!html.includes('<img'),'prose must not create HTML elements');
}
console.log('PASS original comparison/multiline/XSS prose: exact parser values and escaped React SSR');
const decisionsHtml=render(ready(withDecision()));
for(const text of ['1 of 2','1.230000','12.345678','USD','Original synthetic proposal.','Reported submitted','Execution unconfirmed','Model unknown','Cohort unknown','Observed existing','Original publication','Captured','Source cutoff']) assert(decisionsHtml.includes(text),text);
assert(!decisionsHtml.includes('Mark executed')); assert(!decisionsHtml.includes('<a '));
const zeroProposal=withDecision();Object.assign(zeroProposal.payload.decision_window.items[0],{quantity:'0',limit_native:'0',amount_cad:'0'});
const zeroProposalHtml=render(ready(zeroProposal));
for(const text of ['0 units','0 USD','amount 0 CAD','Reported submitted','Execution unconfirmed']) assert(zeroProposalHtml.includes(text),text);
assert(!zeroProposalHtml.includes('Execution — exact ledger-reported values'));
const unknownProposal=withDecision();Object.assign(unknownProposal.payload.decision_window.items[0],{quantity:null,limit_native:null,amount_cad:null});
const unknownProposalHtml=render(ready(unknownProposal));
assert(unknownProposalHtml.includes('Quantity unavailable'));assert(!unknownProposalHtml.includes('amount 0 CAD'));
assert(zeroProposalHtml.includes('<td>0 CAD</td>'));assert(unknownProposalHtml.includes('<td>Unavailable</td>'));
const emptyHtml=render(ready(synthetic(),'performance'));
assert.match(emptyHtml,/Broker data not imported/);assert(!emptyHtml.includes('%'));assert(!emptyHtml.includes('Opening equity'));assert(!emptyHtml.includes('<svg'));
const perfHtml=render(ready(reconciled(),'performance'));
for(const text of ['1000.0000','989.7500','-10.25','CAD','Money-weighted','Time-weighted','-1.025%','-0.01025','Comparison unavailable','Model evidence','Future sessions required.']) assert(perfHtml.includes(text),text);
assert.match(render(ready(confirmed)),/Broker-confirmed execution/);
const bothMetrics=reconciled();bothMetrics.payload.performance.time_weighted={...bothMetrics.payload.performance.money_weighted,method:'period_twr_exact_boundaries',value:'0'};
assert.match(render(ready(bothMetrics,'performance')),/0% for the supported period/);
const unavailableMetric=reconciled();unavailableMetric.payload.performance.time_weighted={...unavailableMetric.payload.performance.money_weighted,method:'period_twr_exact_boundaries',status:'unavailable',value:null,reason:'Exact flow boundaries absent.'};
assert.match(render(ready(unavailableMetric,'performance')),/Exact flow boundaries absent/);
const ambiguous=reconciled();ambiguous.payload.decision_window.items[0].execution.status='ambiguous';assert.match(render(ready(ambiguous)),/Execution ambiguous/);
const discrepancy=withDecision();discrepancy.payload.reconciliation.status='discrepancy';discrepancy.payload.reconciliation.issues=['Statement mismatch.'];
assert.match(render(ready(discrepancy,'performance')),/Reconciliation discrepancy/);
console.log('PASS SSR states, original proposal vs intent/execution, exact bridge/return fractions, collecting and unavailable comparison');
const browserBundle=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {StockOutcomes} from './src/StockOutcomes';const root=createRoot(document.getElementById('root'));window.retries=0;window.show=p=>flushSync(()=>root.render(<StockOutcomes {...p} state={p.state.status==='error'?{...p.state,onRetry:()=>window.retries++}:p.state}/>));`,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
const modulePath=process.env.PUPPETEER_MODULE||'C:/Users/campb/AppData/Local/hermes/cache/scratch/site-audit-20260925/harness/node_modules/puppeteer-core';
const {default:puppeteer}=await import(pathToFileURL(modulePath.endsWith('.js')?modulePath:resolve(modulePath,'lib/puppeteer/puppeteer-core.js')).href);
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking']});
try {
 const page=await browser.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',request=>{requests.push(request.url());request.abort();}); // No auth, network, app bundle or external fetch can escape this harness.
 await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:16px;background:#10161f;color:#e2e8f0}</style><main id="root"></main>');
 await page.addStyleTag({content:readFileSync(resolve(root,'src/StockOutcomes.css'),'utf8')});await page.addScriptTag({content:browserBundle});
 const mount=async props=>page.evaluate(p=>window.show(p),props);
 for(const reason of originalProse) {
  const row=withDecision();row.payload.decision_window.items[0].reason=reason;
  await mount(ready(row));
  assert.equal(await page.$eval('article details p',e=>e.textContent),reason,'DOM preserves original prose/newline');
  assert.equal(await page.$('article img, article script, article a'),null,'no executable prose elements');
  assert.equal(await page.evaluate(()=>window.outcomeXss),undefined,'no injected handler executed');
 }
 await mount(ready(withDecision()));
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');await page.keyboard.press('Enter');assert(await page.$eval('details',e=>e.open));
 await mount({view:'decisions',state:{status:'error',reason:'Try again.'}});await page.focus('button');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.retries),1);
 const screenshots='C:/Users/campb/AppData/Local/hermes/cache/scratch/stock-outcomes-build/ui';mkdirSync(screenshots,{recursive:true});
 for(const width of [320,390,1280]) for(const view of ['decisions','performance']) {
  await page.setViewport({width,height:900});await mount(ready(reconciled(),view));
  await page.$$eval('details',els=>els.forEach(e=>e.open=true));
  assert.equal(await page.$eval('.stock-outcomes',e=>getComputedStyle(e).fontSize),'14px','primary text size');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${view} no clipping`);
  assert(await page.$eval('.stock-outcomes',e=>[e,...e.querySelectorAll('*')].every(el=>!['auto','scroll','hidden'].includes(getComputedStyle(el).overflowY))),'natural reflow, no nested scroll or hidden clipping');
  assert(await page.$$eval('.so-meta',els=>els.every(e=>parseFloat(getComputedStyle(e).fontSize)>=12)));
  await page.screenshot({path:resolve(screenshots,`${view}-${width}.png`),fullPage:true});
 }
 await mount(ready(synthetic(),'performance'));assert(!await page.$('svg'));assert(!(await page.$eval('.stock-outcomes',e=>e.innerText)).includes('%'));
 await mount({view:'performance',state:{status:'no-owner'}});assert(!(await page.$eval('.stock-outcomes',e=>e.innerText)).includes('1000'));
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('PASS Chrome keyboard details/retry, owner clearing, 320/390/1280 reflow, readable type, no nested scroll/network; six screenshots');
} finally {await browser.close();}
