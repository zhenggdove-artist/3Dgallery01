import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {TempleNetwork} from '../src/network.js';
globalThis.crypto??=webcrypto;
globalThis.WebSocket??={OPEN:1};
const fake=()=>{const network=new TempleNetwork({backendUrl:'https://example.invalid'}),packets=[];const socket={readyState:WebSocket.OPEN,send:s=>packets.push(JSON.parse(s))};network.socket=socket;network.compactCombat=true;network.combatSocketActions=true;network.wireWorld={revision:100};return {network,socket,packets};};
test('all attack phases use the negotiated socket and authoritative response',async()=>{
 const {network,socket,packets}=fake();network.request=()=>{throw Error('unexpected HTTP');};
 for(const phase of [undefined,'charge','channel-start','channel','channel-stop']){
  const pending=network.action('attack',{phase,origin:[1,2,3],direction:[0,0,1]});
  const packet=packets.at(-1);assert.equal(packet.type,'combat-action');assert.equal(packet.data.phase,phase);assert.equal(packet.data.compactCombat,true);
  network.resolveCombatSocket({}, {requestId:packet.data.requestId,status:200,result:{wrong:true}});
  assert.equal(network.combatPending.size,1);
  network.resolveCombatSocket(socket,{requestId:packet.data.requestId,status:200,result:{ok:true,worldRevision:100}});
  assert.deepEqual(await pending,{ok:true,worldRevision:100});assert.equal(network.combatPending.size,0);
 }
 assert.equal(network.actionTimings.length,5);assert.ok(network.actionTimings.every(t=>t.transport==='ws'));
});
test('rejected and disconnected attacks are not replayed',async()=>{
 const {network,socket,packets}=fake();network.request=()=>{throw Error('unexpected retry');};
 let pending=network.action('attack',{phase:'charge'});
 network.resolveCombatSocket(socket,{requestId:packets.at(-1).data.requestId,status:400,result:{error:'Not enough mana'}});
 await assert.rejects(pending,/Not enough mana/);
 pending=network.action('attack');network.rejectCombatSocket(socket);
 await assert.rejects(pending,/interrupted/);assert.equal(network.combatPending.size,0);assert.equal(packets.length,2);
});
test('older servers, disconnected sockets and noncombat actions keep HTTP',async()=>{
 const {network,socket,packets}=fake();const requests=[];
 network.request=async (path,options)=>{requests.push({path,body:options.body});return {ok:true};};
 network.combatSocketActions=false;await network.action('attack',{phase:'charge'});
 network.combatSocketActions=true;socket.readyState=3;await network.action('attack');
 socket.readyState=WebSocket.OPEN;await network.action('equip',{itemId:'saber-2'});
 assert.equal(packets.length,0);assert.deepEqual(requests.map(v=>v.body.action),['attack','attack','equip']);
 assert.ok(requests.every(v=>v.path==='/api/action'));
});
test('Worker transport shares the authoritative action and emits its event before world serialization',()=>{
 const worker=readFileSync(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
 assert.match(worker,/this\.action\(null,session,\{\.\.\.body,compactCombat:true\}\)/);
 assert.match(worker,/body\?\.action!=='attack'/);
 const start=worker.indexOf('async action(request,session,parsedBody=null)');
 const end=worker.indexOf('async saveCode(session)',start);const action=worker.slice(start,end);
 assert.ok(action.indexOf('transactionSync')<action.indexOf("this.broadcast('attack'"));
 assert.ok(action.indexOf("this.broadcast('attack'")<action.indexOf('this.broadcastWorld(world)'));
});
