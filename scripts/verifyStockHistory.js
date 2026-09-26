import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const result = await build({ entryPoints: ['src/StockHistory.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'], loader: { '.css': 'empty' }, jsx: 'automatic' });
const mod = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
const { StockHistory } = mod.exports;
const props = { ticker: 'TEST', scope: 'book', price: { state: 'loading', history: null, identity: null }, ratings: [] };
const render = p => renderToStaticMarkup(React.createElement(StockHistory, { ...props, ...p }));
assert.match(render(), /Loading price history/);
assert.match(render({ price: { ...props.price, state: 'unavailable' } }), /Price history unavailable/);
assert.match(render({ isEtf: true }), /ETF.*not scored by the equity model/);
assert.match(render(), /aria-pressed="true"[^>]*>Price/);
console.log('PASS history loading, unavailable, ETF, native chart selection');
const stamp = (overrides = {}) => ({ schema_version: 1, model_version: 'v1', scope: 'book', subject_id: 'TEST', cohort_id: 'c1', cohort_size: 10, ...overrides });
const rating = (date, value, scoreMeta = stamp()) => ({ date, rating: value, scoreMeta });
const series = mod.exports.ratingSeries;
assert.equal(typeof series, 'function', 'ratingSeries must expose the actual component series');
const rated = series([
 rating('2026-09-01', 0), rating('2026-09-02', 50), rating('2026-09-03', 60, stamp({model_version:'v2'})),
 rating('2026-09-04', 70, {subject_id:'TEST',scope:'book'}), rating('2026-09-05', 80), rating('2026-09-06', 101),
 rating('2026-09-07', 90), rating('2026-09-08', 99, stamp({scope:'universe'})), rating('2026-09-09', 42, stamp({subject_id:'OTHER'})),
], 'TEST', 'book');
assert.deepEqual(rated.rows.map(p => p.value), [0,50,60,70,80,null,90,null,null]);
assert.deepEqual(rated.segments.map(s => s.length), [2,1,1,1,1]);
assert.match(rated.rows[2].note, /boundary/i);
assert.match(rated.rows[3].note, /legacy/i);
const duplicates = series([rating('2026-09-03',30),rating('2026-09-01',10),rating('2026-09-02',20),rating('2026-09-02',21)],'TEST','book');
assert.deepEqual(duplicates.rows.map(p=>p.value),[10,null,30]);
assert.deepEqual(duplicates.segments.map(s=>s.length),[1,1]);
const malformed = series([rating('2026-09-01',10),rating('bad',20),rating('2026-09-03',30)],'TEST','book');
assert.deepEqual(malformed.segments.map(s=>s.length),[1,1]);
assert.equal(series([rating('2026-09-01',NaN),rating('2026-09-02',-1),rating('2026-09-03','50'),rating('2026-09-04',null)],'TEST','book').segments.length,0);
assert.equal(series([rating('2026-09-01',50,{})],'TEST','book').rows[0].value,null);
console.log('PASS actual rating normalization, identity, boundaries, duplicates, malformed and zero');
const annualRatings = Array.from({length:800},(_,i)=>rating(new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),50));
const boundedRatings = series(annualRatings,'TEST','book');
assert.ok(boundedRatings.rows.length<=400, 'rating chart must also stay bounded');
assert.ok(Date.parse(boundedRatings.rows.at(-1).date)-Date.parse(boundedRatings.rows[0].date)<=366*86400000);
assert.match(boundedRatings.notice,/one year/);
const identity = { instrumentId:'Yahoo Finance:TEST:USD',listingSymbol:'TEST',underlyingSymbol:null,currency:'USD' };
const history = {status:'ready',observations:[{date:'2026-08-01',value:10.123456},{date:'2026-08-02',value:null},{date:'2026-09-01',value:0},{date:'2026-09-03',value:null}],pointCount:2,reason:null,source:'Yahoo Finance',adjustmentBasis:'provider-adjusted close',fetchedAt:'2026-09-04T00:30:00Z',coverageStart:'2026-08-01',coverageEnd:'2026-09-03',timezone:'America/New_York'};
assert.equal(typeof mod.exports.priceSeries,'function');
const priced = mod.exports.priceSeries(history,'1Y');
assert.deepEqual(priced.segments.map(s=>s.length),[1,1]);
assert.equal(priced.rows.at(-1).value,null);
assert.deepEqual(priced.periods,['1M','3M']);
assert.equal(priced.partial,true);
const ready = render({price:{state:'ready',history,identity}});
for(const text of ['10.123456','provider-adjusted close','2026-09-01','2026-09-03','2026-09-04T00:30:00Z','America/New_York','Show observations','Partial coverage','Not live','USD']) assert.ok(ready.includes(text),text);
assert.equal((ready.match(/<svg/g)||[]).length,1);
assert.equal((ready.match(/<polyline/g)||[]).length,0);
assert.match(render({price:{state:'ready',identity,history:{...history,observations:[{date:'2026-09-01',value:5}],pointCount:1,status:'single'}}}),/One observation.*not a trend/);
assert.match(render({price:{state:'ready',identity,history:{...history,observations:[],pointCount:0,status:'empty'}}}),/No usable price observations/);
const longRows = Array.from({length:800},(_,i)=>({date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),value:i}));
const bounded = mod.exports.priceSeries({...history,observations:longRows,coverageStart:longRows[0].date,coverageEnd:longRows.at(-1).date},'1Y');
assert.ok(bounded.rows.length<=400);
assert.ok(Date.parse(bounded.rows.at(-1).date)-Date.parse(bounded.rows[0].date)<=366*86400000);
assert.deepEqual(bounded.periods,['1M','3M','1Y']);
console.log('PASS price gaps, exact table, provenance, partial periods, single, empty, one-year bound');
// H1: validate synthetic inputs with the real normalizer, then exercise the real helper and SSR.
const normalizerBundle = await build({ entryPoints:['src/stockInsights.ts'],bundle:true,write:false,platform:'node',format:'cjs' });
const normalizer = {exports:{}};
new Function('require','module','exports',normalizerBundle.outputFiles[0].text)(require,normalizer,normalizer.exports);
const validatedHistory = observations => normalizer.exports.normalizeHistory({
 status:'ok',instrument_id:identity.instrumentId,listing_symbol:'TEST',underlying_symbol:null,currency:'USD',
 source:'Yahoo Finance',adjustment_basis:'provider-adjusted close',fetched_at:'2026-09-26T00:30:00Z',timezone:'America/New_York',
 coverage_start:observations[0].date,coverage_end:observations.at(-1).date,observations,
},identity);
const nearYearRows = [];
for(let day=new Date('2025-09-29T00:00:00Z'); day<=new Date('2026-09-25T00:00:00Z'); day.setUTCDate(day.getUTCDate()+1)) {
 if(day.getUTCDay()!==0 && day.getUTCDay()!==6) nearYearRows.push({date:day.toISOString().slice(0,10),value:nearYearRows.length});
}
const nearYear = validatedHistory(nearYearRows);
assert.equal(nearYear.status,'ready');
assert.equal(nearYear.pointCount,260);
const oldOnly = validatedHistory([{date:'2026-02-02',value:0},{date:'2026-09-25',value:null}]);
assert.equal(oldOnly.status,'single');
const h1Failures = [];
const h1Check = (name,check) => { try { check(); console.log(`PASS H1 ${name}`); } catch(error) { h1Failures.push(name); console.error(`FAIL H1 ${name}: ${error.message}`); } };
h1Check('near-year helper preserves all 260 observations including oldest zero',()=>{
 const actual=mod.exports.priceSeries(nearYear,'1Y');
 assert.deepEqual(actual.periods,['1M','3M','1Y']);
 assert.equal(actual.period,'1Y');
 assert.equal(actual.partial,true);
 assert.deepEqual(actual.rows.map(({date,value})=>({date,value})),nearYearRows);
});
h1Check('near-year SSR exposes partial 1Y and oldest zero in native table',()=>{
 const html=render({price:{state:'ready',history:nearYear,identity}});
 assert.match(html,/<button[^>]*aria-pressed="true"[^>]*>1Y<\/button>/);
 assert.match(html,/Partial coverage for the trailing 1Y/);
 assert.match(html,/<tbody><tr><th scope="row">2025-09-29<\/th><td>0<\/td>/);
 assert.match(html,/Show observations \(260\)/);
});
h1Check('old-only helper falls back from previously selected short periods',()=>{
 for(const requested of ['1M','3M','1Y']) {
  const actual=mod.exports.priceSeries(oldOnly,requested);
  assert.deepEqual(actual.periods,['1Y']);
  assert.equal(actual.period,'1Y');
  assert.equal(actual.partial,true);
  assert.deepEqual(actual.rows.map(({date,value})=>({date,value})),oldOnly.observations);
  assert.deepEqual(actual.segments.map(segment=>segment.length),[1]);
 }
});
h1Check('old-only SSR exposes a dated zero dot, null endpoint and no trend',()=>{
 const html=render({price:{state:'ready',history:oldOnly,identity}});
 assert.match(html,/<button[^>]*aria-pressed="true"[^>]*>1Y<\/button>/);
 assert.match(html,/Partial coverage for the trailing 1Y/);
 assert.match(html,/<th scope="row">2026-02-02<\/th><td>0<\/td>/);
 assert.match(html,/<th scope="row">2026-09-25<\/th><td>Unavailable<\/td>/);
 assert.match(html,/One observation — a dated point, not a trend/);
 assert.equal((html.match(/<circle/g)||[]).length,1);
 assert.equal((html.match(/<polyline/g)||[]).length,0);
});
h1Check('3M boundary does not offer a redundant year; older out-of-year points stay bounded',()=>{
 const edge=validatedHistory([{date:'2026-06-25',value:0},{date:'2026-09-25',value:null}]);
 assert.deepEqual(mod.exports.priceSeries(edge,'1Y').periods,['3M']);
 const outside=validatedHistory([{date:'2025-09-24',value:1},{date:'2026-09-25',value:2}]);
 const actual=mod.exports.priceSeries(outside,'1Y');
 assert.deepEqual(actual.periods,['1M']);
 assert.deepEqual(actual.rows.map(row=>row.date),['2026-09-25']);
});
assert.deepEqual(h1Failures,[],'H1 regression failures');
// Browser runs only the component in memory, not the application or shared docs.
const { default: puppeteer } = await import('file:///C:/Users/campb/AppData/Local/hermes/cache/scratch/site-audit-20260925/harness/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
const browserBundle = await build({ stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {StockHistory} from './src/StockHistory'; const root=createRoot(document.getElementById('root')); window.show=p=>root.render(React.createElement(StockHistory,p));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outfile:'history.js',format:'iife',platform:'browser',jsx:'automatic' });
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844});
 await page.setContent('<html><head></head><body style="margin:16px;background:#101820"><div id="root"></div></body></html>');
 for(const file of browserBundle.outputFiles) { if(file.path.endsWith('.css')) await page.addStyleTag({content:file.text}); else await page.addScriptTag({content:file.text}); }
 const mount = async p => { await page.evaluate(p=>window.show(p),p); await page.waitForFunction(()=>document.querySelector('.sd-history')); };
 const click = async text => { await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click(),text); await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent===text&&b.getAttribute('aria-pressed')==='true'),{},text); };
 await mount({...props,price:{state:'ready',history,identity},ratings:[rating('2026-09-01',0),rating('2026-09-02',100),rating('2026-09-03',30,stamp({cohort_id:'c2'})),rating('2026-09-04',40,{subject_id:'TEST',scope:'book'})]});
 await click('Rating');
 assert.equal(await page.$$eval('svg',e=>e.length),1);
 assert.equal(await page.$$eval('polyline',e=>e.length),1);
 assert.equal(await page.$$eval('circle',e=>e.length),4);
 assert.match(await page.$eval('svg',e=>e.getAttribute('aria-label')),/fixed 0 to 100/);
 await page.click('summary');
 assert.equal(await page.$$eval('tbody tr',e=>e.length),4);
 assert.match(await page.$eval('tbody',e=>e.textContent),/boundary/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.$eval('svg text',e=>getComputedStyle(e).fontSize),'14px');
 await click('Price'); await click('1M');
 assert.equal(await page.$$eval('tbody tr',e=>e.length),2);
 assert.match(await page.$eval('tbody',e=>e.textContent),/Unavailable/);
 // Retain the real component's selected 1M state while replacing data with an old-only point.
 await mount({...props,price:{state:'ready',history:oldOnly,identity}});
 await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('2026-02-02'));
 assert.deepEqual(await page.$$eval('[aria-label="Price period"] button',buttons=>buttons.map(b=>[b.textContent,b.getAttribute('aria-pressed')])),[['1Y','true']]);
 assert.match(await page.$eval('.sd-history',e=>e.textContent),/Partial coverage for the trailing 1Y/);
 assert.match(await page.$eval('.sd-history',e=>e.textContent),/dated point, not a trend/);
 assert.equal(await page.$$eval('circle',e=>e.length),1);
 assert.equal(await page.$$eval('polyline',e=>e.length),0);
 assert.deepEqual(await page.$$eval('tbody tr',rows=>rows.map(row=>[row.querySelector('th').textContent,row.querySelector('td').textContent])),[['2026-02-02','0'],['2026-09-25','Unavailable']]);
 await mount({...props,price:{state:'ready',history:nearYear,identity}});
 await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('2026-08-25'));
 await click('1Y');
 assert.equal(await page.$$eval('tbody tr',rows=>rows.length),260);
 assert.equal(await page.$$eval('circle',e=>e.length),260);
 assert.match(await page.$eval('tbody tr',e=>e.textContent),/^2025-09-290Observed/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS H1 browser retained-short-period fallback, old dated zero dot, and partial-year access');
 await mount({...props,isEtf:true}); await click('Rating');
 await page.waitForFunction(()=>document.body.textContent.includes('Equity rating unavailable'));
 assert.equal(await page.$$eval('circle',e=>e.length),0);
 await mount({...props,isEtf:false});
 await page.waitForFunction(()=>document.body.textContent.includes('Collecting rating history'));
 await mount({...props,ratings:[rating('2026-09-01',0)]});
 await page.waitForFunction(()=>document.querySelectorAll('circle').length===1);
 assert.match(await page.$eval('.sd-history',e=>e.textContent),/not a trend/);
 // A loading/empty chart becoming ready must remeasure instead of scaling 14px labels.
 await page.setViewport({width:900,height:844});
 await mount({...props,ratings:[]}); await page.waitForFunction(()=>!document.querySelector('svg'));
 await mount({...props,ratings:[rating('2026-09-01',0)]});
 await page.waitForFunction(()=>document.querySelector('svg'));
 await page.waitForFunction(()=>{ const svg=document.querySelector('svg'); return svg && Math.abs(svg.viewBox.baseVal.width-svg.getBoundingClientRect().width)<2; },{timeout:5000});
 assert.ok(await page.$eval('svg',e=>Math.abs(e.viewBox.baseVal.width-e.getBoundingClientRect().width)<2),'chart must measure after empty-to-ready transition');
 assert.deepEqual(errors,[]);
 console.log('PASS browser one-chart toggles, exact table, rating axis, ETF, collecting, single, 390px reflow and empty-to-ready sizing');
} finally { await browser.close(); }
