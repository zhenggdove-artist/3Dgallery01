import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {ITEMS,itemById} from '../src/shared/catalog.js';
const T=97000000,actor={key:'v089',name:'V089',color:'#abcdef',role:'fighter',position:[75,0,0]};
function fixture(){const world=createInitialWorld(T),p=ensureProfile(world,actor.key,actor.name,actor.color,T);const act=(body,now=T+1000)=>applyAction(world,actor,body,{now,actors:[actor],rng:()=>.5});return {world,p,act};}
test('a full-health heart is collected once and produces its normal pickup receipt without a warning',()=>{
 const {world,p,act}=fixture();assert.equal(p.hp,p.maxHp);
 world.groundDrops.push({id:'full-heart',kind:'heart',amount:25,position:[...actor.position],expiresAt:T+10000});
 const result=act({action:'pickup-drop',dropId:'full-heart'});
 assert.equal(result.error,undefined);assert.equal(result.notice,undefined);assert.equal(p.hp,p.maxHp);
 assert.equal(world.groundDrops.some(d=>d.id==='full-heart'),false);
 assert.ok(world.pickupReceipts.some(d=>d.id==='full-heart'));
 assert.match(act({action:'pickup-drop',dropId:'full-heart'}).error,/gone/);
 assert.ok(act({action:'attack',charge:0,direction:[0,0,1]},T+2000).attackEvent);
});
test('all health and mana consumables are consumed at full resource without over-cap stats or warnings',()=>{
 for(const item of ITEMS.filter(i=>i.slot==='consumable'&&(i.healFraction>0||i.manaFraction>0))){
  const {p,act}=fixture();p.inventory.push(item.id,item.id);p.quickSlots[0]=item.id;
  const result=act({action:'use-consumable',slot:0});
  assert.equal(result.error,undefined,item.id);assert.equal(result.notice,undefined,item.id);
  assert.equal(result.remaining,1,item.id);assert.equal(p.hp,p.maxHp);assert.equal(p.mana,p.maxMana);
  assert.match(act({action:'use-consumable',slot:0},T+1001).error,/cooling down/);
 }
});
test('atomic charged first pulse requires full server charge and applies the same event and mana as the two-stage flow',()=>{
 for(const id of ['tide-1','ember-1','prism-1','bloom-1','storm-1','nova-1']){
  const a=fixture(),b=fixture();for(const f of [a,b]){f.p.inventory.push(id);f.p.equipment.weapon=id;assert.equal(f.act({action:'attack',phase:'charge'},T+1000).charging,true);}
  const ready=T+1000+itemById(id).chargeMs,body={action:'attack',phase:'channel',charge:1,direction:[0,0,1]};
  assert.match(a.act({...body,startChannelV089:true},ready-1).error,/100%/);
  assert.equal(a.p.channelWeapon??null,null);
  assert.equal(b.act({action:'attack',phase:'channel-start'},ready).channeling,true);
  const old=b.act(body,ready),next=a.act({...body,startChannelV089:true},ready);
  assert.equal(next.error,undefined,id);assert.equal(next.channeling,true,id);assert.ok(next.attackEvent?.ultimate&&next.attackEvent?.channel,id);
  assert.equal(next.attackEvent.manaCost,old.attackEvent.manaCost,id);
  assert.equal(next.attackEvent.damage,old.attackEvent.damage,id);assert.equal(a.p.mana,b.p.mana,id);
  assert.equal(a.act({action:'attack',phase:'channel-stop'},ready+20).channeling,false);
 }
});
test('automatic drops do not capture attack input and full hearts are eligible',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/if\(nearbyArt\?\.type==='artwork'\)\s*pendingAInteraction=nearbyArt/);
 assert.doesNotMatch(source,/d\.kind!=='heart'\|\|world\.profile\.hp/);
 assert.match(source,/\^Weapon is recovering\$/);
 assert.ok(source.indexOf('chargeStarted=started;\n chargeRequest=sendAction')>0);
});
