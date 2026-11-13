import assert from 'node:assert/strict';import {chromium} from 'playwright';import {readFile,mkdir} from 'node:fs/promises';
const secret=(await readFile('.dev.vars','utf8')).match(/^TEMPLE_ADMIN_KEY=(.+)$/m)[1].trim();await mkdir('output/00-vfx',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const context=await browser.newContext({viewport:{width:1280,height:800}});await context.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8788'));const page=await context.newPage(),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>document.body.classList.contains('ready'));await page.locator('#player-name').fill('Ely');await page.locator('#memory-code').fill(secret);await page.locator('#entry-form').evaluate(f=>f.requestSubmit());await page.locator('#hud').waitFor({state:'visible'});
 await page.evaluate(()=>{const t=templeTest;t.network.close();t.ui.closePanel();t.controller().teleport([-20,0,-20]);t.controller().cameraLocked=true;t.camera.position.set(-12,4,-10);t.camera.lookAt(-20,1,-23);});
 for(const family of ['saber','fire','ice','beam','lightning','petal']){
  const result=await page.evaluate(family=>{const t=templeTest,v=t.arena.presentation.vfx,r=t.controller().root,item=t.items.find(i=>i.family===family&&i.slot==='weapon');for(const e of [...v.active])v.release(e);t.arena.setPlayerEquipment(r,{weapon:item.id});t.arena.presentation.play({id:crypto.randomUUID(),weapon:item.id,origin:[-20,1,-20],direction:[0,0,-1],range:8,charge:1,ultimate:true,combo:6,impactPoint:[-20,1,-26]},r);return v.active.map(e=>({id:e.id,source:e.fx.group.userData.vfxSource}));},family);
  assert.ok(result.length);assert.ok(result.every(e=>e.source==='00GameDevs'));await page.waitForTimeout(260);await page.screenshot({path:'output/00-vfx/'+family+'.png'});
 }
 const lifecycle=await page.evaluate(async()=>{const t=templeTest,v=t.arena.presentation.vfx,ids=Object.keys((await import('/src/weapon-vfx.js')).WEAPON_VFX);for(const e of [...v.active])v.release(e);let plays=0;
  for(const id of ids){const item=t.items.find(i=>i.slot==='weapon'&&(i.id===id||i.family===id));for(const ultimate of [false,true]){v.play({origin:[-20,1,-20],direction:[0,0,-1],range:6,ultimate,fusionEffects:['ice']},item,t.controller().root);for(let i=0;i<260;i++)v.update(.05);plays++;}}
  const remaining=v.active.length,before=v.created;for(let i=0;i<20;i++){const e=v.acquire('azure-sweep');v.release(e);}return {plays,remaining,poolCreated:v.created-before,pooled:[...v.pools.values()].reduce((n,p)=>n+p.length,0)};
 });assert.equal(lifecycle.remaining,0);assert.equal(lifecycle.poolCreated,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({lifecycle,errors}));
}finally{await browser.close();}
