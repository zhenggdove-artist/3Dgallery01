import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {CITY_LOTS,cityBlocked} from '../src/shared/city-layout.js';
import {PLAYER_SPAWNS} from '../src/shared/arena.js';
import {applyWorldPatch} from '../src/shared/world-patch.js';
const base=process.env.TEMPLE_BACKEND||'http://127.0.0.1:8789',sleep=ms=>new Promise(r=>setTimeout(r,ms)),players=[];
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/,'load test is local only');
async function json(path,data,token){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:data?JSON.stringify(data):undefined});const body=await r.json();if(!r.ok)throw Error(body.error||r.status);return body;}
const action=(p,action,rest={})=>json('/api/action',{requestId:crypto.randomUUID(),action,...rest},p.token);
const p95=list=>Math.round([...list].sort((a,b)=>a-b)[Math.floor(list.length*.95)]||0);
try{
 for(let i=0;i<4;i++){
  const r=await json('/api/join',{name:`Local Room Profile ${i}`,color:'#43b59a'});
  const p={token:r.token,seq:0,sent:new Map(),latency:[],patchBytes:0,fullBytes:0,patches:0,rejections:[],state:[...PLAYER_SPAWNS[r.seat]],seat:r.seat};players.push(p);
  assert.equal(r.role,'fighter');
  const ws=p.ws=new WebSocket(base.replace('http','ws')+'/api/socket?patch=1&token='+r.token);
  ws.on('message',data=>{const m=JSON.parse(data);if(m.type==='welcome')p.world=m.data.world;if(m.type==='world'){p.world=m.data;p.fullBytes+=data.length;}if(m.type==='world-patch'){const n=applyWorldPatch(p.world,m.data);assert.ok(n,'world delta baseline intact');p.world=n;p.patchBytes+=data.length;p.patches++;}if(m.type==='state-ack'&&p.sent.has(m.data.seq)){p.latency.push(performance.now()-p.sent.get(m.data.seq));p.sent.delete(m.data.seq);p.ack=m.data;}if(m.type==='state-rejected')p.rejections.push(m.data.error);});
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 }
 function send(p){const seq=++p.seq;p.sent.set(seq,performance.now());p.ws.send(JSON.stringify({type:'state',data:{seq,position:p.state,rotation:0,animation:'walk'}}));}
 // Each fighter walks at 7.5m/s on a different unobstructed radial path.
 for(const p of players){
  const [sx,,sz]=p.state;
  for(let offset=-3;offset<=3;offset++){
   const a=p.seat*Math.PI/2+offset*.12,dx=Math.cos(a),dz=Math.sin(a);
   for(let d=0;d<155;d+=.25)if(cityBlocked(sx+d*dx,sz+d*dz,0,{},1.6)){
    if(!p.distance||d-.5<p.distance){p.distance=d-.5;p.dir=[dx,0,dz];}break;
   }
  }
  assert.ok(p.distance>50);send(p);
 }
 await sleep(150);
 const steps=Math.ceil(Math.max(...players.map(p=>p.distance))/.75);
 for(let j=0;j<steps;j++){for(const p of players){const [sx,,sz]=PLAYER_SPAWNS[p.seat],d=Math.min(p.distance,j*.75);p.state=[sx+p.dir[0]*d,0,sz+p.dir[2]*d];send(p);}await sleep(100);}
 const idle=players.flatMap(p=>p.latency.splice(0));
 for(let round=0;round<3;round++){
  await Promise.all(players.map(p=>action(p,'attack',{phase:'charge'})));
  for(let j=0;j<18;j++){players.forEach(send);await sleep(100);}
  await Promise.all(players.map(async p=>{const a=performance.now();const r=await action(p,'attack',{charge:1,direction:p.dir});(p.actionTimes??=[]).push(performance.now()-a);p.hits=(p.hits||0)+(r.structureHits?.length||0); }));
  for(let j=0;j<8;j++){players.forEach(send);await sleep(100);}
 }
 const result={fighters:players.length,cityLots:CITY_LOTS.length,walkAckP95:p95(idle),combatAckP95:p95(players.flatMap(p=>p.latency)),actionP95:p95(players.flatMap(p=>p.actionTimes)),hits:players.reduce((s,p)=>s+p.hits,0),patches:players.reduce((s,p)=>s+p.patches,0),patchBytes:players.reduce((s,p)=>s+p.patchBytes,0),rejections:players.flatMap(p=>p.rejections)};
 console.log(JSON.stringify(result));assert.ok(result.hits>0);assert.ok(result.patches>0);assert.deepEqual(result.rejections,[]);
}finally{await Promise.all(players.map(async p=>{p.ws?.close();await fetch(base+'/api/disconnect?token='+p.token,{method:'POST',body:'{}'}).catch(()=>{});}));}
