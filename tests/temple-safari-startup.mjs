// Real WebKit module graph startup: unlike Chromium emulation this uses
// the engine shipped in iOS Safari. Run against isolated local static files.
import assert from 'node:assert/strict';
import {webkit} from 'playwright';
import {mkdir} from 'node:fs/promises';

await mkdir('output/temple-safari-startup',{recursive:true});
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,
  deviceScaleFactor:2
 });
 const messages=[];
 page.on('pageerror',e=>messages.push('SCRIPT '+e.message));
 page.on('requestfailed',r=>messages.push('FETCH '+r.url()+' '+(r.failure()?.errorText||'')));
 page.on('console',m=>{if(m.type()==='error')messages.push('CONSOLE '+m.text());});
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded',timeout:20000});
 try{
  await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:105000});
 }catch(error){
  const diagnostic=await page.evaluate(()=>({
   state:document.body.className,
   loading:document.querySelector('#loading')?.innerText?.slice(0,900),
   logs:window.templeStartupDiagnostics,
   timings:window.templeLoadTimings,
   lastResources:performance.getEntriesByType('resource').slice(-20).map(x=>x.name.split('/').at(-1))
  }));
  await page.screenshot({path:'output/temple-safari-startup/failed.png'}).catch(()=>{});
  throw new Error('WebKit startup failed: '+JSON.stringify(diagnostic)+' ERRORS: '+messages.slice(0,12).join(' | '),{cause:error});
 }
 assert.equal(await page.locator('#loading').isVisible(),false);
 assert.ok(await page.locator('#entry-form').isVisible());
 const loaded=await page.evaluate(()=>window.templeLoadTimings);
 console.log('WebKit Safari module graph booted: '+JSON.stringify({timings:loaded,errorCount:messages.length}));
 await page.screenshot({path:'output/temple-safari-startup/success.png'});
} finally{await browser.close();}
