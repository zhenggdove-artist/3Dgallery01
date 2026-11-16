import WebSocket from 'ws';
// Run against an ephemeral local Wrangler Durable Object; never production.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PLAYER_SPAWNS} from '../src/shared/arena.js';
import {setTimeout as delay} from 'node:timers/promises';

const base=process.env.TEMPLE_WORKER_URL||'http://127.0.0.1:8787';
async function call(path,body,token,options={}){
 const response=await fetch(base+path,{
  method:body===undefined?'GET':'POST',
  headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':options.type||'application/json'},
  body:body===undefined?undefined:options.raw?body:JSON.stringify(body),
  signal:AbortSignal.timeout(15000)
 });
 const data=await response.json();
 if(options.expectedStatus){assert.equal(response.status,options.expectedStatus,JSON.stringify(data));return data;}
 assert.ok(response.ok,base+path+': '+response.status+' '+JSON.stringify(data));
 return data;
}
async function waitForWorker(){
 for(let i=0;i<75;i++){
  try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(1500)});if(r.ok)return;}catch{}
  await delay(600);
 }
 throw Error('Ephemeral Worker did not start on '+base);
}
await waitForWorker();
const health=await call('/health');
assert.equal(health.features?.artMediaUpload,true,'The public /health must advertise artwork upload compatibility');
assert.equal(health.features?.artBombPlace,true);
assert.equal(health.features?.gmReset,true);
const guest='Smoke-'+randomUUID().slice(0,8);
const join=await call('/api/join',{name:guest,color:'#43b59a'});
assert.equal(join.role,'fighter');
const token=join.token;
assert.ok(token);
// The authoritative API deliberately refuses game actions until the player
// opens the real socket and submits a validated initial position.
const socket=new WebSocket(base.replace(/^http/,'ws')+'/api/socket?token='+encodeURIComponent(token));
await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
socket.send(JSON.stringify({type:'state',data:{position:PLAYER_SPAWNS[0],rotation:0,animation:'idle',visible:true}}));
await delay(250);
const act=async(action,extra={})=>call('/api/action',{action,requestId:randomUUID(),...extra},token);
const denied=await call('/api/action',{action:'recover-artworks',requestId:randomUUID()},token,{expectedStatus:400});
assert.match(denied.error,/GM only/i);

// Live WRITE on real Worker with a persistent world + player profile.
const started=await act('write-begin');
assert.ok(started.journey?.start);
const premature=await call('/api/action',{action:'write-drink',duration:.2,requestId:randomUUID()},token,{expectedStatus:400});
assert.match(premature.error,/Wait until/);
await delay(3100);
const drank=await act('write-drink',{duration:.2});
assert.ok(drank.journey?.drinkAt);
await delay(3950); // The server-authoritative WRITE journey must reach the ground before planting.
const planted=await act('plant',{text:'Local integration smoke '+guest,position:[0,0,0]});
assert.ok(planted.plant?.id,JSON.stringify(planted));
const worldAfterPlant=await call('/api/world',undefined,token);
assert.ok(worldAfterPlant.world.plants.some(p=>p.id===planted.plant.id));

// 1x1 valid PNG; backend checks authenticated session and media provenance.
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=','base64'));
const uploaded=await call('/api/art-media',png,token,{raw:true,type:'image/png'});
assert.ok(uploaded.id);
const build=await act('publish-art-bomb',{artwork:{title:'Guest smoke art',mediaId:uploaded.id,position:[-17,1.5,22],appearance:{depth:.1}},size:1.5});
assert.ok(build.artwork?.bomb,JSON.stringify(build));
assert.equal(build.artwork.owner,join.self.key);
const resized=await act('resize-art-bomb',{id:build.artwork.id,size:2});
assert.equal(resized.artworkLayout.scale[0],2);
const final=await call('/api/world',undefined,token);
assert.ok(final.world.customArtworks.some(a=>a.id===build.artwork.id));
assert.ok(final.world.artworkLayout[build.artwork.id].scale[0]===2);
console.log(JSON.stringify({ok:true,guest,role:join.role,write:planted.plant.id,artwork:build.artwork.id,size:2}));
socket.close();
