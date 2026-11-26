import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import WebSocket from 'ws';
import {CITY_LOTS,cityBlocked,cityWallPoint,cityRaycast} from '../src/shared/city-layout.js';
import {itemById} from '../src/shared/catalog.js';

// Four real fighter sockets (the room limit), twelve viewers, populated
// inventories and 432 damaged lots. Only ephemeral localhost storage uses
// the seed. All actions, patches, receipts and validation run the real DO.
const fixtures=[];
for(const lot of CITY_LOTS){
 if(fixtures.length===4)break;
 const p=cityWallPoint(lot,'front',.46,.5,4.5).map(x=>+x.toFixed(3));p[1]=0;
 if(fixtures.some(other=>Math.hypot(other.position[0]-p[0],other.position[2]-p[2])<65)||cityBlocked(p[0],p[2],0))continue;
 const d=[-Math.sin(lot.yaw),0,-Math.cos(lot.yaw)];
 if(cityRaycast([p[0],1.16,p[2]],d,6)?.lot!==lot)continue;
 fixtures.push({position:p,direction:d});
}
assert.equal(fixtures.length,4);
const entry=fileURLToPath(new URL('../cloudflare/worker.js',import.meta.url));
const baseRef=process.env.COMPARE_REF;
const gitFile=path=>execFileSync('git',['show',baseRef+':'+path],{encoding:'utf8'});
const seed=`\nfunction r171LocalBenchmarkWorld(w){for(let i=0;i<432;i++){const hp=218-(i%4)*6;w.cityDamage['city-'+i]={hp,maxHp:240,parts:{masonry:hp}};}return w;}\n`;
const worldArgs=/\[4,0,3\],\[-4,0,3\],\[4,0,-3\],\[-4,0,-3\],\[0,0,5\],\[0,0,-5\]/;
const tweak=(source,pattern,replacement)=>{assert.match(source,pattern);return source.replace(pattern,replacement);};
async function bundle(before){
 const b=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',target:'es2022',external:['cloudflare:workers'],plugins:[{
  name:'ephemeral-room-load',setup(m){
   const args={filter:/[/\\](arena|temple-rules|world-patch|worker)\.js$/};
   m.onLoad(args,({path})=>{
    const f=path.split(/[/\\]/).at(-1);
    let s=before&&['worker.js','world-patch.js'].includes(f)?gitFile((f==='worker.js'?'cloudflare/':'src/shared/')+f):readFileSync(path,'utf8');
    if(f==='arena.js')s=tweak(s,worldArgs,fixtures.map(f=>JSON.stringify(f.position)).join(',')+',[0,0,5],[0,0,-5]');
    if(f==='worker.js')s=tweak(s,/JSON\.stringify\(createInitialWorld\(\)\)/,'JSON.stringify(r171LocalBenchmarkWorld(createInitialWorld()))')+seed;
    if(f==='temple-rules.js'){
     s=tweak(s,/\[STARTER_LOADOUT\.weapon\],quickSlots/,
      `(name.startsWith('Fixture Fighter')?[STARTER_LOADOUT.weapon,'frost-5','prism-5',...Array.from({length:997},(_,i)=>['saber-2','comfort-dollar-50','comfort-dollar-100'][i%3])]:[STARTER_LOADOUT.weapon]),quickSlots`);
     s=tweak(s,/wallet:80,level:1,xp:0,hp:100,maxHp:100,mana:100,maxMana:100/,
      `wallet:80,level:name.startsWith('Fixture Fighter')?200:1,xp:0,hp:100,maxHp:100,mana:name.startsWith('Fixture Fighter')?10000:100,maxMana:100`);
    }
    return {contents:s,loader:'js',resolveDir:dirname(path)};
   });
  }
 }]});
 return b.outputFiles[0].text;
}

async function benchmark(source){
 const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,workers:[{
  name:'local-room-latency',modules:[{type:'ESModule',path:'worker.mjs',contents:source}],compatibilityDate:'2026-10-13',
  durableObjects:{TEMPLE_ROOM:{className:'TempleRoom',useSQLite:true}}
 }]}));
 const sockets=[],requestTimes=[];
 try{
  const base=await mf.ready;
  async function json(path,body,token){
   const response=await fetch(new URL(path,base),{method:'POST',headers:{'Content-Type':'application/json',
    ...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
   const result=await response.json();assert.ok(response.ok,result.error);return result;
  }
  const join=async(name,mode)=>{
   const guest=await json('/api/join',{name,mode,color:'#43b59a'});
   assert.equal(guest.role,mode==='spectator'?'spectator':'fighter');
   const url=new URL('/api/socket',base);url.protocol='ws:';url.searchParams.set('patch','2');url.searchParams.set('token',guest.token);
   const socket=new WebSocket(url),wire=[];sockets.push(socket);
   socket.on('message',payload=>{const m=JSON.parse(String(payload));wire.push({type:m.type,data:m.data,at:performance.now(),bytes:payload.length});});
   await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
   return {...guest,wire,socket};
  };
  const fighters=[];
  for(let i=0;i<4;i++){
   const p=await join('Fixture Fighter '+i,'guest');fighters.push(p);
   p.socket.send(JSON.stringify({type:'state',data:{position:fixtures[p.seat].position,rotation:0,animation:'idle',seq:1}}));
   for(let j=0;j<150&&!p.wire.some(m=>m.type==='state-ack');j++)await pause(10);
   assert.deepEqual(p.wire.find(m=>m.type==='state-ack')?.data.position,fixtures[p.seat].position);
   p.weapon=i%2?'prism-5':'frost-5';p.dir=fixtures[p.seat].direction;
   await json('/api/action',{action:'equip',itemId:p.weapon,requestId:crypto.randomUUID()},p.token);
  }
  const viewers=[];
  for(let i=0;i<12;i++)viewers.push(await join('Fixture Viewer '+i,'spectator'));
  for(const p of [...fighters,...viewers])p.wire.length=0;
  async function attack(p,phase){
   const start=performance.now();
   const result=await json('/api/action',{action:'attack',...(phase?{phase}:{}),charge:phase==='charge'?0:1,
    direction:p.dir,compactCombat:true,requestId:crypto.randomUUID()},p.token);
   const ms=performance.now()-start;let eventMs=null;
   if(result.attackEvent){
    for(let i=0;i<100&&!p.wire.some(m=>m.data?.id===result.attackEvent.id);i++)await pause(10);
    const event=p.wire.find(m=>m.type==='attack'&&m.data.id===result.attackEvent.id);
    const patch=p.wire.find(m=>m.type==='world-patch'&&m.data.revision===result.worldRevision);
    assert.ok(event&&patch&&p.wire.indexOf(patch)<p.wire.indexOf(event));
    assert.deepEqual(event.data,result.attackEvent);eventMs=event.at-start;
   }
   requestTimes.push({phase:phase||'release',weapon:p.weapon,ms,eventMs,hits:result.structureHits?.length||0});
   return result;
  }
  for(let wave=0;wave<3;wave++){
   await Promise.all(fighters.map(p=>attack(p,'charge')));
   await pause(Math.max(itemById('prism-5').chargeMs,itemById('frost-5').chargeMs)+150);
   await Promise.all(fighters.map(async p=>{
    if(p.weapon==='prism-5'){await attack(p,'channel-start');await attack(p,'channel');}
    else await attack(p,null);
   }));
   await Promise.all(fighters.filter(p=>p.weapon==='prism-5').map(p=>attack(p,'channel-stop')));
   await pause(1350);
  }
  const casts=requestTimes.filter(r=>r.eventMs!==null);
  assert.ok(casts.filter(r=>r.phase==='release').reduce((n,r)=>n+r.hits,0)>10,'exercise actual charged building impacts');
  const ps=(rows,k,rank)=>rows.map(r=>r[k]).sort((a,b)=>a-b)[Math.min(rows.length-1,Math.ceil(rows.length*rank)-1)];
  const wire=[...fighters,...viewers].flatMap(p=>p.wire).filter(m=>m.type==='world-patch');
  return {casts:casts.length,hits:casts.reduce((n,r)=>n+r.hits,0),eventMedian:ps(casts,'eventMs',.5),eventP95:ps(casts,'eventMs',.95),
   httpP95:ps(requestTimes,'ms',.95),patches:wire.length,patchP95:ps(wire,'bytes',.95)};
 }finally{for(const s of sockets)s.close();await mf.dispose();}
}
for(const before of (baseRef?[true,false]:[false]))
 console.log(JSON.stringify({variant:before?baseRef:'current',...(await benchmark(await bundle(before)))}));
