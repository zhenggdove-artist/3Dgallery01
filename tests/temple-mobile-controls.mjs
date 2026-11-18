// Isolated Chrome mobile-touch regression against the real staging Worker.
// Covers A camera cycling, actual scoped overlay, fire-only via scope button, and
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
 await page.locator('[data-legacy-login]').click();
 await page.locator('#player-name').fill('TouchScopeCI');
 await page.locator('#entry-form').evaluate(form=>form.requestSubmit());
 await page.locator('#hud').waitFor({state:'visible'});
 await page.waitForFunction(()=>templeTest.controller()?.enabled&&
  JSON.parse(window.render_game_to_text()).connected,null,{timeout:25000});
 const initial=await page.evaluate(()=>{
  const t=templeTest;
  const e=document.querySelector('[data-action="interact"]');
  const hidden=!e||getComputedStyle(e).display==='none';
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
   if(window.mobileForcePlant&&w?.plants){
    if(!w.plants.some(p=>p.id===window.mobileForcePlant.id))w.plants.push(window.mobileForcePlant);
    if(w.profile?.equipment)w.profile.equipment.weapon='clam';
   }
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
 // 35vmin radius: the black region is an exit button on touch devices.
 await page.touchscreen.tap(8,422);
 await page.waitForFunction(()=>templeTest.gun.mode===0);
 assert.equal(await page.evaluate(()=>window.mobileTestShots),0,'black-region tap must not fire');
 await button.tap();
 await page.waitForFunction(()=>templeTest.gun.mode===1);
 await button.tap();
 await page.waitForFunction(()=>templeTest.gun.mode===2);
 // Touching the transparent scope aims ONLY; it never shoots.
 await page.touchscreen.tap(275,390);
 assert.equal(await page.evaluate(()=>window.mobileTestShots),0,'touch aiming inside scope must not fire');
 const fireButton=page.locator('.sniper-fire-button');
 assert.equal(await fireButton.isVisible(),true,'touch FIRE button appears only in scope');
 const fireBounds=await fireButton.boundingBox();
 assert.ok(fireBounds.x<130&&fireBounds.y>500,'FIRE button occupies lower-left above movement stick');
 await fireButton.tap();
 await page.waitForFunction(()=>window.mobileTestShots===1,null,{timeout:8000});
 assert.equal(await page.evaluate(()=>templeTest.gun.mode),2,'FIRE shoots without leaving scope');
 await button.tap();
 await page.waitForFunction(()=>templeTest.gun.mode===0);
 assert.equal(await page.evaluate(()=>window.mobileTestShots),1,'third A exits scope without firing');
 const setup=await page.evaluate(()=>{
  const t=templeTest,plant={id:'ci-touch-plant',author:'CI',text:'Mobile E equivalence',position:[0,0,0],media:null,parentId:null,createdAt:Date.now()};
  window.mobileForcePlant=plant;
  window.mobileForceGun=false;
  t.ui.world.plants.push(plant);
  t.ui.world.profile.equipment.weapon='clam';
  t.arena.nearest=()=>({type:'plant',id:plant.id});
  return t.controller().enabled;
 });
 assert.equal(setup,true);
 // The central writing garden is the NEW spawn. A must keep its combat
 // purpose instead of automatically opening a message window near plants.
 await button.tap();
 await page.waitForFunction(()=>window.mobileTestShots===2,null,{timeout:8000});
 assert.equal(await page.evaluate(()=>templeTest.ui.panelName),'',
  'Touch A near the central message tree must NOT open the writing panel');
 assert.equal(await page.evaluate(()=>window.mobileTestShots),2,
  'A near a writing plant should still send one normal attack');
 await page.screenshot({path:output+'/mobile-a-near-writing-tree.png'});
 assert.deepEqual(errors,[],errors.join('; '));
 console.log(JSON.stringify({mobileA:true,scope:true,dedicatedScopeFire:true,writingTreeAStaysCombat:true,eButtonHidden:true}));
} finally {await browser.close();}
