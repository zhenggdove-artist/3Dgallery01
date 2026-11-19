// Independent real-browser smoke: user-facing SUPPORT must be self-contained
// and visually legible even when the unrelated WRITE cinematic is slow.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const folder='output/support-y2k';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,
 args:['--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8787'));
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('ready')&&window.templeTest,null,{timeout:70000});
 await page.evaluate(()=>templeTest.ui.emit('join',{name:'Y2KVisualCI',color:'#6fe7e3',backendUrl:window.TEMPLE_CONFIG.backendUrl}));
 await page.locator('#hud').waitFor({state:'visible'});
 await page.waitForFunction(()=>templeTest.controller()&&JSON.parse(window.render_game_to_text()).connected,null,{timeout:25000});
 await page.evaluate(()=>templeTest.ui.openPanel('wing-shop'));
 const support=page.locator('.wing-design-support');
 await support.waitFor({state:'visible'});
 assert.equal(await page.locator('.wing-design-support [data-draw-wing]').count(),0);
 assert.equal(await page.locator('.wing-design-support [data-wing-checkout]').count(),1);
 assert.equal(await page.locator('.y2k-shell-header').count(),1);
 assert.equal(await page.locator('.y2k-taskbar').count(),1);
 const desktop=await page.evaluate(()=>{
  const r=document.querySelector('.wing-payment-preview').getBoundingClientRect();
  const app=document.querySelector('.wing-design-support').getBoundingClientRect();
  return {paymentW:r.width,paymentH:r.height,appW:app.width,
   bodyOverflow:document.documentElement.scrollWidth>innerWidth+2,
   gachaCount:document.querySelectorAll('.wing-design-support .wing-gacha-machine').length};
 });
 assert.ok(desktop.paymentW>=350&&desktop.paymentH>105,JSON.stringify(desktop));
 assert.equal(desktop.gachaCount,0);
 assert.equal(desktop.bodyOverflow,false);
 await page.screenshot({path:folder+'/support-desktop-direct-wings.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(250);
 const mobile=await page.evaluate(()=>{
  const r=document.querySelector('.wing-payment-preview').getBoundingClientRect();
  const p=document.querySelector('#panel-content').getBoundingClientRect();
  const action=document.querySelector('.wing-design-support [data-wing-checkout]');
  const button=action.getBoundingClientRect();
  return {paymentW:r.width,left:r.left,right:r.right,panelW:p.width,
   buttonW:button.width,buttonTop:button.top,
   buttonBackground:getComputedStyle(action).backgroundColor,
   overflow:document.documentElement.scrollWidth>innerWidth+2};
 });
 assert.ok(mobile.paymentW>250&&mobile.paymentW<=390,JSON.stringify(mobile));
 assert.ok(mobile.left>=-2&&mobile.right<=392,JSON.stringify(mobile));
 assert.ok(mobile.buttonW>=220,JSON.stringify(mobile));
 assert.notEqual(mobile.buttonBackground,'rgba(0, 0, 0, 0)',JSON.stringify(mobile));
 assert.equal(mobile.overflow,false);
 await page.screenshot({path:folder+'/support-mobile-direct-wings.png',animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('Y2K SUPPORT visual smoke passed',JSON.stringify({desktop,mobile}));
}finally{await browser.close();}
