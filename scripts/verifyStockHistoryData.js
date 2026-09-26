import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assert(existsSync(resolve(root, 'src/StockHistoryData.tsx')), 'StockHistoryData must exist');
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || 'C:/Users/campb/AppData/Local/hermes/cache/scratch/site-audit-20260925/harness/node_modules/puppeteer-core');
const bundle = await build({ stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {StockHistoryData} from './src/StockHistoryData';
import {insightsPath} from './src/stockInsightData';
window.calls=[]; window.checks=0;
window.snapshot={as_of:'2026-09-25',generated_at:'2026-09-25T12:00:00.123456+00:00'};
window.expected=insightsPath(window.snapshot);
const mode=new URLSearchParams(location.search).get('mode');
window.props={ticker:'ABC',scope:'book',currency:'CAD',snapshot:mode==='missing'?{as_of:window.snapshot.as_of}:window.snapshot,ownerKey:mode==='no-owner'?null:'owner-a',ratings:[]};
let root=createRoot(document.getElementById('root'));
window.render=(patch={})=>{Object.assign(window.props,patch);const element=<StockHistoryData {...window.props} fetchRows={path=>{if(window.throwFetch)throw Error('synchronous network error');return new Promise((resolve,reject)=>window.calls.push({path,resolve,reject}));}} onAccessCheck={()=>window.checks++}/>;flushSync(()=>root.render(mode==='strict'?<React.StrictMode>{element}</React.StrictMode>:element));return document.body.textContent;};
window.unmount=()=>flushSync(()=>root.unmount());
window.render();
`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, outdir: 'memory', format: 'iife', jsx: 'automatic' });
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
const server = createServer((req, res) => {res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:`<style>${css}</style><div id="root"></div><script src="/test.js"></script>`);});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const scratch = process.env.TMPDIR || 'C:/Users/campb/AppData/Local/hermes/cache/scratch';
mkdirSync(scratch, { recursive: true });
const profile = mkdtempSync(resolve(scratch, 'stock-history-data-chrome-'));
let browser;
const errors=[];
let passed=0;
try {
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',userDataDir:profile,headless:true,args:['--disable-background-networking','--no-first-run','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
 const page=await browser.newPage();
 await page.evaluateOnNewDocument(()=>{Date.now=()=>Date.parse('2026-09-26T12:00:00Z');});
 await page.setRequestInterception(true);
 page.on('request',req=>new URL(req.url()).hostname==='127.0.0.1'?req.continue():req.abort());
 page.on('pageerror',error=>errors.push(String(error)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const reset=async()=>{await page.goto(url);await page.waitForFunction(()=>window.calls?.length===1);};
 const check=async(name,fn)=>{await fn();passed++;console.log(`PASS ${name}`);};
 await reset();
 await check('mount requests exact helper path once; unstable callbacks do not loop',async()=>{
  assert.equal(await page.evaluate(()=>calls[0].path),await page.evaluate(()=>expected));
  await page.evaluate(()=>{for(let i=0;i<5;i++)render();});
  assert.equal(await page.evaluate(()=>calls.length),1);
  assert.match(await page.evaluate(()=>document.body.textContent),/Loading price history/);
 });
 const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
 const text=()=>page.evaluate(()=>document.body.textContent);
 const fixture=await page.evaluate(()=>{
  const entry={status:'ok',instrument_id:'Yahoo Finance:ABC.NE:CAD',listing_symbol:'ABC.NE',underlying_symbol:'ABC',currency:'CAD',source:'Yahoo Finance',adjustment_basis:'provider-adjusted close',fetched_at:'2026-09-26T10:00:01Z',coverage_start:'2026-09-23',coverage_end:'2026-09-25',timezone:'America/Toronto',observations:[{date:'2026-09-23',value:10},{date:'2026-09-25',value:12.34567}]};
  return [{...snapshot,insights:{schema_version:1,as_of:snapshot.as_of,snapshot_generated_at:snapshot.generated_at,generated_at:'2026-09-26T10:00:00Z',series:{ABC:entry,XYZ:{...entry,instrument_id:'Yahoo Finance:XYZ.NE:CAD',listing_symbol:'XYZ.NE',underlying_symbol:'XYZ',observations:[{date:'2026-09-23',value:80},{date:'2026-09-25',value:88.76543}]}}}}];
 });
 const respond=async(index,rows=fixture,status=200)=>{await page.evaluate(({index,rows,status})=>calls[index].resolve({ok:status===200,status,rows}),{index,rows,status});await settle();};
 await check('no owner or missing timestamp cannot query; explicit unavailable',async()=>{
  await page.evaluate(()=>render({ownerKey:null}));await settle();
  assert.match(await text(),/unavailable/i);assert.equal(await page.evaluate(()=>calls.length),1);
  await page.evaluate(()=>render({ownerKey:'owner-a',snapshot:{as_of:'2026-09-25'}}));await settle();
  assert.match(await text(),/unavailable/i);assert.equal(await page.evaluate(()=>calls.length),1);
 });
 await reset();
 await check('actual publishedPrice renders exact series; ticker/currency select cached whole row',async()=>{
  await respond(0);assert.match(await text(),/12.34567/);
  const immediate=await page.evaluate(()=>render({ticker:'XYZ'}));assert(!immediate.includes('12.34567'));assert.match(immediate,/88.76543/);
  assert.equal(await page.evaluate(()=>calls.length),1);
  assert(!((await page.evaluate(()=>render({currency:'USD'}))).includes('88.76543')));
  assert.match(await text(),/unavailable/i);
 });
 await check('owner/snapshot changes gate old data synchronously; late responses ignored',async()=>{
  await page.evaluate(()=>render({ticker:'ABC',currency:'CAD'}));
  assert(!((await page.evaluate(()=>render({ownerKey:'owner-b'}))).includes('12.34567')));
  await settle();assert.equal(await page.evaluate(()=>calls.length),2);
  await page.evaluate(()=>render({snapshot:{...snapshot,generated_at:'2026-09-25T12:00:00.123457+00:00'}}));await settle();
  assert.equal(await page.evaluate(()=>calls.length),3);
  await respond(1);assert(!((await text()).includes('12.34567')));
  await respond(2,[]);assert.match(await text(),/Refresh the desk/);
 });
 const click=async(label)=>{await page.evaluate(label=>{const button=[...document.querySelectorAll('button')].find(button=>button.textContent===label);if(!button)throw Error('Missing button: '+label);button.click();},label);await settle();};
 await reset();
 await check('native refresh retains source dates while pending; HTTP500 warns and retry recovers',async()=>{
  await respond(0);await click('Refresh price history');
  assert.equal(await page.evaluate(()=>calls.length),2);assert.match(await text(),/12.34567/);
  assert(await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Refresh price history').disabled));
  await respond(1,[],500);assert.match(await text(),/last successful/i);assert.match(await text(),/freshness/i);assert.match(await text(),/2026-09-26T10:00:01Z/);
  await click('Retry price history');await respond(2);assert(!((await text()).includes('freshness')));
 });
 await check('network rejection retains last success; 400 clears chart only; Rating/Price controls remain',async()=>{
  await click('Refresh price history');await page.evaluate(()=>calls[3].reject(Error('offline')));await settle();
  assert.match(await text(),/12.34567/);assert.match(await text(),/last successful/i);
  await click('Retry price history');await respond(4,[],400);assert(!((await text()).includes('12.34567')));assert.match(await text(),/unavailable/i);
  assert.equal(await page.evaluate(()=>checks),0);
  await click('Rating');assert.match(await text(),/rating history/);await click('Price');
 });
 await page.evaluateOnNewDocument(()=>{const original=window.setTimeout;window.historyTimers=[];window.setTimeout=(fn,delay,...args)=>{if(delay===12000){historyTimers.push(()=>fn(...args));return original(()=>{},60000);}return original(fn,delay,...args);};});
 await reset();
 await check('fixed 12000ms deadline stops pending; timeout keeps rating UI and late success cannot restore',async()=>{
  assert.equal(await page.evaluate(()=>historyTimers.length),1);
  await page.evaluate(()=>historyTimers[0]());await settle();
  assert.match(await text(),/timed out/i);await click('Rating');await click('Price');
  await respond(0);assert(!((await text()).includes('12.34567')));
  await click('Retry price history');assert.equal(await page.evaluate(()=>calls.length),2);await respond(1);assert.match(await text(),/12.34567/);
 });
 for(const status of [401,403]) {
  await reset();
  await check(`secondary ${status} clears cache and calls authoritative check once without replacing UI`,async()=>{
   await respond(0);await click('Refresh price history');await respond(1,[],status);
   assert.equal(await page.evaluate(()=>checks),1);assert(!((await text()).includes('12.34567')));assert.match(await text(),/unavailable/i);
   await page.evaluate(()=>render());await settle();assert.equal(await page.evaluate(()=>checks),1);
   await click('Retry price history');await respond(2,[],500);assert(!((await text()).includes('12.34567')));
   await click('Rating');assert.match(await text(),/rating history/);
  });
 }
 await reset();
 await check('late denial after timeout still checks current access and removes old cache',async()=>{
  await respond(0);await click('Refresh price history');await page.evaluate(()=>historyTimers.at(-1)());await settle();
  assert.match(await text(),/12.34567/);await respond(1,[],403);assert.equal(await page.evaluate(()=>checks),1);assert(!((await text()).includes('12.34567')));
 });
 await reset();
 await check('retry supersedes timed-out responses including secondary denial',async()=>{
  await page.evaluate(()=>historyTimers[0]());await settle();await click('Retry price history');await respond(1);await respond(0,[],401);
  assert.equal(await page.evaluate(()=>checks),0);assert.match(await text(),/12.34567/);
 });
 await reset();
 await check('unmount ignores late denial and rejection',async()=>{
  await page.evaluate(()=>unmount());await respond(0,[],401);assert.equal(await page.evaluate(()=>checks),0);assert.equal(await text(),'');
  await reset();await page.evaluate(()=>unmount());await page.evaluate(()=>calls[0].reject(Error('late offline')));await settle();assert.equal(await text(),'');
 });
 await check('StrictMode effect replay does not issue a canceled request',async()=>{
  await page.goto(url+'/?mode=strict');await page.waitForFunction(()=>window.calls?.length>0);assert.equal(await page.evaluate(()=>calls.length),1);
 });
 for(const mode of ['no-owner','missing']) await check(`initial ${mode} mount issues zero queries`,async()=>{
  await page.goto(url+'/?mode='+mode);await page.waitForFunction(()=>typeof window.render==='function');await settle();assert.equal(await page.evaluate(()=>calls.length),0);assert.match(await text(),/unavailable/i);
 });
 await reset();
 await check('deferred ticker switch selects only current listing without refetch',async()=>{
  await page.evaluate(()=>render({ticker:'XYZ'}));await respond(0);assert.match(await text(),/88.76543/);assert(!((await text()).includes('12.34567')));assert.equal(await page.evaluate(()=>calls.length),1);
 });
 await reset();
 await check('superseded owner denial cannot revalidate current owner',async()=>{
  await page.evaluate(()=>render({ownerKey:'owner-b'}));await settle();await respond(0,[],403);assert.equal(await page.evaluate(()=>checks),0);await respond(1);assert.match(await text(),/12.34567/);
 });
 await reset();
 await check('initial HTTP500, rejected and synchronous throwing fetches finish with retry',async()=>{
  await respond(0,[],500);assert.match(await text(),/unavailable/i);await click('Retry price history');await page.evaluate(()=>calls[1].reject(Error('offline')));await settle();assert.match(await text(),/unavailable/i);
  await page.evaluate(()=>{window.throwFetch=true;});await click('Retry price history');assert.match(await text(),/Check the connection/);
 });
 await reset();
 await check('empty successful refresh removes cached price without owner denial',async()=>{
  await respond(0);await click('Refresh price history');await respond(1,[]);assert.match(await text(),/Refresh the desk/);assert(!((await text()).includes('12.34567')));assert.equal(await page.evaluate(()=>checks),0);
 });
 await reset();
 await check('caller rating points remain usable while price is loading and after failure',async()=>{
  await page.evaluate(()=>render({ratings:[{date:'2026-09-25',rating:67.123,scoreMeta:{subject_id:'ABC',scope:'book'}}]}));await click('Rating');assert.match(await text(),/67.123/);await respond(0,[],500);assert.match(await text(),/67.123/);
  assert.equal(await page.evaluate(()=>getComputedStyle([...document.querySelectorAll('button')].find(button=>button.textContent==='Retry price history')).fontSize),'14px');
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 });
 assert.deepEqual(errors,[],'No browser errors or unhandled rejections');
 console.log(`PASS ${passed} real React/Chrome lifecycle scenarios; localhost only`);
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
