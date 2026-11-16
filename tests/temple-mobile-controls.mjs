// Isolated Chrome mobile-touch regression against the real staging Worker.
// Covers A camera cycling, actual scoped overlay, firing via scene tap, and
// contextual E interactions without a separate mobile E button.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const output='output/temple-ui-smoke';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,
 args:['--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-webgl']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 page.setDefaultTimeout(40000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8787'));
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('ready')&&!!window.templeTest,
  null,{timeout:70000});
 await page.locator('#player-name').fill('TouchScopeCI');
 await page.locator('#entry-form').evaluate(form=>form.requestSubmit());
 await page.locator('#hud').waitFor({state:'visible'});
 await page.waitForFunction(()=>templeTest.controller()?.enabled&&
  JSON.parse(window.render_game_to_text()).connected,null,{timeout:25000});
 const initial=await page.evaluate(()=>{
  const t=templeTest;
  const e=document.querySelector('[data-action="interact"]');
  const hidden=getComputedStyle(e).display==='none';
  const coarse=matchMedia('(pointer:coarse)').matches;
  if(!t.ui.world?.profile?.equipment)throw Error('World equipment unavailable');
  // The room pushes fresh authoritative world snapshots. Keep the gun
  // equipped in ALL incoming snapshots during this isolated input test.
  // Without this, a server inventory refresh switches back to the starter
  // clam between pointerdown and the camera's next animation frame.
  const setWorld=t.ui.setWorld.bind(t.ui);
  window.mobileForceGun=true;
  t.ui.setWorld=w=>{
   if(window.mobileForceGun&&w?.profile?.equipment)w.profile.equipment.weapon='black-cat';
   return setWorld(w);
  };
  t.ui.world.profile.equipment.weapon='black-cat';
  window.mobileAEvents=0;
  t.ui.addEventListener('attack-start',()=>window.mobileAEvents++);
  const network=t.network,real=network.action.bind(network);
  window.mobileTestShots=0;
  network.action=async function(action,...args){
   if(action==='attack'){window.mobileTestShots++;return {};}
   return real(action,...args);
  };
  return {hidden,coarse};
 });
 assert.deepEqual(initial,{hidden:true,coarse:true},'No E control; genuine coarse-pointer emulation');
 const button=page.locator('#attack-button');
 await button.tap();
 try {await page.waitForFunction(()=>templeTest.gun.mode===1,null,{timeout:8000});}
 catch(error){
  const state=await page.evaluate(()=>({mode:templeTest.gun.mode,
   selectedWeapon:templeTest.ui.world?.profile?.equipment?.weapon,
   controller:templeTest.controller()?.enabled,panel:templeTest.ui.panelName,
   aEvents:window.mobileAEvents,shots:window.mobileTestShots,
   modeWeapon:templeTest.gun.weapon()?.id}));
  throw new Error('First mobile A did not enter shoulder view: '+JSON.stringify(state),{cause:error});
 }
 assert.equal(await page.evaluate(()=>window.mobileTestShots),0,'first A only opens shoulder');
 await button.tap();
 await page.waitForFunction(()=>templeTest.gun.mode===2&&
  document.querySelector('#gun-overlay').classList.contains('scoped')&&
  !document.querySelector('#gun-overlay').hidden);
 assert.equal(await page.evaluate(()=>window.mobileTestShots),0,'second A opens sniper scope, never fires');
 await page.screenshot({path:output+'/mobile-sniper-scoped.png'});
 await page.touchscreen.tap(335,390);
 await page.waitForFunction(()=>window.mobileTestShots===1,null,{timeout:8000});
 assert.equal(await page.evaluate(()=>templeTest.gun.mode),2,'tap scene fires, stays scoped');
 await button.tap();
 await page.waitForFunction(()=>templeTest.gun.mode===0);
 assert.equal(await page.evaluate(()=>window.mobileTestShots),1,'third A exits scope without firing');
 const setup=await page.evaluate(()=>{
  const t=templeTest,plant={id:'ci-touch-plant',author:'CI',text:'Mobile E equivalence',createdAt:Date.now()};
  t.ui.world.plants.push(plant);
  window.mobileForceGun=false;
  t.ui.world.profile.equipment.weapon='clam';
  t.arena.nearest=()=>({type:'plant',id:plant.id});
  return t.controller().enabled;
 });
 assert.equal(setup,true);
 await button.tap();
 await page.waitForFunction(()=>templeTest.ui.panelName==='plant');
 assert.equal(await page.locator('#panel').isVisible(),true,'mobile A performs E near an interactable');
 assert.equal(await page.locator('#panel-title').innerText(),'MESSAGE PLANT');
 assert.equal(await page.evaluate(()=>window.mobileTestShots),1,'contextual A never fires a gun');
 await page.screenshot({path:output+'/mobile-a-interact.png'});
 assert.deepEqual(errors,[],errors.join('; '));
 console.log(JSON.stringify({mobileA:true,scope:true,sceneFire:true,interact:true,eButtonHidden:true}));
} finally {await browser.close();}
