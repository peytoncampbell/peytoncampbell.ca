import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert(existsSync(resolve(root,'src/StockOutcomesData.tsx')), 'History outcomes wrapper must exist');
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_PATH || 'C:/Users/campb/AppData/Local/hermes/cache/scratch/site-audit-20260925/harness/node_modules/puppeteer-core');
const bundle=await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {StockOutcomesData} from './src/StockOutcomesData';
import OwnerStocks from './src/OwnerStocks';
import {stockDashboardFixture} from './scripts/fixtures/stockDashboard';
window.fixture=stockDashboardFixture();window.ownerCalls=[];window.outcomePending=[];window.privateDenied=false;
window.ownerRead=async(path,fresh)=>{window.ownerCalls.push(path);await fresh();const table=path.split('?')[0];if(table==='pc_outcome_reports')return new Promise(resolve=>window.outcomePending.push(resolve));return {ok:true,status:200,rows:table==='pc_digest_private'&&window.privateDenied?[]:(window.fixture.routes[table] || [])};};
window.calls=[];window.checks=0;
const mode=new URLSearchParams(location.search).get('mode');
window.props={ownerKey:mode==='no-owner'?null:'owner-a', snapshots:<p>Original snapshots</p>};
const root=createRoot(document.getElementById('root'));
window.render=(patch={})=>{Object.assign(window.props,patch);const element=<StockOutcomesData {...window.props} fetchRows={path=>{if(window.throwFetch)throw Error('offline');return new Promise((resolve,reject)=>calls.push({path,resolve,reject}));}} onAccessCheck={()=>checks++}/>;flushSync(()=>root.render(mode==='owner'?<OwnerStocks onSignedOut={()=>window.signedOut=true} onHome={()=>{}}/>:mode==='strict'?<React.StrictMode>{element}</React.StrictMode>:element));return document.body.textContent;};
window.unmount=()=>flushSync(()=>root.unmount());window.render();
`,resolveDir:root,loader:'tsx'},bundle:true,write:false,outdir:'memory',format:'iife',jsx:'automatic',plugins:[{name:'synthetic-owner-transport',setup(build){build.onResolve({filter:/^\.\/ownerAuth$/},()=>({path:'owner-auth',namespace:'synthetic'}));build.onLoad({filter:/.*/,namespace:'synthetic'},()=>({loader:'js',contents:`const session={user_id:'synthetic-owner',email:'owner@example.invalid'};const fresh=async()=>session;const noop=()=>{};export const useNoIndex=noop;export const useOwnerSession=()=>({session,ready:true,error:'',setError:noop,signOut:async()=>{},ensureFresh:fresh,invalidateSession:noop});export const ownerFetch=(path,fresh)=>window.ownerRead(path,fresh);`}));}}]});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text || '';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:`<style>${css}</style><div id="root"></div><script src="/test.js"></script>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const scratch=process.env.TMPDIR || 'C:/Users/campb/AppData/Local/hermes/cache/scratch';mkdirSync(scratch,{recursive:true});
const profile=mkdtempSync(resolve(scratch,'outcome-data-chrome-'));let browser;let passed=0;const errors=[];
try {
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',userDataDir:profile,headless:true,args:['--disable-background-networking','--no-first-run','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
 const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).hostname==='127.0.0.1'?r.continue():r.abort());page.on('pageerror',e=>errors.push(String(e)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const settle=()=>page.evaluate(()=>new Promise(r=>setTimeout(r,0)));
 const text=()=>page.evaluate(()=>document.body.textContent);
 const reset=async(mode='')=>{await page.goto(url+'/?mode='+mode);await page.waitForFunction(()=>typeof window.render==='function');await settle();};
 const click=async(label)=>{await page.evaluate(label=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label);if(!b)throw Error('Missing '+label);b.click();},label);await settle();};
 const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
 await reset();
 await check('Snapshots default; native secondary navigation; no initial report reads',async()=>{
  assert.match(await text(),/Original snapshots/);assert.deepEqual(await page.$$eval('button',bs=>bs.map(b=>b.textContent)),['Snapshots','Decisions','Performance']);assert.equal(await page.evaluate(()=>calls.length),0);
 });
 const stamp='2026-09-25T20:00:00.123456Z';
 const report={report_id:'synthetic-report',as_of:'2026-09-25',generated_at:stamp,schema_version:1,payload:{schema_version:1,report_id:'synthetic-report',as_of:'2026-09-25',generated_at:stamp,reporting_currency:'CAD',source_cutoff:stamp,ledger_revision:null,reconciliation:{status:'not_imported',broker_data_as_of:null,period_start:null,period_end:null,verified_at:null,issues:[]},decision_window:{total:0,returned:0,has_more:false,items:[]},performance:{status:'unavailable',reason:'Broker import required.',period_start:null,period_end:null,bridge:null,money_weighted:null,time_weighted:null,benchmark:null},model_evidence:{status:'collecting',reason:'Future sessions required.',capture_count:0,first_capture:null,last_capture:null,horizons:[],limitations:[]},limitations:['Comparison policy not selected.']}};
 const respond=async(i,rows=[report],status=200)=>{await page.evaluate(({i,rows,status})=>calls[i].resolve({ok:status===200,status,rows}),{i,rows,status});await settle();};
 await check('deliberate entry reads bounded projection once and shares parsed report across views',async()=>{
  await click('Decisions');assert.equal(await page.evaluate(()=>calls.length),1);
  assert.equal(await page.evaluate(()=>calls[0].path),'pc_outcome_reports?select=report_id,as_of,generated_at,schema_version,payload&order=generated_at.desc,report_id.desc&limit=1');
  assert.match(await text(),/Loading outcomes/);await respond(0);assert.match(await text(),/0 of 0 decisions/);assert.match(await text(),/2026-09-25T20:00:00.123456Z/);
  await click('Performance');assert.match(await text(),/Broker data not imported/);assert.match(await text(),/Captures: 0/);await page.evaluate(()=>{for(let i=0;i<5;i++)render();});await settle();assert.equal(await page.evaluate(()=>calls.length),1);
 });
 await check('owner change and revoke synchronously hide cached report; stale success cannot restore',async()=>{
  assert(!(await page.evaluate(()=>render({ownerKey:'owner-b'}))).includes(stamp));await settle();
  assert.equal(await page.evaluate(()=>calls.length),2);
  assert(!(await page.evaluate(()=>render({ownerKey:null}))).includes(stamp));await respond(1);assert.match(await text(),/Owner access required/);assert(!(await text()).includes(stamp));
 });
 await reset();await click('Decisions');
 await check('malformed, unsupported, multiple, empty and missing table fail closed with retry; empty rechecks gate once',async()=>{
  for(const rows of [[{}],[{...report,schema_version:2}],[report,report],null]) {await respond((await page.evaluate(()=>calls.length))-1,rows);assert.match(await text(),/unavailable/i);await click('Retry');}
  await respond((await page.evaluate(()=>calls.length))-1,[]);assert.match(await text(),/No outcome report has been published/);assert.equal(await page.evaluate(()=>checks),1);await page.evaluate(()=>render());await settle();assert.equal(await page.evaluate(()=>checks),1);
  await click('Refresh outcomes');await respond((await page.evaluate(()=>calls.length))-1,[],404);assert.match(await text(),/HTTP 404/);await click('Snapshots');assert.match(await text(),/Original snapshots/);
 });
 await reset();await click('Decisions');await respond(0);
 await check('refresh retains original provenance with explicit stale warning on 500/network; 400 clears',async()=>{
  await click('Refresh outcomes');assert((await text()).includes(stamp));assert.match(await text(),/last successful/i);await respond(1,[],500);assert((await text()).includes(stamp));assert.match(await text(),/stale/i);
  await click('Refresh outcomes');await page.evaluate(()=>calls[2].reject(Error('offline')));await settle();assert((await text()).includes(stamp));assert.match(await text(),/stale/i);
  await click('Refresh outcomes');await respond(3,[],400);assert(!(await text()).includes(stamp));assert.match(await text(),/unavailable/i);
 });
 for(const status of [401,403]) await check(`current ${status} clears cache and revalidates once; stale owner/unmounted denial ignored`,async()=>{
  await reset();await click('Decisions');await respond(0);await click('Refresh outcomes');await respond(1,[],status);assert.equal(await page.evaluate(()=>checks),1);assert(!(await text()).includes(stamp));await click('Snapshots');assert.match(await text(),/Original snapshots/);
  await reset();await click('Decisions');await page.evaluate(()=>render({ownerKey:'owner-b'}));await settle();await respond(0,[],status);assert.equal(await page.evaluate(()=>checks),0);await page.evaluate(()=>unmount());await respond(1,[],status);assert.equal(await page.evaluate(()=>checks),0);
 });
 await page.evaluateOnNewDocument(()=>{const original=setTimeout;window.timers=[];window.setTimeout=(fn,delay,...args)=>{if(delay===12000){timers.push(()=>fn(...args));return original(()=>{},60000);}return original(fn,delay,...args);};});
 await check('12 second deadline stops loading; retry supersedes late success and denial',async()=>{
  await reset();await click('Decisions');assert.equal(await page.evaluate(()=>timers.length),1);await page.evaluate(()=>timers[0]());await settle();assert.match(await text(),/timed out/i);await respond(0);assert(!(await text()).includes(stamp));await click('Retry');await respond(1);assert((await text()).includes(stamp));
  await click('Refresh outcomes');await page.evaluate(()=>timers.at(-1)());await settle();assert.match(await text(),/stale/i);await click('Refresh outcomes');await respond(3);await respond(2,[],401);assert.equal(await page.evaluate(()=>checks),0);assert((await text()).includes(stamp));
  await click('Refresh outcomes');await page.evaluate(()=>timers.at(-1)());await settle();await respond(4,[],403);assert.equal(await page.evaluate(()=>checks),1);assert(!(await text()).includes(stamp));
 });
 await check('no-owner entry never reads; StrictMode/unstable callbacks single read; keyboard focus and snapshots return',async()=>{
  await reset('no-owner');await click('Decisions');assert.equal(await page.evaluate(()=>calls.length),0);assert.match(await text(),/Owner access required/);
  await reset('strict');assert.equal(await page.evaluate(()=>calls.length),0);await page.focus('nav button:nth-child(2)');await page.keyboard.press('Enter');await settle();assert.equal(await page.evaluate(()=>calls.length),1);await page.evaluate(()=>{for(let i=0;i<5;i++)render();});await respond(0);assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Decisions');await page.keyboard.press('Tab');await page.keyboard.press('Space');await settle();assert.match(await text(),/Broker data not imported/);assert.equal(await page.evaluate(()=>calls.length),1);await click('Snapshots');assert.match(await text(),/Original snapshots/);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 });
 await check('cached malformed and empty clear; synchronous fetch failure; unmount ignores success/rejection',async()=>{
  for(const rows of [[{}],[]]) {await reset();await click('Decisions');await respond(0);await click('Refresh outcomes');await respond(1,rows);assert(!(await text()).includes(stamp));}
  await reset();await page.evaluate(()=>{window.throwFetch=true;});await click('Decisions');assert.match(await text(),/Check the connection/);
  await reset();await click('Decisions');await page.evaluate(()=>unmount());await respond(0);assert.equal(await text(),'');
  await reset();await click('Decisions');await page.evaluate(()=>unmount());await page.evaluate(()=>calls[0].reject(Error('late')));await settle();assert.equal(await text(),'');
 });
 await check('actual OwnerStocks preserves dashboard and lazy History integration',async()=>{
  await reset('owner');await page.waitForSelector('.stock-dashboard');
  assert.equal(await page.evaluate(()=>ownerCalls.filter(p=>p.startsWith('pc_outcome_reports')).length),0);
  assert.equal(await page.$$eval('.sd-kpis > div',items=>items.length),4);
  assert.equal(await page.$$eval('[data-dashboard-panel]',items=>items.length),3);
  assert(await page.$('[data-stock-origin="buy"]'));assert(await page.$('[data-stock-origin="sell"]'));
  const baseline=await page.$eval('.stock-dashboard',e=>e.textContent);
  assert.deepEqual(await page.$$eval('nav[aria-label="Primary"] button',bs=>bs.map(b=>b.textContent)),['Dashboard','Research','History']);
  await click('History');assert.deepEqual(await page.$$eval('nav[aria-label="History views"] button',bs=>bs.map(b=>b.textContent)),['Snapshots','Decisions','Performance']);
  assert.equal(await page.evaluate(()=>outcomePending.length),0);await click('Decisions');assert.equal(await page.evaluate(()=>outcomePending.length),1);
  await page.evaluate(report=>outcomePending[0]({ok:true,status:200,rows:[report]}),report);await settle();assert((await text()).includes(stamp));
  await click('Performance');assert.equal(await page.evaluate(()=>outcomePending.length),1);await click('Dashboard');assert.equal(await page.$eval('.stock-dashboard',e=>e.textContent),baseline);
 });
 await check('actual owner gate survives absent/denied secondary; authoritative empty clears and late success stays hidden',async()=>{
  await reset('owner');await page.waitForSelector('.stock-dashboard');await click('Research');assert.equal(await page.evaluate(()=>outcomePending.length),0);await click('History');await click('Decisions');
  await page.evaluate(()=>outcomePending[0]({ok:true,status:200,rows:[]}));await settle();await page.waitForFunction(()=>ownerCalls.filter(p=>p.startsWith('pc_digest_private')).length===2);assert.match(await text(),/No outcome report/);assert.equal(await page.evaluate(()=>Boolean(window.signedOut)),false);await click('Snapshots');assert(await page.$('.stock-dashboard'));
  await click('Decisions');await click('Refresh outcomes');await page.evaluate(()=>outcomePending[1]({ok:false,status:403,rows:[]}));await settle();assert.match(await text(),/Rechecking owner access/);assert(await page.$('.stock-dashboard'));
  await click('Retry');await page.evaluate(()=>{window.privateDenied=true;});await click('Refresh');await page.waitForSelector('.sd-unavailable');await page.evaluate(report=>outcomePending[2]({ok:true,status:200,rows:[report]}),report);await settle();assert(!(await text()).includes(stamp));
 });
 await check('browser strict parser preserves zero proposal and exact original comparison prose',async()=>{
  const row=structuredClone(report);const prose='Buy only if price < 100 & earnings > 5.\nOriginal line two.';
  row.payload.decision_window={total:1,returned:1,has_more:false,items:[{decision_id:'synthetic-decision',batch_id:'synthetic-batch',as_of:'2026-09-24',generated_at:'2026-09-24T20:00:00Z',captured_at:stamp,publication_state:'observed_existing',ticker:'SYNTH',listing_symbol:null,currency:'USD',action:'Consider purchase',order_type:'limit',quantity:'0',amount_cad:'0',limit_native:'0',reason:prose,model_version:null,cohort_id:null,intent:'reported_submitted',execution:{status:'unconfirmed',quantity:null,average_price:null,currency:null,fees:null,reason:'No accepted broker evidence.'}}]};
  await reset();await click('Decisions');await respond(0,[row]);const rendered=await text();for(const exact of ['0 units','0 USD','amount 0 CAD',prose,stamp,'Execution unconfirmed']) assert(rendered.includes(exact),exact);
 });
 assert.deepEqual(errors,[]);console.log(`PASS ${passed} real React/Chrome outcomes scenarios; localhost only`);
} finally {await browser?.close();await new Promise(r=>server.close(r));rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
