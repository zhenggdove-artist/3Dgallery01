import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const folder='output/critical-perf';
const backend=process.env.TEMPLE_BACKEND||'http://127.0.0.1:8788';
assert.match(backend,/^http:\/\/127\.0\.0\.1:\d+$/);
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const sent=[],received=[],bytes={},errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('websocket',ws=>{
  ws.on('framesent',({payload})=>{if(typeof payload!=='string'||!payload.startsWith('{'))return;const m=JSON.parse(payload);if(m.type==='state')sent.push({...m.data,at:Date.now()});});
  ws.on('framereceived',({payload})=>{if(typeof payload!=='string'||!payload.startsWith('{'))return;const m=JSON.parse(payload);const b=bytes[m.type]??={count:0,bytes:0};b.count++;b.bytes+=Buffer.byteLength(payload);if(['state-ack','state-rejected'].includes(m.type))received.push({...m.data,type:m.type,at:Date.now()});});
 });
 await page.addInitScript(base=>{localStorage.setItem('temple-backend-url',base);window.longTasks=[];new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});},backend);
 if(process.env.BASELINE_MAIN)await page.route(/\/src\/(main|arena-view|outer-city|city-ruins-vfx)\.js\?/,route=>{
  const path=new URL(route.request().url()).pathname.slice(1);
  return route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','1af6712:'+path],{encoding:'utf8'})});
 });
 await page.goto(process.env.TEMPLE_SITE||'http://127.0.0.1:4173');await page.waitForFunction(()=>document.body.classList.contains('ready')||document.querySelector('#loading-percent')?.textContent==='ERROR',null,{timeout:90000});
 assert.ok(await page.evaluate(()=>document.body.classList.contains('ready')),await page.locator('#loading-detail').textContent());
 if(process.env.SLOW_SOCKET)await page.evaluate(()=>{const n=templeTest.network,connect=n.connect.bind(n);n.connect=async()=>{await new Promise(r=>window.releaseSocket=r);return connect();};});
 await page.evaluate(base=>templeTest.ui.emit('join',{name:'Local Walk Profile',color:'#43b59a',backendUrl:base}),backend);
 await page.locator('#hud').waitFor({state:'visible',timeout:30000});
 if(!process.env.SLOW_SOCKET)await page.waitForFunction(()=>templeTest.network.lastAcceptedSequence>0);
 await page.evaluate(()=>{const c=templeTest.controller();c.yaw=0;window.poses=[];const fn=()=>{window.poses.push({at:Date.now(),p:c.root.position.toArray()});window.poseFrame=requestAnimationFrame(fn);};window.poseFrame=requestAnimationFrame(fn);});
 await page.keyboard.down('KeyW');
 if(process.env.SLOW_SOCKET){await page.waitForTimeout(2600);await page.evaluate(()=>window.releaseSocket());}
 await page.waitForTimeout(3500);await page.keyboard.up('KeyW');
 const poses=await page.evaluate(()=>{cancelAnimationFrame(window.poseFrame);return window.poses;});
 const trace={sent:[...sent],received:[...received],poses,bytes:structuredClone(bytes),corrections:await page.evaluate(()=>templeTest.network.motionDiagnostics),backsteps:poses.slice(1).filter((row,i)=>row.p[2]-poses[i].p[2]>.05).length};
 await writeFile(`${folder}/${process.env.PROFILE_LABEL||'before'}-motion.json`,JSON.stringify(trace,null,2));console.log('movement',{sent:sent.length,received:received.length,backsteps:trace.backsteps,reasons:received.filter(m=>m.type==='state-rejected').map(m=>m.error)});
 if(process.env.MOTION_ONLY){if(process.env.BASELINE_MAIN)assert.ok(trace.backsteps>0);else assert.equal(trace.backsteps,0);assert.deepEqual(errors,[]);process.exitCode=0;}
 else {
 await page.evaluate(()=>templeTest.network.close());
 const devtools=await page.context().newCDPSession(page);await devtools.send('Profiler.enable');await devtools.send('Profiler.start');
 await page.evaluate(async()=>{const t=templeTest,c=t.controller(),city=t.arena.outerCity;const nearest=[...city.lots].sort((a,b)=>Math.hypot(a.x-120,a.z)-Math.hypot(b.x-120,b.z));const lot=nearest[0];c.cameraLocked=true;t.camera.position.set(lot.x-26,12,lot.z+5);t.camera.lookAt(lot.x,3,lot.z);window.testLots=nearest.slice(0,24);window.longTasks.length=0;window.stats={uploads:0,bytes:0,compiles:0,calls:[],gpu:[]};const gl=t.renderer.getContext(),raw=gl.bufferSubData.bind(gl),compile=gl.compileShader.bind(gl);gl.compileShader=(...a)=>{stats.compiles++;return compile(...a);};gl.bufferSubData=(target,offset,data,start,count)=>{stats.uploads++;stats.bytes+=(count??data.length)*(data.BYTES_PER_ELEMENT||1);return count===undefined?raw(target,offset,data):raw(target,offset,data,start,count);};window.measureGpu=()=>{const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)return;const raw=t.renderer.render.bind(t.renderer),pending=[];let frame=0;t.renderer.render=(...args)=>{for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))stats.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}}if(++frame%20!==0||pending.length>4)return raw(...args);const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);try{return raw(...args);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}};};window.measureGpu();});
 await page.waitForTimeout(1400);
 const measure=()=>page.evaluate(()=>{const {performanceSamples:s,renderer}=templeTest;return {...stats,longTasks:[...longTasks],drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:s.frame.slice(-60),logic:s.logic.slice(-60),submit:s.submit.slice(-60)};});
 const idle=await measure();
 for(let wave=0;wave<5;wave++){
  await page.evaluate(w=>{const t=templeTest;for(const lot of testLots){const maxHp=2000,previousHp=maxHp*(1-w*.18),hp=previousHp-maxHp*.18;t.arena.showStructureHit({id:`profile-${w}-${lot.id}`,cityLotIndex:lot.index,kind:'city-house',part:'masonry',hp,maxHp,previousHp,damage:maxHp*.18,time:Date.now(),position:[lot.x,2,lot.z]});}},wave);
  await page.waitForTimeout(380);
 }
 await page.waitForTimeout(650);
 const hit=await measure();const {profile}=await devtools.send('Profiler.stop');
 await writeFile(`${folder}/${process.env.PROFILE_LABEL||'before'}.cpuprofile`,JSON.stringify(profile));
 const top=new Map(),nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame]));for(let i=0;i<profile.samples.length;i++){const f=nodes.get(profile.samples[i]);const key=f.functionName+' '+f.url.split('/').at(-1);top.set(key,(top.get(key)||0)+profile.timeDeltas[i]/1000);}
 const counters={idle,hit,top:[...top].sort((a,b)=>b[1]-a[1]).slice(0,30),errors};
 await writeFile(`${folder}/${process.env.PROFILE_LABEL||'before'}-metrics.json`,JSON.stringify(counters,null,2));
 await page.screenshot({path:`${folder}/${process.env.PROFILE_LABEL||'before'}.png`});
 const p95=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)];console.log('city',{idle:{frame:p95(idle.frames),logic:p95(idle.logic),submit:p95(idle.submit)},combat:{frame:p95(hit.frames),logic:p95(hit.logic),submit:p95(hit.submit)},uploads:hit.uploads-idle.uploads,uploadBytes:hit.bytes-idle.bytes,gpu:hit.gpu,compiles:hit.compiles-idle.compiles,drawCalls:hit.drawCalls,longTasks:hit.longTasks,top:counters.top.slice(0,16),errors});
 assert.deepEqual(errors,[]);
 }
}finally{for(const page of browser.contexts().flatMap(c=>c.pages()))await page.evaluate(()=>window.templeTest?.network.close()).catch(()=>{});await browser.close();}
