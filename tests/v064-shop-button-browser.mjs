import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('index.html'),ui=await read('src/ui.js');
const menu=html.match(/<nav id="dock"[\s\S]*?<\/nav>/)[0];
// Preserve the real stylesheet order, not a subset or a mock layout.
const cssFiles=[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(m=>m[1]);
const css=(await Promise.all(cssFiles.map(read))).join('\n');
const start=ui.indexOf("document.getElementById('dock').addEventListener('click',"),end=ui.indexOf('});',start)+3;
assert.ok(start>=0&&end>start);
const binding=ui.slice(start,end);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:820,height:1180}]){
  const page=await browser.newPage({viewport});
  await page.setContent('<style>'+css+'</style><div id="hud">'+menu+'</div><section id="panel" hidden></section>');
  await page.evaluate(binding=>{const context={openPanel:name=>{document.body.dataset.opened=name;},emit:()=>{}};Function(binding).call(context);},binding);
  for(const spectator of [false,true]){
   await page.evaluate(spectator=>{document.body.classList.toggle('spectator',spectator);document.getElementById('hud').classList.add('functions-open');delete document.body.dataset.opened;},spectator);
   const shop=page.locator('#shop-button');await shop.waitFor({state:'visible',timeout:3000});assert.equal(await shop.count(),1);
   const geometry=await page.evaluate(()=>{const by=s=>document.querySelector(s),rect=s=>by(s).getBoundingClientRect(),shop=rect('#shop-button'),paint=rect('#paint-button'),write=rect('[data-panel=social]'),s=getComputedStyle(by('#shop-button'));return {sameColumn:Math.abs(shop.left-paint.left)<1,below:shop.top>=paint.bottom,notOverlap:shop.right<write.left,sameRow:Math.abs(shop.top-write.top)<1,hit:document.elementFromPoint(shop.x+shop.width/2,shop.y+shop.height/2)?.closest('button')?.id,style:s.display,visibility:s.visibility,opacity:s.opacity,label:by('#shop-button').innerText.trim()};});
   assert.ok(geometry.sameColumn&&geometry.below&&geometry.notOverlap&&geometry.sameRow&&geometry.hit==='shop-button'&&geometry.style!=='none'&&geometry.visibility==='visible'&&geometry.opacity==='1'&&geometry.label==='SHOP',JSON.stringify({viewport,spectator,geometry}));
   await shop.click();assert.equal(await page.locator('body').getAttribute('data-opened'),'shop');
   await page.evaluate(()=>document.getElementById('hud').classList.remove('functions-open'));assert.equal(await shop.isVisible(),false);
  }
  await page.close();
 }
 console.log('V064 real HUD SHOP placement and click routing passed: desktop, phone, tablet, fighter and spectator');
}finally{await browser.close();}
