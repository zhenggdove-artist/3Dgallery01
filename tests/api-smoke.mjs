import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {PLATFORMS,PLAYER_SPAWNS} from '../src/shared/arena.js';
import {ECONOMY} from '../src/shared/catalog.js';

const base=process.env.TEMPLE_API||'http://127.0.0.1:8787';
const origin=process.env.TEMPLE_ORIGIN||'http://127.0.0.1:8000';
const clients=[];

async function request(path,{method='GET',body,token}={}){
  const headers={Origin:origin};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization=`Bearer ${token}`;
  const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));return {status:response.status,ok:response.ok,data};
}

async function join(index,saveCode=''){
  const response=await request('/api/join',{method:'POST',body:{name:`ApiTest${index}`,color:`#${(0x718899+index*0x010101).toString(16).slice(-6)}`,saveCode,adminKey:''}});
  assert.equal(response.status,200,JSON.stringify(response.data));const client={...response.data,index,ws:null};clients.push(client);return client;
}

async function connect(client){
  const url=new URL(base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/api/socket';url.searchParams.set('token',client.token);
  client.ws=new WebSocket(url,{headers:{Origin:origin}});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('WebSocket welcome timeout')),8000);client.ws.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='welcome'){clearTimeout(timer);resolve();}});client.ws.once('error',reject);});
}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function sendState(client,position,animation='idle'){client.ws.send(JSON.stringify({type:'state',data:{position,rotation:0,animation,visible:true}}));}

async function walkTo(client,target){
  const start=PLAYER_SPAWNS[client.seat];sendState(client,[...start]);await delay(120);
  const distance=Math.hypot(target[0]-start[0],target[1]-start[1],target[2]-start[2]),steps=Math.ceil(distance/18);
  for(let step=1;step<=steps;step++){await delay(1350);sendState(client,start.map((value,axis)=>value+(target[axis]-value)*step/steps),'run');}
  await delay(180);
}

async function action(client,actionName,data={}){return request('/api/action',{method:'POST',token:client.token,body:{action:actionName,requestId:crypto.randomUUID(),...data}});}

let restored;
try{
  const joined=[];for(let index=0;index<6;index++){const client=await join(index);await connect(client);joined.push(client);}
  assert.deepEqual(joined.map(client=>client.role),['fighter','fighter','fighter','fighter','spectator','spectator']);
  assert.deepEqual(joined.map(client=>client.seat),[0,1,2,3,4,5]);
  const overflow=await request('/api/join',{method:'POST',body:{name:'Overflow',color:'#abcdef',saveCode:'',adminKey:''}});
  assert.equal(overflow.status,409);assert.match(overflow.data.error,/full/i);

  sendState(joined[4],[...PLAYER_SPAWNS[4]]);await delay(150);
  const spectatorMutation=await action(joined[4],'pickup-coin',{platformId:PLATFORMS[0].id});
  assert.equal(spectatorMutation.status,400);assert.match(spectatorMutation.data.error,/Spectators/);

  const target=[...PLATFORMS[0].coinPosition];await Promise.all([walkTo(joined[0],target),walkTo(joined[1],target)]);
  const before=await request('/api/world',{token:joined[0].token});assert.equal(before.status,200);assert.ok(before.data.players.slice(0,2).every(player=>player.state?.position));
  const claims=await Promise.all([action(joined[0],'pickup-coin',{platformId:PLATFORMS[0].id}),action(joined[1],'pickup-coin',{platformId:PLATFORMS[0].id})]);
  assert.deepEqual(claims.map(result=>result.status).sort(),[200,400]);
  const winner=claims[0].ok?joined[0]:joined[1],winnerResponse=claims.find(result=>result.ok);
  assert.equal(winnerResponse.data.world.profile.wallet,80+ECONOMY.platformCoinValue);

  const chat=await request('/api/chat',{method:'POST',token:winner.token,body:{text:'Temple API smoke'}});assert.equal(chat.status,200);
  const codeResponse=await request('/api/save-code',{method:'POST',token:winner.token,body:{}});assert.equal(codeResponse.status,200);assert.match(codeResponse.data.code,/^[A-Z2-9]{4}$/);
  await request('/api/disconnect',{method:'POST',token:winner.token,body:{}});winner.ws.close();
  restored=await join(9,codeResponse.data.code);await connect(restored);assert.equal(restored.world.profile.wallet,80+ECONOMY.platformCoinValue);assert.ok(restored.world.profile.inventory.includes('tide-1'));assert.equal(restored.self.name,winner.self.name);assert.equal(restored.self.color,winner.self.color);
  await request('/api/disconnect',{method:'POST',token:joined[2].token,body:{}});joined[2].ws.close();const promoted=await request('/api/role',{method:'POST',token:joined[4].token,body:{role:'fighter'}});assert.equal(promoted.status,200);assert.equal(promoted.data.role,'fighter');assert.ok(promoted.data.seat<4);

  console.log(JSON.stringify({ok:true,seats:joined.map(({role,seat})=>({role,seat})),atomicCoinStatuses:claims.map(result=>result.status),wallet:restored.world.profile.wallet,saveCodeRestored:true,savedIdentityRestored:true,spectatorPromoted:true},null,2));
}finally{
  for(const client of clients){try{client.ws?.close();}catch{}try{await request('/api/disconnect',{method:'POST',token:client.token,body:{}});}catch{}}
}
