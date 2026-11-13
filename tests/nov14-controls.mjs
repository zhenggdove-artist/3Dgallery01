import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
const secret=(await readFile('.dev.vars','utf8')).match(/^TEMPLE_ADMIN_KEY=(.+)$/m)[1].trim();
await mkdir('output/nov14',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8788'));
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>document.body.classList.contains('ready'));
 await page.locator('#player-name').fill('Ely');await page.locator('#memory-code').fill(secret);await page.locator('#entry-form').evaluate(f=>f.requestSubmit());await page.locator('#hud').waitFor({state:'visible'});
 assert.equal(await page.locator('#attack-button span').textContent(),'A');assert.equal(await page.locator('[data-action=interact]').count(),0);
 const inventory=await page.evaluate(()=>({missing:templeTest.items.filter(i=>!templeTest.ui.world.profile.inventory.includes(i.id)).map(i=>i.id)}));assert.deepEqual(inventory.missing,[]);
 await page.evaluate(()=>{const c=templeTest.controller();c.teleport([0,0,0]);c.grounded=true;c.setEnabled(true);});
 const client=await context.newCDPSession(page),stick=await page.locator('#mobile-stick').boundingBox(),attack=await page.locator('#attack-button').boundingBox(),jump=await page.locator('[data-action=jump]').boundingBox();
 const p1={id:1,x:stick.x+stick.width/2,y:stick.y+8},p2={id:2,x:attack.x+attack.width/2,y:attack.y+attack.height/2},p3={id:3,x:jump.x+jump.width/2,y:jump.y+jump.height/2};
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1]});
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});await page.waitForTimeout(180);
 const together=await page.evaluate(()=>({move:templeTest.controller().move.length(),charge:document.querySelector('#attack-button').classList.contains('charging')}));assert.ok(together.move>.5);assert.ok(together.charge);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2,p3]});
 const jumping=await page.evaluate(()=>!templeTest.controller().grounded);assert.ok(jumping);
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p3]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p2]});
 assert.ok(await page.evaluate(()=>templeTest.controller().move.length()>.5));await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p1]});
 assert.equal(await page.evaluate(()=>templeTest.controller().move.length()),0);
 const height=(await page.locator('#chat-hud').boundingBox()).height;await page.locator('#chat-toggle').click();assert.ok((await page.locator('#chat-hud').boundingBox()).height>height+40);await page.locator('#chat-toggle').click();
 const handle=await page.locator('#chat-resize').boundingBox();await page.mouse.move(handle.x+70,handle.y+8);await page.mouse.down();await page.mouse.move(handle.x+70,handle.y-55);await page.mouse.up();assert.ok((await page.locator('#chat-hud').boundingBox()).height>height+40);await page.locator('#chat-toggle').click();await page.locator('#chat-toggle').click();
 const checks=await page.evaluate(async()=>{const t=templeTest,T=await import('/vendor/three/build/three.module.js'),{weaponMuzzle}=await import('/src/weapon-muzzle.js');const c=t.controller(),r=c.root;let maxError=0;
 for(const id of ['white-cat','black-cat','calico-cat']){t.arena.setPlayerEquipment(r,{weapon:id});r.position.set(5,0,2);r.rotation.y=1.2;t.arena.update(.016,2,t.camera,t.roots);const item=t.items.find(i=>i.id===id),m=weaponMuzzle(r,item),expected=r.userData.blade.localToWorld(new T.Vector3(0,.97,.265));maxError=Math.max(maxError,m.distanceTo(expected));t.arena.presentation.vfx.play({origin:[5,1,2],direction:[0,0,1],range:10},item,r);const entry=t.arena.presentation.vfx.active.at(-1);if(entry.start)maxError=Math.max(maxError,entry.start.distanceTo(m));}
 t.arena.setPlayerAnimation(r,'jump');const action=r.userData.actions.jump;
 return {maxError,loop:action.loop,once:T.LoopOnce,clamped:action.clampWhenFinished,selection:getComputedStyle(document.body).userSelect,blur:getComputedStyle(document.querySelector('#vitals')).backdropFilter};});
 assert.equal(checks.maxError,0);assert.equal(checks.loop,checks.once);assert.ok(checks.clamped);assert.equal(checks.selection,'none');assert.equal(checks.blur,'none');
 await page.evaluate(()=>{const t=templeTest;for(const e of [...t.arena.presentation.vfx.active])t.arena.presentation.vfx.release(e);t.ui.bagTab='equip';t.ui.openPanel('bag');});assert.ok(await page.locator('[data-bag-tab=equip]').isVisible());await page.screenshot({path:'output/nov14/equip-mobile.png'});await page.locator('#panel-close').click();
 await page.screenshot({path:'output/nov14/mobile.png'});await page.setViewportSize({width:1280,height:800});await page.screenshot({path:'output/nov14/desktop.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({inventory,together,jumping,checks,errors}));
}finally{await browser.close();}
