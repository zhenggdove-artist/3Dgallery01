import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import WebSocket from 'ws';
import {PLAYER_SPAWNS} from '../src/shared/arena.js';
import {applyWorldPatch} from '../src/shared/world-patch.js';

const entry=fileURLToPath(new URL('../cloudflare/worker.js',import.meta.url));
const legacy=Array.from({length:300},(_,i)=>({id:'legacy-stroke-'+i,ownerKey:'fixture-old-owner',ownerEpoch:0,color:'#ff00aa',normal:[0,0,1],size:.4,thickness:.34,points:Array.from({length:32},(_,j)=>[j*.1,20,30+i%20])}));
const seed=JSON.stringify(legacy),drops=PLAYER_SPAWNS.map((position,i)=>({id:'fixture-pickup-'+i,kind:'coin',amount:17,position:[...position],createdAt:Date.now(),expiresAt:Date.now()+600000}));
const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',target:'es2022',external:['cloudflare:workers'],logLevel:'error',plugins:[{name:'isolated-paint-fixture',setup(b){b.onLoad({filter:/[/\\]worker\.js$/},args=>{
 const original=readFileSync(args.path,'utf8'),anchor='JSON.stringify(createInitialWorld())';
 assert.equal(original.split(anchor).length,2);
 return {contents:original.replace(anchor,'JSON.stringify({...createInitialWorld(),spacePaint:'+seed+',spacePaintRevision:1,groundDrops:'+JSON.stringify(drops)+'})'),loader:'js',resolveDir:dirname(args.path)};
});}}]});
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'v119-paint-fixture',modules:[{type:'ESModule',path:'worker.mjs',contents:bundle.outputFiles[0].text}],compatibilityDate:'2026-10-13',bindings:{TEMPLE_ADMIN_KEY:'local-fixture-only'},durableObjects:{TEMPLE_ROOM:{className:'TempleRoom',useSQLite:true}}}],host:'127.0.0.1',port:0}));
let socket;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(get){const end=Date.now()+10000;for(;;){const v=get();if(v)return v;if(Date.now()>end)throw Error('Timed out waiting for paint synchronization');await delay(20);}}
try{
 const base=await mf.ready;
 async function call(path,body,token){const res=await fetch(new URL(path,base),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await res.json();assert.ok(res.ok,path+': '+data.error);return data;}
 const health=await call('/health');assert.equal(health.features.paintArchiveDeployV119,true);assert.equal(health.features.pickupHotPathV124,true);
 const join=await call('/api/join',{name:'Ely',color:'#43b59a',memoryCode:'local-fixture-only'});
 assert.equal(join.self.profile.admin,true);assert.equal(join.paintArchiveV118,true);
 assert.deepEqual(join.world.spacePaint,legacy);
 const url=new URL('/api/socket',base);url.protocol='ws:';url.searchParams.set('token',join.token);url.searchParams.set('patch','2');url.searchParams.set('surfaceDelta','1');url.searchParams.set('paintDelta','1');
 let world,delta;const messages=[];
 socket=new WebSocket(url);socket.on('message',raw=>{const msg=JSON.parse(String(raw));messages.push(msg);if(msg.type==='welcome')world=msg.data.world;else if(msg.type==='world')world=msg.data;else if(msg.type==='world-patch'){world=applyWorldPatch(world,msg.data);if(msg.data.spaceGeometry)delta=msg.data.spaceGeometry;}});
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 const welcome=await until(()=>messages.find(m=>m.type==='welcome'));assert.equal(welcome.data.paintArchiveV118,true);
 socket.send(JSON.stringify({type:'state',data:{position:PLAYER_SPAWNS[join.seat],rotation:0,animation:'idle',visible:true,seq:1}}));
 await until(()=>messages.find(m=>m.type==='state-ack'&&m.data.seq===1));
 const stroke={id:'fixture-new-stroke',color:'#abcdef',size:.4,thickness:.34,normal:[0,0,1],points:[[1,10,3],[2,10,3],[3,10,3]]};
 const act=(action,data)=>call('/api/action',{action,requestId:crypto.randomUUID(),paintDeltaV118:true,...data},join.token);
 const added=await act('gm-paint-3d',{stroke});assert.equal(added.spacePaintStroke.ownerKey,join.self.key);assert.ok(Number.isFinite(added.worldRevision));
 await until(()=>world?.spacePaint?.length===301);assert.equal(delta.add.length,1);assert.equal(delta.add[0].id,stroke.id);
 const saved=(await call('/api/world',undefined,join.token)).world.spacePaint;assert.deepEqual(saved.slice(0,300),legacy);assert.equal(saved[300].id,stroke.id);
 const erased=await act('gm-erase-3d',{id:stroke.id});assert.ok(erased.erasedStroke);
 await act('gm-edit-3d',{remove:[],add:[erased.erasedStroke]});
 assert.equal((await call('/api/world',undefined,join.token)).world.spacePaint.length,301);
 console.log('Actual isolated Durable Object API accepted 301 strokes / 9603 points, preserved legacy paint, synchronized one appended stroke and passed erase/redo.');
 const dropId='fixture-pickup-'+join.seat,requestId=crypto.randomUUID(),packet={type:'combat-action',data:{action:'pickup-drop',dropId,requestId,fastActionV087:true,paintDeltaV118:true}};
 const beforePickup=performance.now();
 socket.send(JSON.stringify(packet));
 const receipt=await until(()=>messages.find(m=>m.type==='combat-result'&&m.data.requestId===requestId));
 assert.equal(receipt.data.status,200,JSON.stringify(receipt.data));assert.equal(receipt.data.result.world,undefined);
 await until(()=>world&&world.revision>=receipt.data.result.worldRevision&&!world.groundDrops.some(d=>d.id===dropId));
 const after=(await call('/api/world',undefined,join.token)).world;
 assert.equal(after.spacePaint.length,301);assert.deepEqual(after.spacePaint.slice(0,300),legacy);
 assert.equal(after.pickupReceipts.filter(r=>r.id===dropId).length,1);
 const receiptCount=messages.filter(m=>m.type==='combat-result'&&m.data.requestId===requestId).length;
 socket.send(JSON.stringify(packet));await until(()=>messages.filter(m=>m.type==='combat-result'&&m.data.requestId===requestId).length>receiptCount);
 const duplicate=(await call('/api/world',undefined,join.token)).world;assert.equal(duplicate.pickupReceipts.filter(r=>r.id===dropId).length,1);
 console.log('V124 loaded-room pickup and idempotent receipt verified, including world reads and replay; elapsedMs='+Math.round(performance.now()-beforePickup));
}finally{socket?.close();await mf.dispose();}
