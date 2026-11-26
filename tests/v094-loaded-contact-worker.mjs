import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import WebSocket from 'ws';
const entry=fileURLToPath(new URL('../cloudflare/worker.js',import.meta.url));
const nearBuilding=[85.964,0,-43.694],towardsBuilding=[.91771,0,-.39725];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(get){const end=performance.now()+4000;for(;;){const value=get();if(value)return value;if(performance.now()>end)throw Error('Timed out waiting for authoritative contact');await delay(10);}}
async function scenario(building){
 const positions=building?[nearBuilding]:[[75,0,0],[75,0,1]];
 const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',target:'es2022',external:['cloudflare:workers'],logLevel:'error',plugins:[{name:'isolated-spawn-fixture',setup(b){b.onLoad({filter:/[/\\]worker\.js$/},args=>({contents:readFileSync(args.path,'utf8').replace('JSON.stringify(createInitialWorld())','JSON.stringify({...createInitialWorld(),sceneArchive:{testFixture:\"x\".repeat(1500000)}})'),loader:'js',resolveDir:dirname(args.path)}));b.onLoad({filter:/[/\\]arena\.js$/},args=>{let contents=readFileSync(args.path,'utf8').replace('[4,0,3]',JSON.stringify(positions[0]));if(!building)contents=contents.replace('[-4,0,3]',JSON.stringify(positions[1]));return {contents,loader:'js',resolveDir:dirname(args.path)};});}}]});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'v94-loaded-contact-fixture',modules:[{type:'ESModule',path:'worker.mjs',contents:bundle.outputFiles[0].text}],compatibilityDate:'2026-10-13',durableObjects:{TEMPLE_ROOM:{className:'TempleRoom',useSQLite:true}}}],host:'127.0.0.1',port:0}));
 const sockets=[];
 try{
  const base=await mf.ready;
  for(let i=0;i<positions.length;i++){
   const res=await fetch(new URL('/api/join',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'V94 Fixture '+i,color:'#43b59a',mode:'guest'})});
   const guest=await res.json();assert.equal(res.ok,true,guest.error);assert.equal(guest.role,'fighter');
   const url=new URL('/api/socket',base);url.protocol='ws:';url.searchParams.set('patch','2');url.searchParams.set('token',guest.token);
   const socket=new WebSocket(url),wire=[];socket.on('message',raw=>{const msg=JSON.parse(String(raw));wire.push({...msg,at:performance.now()});});
   sockets.push({socket,wire,guest});await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
   const welcome=await until(()=>wire.find(m=>m.type==='welcome'));assert.equal(welcome.data.contactFastV093,true);
   socket.send(JSON.stringify({type:'state',data:{position:positions[i],rotation:0,animation:'idle',visible:true,seq:1}}));
   const ack=await until(()=>wire.find(m=>m.type==='state-ack'&&m.data.seq===1));assert.deepEqual(ack.data.position,positions[i]);
  }
  const {socket,wire,guest}=sockets[0],start=performance.now(),offset=wire.length,requestId=crypto.randomUUID();
  const response=await fetch(new URL('/api/action',base),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+guest.token},body:JSON.stringify({action:'attack',requestId,compactCombat:true,charge:0,direction:building?towardsBuilding:[0,0,1]})});const result=await response.json();const ack={at:performance.now()};assert.ok(response.ok,result.error);if(building)assert.ok(result.contactStructures?.hits.length);
  const target=sockets[1]?.guest.self.key;
  const hit=await until(()=>wire.slice(offset).find(m=>building?m.type==='structure-events'&&m.data.hits.some(e=>e.structureId==='city-0'):m.type==='combat-damage'&&m.data.events.some(e=>e.owner===guest.self.key&&e.target===target)));
  assert.ok(Number.isFinite(hit.data.revision)||building&&hit.data.hits.every(e=>Number.isFinite(e.revision)));
  console.log(JSON.stringify({scenario:building?'city impact':'stationary PvP contact',ackMs:Math.round(ack.at-start),contactPacketMs:Math.round(hit.at-start),noAdditionalMovementPackets:true,transport:'v35-http',fixtureArchiveBytes:1500000}));
 }finally{for(const {socket} of sockets)socket.close();await mf.dispose();}
}
await scenario(true);await scenario(false);
