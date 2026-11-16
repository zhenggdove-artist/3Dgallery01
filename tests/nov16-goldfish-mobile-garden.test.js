import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,validateState,worldView} from '../src/shared/temple-rules.js';
import {itemById,ITEMS,SHOP_ITEMS} from '../src/shared/catalog.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {GOLDFISH_SWIM_MS} from '../src/shared/weapon-abilities.js';

const NOW=990000;
const fighter=(key='caster',position=[75,0,0])=>({key,name:key,color:'#ffffff',role:'fighter',position,admin:false});
function game(weapon='goldfish',monsterZ=12){
 const world=createInitialWorld(NOW),actor=fighter(),profile=ensureProfile(world,actor.key,actor.name,actor.color,NOW);
 profile.inventory.push(weapon);profile.equipment.weapon=weapon;
 world.monster={id:'target-monster',active:true,model:'uncle',variant:'uncle',position:[75,0,monsterZ],hp:100000,maxHp:100000,skills:[],nextAttackAt:NOW+100000};
 return {world,actor,profile};
}
const shoot=(w,a,now,extra={},rng=()=>.5,actors=[a])=>applyAction(w,a,{action:'attack',direction:[0,0,1],...extra},{now,actors,rng});

test('giant goldfish creates a visible swimming fish and swept damage/knockback collider',()=>{
 const {world,actor}=game();
 assert.equal(shoot(world,actor,NOW+1000,{phase:'charge'}).charging,true);
 const result=shoot(world,actor,NOW+2700,{charge:1});
 assert.equal(result.attackEvent?.ultimate,true);
 assert.equal(result.attackEvent?.area,null);
 const fx=world.persistentAttacks.find(a=>a.kind==='goldfish');
 assert.ok(fx);
 assert.ok(fx.expiresAt-fx.createdAt>=GOLDFISH_SWIM_MS);
 const scene=new THREE.Scene(),effects=new WeaponSignatureEffects(scene);
 assert.equal(effects.play(result.attackEvent,itemById('goldfish')),true);
 const mesh=effects.active.at(-1).obj;
 assert.equal(mesh.name,'Translucent spectral goldfish swimming forward');
 assert.ok(mesh.children[0].children.length>12);
 effects.update(.4);
 assert.ok(mesh.position.z>0,'the visible fish must swim forward');
 const hp=world.monster.hp,originalZ=world.monster.position[2];
 tickWorld(world,{now:NOW+3500,actors:[actor],rng:()=>.5,activeFighters:0});
 assert.ok(world.monster.hp<hp,'server fish collides and damages');
 assert.ok(world.monster.position[2]>originalZ,'fish knocks monster back');
 assert.ok(worldView(world,actor.key,NOW+3500).damageEvents.some(e=>e.kind==='giant-goldfish'));
 effects.dispose();
 assert.equal(scene.children.length,0);
});

test('goldfish collision damages and knocks back other players, but not its caster',()=>{
 const {world,actor}=game();world.monster.active=false;
 const victim=fighter('victim',[75,0,10]),p=ensureProfile(world,victim.key,victim.name,victim.color,NOW);
 shoot(world,actor,NOW+1000,{phase:'charge'});
 shoot(world,actor,NOW+2700,{charge:1},()=>.5,[actor,victim]);
 const hp=p.hp;
 tickWorld(world,{now:NOW+3500,actors:[actor,victim],activeFighters:0,rng:()=>.5});
 assert.ok(p.hp<hp);
 assert.equal(p.hitReaction.knockback,14);
 assert.equal(world.profiles.caster.hp,100);
});

test('shotgun damage has a threefold or greater random swing and deals more at point blank',()=>{
 const damageAt=(z,rng)=>{
  const {world,actor}=game('calico-cat',z);
  const before=world.monster.hp;
  const result=shoot(world,actor,NOW+2000,{},()=>rng);
  assert.equal(result.attackEvent.pellets.length,20);
  assert.equal(world.monster.hp,before);
  tickWorld(world,{now:NOW+2380,actors:[actor],rng:()=>rng,activeFighters:0});
  return before-world.monster.hp;
 };
 const close=damageAt(3,.5),far=damageAt(9,.5);
 assert.ok(close>far,'damage must fall off with distance');
 const low=damageAt(3,0),high=damageAt(3,1);
 assert.ok(high>=low*3,'pellet random damage swing must be at least 3x');
});

test('farming seeds and harvests are absent but WRITE message plants stay live',()=>{
 assert.equal(itemById('seed-1'),null);
 assert.equal(itemById('harvest-1'),null);
 assert.ok(ITEMS.every(item=>!['seed','harvest'].includes(item.slot)));
 assert.ok(SHOP_ITEMS.every(item=>!['seed','harvest'].includes(item.slot)));
 const world=createInitialWorld(NOW),actor=fighter('writer',[0,0,0]);
 const result=applyAction(world,actor,{action:'plant',text:'Message tree remains',position:[2,0,0]},{now:NOW});
 assert.equal(result.error,undefined);
 assert.equal(world.plants.length,1);
 assert.equal(applyAction(world,actor,{action:'seed-plant',item:'seed-1',position:[0,0,3]},{now:NOW+1000}).error,'Unknown action');
});

test('network validation accepts buffered movement and server-authorized knockback but rejects teleports',()=>{
 const p={position:[0,0,0],rotation:0,animation:'idle'};
 const normal=validateState(p,{...p,position:[5,0,0]},100,'fighter',null,null,NOW);
 assert.equal(normal.error,undefined);
 const bad=validateState(p,{...p,position:[25,0,0]},100,'fighter',null,null,NOW);
 assert.equal(bad.error,'Movement rejected');
 assert.deepEqual(bad.state,p,'the rejected packet must include an authoritative rebase position');
 const hit={stats:{speed:1,impulse:0},hitReaction:{time:NOW-120}};
 const bumped=validateState(p,{...p,position:[9,0,0]},100,'fighter',null,null,NOW,hit);
 assert.equal(bumped.error,undefined);
 const respawn={...hit,lastRespawnAt:NOW-2000};
 const moved=validateState({...p,position:[35,0,0]},{...p,position:[0,0,0]},100,'fighter',[0,0,0],null,NOW,respawn);
 assert.equal(moved.error,undefined);
 assert.equal(validateState(p,{...p,position:[NaN,0,0]},100).error,'Invalid position');
});
