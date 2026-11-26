import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Local only: all casts go through the original Q handlers, real Worker,
// actual WebSocket packets and native VFX. No production state is touched.
const backend=process.env.TEMPLE_BACKEND||'http://127.0.0.1:8885';
const site=process.env.TEMPLE_SITE||'http://127.0.0.1:4173';
assert.match(backend,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
const label=process.env.RUN_LABEL||'baseline';
assert.match(label,/^[\w-]+$/);
const key=process.env.TEMPLE_TEST_ADMIN_KEY||(await readFile('.dev.vars','utf8')).match(/^TEMPLE_ADMIN_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];
assert.ok(key,'Use an isolated local Wrangler GM test fixture');
const out='output/v085-skill';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
let page;
try{
 page=await browser.newPage({viewport:{width:1120,height:720}});
 const faults=[];page.on('pageerror',error=>faults.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error'&&/Shader Error|Gameplay update fault|Render fault|VFX update failure/i.test(msg.text()))faults.push(msg.text());});
 await page.addInitScript(base=>localStorage.setItem('temple-backend-url',base),backend);
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:180000});
 // Reproduce a normal trusted entry gesture. A programmatic join alone
 // otherwise creates the OS AudioContext on the first measured attack.
 await page.locator('#entry h1').click({timeout:15000});
 await page.evaluate(({base,key})=>{
  const n=templeTest.network;
  // The localhost fixture needs the GM credential only on /join. Everything
  // afterwards uses the real session, CORS, state and gameplay paths.
  n.join=async({name,color})=>{
   const data=await n.request('/api/join',{method:'POST',auth:false,body:{name,color,memoryCode:key}});
   n.token=data.token;n.joinData=data;void n.connect();return data;
  };
  templeTest.ui.emit('join',{name:'Ely',color:'#43b59a',backendUrl:base});
 },{base:backend,key});
 await page.waitForFunction(()=>templeTest.network.spawnConfirmed,null,{timeout:30000});
 assert.equal(await page.evaluate(()=>templeTest.ui.world.profile.admin),true);
 const action=(action,data={})=>page.evaluate(({action,data})=>templeTest.network.action(action,data),{action,data});
 await action('gm-player-level',{level:100,targetKey:await page.evaluate(()=>templeTest.ui.world.profile.key)});
 const equip=async id=>{
  await action('equip',{itemId:id});
  await page.waitForFunction(id=>templeTest.ui.world.profile.equipment.weapon===id,id);
 };
 await action('equip',{itemId:'wings-33'});
 await page.waitForFunction(()=>templeTest.ui.world.profile.equipment.wings==='wings-33');
 await action('reset-buildings');
 // Travel to a repeatable edge of the city. All pose samples still pass
 // the Worker's ordinary validation. Do not test in the safe WRITE hub.
 await page.evaluate(async()=>{
  const t=templeTest,c=t.controller();c.setEnabled(false);
  let from=c.root.position.toArray();
  for(const end of [[from[0],27,from[2]],[101,27,-51],[101,0,-51]]){
   const steps=Math.ceil(Math.hypot(...end.map((v,i)=>v-from[i]))/2.5);
   for(let i=1;i<=steps;i++){
    const p=from.map((v,k)=>v+(end[k]-v)*i/steps);
    if(t.arena.blocked(p[0],p[2],p[1]))throw Error('Fixture route blocked: '+p);
    c.teleport(p);await new Promise(resolve=>setTimeout(resolve,125));
   }
   from=end;
  }
  c.yaw=-Math.PI*.75;c.pitch=.06;c.setEnabled(true);c.updateCamera(1);
 });
 const dev=await page.context().newCDPSession(page);
 await dev.send('Profiler.enable');
 await dev.send('Performance.enable');
 const metrics=await dev.send('Performance.getMetrics');
 const nav=metrics.metrics.find(m=>m.name==='NavigationStart')?.value;
 const networkTime=seconds=>nav===undefined?null:(seconds-nav)*1000;
 const transport=new Map(),wireAttacks=new Map();
 await dev.send('Network.enable');
 dev.on('Network.requestWillBeSent',e=>{
  if(e.request.url!==backend+'/api/action'||e.request.method!=='POST')return;
  let body;try{body=JSON.parse(e.request.postData||'{}');}catch{return;}
  if(body.action==='attack')transport.set(e.requestId,{phase:body.phase||'release',at:networkTime(e.timestamp)});
 });
 dev.on('Network.responseReceived',e=>{
  const r=transport.get(e.requestId);if(!r)return;
  r.responseAt=networkTime(e.timestamp);r.status=e.response.status;
  const timing=e.response.timing;
  if(timing?.receiveHeadersStart>=0&&timing?.sendEnd>=0)r.sendToHeadersMs=timing.receiveHeadersStart-timing.sendEnd;
 });
 dev.on('Network.webSocketFrameReceived',e=>{
  if(!e.response.payloadData.startsWith('{"type":"attack"'))return;
  try{const m=JSON.parse(e.response.payloadData);wireAttacks.set(m.data.id,networkTime(e.timestamp));}catch{}
 });
 await page.evaluate(()=>{
  const t=templeTest,net=t.network,gl=t.renderer.getContext();
  const samples={busy:[],frames:[],updates:[],renders:[],websocket:[],attacks:[],input:[],http:[],vfx:[],compiles:0,programLinks:[],gpu:[],uploadBytes:0,sceneWork:[]};
  window.v085Sample=samples;
  const now=()=>performance.now();
  new PerformanceObserver(l=>{for(const task of l.getEntries())samples.busy.push([task.startTime,task.duration]);}).observe({type:'longtask'});
  function measure(obj,name,log){
   const original=obj[name];
   obj[name]=function(...args){
    const start=now();
    try{return original.apply(this,args);}
    finally{log(start,now()-start,args);}
   };
  }
  measure(net,'dispatch',(start,ms,[type])=>{if(['world','attack','structure-events'].includes(type))samples.websocket.push({start,ms,type});});
  measure(t.arena.presentation,'play',(start,ms,[event])=>samples.attacks.push({start,ms,id:event.id,weapon:event.weapon,channel:!!event.channel,charge:event.charge}));
  measure(t.arena,'update',(start,ms)=>samples.updates.push({start,ms}));
  measure(t.arena.presentation.vfx,'update',(start,ms)=>samples.vfx.push({start,ms}));
  if(t.arena.grass?.prepareVisibility)measure(t.arena.grass,'prepareVisibility',(start,ms)=>{if(ms>=.5)samples.sceneWork.push({start,ms,name:'grass visibility'});});
  for(const [object,name] of [[t.arena,'syncDrops'],[t.arena.outerCity,'syncDamage'],[t.arena.outerCity,'stepChunkPreparation'],[t.arena.outerCity,'processEjections']])
   measure(object,name,(start,ms)=>{if(ms>=.5)samples.sceneWork.push({start,ms,name});});
  const native=net.action.bind(net);
  net.action=async(action,data)=>{
   const start=now();
   try{
    const result=await native(action,data);
    if(action==='attack')samples.http.push({start,ms:now()-start,phase:data?.phase||'release',id:result.attackEvent?.id,charge:result.attackEvent?.charge,hits:result.structureHits?.length||0});
    return result;
   }catch(error){
    if(action==='attack')samples.http.push({start,ms:now()-start,phase:data?.phase||'release',error:error.message});
    throw error;
   }
  };
  for(const e of ['keydown','keyup'])addEventListener(e,event=>{if(event.code==='KeyQ')samples.input.push({at:now(),type:e});},{capture:true});
  const compile=gl.compileShader.bind(gl);
  gl.compileShader=(...args)=>{samples.compiles++;return compile(...args);};
  const programInfo=gl.getProgramInfoLog.bind(gl),draw=t.renderer.renderBufferDirect.bind(t.renderer);
  let material=null,object=null;
  t.renderer.renderBufferDirect=(...args)=>{
   const previous=[material,object];[material,object]=[args[3],args[4]];
   try{return draw(...args);}finally{[material,object]=previous;}
  };
  gl.getProgramInfoLog=program=>{
   const at=now(),log=programInfo(program);
   const entry=t.renderer.info.programs.find(p=>p.program===program);
   const lineage=[];
   for(let node=object;node&&lineage.length<7;node=node.parent)lineage.push(node.name||node.type);
   samples.programLinks.push({at,ms:now()-at,key:entry?.cacheKey,material:material?.name||material?.type,object:lineage});
   return log;
  };
  const upload=gl.bufferSubData.bind(gl);
  gl.bufferSubData=(target,offset,data,start,count)=>{
   samples.uploadBytes+=(count??data.length)*(data.BYTES_PER_ELEMENT||1);
   return count===undefined?upload(target,offset,data):upload(target,offset,data,start,count);
  };
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
  const render=t.renderer.render.bind(t.renderer);let draws=0;
  t.renderer.render=(...args)=>{
   const start=now();
   const isWorld=args[0]===t.arena.scene;
   if(ext){
    for(let i=pending.length-1;i>=0;i--){
     const q=pending[i];
     if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;
     if(!gl.getParameter(ext.GPU_DISJOINT_EXT))samples.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);
     pending.splice(i,1);gl.deleteQuery(q);
    }
   }
   const q=ext&&isWorld&&++draws%8===0&&pending.length<4?gl.createQuery():null;
   if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
   try{return render(...args);}
   finally{if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}samples.renders.push({start,ms:now()-start,calls:t.renderer.info.render.calls,isWorld});}
  };
  let prev;
  const sample=at=>{if(prev!==undefined)samples.frames.push({at,ms:at-prev});prev=at;if(!samples.stop)requestAnimationFrame(sample);};
  requestAnimationFrame(sample);
 });
 const mark=()=>page.evaluate(()=>performance.now());
 const stages=[];
 const stage=async(name,fn)=>{
  const start=await mark();await fn();stages.push({name,start,end:await mark()});
 };
 await equip('saber-2');
 await page.waitForTimeout(500);
 await dev.send('Profiler.start');
 await stage('idle',()=>page.waitForTimeout(1200));
 await stage('tap',async()=>{await page.keyboard.down('KeyQ');await page.waitForTimeout(80);await page.keyboard.up('KeyQ');await page.waitForTimeout(900);});
 await equip('frost-5');
 await stage('frost release',async()=>{await page.keyboard.down('KeyQ');await page.waitForTimeout(2900);await page.keyboard.up('KeyQ');await page.waitForTimeout(1000);});
 await page.screenshot({path:`${out}/${label}-frost.png`});
 await equip('prism-5');
 await stage('prism channel',async()=>{await page.keyboard.down('KeyQ');await page.waitForTimeout(5300);await page.keyboard.up('KeyQ');await page.waitForTimeout(500);});
 if(process.env.PROFILE_WALK==='1')await stage('walk and turn',async()=>{
  await page.keyboard.down('KeyW');await page.waitForTimeout(800);
  await page.evaluate(()=>{const c=templeTest.controller();c.yaw+=Math.PI/3;c.updateCamera(.5);});
  await page.waitForTimeout(500);await page.keyboard.up('KeyW');await page.waitForTimeout(400);
 });
 const {profile}=await dev.send('Profiler.stop');
 const raw=await page.evaluate(()=>{v085Sample.stop=true;return v085Sample;});
 const state=JSON.parse(await page.evaluate(()=>render_game_to_text()));
 const boot=await page.evaluate(()=>window.templeLoadTimings);
 const pct=(values,p)=>{values=[...values].sort((a,b)=>a-b);return values[Math.floor((values.length-1)*p)]??null;};
 const inside=(t,stage)=>t>=stage.start&&t<=stage.end;
 const stagesSummary=stages.map(stage=>{
  const frames=raw.frames.filter(v=>inside(v.at,stage)).map(v=>v.ms);
  const input=raw.input.filter(v=>inside(v.at,stage));
  const http=raw.http.filter(v=>inside(v.start,stage)).map(v=>{
   const duration=v.ms,first=raw.attacks.find(a=>a.id===v.id&&v.id),draw=first&&raw.renders.find(r=>r.start>=first.start+first.ms);
   return {phase:v.phase,charge:v.charge,ms:duration,hits:v.hits,error:v.error,requestToEvent:first?first.start-v.start:null,requestToFirstDraw:draw?draw.start-v.start:null};
  });
  const largest=raw.busy.filter(v=>inside(v[0],stage)).sort((a,b)=>b[1]-a[1]).slice(0,4);
  return {name:stage.name,frames:frames.length,frameP95:pct(frames,.95),maxFrame:pct(frames,1),vfxP95:pct(raw.vfx.filter(v=>inside(v.start,stage)).map(v=>v.ms),.95),
   logicP95:pct(raw.updates.filter(v=>inside(v.start,stage)).map(v=>v.ms),.95),submitP95:pct(raw.renders.filter(v=>inside(v.start,stage)).map(v=>v.ms),.95),
   peakCalls:pct(raw.renders.filter(v=>inside(v.start,stage)).map(v=>v.calls),1),longTasks:largest,input,http};
 });
 const byId=new Map(profile.nodes.map(n=>[n.id,n.callFrame])),cpu=new Map();
 for(let i=0;i<profile.samples.length;i++){
  const f=byId.get(profile.samples[i]),key=f.functionName+' '+f.url.split('/').at(-1);
  cpu.set(key,(cpu.get(key)||0)+profile.timeDeltas[i]/1000);
 }
 const delivery=raw.attacks.filter((a,i)=>raw.attacks.findIndex(b=>b.id===a.id)===i)
  .map(a=>({weapon:a.weapon,wireToHandlerMs:wireAttacks.get(a.id)==null?null:a.start-wireAttacks.get(a.id)}));
 const report={stages:stagesSummary,state,boot,compiles:raw.compiles,programLinks:raw.programLinks.map(({at,ms,material,object})=>({at,ms,material,object})),uploads:raw.uploadBytes,gpuWorldP95:pct(raw.gpu,.95),transport:[...transport.values()],delivery,sceneWork:raw.sceneWork.sort((a,b)=>b.ms-a.ms).slice(0,12),cpu:[...cpu].sort((a,b)=>b[1]-a[1]).slice(0,40),faults};
 await writeFile(`${out}/${label}.json`,JSON.stringify({report,raw},null,2));
 await writeFile(`${out}/${label}.cpuprofile`,JSON.stringify(profile));
 console.log(JSON.stringify(report));
 assert.ok(raw.attacks.some(e=>e.weapon==='frost-5'&&e.charge>=1),'Expected actual released frost ultimate');
 assert.ok(raw.attacks.some(e=>e.weapon==='prism-5'&&e.channel),'Expected actual sustained prism');
 if(process.env.CHECK_CHANNEL_STOP==='1')assert.equal(raw.http.filter(row=>row.phase==='channel-stop').length,1,'an acknowledged beam release must send just one stop');
 assert.deepEqual(faults,[]);
}finally{
 if(page)await page.evaluate(()=>window.templeTest?.network.close()).catch(()=>{});
 await browser.close();
}
