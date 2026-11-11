import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const site=process.env.TEMPLE_SITE||'http://127.0.0.1:8000';
const output=new URL('../output/temple-browser/',import.meta.url);
await mkdir(output,{recursive:true});

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:960,height:540}});
const page=await context.newPage();
page.setDefaultTimeout(30_000);
const errors=[];
page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});
page.on('pageerror',error=>errors.push(`page: ${error.message}`));
page.on('response',response=>{if(response.status()>=400)errors.push(`http ${response.status()}: ${response.url()}`);});

let exitCode=0;
try{
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:30_000});
  await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:120_000});
  const loadedState=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  console.log('loaded',JSON.stringify(loadedState));
  await page.screenshot({path:fileURLToPath(new URL('entry.png',output)),animations:'disabled',timeout:120_000});
  await page.locator('#player-name').fill('BrowserTest');
  await page.locator('#entry-form').evaluate(form=>form.requestSubmit());
  await page.locator('#hud').waitFor({state:'visible',timeout:30_000});
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).connected,null,{timeout:15_000});
  await page.keyboard.press('Shift+Y');
  await page.locator('#panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#panel-title').textContent(),'LAYOUT EDITOR');
  await page.locator('input[name="fog"]').fill('0.012');
  await page.locator('form[data-form="editor"]').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>localStorage.getItem('temple-editor-settings')!==null);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('temple-editor-settings')).fog),.012);
  await page.screenshot({path:fileURLToPath(new URL('arena-editor.png',output)),animations:'disabled',timeout:120_000});
  await page.locator('#panel-close').click();
  await page.locator('#dock [data-panel="build"]').click();
  await page.locator('[data-build="wall"]').click();
  await page.locator('#build-mode').waitFor({state:'visible'});
  await page.keyboard.press('KeyR');
  await page.keyboard.press('Escape');
  await page.locator('#build-mode').waitFor({state:'hidden'});
  const state=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  assert.equal(state.mode,'play');
  assert.equal(state.role,'fighter');
  assert.equal(state.connected,true);
  assert.equal(state.players.length,1,'stale multiplayer seat remained after disconnect');
  assert.equal(state.artworks.total,13);
  assert.equal(state.economy.platformCoinTotal,13);
  assert.ok(state.economy.platformCoins>=0&&state.economy.platformCoins<=13,'available platform coin count is invalid');
  assert.ok(state.render.drawCalls<120,`draw calls too high: ${state.render.drawCalls}`);
  assert.ok(state.position?.length===3,'local player controller did not initialize');
  assert.ok(state.render.triangles<520_000,`triangle count too high: ${state.render.triangles}`);
  await writeFile(new URL('state.json',output),JSON.stringify(state,null,2));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ok:true,state},null,2));
}catch(error){
  exitCode=1;
  console.error(error);
}finally{
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide'))).catch(()=>{});
  await Promise.race([context.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))]);
  await Promise.race([browser.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))]);
}
process.exit(exitCode);
