import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('output/sketch-hud',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
 await context.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8788'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
 await page.goto('http://127.0.0.1:8000');await page.screenshot({path:`output/sketch-hud/loading-${mobile}.png`});await page.waitForFunction(()=>document.body.classList.contains('ready'));
 assert.equal(await page.locator('#loading-percent').textContent(),'100%');
 await page.locator('#player-name').fill('Sketch'+(mobile?'Touch':'Mouse'));await page.locator('#entry-form').evaluate(f=>f.requestSubmit());await page.locator('#hud').waitFor({state:'visible'});
 assert.equal(await page.locator('#chat-hud').isVisible(),true);assert.equal(await page.locator('#minimap').isVisible(),true);
 await page.locator('#function-toggle').click();assert.equal(await page.locator('[data-panel="shop"]').isVisible(),true);await page.locator('#function-toggle').click();
 const box=await page.locator('#attack-button').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(800);const charge=await page.locator('#attack-button').evaluate(o=>parseFloat(o.style.getPropertyValue('--charge')));assert.ok(charge>10);await page.mouse.up();await page.waitForTimeout(400);
 await page.evaluate(()=>{templeTest.network.close();templeTest.controller().cameraLocked=true;const a=templeTest.arena;a.islandEnemies.sync({active:true,model:'auntie',position:[0,0,4],skills:[{id:'visual-test',type:'shockwave',phase:'warning',start:Date.now(),end:Date.now()+10000,origin:[0,0,4],aim:[0,0,0],radius:2.2,height:1.2,island:true}],moving:false});templeTest.camera.position.set(6,4,11);templeTest.camera.lookAt(0,.8,4);templeTest.controller().setEnabled(false);});
 await page.waitForTimeout(100);await page.screenshot({path:`output/sketch-hud/game-${mobile}.png`});
 const models=await page.evaluate(()=>[...templeTest.arena.islandEnemies.models].map(([kind,o])=>({kind,height:o.userData.nanganHeight,animations:Object.keys(o.userData.actions).length})));assert.equal(models.length,6);assert.ok(models.every(m=>m.height===1.575));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({mobile,charge,models,errors}));await page.evaluate(()=>templeTest.network.close());await context.close();
}}finally{await browser.close();}
