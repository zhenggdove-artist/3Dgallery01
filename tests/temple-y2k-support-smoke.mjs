// Independent real-browser smoke: user-facing SUPPORT must be self-contained
// and visually legible even when the unrelated WRITE cinematic is slow.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const folder='output/support-y2k';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,
 args:process.platform==='win32'?['--ignore-gpu-blocklist']:['--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(base=>localStorage.setItem('temple-backend-url',base),process.env.TEMPLE_BACKEND||'http://127.0.0.1:8787');
 await page.goto(process.env.TEMPLE_SITE||'http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
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
 await support.screenshot({path:folder+'/support-mobile-direct-wings.png',timeout:60000});
 // Same paid-user component in the GM preview. Simulate only UI privileges in the isolated browser.
 await page.setViewportSize({width:1280,height:800});
 const preview=await page.evaluate(()=>{
  const ui=templeTest.ui,profile=ui.world.profile,oldAdmin=ui.self.profile.admin,oldCredits=profile.wingDesignCredits;
  ui.self.profile.admin=true;ui.openPanel('wing-player-preview');
  const gmMarkup=ui.content.querySelector('.wing-painter').innerHTML;
  profile.wingDesignCredits=1;ui.self.profile.admin=false;ui.openPanel('wing-personal-painter');
  const playerMarkup=ui.content.querySelector('.wing-painter').innerHTML;
  profile.wingDesignCredits=oldCredits;ui.self.profile.admin=true;ui.openPanel('wing-player-preview');
  window.__restoreWingTest=()=>{ui.self.profile.admin=oldAdmin;ui.closePanel();};
  window.__wingPublishCalls=0;ui.addEventListener('wing-publish-request',()=>window.__wingPublishCalls++);
  return gmMarkup===playerMarkup;
 });
 assert.equal(preview,true,'GM test must use identical player painter markup');
 const canvas=page.locator('.wing-painter-canvas');await canvas.waitFor({state:'visible'});
 const c=await canvas.boundingBox();assert.ok(c&&c.width>100&&c.height>100);
 await page.mouse.move(c.x+c.width*.2,c.y+c.height*.2);await page.mouse.down();
 await page.mouse.move(c.x+c.width*.75,c.y+c.height*.25,{steps:8});
 await page.mouse.move(c.x+c.width*.6,c.y+c.height*.8,{steps:8});
 await page.mouse.move(c.x+c.width*.2,c.y+c.height*.2,{steps:8});await page.mouse.up();
 await page.locator('[data-wing-field=name]').fill('GM preview test');
 await page.locator('[data-wing-material]').selectOption('watercolor');
 await page.mouse.move(c.x+c.width*.4,c.y+c.height*.35);await page.mouse.down();await page.mouse.move(c.x+c.width*.6,c.y+c.height*.4,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>templeTest.ui.wingPreviewDraft.strokes.at(-1)?.material),'watercolor');
 await page.locator('[data-wing-publish]').click();
 assert.match(await page.locator('[data-wing-status]').textContent(),/GM TEST.*驗證通過/);
 assert.equal(await page.evaluate(()=>window.__wingPublishCalls),0);
 await page.evaluate(()=>window.__restoreWingTest());
 await page.setViewportSize({width:390,height:844});
 // Contract-only production checkout: intercept the outbound POST before
 // it can reach ECPay. No order or card charge is created on the real gateway.
 const cors={'Access-Control-Allow-Origin':new URL(page.url()).origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 const orderId='GW0123456789ABCDEFGH';
 await page.route('**/api/wing-pay/status',r=>r.fulfill({status:200,headers:cors,json:{checkoutEnabled:true,checkoutMode:'production',amount:30,flexibleAmount:true,maxQuantity:100,maxAmount:20000}}));
 await page.route('**/api/wing-pay/checkout',r=>{
  const selection=r.request().postDataJSON();assert.deepEqual(selection,{quantity:3,amount:155});
  return r.fulfill({status:200,headers:cors,json:{checkoutMode:'production',gateway:'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',orderId,amount:155,designCredits:3,fields:{MerchantTradeNo:orderId,TotalAmount:'155',CheckMacValue:'MOCK'}}});
 });
 await page.route('https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',r=>r.fulfill({status:200,contentType:'text/plain',body:'ECPay navigation intercepted'}));
 await page.evaluate(()=>templeTest.ui.openPanel('wing-shop'));const buy=page.getByRole('button',{name:/Continue to ECPay/});
 await buy.waitFor({state:'visible'});
 await page.locator('[data-wing-order-quantity]').selectOption('3');
 const custom=page.locator('[data-wing-order-amount]');await custom.fill('89');assert.equal(await buy.isEnabled(),false);
 await custom.fill('155');assert.equal(await page.locator('[data-wing-order-total]').textContent(),'NT$155');assert.equal(await buy.isEnabled(),true);
 const [submit]=await Promise.all([page.waitForRequest(r=>r.url().startsWith('https://payment.ecpay.com.tw/')&&r.method()==='POST'),buy.click()]);
 assert.equal(new URLSearchParams(submit.postData()).get('TotalAmount'),'155');
 assert.deepEqual(errors,[]);
 console.log('Y2K SUPPORT visual smoke passed',JSON.stringify({desktop,mobile}));
}finally{for(const page of browser.contexts().flatMap(c=>c.pages()))await page.evaluate(()=>window.templeTest?.network.close()).catch(()=>{});await browser.close();}
