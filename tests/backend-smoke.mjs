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
assert.equal(join.self.profile.equipment.weapon,'white-cat','new players must spawn equipped with the SMG');
assert.ok(join.world.profile.inventory.includes('white-cat'),'the starter SMG must be owned');
const deniedGmHistory=await call('/api/gm/presence',undefined,token,{expectedStatus:403});
assert.match(deniedGmHistory.error,/GM only/i,'regular players may not view private GM login history');
if(process.env.TEMPLE_TEST_ADMIN_KEY){
 const gm=await call('/api/join',{name:'Ely',color:'#43b59a',memoryCode:process.env.TEMPLE_TEST_ADMIN_KEY});
 assert.equal(gm.self.profile.admin,true);
 const history=await call('/api/gm/presence',undefined,gm.token);
 assert.ok(history.online.some(p=>p.name===guest));
 assert.ok(history.events.some(e=>e.name===guest&&e.event==='online'));
 assert.ok(history.events.some(e=>e.name==='Ely'&&e.event==='online'));
 // The GM soundtrack upload serves Safari-compatible range reads even
 // across the 512 KiB SQLite chunk boundary.
 const soundtrack=Buffer.alloc(540_000);
 for(let i=0;i<soundtrack.length;i++)soundtrack[i]=i%251;
 soundtrack[0]=73;soundtrack[1]=68;soundtrack[2]=51; // ID3
 const deniedMusic=await call('/api/gm/music',soundtrack,token,{raw:true,type:'audio/mpeg',expectedStatus:403});
 assert.match(deniedMusic.error,/GM only/i);
 const uploadedMusic=await call('/api/gm/music',soundtrack,gm.token,{raw:true,type:'audio/mpeg'});
 assert.ok(uploadedMusic.version>0);
 assert.equal(uploadedMusic.bytes,soundtrack.length);
 const soundtrackResponse=await fetch(base+'/api/gm/music?v='+uploadedMusic.version,{
  headers:{Range:'bytes=524276-524300'},signal:AbortSignal.timeout(15000)});
 assert.equal(soundtrackResponse.status,206);
 assert.equal(soundtrackResponse.headers.get('Content-Range'),'bytes 524276-524300/540000');
 assert.equal(soundtrackResponse.headers.get('Content-Type'),'audio/mpeg');
 assert.deepEqual(Buffer.from(await soundtrackResponse.arrayBuffer()),soundtrack.subarray(524276,524301));
 const musicWorld=await call('/api/world',undefined,token);
 assert.equal(musicWorld.world.musicVersion,uploadedMusic.version);
 await call('/api/disconnect',{},gm.token);
 const gmAgain=await call('/api/join',{name:'Ely',color:'#43b59a',memoryCode:process.env.TEMPLE_TEST_ADMIN_KEY});
 const historyAgain=await call('/api/gm/presence',undefined,gmAgain.token);
 assert.ok(historyAgain.events.some(e=>e.name==='Ely'&&e.event==='offline'),'GM should see persisted logout events');
 await call('/api/disconnect',{},gmAgain.token);
}
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
// One room admits exactly 4 playable fighters and 100 camera-only viewers.
// All 103 remaining entrants share the same simulated client IP, ensuring
// the join throttle does not silently cap a school/gallery's shared network.
const seats=new Set([join.seat]),watchers=[];
for(let i=0;i<103;i++){
 const entrant=await call('/api/join',{name:'Capacity-'+String(i).padStart(3,'0'),color:'#43b59a'});
 assert.equal(entrant.role,i<3?'fighter':'spectator','four fighter seats are reserved');
 assert.ok(!seats.has(entrant.seat),'every active session has a unique seat');
 seats.add(entrant.seat);
 if(entrant.role==='spectator')watchers.push(entrant);
}
assert.equal(seats.size,104);
assert.equal(watchers.length,100);
const blocked=await call('/api/join',{name:'Capacity-full',color:'#43b59a'},null,{expectedStatus:409});
assert.match(blocked.error,/4 fighters \+ 100 spectators/);
const noFighter=await call('/api/role',{role:'fighter'},watchers[0].token,{expectedStatus:409});
assert.match(noFighter.error,/fighter seats/);
await call('/api/disconnect',{},token);
const promoted=await call('/api/role',{role:'fighter'},watchers[0].token);
assert.equal(promoted.role,'fighter');
assert.equal(promoted.seat,join.seat,'released fighter seat is available for promotion');
console.log(JSON.stringify({ok:true,guest,role:join.role,write:planted.plant.id,artwork:build.artwork.id,size:2,capacity:104,spectators:100}));
socket.close();
