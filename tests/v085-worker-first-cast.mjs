import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import WebSocket from 'ws';
import {PLAYER_SPAWNS} from '../src/shared/arena.js';

// Same local workerd binary and a fresh SQLite Durable Object for each
// run. Substitute only the published V85 city source for the control.
const entry=fileURLToPath(new URL('../cloudflare/worker.js',import.meta.url));
const oldSource=execFileSync('git',['show','15ede91:src/shared/city-layout.js'],{encoding:'utf8'});
const nearBuilding=[85.964,0,-43.694],towardsBuilding=[.91771,0,-.39725];
async function bundle(before,hit){
 const result=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',
  target:'es2022',external:['cloudflare:workers'],logLevel:'error',plugins:[{
   name:'cold-cast-fixture',
   setup(builder){
    if(before)builder.onLoad({filter:/[/\\]city-layout\.js$/},args=>({
     contents:oldSource,loader:'js',resolveDir:dirname(args.path)
    }));
    // Start at a normal street position for the near-building scenario.
    // Both variants keep the same authoritative state validation and attack.
    if(hit)builder.onLoad({filter:/[/\\]arena\.js$/},args=>({
     contents:readFileSync(args.path,'utf8').replace('[4,0,3]',JSON.stringify(nearBuilding)),
     loader:'js',resolveDir:dirname(args.path)
    }));
   }
  }]});
 return result.outputFiles[0].text;
}
async function room(source,hit){
 const miniflare=new Miniflare(convertV4MiniflareOptions({
  workers:[{name:'v85-fixture',modules:[{type:'ESModule',path:'worker.mjs',contents:source}],
   compatibilityDate:'2026-10-13',
   durableObjects:{TEMPLE_ROOM:{className:'TempleRoom',useSQLite:true}}}],
  host:'127.0.0.1',port:0
 }));
 let socket;
 try{
  const base=await miniflare.ready;
  const json=async(path,data,token)=>{
   const response=await fetch(new URL(path,base),{method:'POST',headers:{
    'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})
   },body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   assert.ok(response.ok,result.error);
   return result;
  };
  const guest=await json('/api/join',{name:'V85 Cast Fixture',color:'#43b59a',mode:'guest'});
  assert.equal(guest.role,'fighter');
  const wsURL=new URL('/api/socket',base);wsURL.protocol='ws:';wsURL.searchParams.set('patch','2');wsURL.searchParams.set('token',guest.token);
  const wire=[];
  socket=new WebSocket(wsURL);
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  socket.on('message',payload=>{const m=JSON.parse(String(payload));wire.push({type:m.type,data:m.data,at:performance.now()});});
  const position=hit?nearBuilding:PLAYER_SPAWNS[guest.seat];
  socket.send(JSON.stringify({type:'state',data:{position,rotation:0,animation:'idle',seq:1}}));
  for(let i=0;!wire.some(m=>m.type==='state-ack')&&i<100;i++)
   await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(wire.find(m=>m.type==='state-ack')?.data.position,position);
  const start=performance.now();
  const reply=await json('/api/action',{requestId:crypto.randomUUID(),action:'attack',direction:hit?towardsBuilding:[0,0,1],charge:0,compactCombat:true},guest.token);
  const httpMs=performance.now()-start;
  assert.equal(reply.attackEvent.weapon,'saber-2');
  if(hit)assert.deepEqual(reply.structureHits.map(({structureId,part,damage})=>[structureId,part,damage]),[['city-0','windows-0-0',8]]);
  else assert.equal(reply.structureHits.length,0);
  for(let i=0;!wire.some(m=>m.data?.id===reply.attackEvent.id)&&i<100;i++)
   await new Promise(resolve=>setTimeout(resolve,10));
  const attack=wire.find(m=>m.type==='attack'&&m.data.id===reply.attackEvent.id);
  const patch=wire.find(m=>m.type==='world-patch'&&m.data.revision===reply.worldRevision);
  assert.ok(patch&&attack&&wire.indexOf(patch)<wire.indexOf(attack),'authoritative patch must precede the attack event');
  assert.deepEqual(attack.data,reply.attackEvent);
  return {httpMs,attackMs:attack.at-start};
 }finally{
  socket?.close();
  await miniflare.dispose();
 }
}
const median=list=>[...list].sort((a,b)=>a-b)[Math.floor(list.length/2)];
for(const hit of [false,true]){
 const [before,after]=await Promise.all([bundle(true,hit),bundle(false,hit)]);
 const rows={before:[],after:[]};
 for(let i=0;i<3;i++){
  for(const side of i%2?['after','before']:['before','after'])
   rows[side].push(await room(side==='before'?before:after,hit));
 }
 console.log(JSON.stringify({scenario:hit?'building':'open-space',samples:rows,medianEventMs:{
  before:median(rows.before.map(r=>r.attackMs)),after:median(rows.after.map(r=>r.attackMs))
 }}));
}
