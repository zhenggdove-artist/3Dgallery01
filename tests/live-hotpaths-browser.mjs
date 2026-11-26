import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {cityBlocked} from '../src/shared/city-layout.js';
import {itemById} from '../src/shared/catalog.js';

const base=process.env.TEMPLE_BACKEND||'http://127.0.0.1:8789';
const site=process.env.TEMPLE_SITE||'http://127.0.0.1:4173';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
const label=process.env.RUN_LABEL||'after';
const key=(await readFile('.dev.vars','utf8')).match(/^TEMPLE_ADMIN_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];
assert.ok(key,'Local Wrangler admin fixture needed');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const out='output/live-hotpaths';await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 if(label==='before'){
  const {execFileSync}=await import('node:child_process');
  const prior=new Set(['src/main.js','src/network.js','src/shared/world-patch.js','src/arena-view.js','src/equipment-portrait-view.js','src/equipment-portrait.js','src/bag-view.js','src/item-preview.js','src/engine-presentation.js','src/outer-city.js','src/city-ruins-vfx.js','src/ui.js','fidelity-ui.css']);
  await page.route(url=>prior.has(url.pathname.slice(1)),route=>{
   const path=new URL(route.request().url()).pathname.slice(1);
   return route.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body:execFileSync('git',['show','6b5b729:'+path],{encoding:'utf8'})});
  });
 }
 const errors=[],http=[],ws={};page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url()===base+'/api/action')try{
   const bytes=(await r.body()).length;http.push({bytes,status:r.status(),phase:r.request().postDataJSON()?.phase});
 }catch{}});
 page.on('websocket',socket=>socket.on('framereceived',({payload})=>{try{
  const {type}=JSON.parse(payload);const k=ws[type]??={n:0,bytes:0};k.n++;k.bytes+=Buffer.byteLength(payload);
 }catch{}}));
 await page.addInitScript(()=>{window.longTasks=[];new PerformanceObserver(l=>longTasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask'});});
 await page.goto(site);await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:120000});
 await page.evaluate(({base,key})=>{
  const n=templeTest.network;
  n.join=async ({name,color})=>{
   const data=await n.request('/api/join',{method:'POST',auth:false,body:{name,color,memoryCode:key}});
   n.token=data.token;n.joinData=data;void n.connect();return data;
  };
  templeTest.ui.emit('join',{name:'Ely',color:'#43b59a',backendUrl:base});
 },{base,key});
 await page.waitForFunction(()=>templeTest.network.spawnConfirmed,null,{timeout:15000});
 assert.equal(JSON.parse(await page.evaluate(()=>render_game_to_text())).role,'fighter');
 const dev=await page.context().newCDPSession(page);
 await dev.send('Profiler.enable');
 await page.evaluate(async()=>{
  const t=templeTest,c=t.controller(),{Vector3}=await import('three'),temp=new Vector3();
  const hip=c.root.userData.bones.get('Hips');
  window.poseRows=[];window.capturePose=true;
  const shot=()=>{if(!capturePose)return;poseRows.push({t:performance.now(),root:c.root.position.z,hip:hip.getWorldPosition(temp).z});requestAnimationFrame(shot);};
  c.yaw=0;shot();
 });
 await page.keyboard.down('KeyW');await page.waitForTimeout(5200);await page.keyboard.up('KeyW');
 const motion=await page.evaluate(()=>{
  window.capturePose=false;
  const rows=poseRows,back=(k)=>rows.slice(1).map((r,i)=>r[k]-rows[i][k]).filter(v=>v>.20);
  return {samples:rows.length,rootBack:back('root'),visualBack:back('hip'),reject:templeTest.network.rejectionCounts};
 });
 console.log('motion',motion);
 const action=(action,extra={})=>page.evaluate(({action,extra})=>new Promise((res,rej)=>{
  const ui=templeTest.ui,n=templeTest.network,orig=n.action.bind(n);
  n.action=(a,d)=>{if(a===action){n.action=orig;return orig(a,d).then(r=>{res(r);return r;},e=>{rej(e);throw e;});}return orig(a,d);};
  ui.emit('server-action',{action,...extra});
 }),{action,extra});
 await action('reset-buildings');
 if(await page.evaluate(()=>Boolean(templeTest.ui.world.profile.equipment.head)))await action('unequip',{slot:'head'});
 const wing=itemById('wings-33');
 await action('equip',{itemId:wing.id});
 await page.evaluate(()=>{const ui=templeTest.ui;ui.bagCategory='equipment';ui.openPanel('bag');});
 const portrait=page.locator('#bag-portrait');await portrait.waitFor();
 await page.waitForFunction(()=>templeTest.portraitViewport.drawCount>0);
 const portraitMetrics=()=>page.evaluate(()=>{
  const p=templeTest.portraitViewport;const meshes={points:0,wings:0};
  p.scene.traverse(o=>{if(o.isPoints)meshes.points++;if(o.isMesh&&o.parent?.parent?.userData?.wingId)meshes.wings++;});
  return {...meshes,drawCount:p.drawCount};
 });
 const initialPortrait=await portraitMetrics();
 await portrait.screenshot({path:`${out}/${label}-portrait.png`});
 await page.evaluate(()=>{const t=templeTest;window.beforeCanvas=t.portraitViewport.canvas;window.beforeWings=t.controller().root.userData.wings;longTasks.length=0;for(const samples of Object.values(t.performanceSamples))samples.length=0;
  window.equipParts={};
  for(const [o,k] of [[t.portraitViewport,'build'],[t.portraitViewport,'draw'],[t.arena.presentation,'equipment'],[t.ui,'renderBag']]){
   const orig=o[k].bind(o);
   o[k]=(...args)=>{const now=performance.now();try{return orig(...args);}finally{const ms=performance.now()-now;if(ms>1)(equipParts[k]??=[]).push(ms);}};
  }
 });
 await action('equip',{itemId:'hat-poop'});
 await page.waitForTimeout(800);
 const equip=await page.evaluate(()=>{const t=templeTest;return {sameCanvas:beforeCanvas===t.portraitViewport.canvas,sameWings:beforeWings===t.controller().root.userData.wings,longTasks:[...longTasks],maxFrame:Math.max(...t.performanceSamples.frame),parts:equipParts};});
 console.log('equip',equip,initialPortrait);
 await page.locator('#panel').screenshot({path:`${out}/${label}-equip.png`});
 await page.evaluate(()=>templeTest.ui.closePanel());
 const weapon=itemById('ember-5');
 await action('equip',{itemId:weapon.id});
 const current=await page.evaluate(()=>templeTest.controller().root.position.toArray());
 const start=[101,0,-51],direction=[1,-.04,1];
 assert.ok(!cityBlocked(start[0],start[2],start[1]));
 // Legal outbound pose stream: 3 metres per sample matches the allowed
 // velocity of a wing-equipped fighter. Camera views the real target lots.
 await page.evaluate(async ({from,to})=>{
  const t=templeTest,c=t.controller();c.cameraLocked=true;c.setEnabled(false);
  for(const end of [[from[0],28,from[2]],[to[0],28,to[2]],to]){
   const steps=Math.ceil(Math.hypot(...end.map((v,i)=>v-from[i]))/3);
   for(let i=1;i<=steps;i++){
    const p=from.map((v,k)=>v+(end[k]-v)*i/steps);
    if(t.arena.blocked(p[0],p[2],p[1]))throw Error('Fixture path blocked: '+p);
    c.teleport(p);
    await new Promise(r=>setTimeout(r,123));
   }
   from=end;
  }
  t.camera.position.set(to[0]-10,5,to[2]-10);t.camera.lookAt(to[0]+14,1,to[2]+14);
 },{from:current,to:start});
 await page.waitForTimeout(1000);
 assert.ok(await page.evaluate(start=>Math.hypot(...templeTest.controller().root.position.toArray().map((v,i)=>v-start[i]))<.5,start));
 await page.evaluate(()=>{
  const t=templeTest,gl=t.renderer.getContext(),raw=gl.bufferSubData.bind(gl);
  longTasks.length=0;for(const s of Object.values(t.performanceSamples))s.length=0;
  window.load={frames:[],calls:[],gpu:[],uploads:0,bytes:0,compiles:0,stop:false};
  gl.bufferSubData=(target,offset,data,start,count)=>{
   load.uploads++;load.bytes+=(count??data.length)*(data.BYTES_PER_ELEMENT||1);
   return count===undefined?raw(target,offset,data):raw(target,offset,data,start,count);
  };
  const compile=gl.compileShader.bind(gl);
  gl.compileShader=(...a)=>{load.compiles++;return compile(...a);};
  let prev=0;
  const sample=now=>{if(load.stop)return;if(prev)load.frames.push(now-prev);prev=now;
   load.calls.push(t.renderer.info.render.calls);requestAnimationFrame(sample);};
  requestAnimationFrame(sample);
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!ext)return;
  const render=t.renderer.render.bind(t.renderer),pending=[];
  let n=0;
  t.renderer.render=(...args)=>{
   for(let i=pending.length-1;i>=0;i--){
    const q=pending[i];
    if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;
    if(!gl.getParameter(ext.GPU_DISJOINT_EXT))load.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);
    pending.splice(i,1);gl.deleteQuery(q);
   }
   if(++n%25||pending.length>=4)return render(...args);
   const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
   try{return render(...args);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}
  };
 });
 await dev.send('Profiler.start');
 const firstReq=http.length;
 const warm=await action('attack',{phase:'charge'});assert.equal(warm.charging,true);
 await page.waitForTimeout(weapon.chargeMs+150);
 const entered=await action('attack',{phase:'channel-start'});assert.equal(entered.channeling,true);
 const impacts=[];
 for(let i=0;i<3;i++){
  const r=await action('attack',{phase:'channel',charge:1,direction});
  impacts.push(...(r.structureHits||[]));await page.waitForTimeout(weapon.cooldown+80);
 }
 await action('attack',{phase:'channel-stop'});
 const areaImpacts=[];
 for(let i=0;i<3;i++){
  await action('attack',{phase:'charge'});await page.waitForTimeout(weapon.chargeMs+110);
  const cast=await action('attack',{charge:1,direction});
  assert.equal(cast.attackEvent.area?.mode,'area');
  areaImpacts.push(...cast.structureHits);await page.waitForTimeout(400);
 }
 const {profile}=await dev.send('Profiler.stop');
 const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame])),top=new Map();
 for(let i=0;i<profile.samples.length;i++){const f=nodes.get(profile.samples[i]);const k=f.functionName+' '+f.url.split('/').at(-1);top.set(k,(top.get(k)||0)+profile.timeDeltas[i]/1000);}
 const frame=await page.evaluate(()=>{
  load.stop=true;
  const p=values=>{const v=[...values].sort((a,b)=>a-b);return {p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};
  return {longTasks:[...longTasks],logic:p(templeTest.performanceSamples.logic),submit:p(templeTest.performanceSamples.submit),
   frame:p(load.frames),draws:p(load.calls),gpu:p(load.gpu),uploads:load.uploads,bytes:load.bytes,compiles:load.compiles};
 });
 const skill={hits:impacts.length+areaImpacts.length,lots:new Set(areaImpacts.map(h=>h.cityLotIndex)).size,http:http.slice(firstReq),ws,frame,cpu:[...top].sort((a,b)=>b[1]-a[1]).slice(0,22)};
 console.log('skill',JSON.stringify(skill));
 await writeFile(`${out}/${label}-report.json`,JSON.stringify({motion,equip,initialPortrait,skill,errors},null,2));
 await writeFile(`${out}/${label}.cpuprofile`,JSON.stringify(profile));
 assert.ok(skill.lots>=8,'Real Worker attack must damage multiple buildings');
 assert.deepEqual(errors,[]);
 if(label!=='before'){
  assert.equal(motion.rootBack.length,0);assert.equal(motion.visualBack.length,0);
  assert.equal(initialPortrait.points,0);assert.ok(initialPortrait.wings>=2);
  assert.ok(equip.sameCanvas);assert.ok(equip.sameWings);
 }
}finally{await browser.close();}
