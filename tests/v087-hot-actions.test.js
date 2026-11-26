import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {TempleNetwork} from '../src/network.js';
import {isRealtimeAction} from '../src/shared/realtime-actions.js';
globalThis.crypto??=webcrypto;
globalThis.WebSocket??={OPEN:1};
test('equip, pickups, and consumables use negotiated realtime actions with no full HTTP snapshot',async()=>{
 const network=new TempleNetwork({backendUrl:'https://example.invalid'}),packets=[];
 const socket={readyState:1,send:s=>packets.push(JSON.parse(s))};network.socket=socket;network.fastActionsV087=true;network.compactCombat=true;network.wireWorld={revision:9};
 network.request=()=>{throw Error('HTTP should not be used');};
 for(const action of ['attack','equip','unequip','inspect-item','pickup-coin','pickup-drop','pickup-artwork','use-consumable','assign-consumable']){
  assert.equal(isRealtimeAction(action),true);
  const promise=network.action(action);const p=packets.at(-1);
  assert.equal(p.data.action,action);assert.equal(p.data.fastActionV087,true);
  network.resolveCombatSocket(socket,{requestId:p.data.requestId,status:200,result:{ok:true,worldRevision:9}});
  assert.equal((await promise).worldRevision,9);
 }
 assert.equal(network.combatPending.size,0);
});
test('commercial, GM, and media actions never enter the fast mutation allowlist',()=>{
 for(const action of ['buy','sell','fuse','gm-wing-publish','gm-shop-delist','add-artwork','gm-equipment-tuning','redeem-wing-design'])assert.equal(isRealtimeAction(action),false);
});
