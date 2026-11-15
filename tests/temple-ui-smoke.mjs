// Real browser smoke for the ephemeral local Cloudflare Worker. No production URLs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const output='output/temple-ui-smoke';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(45000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8787'));
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:120000});
 await page.locator('#player-name').fill('CIBrowser');
 await page.locator('#entry-form').evaluate(f=>f.requestSubmit());
 await page.locator('#hud').waitFor({state:'visible'});
 await page.waitForFunction(()=>window.templeTest?.controller()&&JSON.parse(window.render_game_to_text()).connected);
 // Inventory categories, custom 3D spell preview, readable descriptions.
 await page.evaluate(()=>templeTest.ui.openPanel('bag'));
 for(const type of ['near','mid','far'])assert.equal(await page.locator('[data-category="'+type+'"]').count(),1,type);
 await page.locator('[data-category="mid"]').click();
 await page.waitForTimeout(400);
 assert.ok(await page.locator('#bag-items [data-bag-item]').count()>0);
 await page.screenshot({path:output+'/weapons.png'});
 await page.locator('#panel-close').click();
 // Only real backend-supported WRITE can initiate the cinematic.
 await page.evaluate(()=>templeTest.ui.openPanel('social'));
 await page.waitForFunction(()=>templeTest.writer.phase==='write',null,{timeout:12000});
 assert.equal(await page.locator('[data-form="plant"]').count(),1);
 await page.locator('[data-form="plant"] textarea[name="text"]').fill('Browser-tested eternal message');
 await page.locator('[data-form="plant"]').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>templeTest.ui.world?.plants?.some(p=>p.text==='Browser-tested eternal message'),null,{timeout:20000});
 await page.screenshot({path:output+'/write-and-plants.png'});
 await page.evaluate(()=>templeTest.ui.showPlantList());
 assert.ok((await page.locator('#panel-content').textContent()).includes('Browser-tested eternal message'));
 await page.locator('#panel-close').click();
 // Non-GM can upload and preview their own art bomb from BUILD.
 await page.evaluate(()=>templeTest.ui.openPanel('build'));
 const upload=page.locator('[data-form="art-bomb-upload"] input[name="artwork"]');
 assert.equal(await upload.count(),1);
 const png=await page.screenshot({clip:{x:50,y:50,width:128,height:128}});
 await upload.setInputFiles({name:'ci-art.png',mimeType:'image/png',buffer:png});
 await page.locator('[data-form="art-bomb-upload"] [name="size"]').fill('2');
 await page.locator('[data-form="art-bomb-upload"]').evaluate(f=>f.requestSubmit());
 await page.waitForTimeout(1200);
 console.log('art-bomb-upload diagnostics',JSON.stringify(await page.evaluate(()=>({toast:document.querySelector('#toast')?.textContent,buildMode:!document.querySelector('#build-mode')?.hidden,preview:templeTest.arena.buildPreview?.userData.kind,network:templeTest.network.base}))));
 await page.waitForFunction(()=>templeTest.arena.buildPreview?.userData.kind==='art-bomb',{},{timeout:20000});
 const scale=await page.evaluate(()=>templeTest.arena.buildPreview.scale.x);
 assert.equal(scale,2);
 await page.screenshot({path:output+'/art-bomb-placement.png'});
 assert.deepEqual(errors,[],errors.join('\n'));
 console.log(JSON.stringify({ok:true,write:true,artBombPreview:scale,errors}));
}catch(err){console.error(err);throw err;}finally{await browser.close();}
