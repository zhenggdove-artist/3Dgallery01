import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
const secret=(await readFile('.dev.vars','utf8')).match(/^TEMPLE_ADMIN_KEY=(.+)$/m)[1].trim();
await mkdir('output/controls',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:800}});await context.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8788'));const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
try{
 await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>document.body.classList.contains('ready'));await page.locator('#player-name').fill('Ely');await page.locator('#memory-code').fill(secret);await page.locator('#entry-form').evaluate(f=>f.requestSubmit());await page.locator('#hud').waitFor({state:'visible'});
 await page.evaluate(async()=>{await templeTest.network.action('buy',{itemId:'black-cat'});await templeTest.network.action('equip',{itemId:'black-cat'});});await page.waitForTimeout(500);
 await page.keyboard.press('KeyV');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>templeTest.camera.fov),62);assert.equal(await page.locator('#panel').isVisible(),false);await page.screenshot({path:'output/controls/shoulder.png'});
 await page.keyboard.press('KeyV');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>templeTest.camera.fov),20);await page.screenshot({path:'output/controls/scope.png'});await page.keyboard.press('Escape');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>templeTest.camera.fov),55);
 await page.evaluate(()=>{const c=templeTest.controller();c.stats={speed:1,jump:1,gravity:.5,impulse:8,flapMs:100};c.teleport([0,0,-10]);c.direction.set(0,0,0);c.jump();});const before=await page.evaluate(()=>templeTest.controller().root.position.toArray());await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');const after=await page.evaluate(()=>templeTest.controller().root.position.toArray());assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])>.5);
 await page.keyboard.press('Shift+Y');assert.equal(await page.locator('#panel').isVisible(),true);await page.locator('[name="artFloat"]').fill('0.12');await page.locator('[data-form="editor"]').evaluate(f=>f.requestSubmit());assert.equal(await page.evaluate(()=>templeTest.arena.artFloat),.12);
 assert.deepEqual(errors,[]);console.log('PASS shoulder, scope, exit, stationary wing steering, Shift+Y and saved settings');
}finally{await page.evaluate(()=>templeTest?.network.close()).catch(()=>{});await browser.close();}
