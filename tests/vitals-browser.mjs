import assert from 'node:assert/strict';import {chromium} from 'playwright';import {readFile,mkdir} from 'node:fs/promises';
const secret=(await readFile('.dev.vars','utf8')).match(/^TEMPLE_ADMIN_KEY=(.+)$/m)[1].trim();
await mkdir('output/vitals',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});await context.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8788'));
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>document.body.classList.contains('ready'));await page.locator('#player-name').fill('Ely');await page.locator('#memory-code').fill(secret);await page.locator('#entry-form').evaluate(f=>f.requestSubmit());await page.locator('#hud').waitFor({state:'visible'});
 await page.evaluate(()=>{templeTest.network.close();const v=templeTest.vitals();v.update(100000,100,100);});
 await page.locator('#vital-models').screenshot({path:'output/vitals/full.png'});
 const result=await page.evaluate(()=>{const t=templeTest,v=t.vitals(),c=t.controller();for(let i=1;i<=60;i++)v.update(100000+i*.05,50,100);c.teleport([0,0,0]);c.grounded=true;c.setEnabled(true);t.hit(c.root,{hitReaction:{id:'visual-test',time:Date.now(),stunMs:100,vector:[1,0,0]}});c.jump();const jumpBlocked=c.grounded;c.update(.03);t.arena.update(.03,performance.now()/1000,t.camera,t.roots);let red=0;c.root.userData.model.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(m.color?.getHex()===0xff182d)red++;});return {fill:v.fill.value,recoil:c.root.position.x,jumpBlocked,red};});
 assert.ok(Math.abs(result.fill-.5)<.001);assert.ok(result.recoil>0);assert.ok(result.jumpBlocked);assert.ok(result.red>0);await page.locator('#vital-models').screenshot({path:'output/vitals/half.png'});
 await page.waitForTimeout(300);const restored=await page.evaluate(()=>{const c=templeTest.controller();let red=0;c.root.userData.model.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(m.color?.getHex()===0xff182d)red++;});return red;});assert.equal(restored,0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({...result,restored,errors}));
}finally{await browser.close();}
