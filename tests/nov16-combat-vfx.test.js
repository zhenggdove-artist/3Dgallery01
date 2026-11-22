import test from 'node:test';
import assert from 'node:assert/strict';
import {calicoPellets,CALICO_PELLET_COUNT} from '../src/shared/calico-pellets.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {ENEMY_RADIUS,ENEMY_HEIGHT} from '../src/shared/island-combat.js';
import {WeaponParticleEffects,recipeFor} from '../src/weapon-particle-effects.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import * as THREE from 'three';

const start=310000;
const fighter=(key,x=75,z=0)=>({key,name:key,color:'#ffffff',role:'fighter',position:[x,0,z],admin:false});
function worldWithCat(){
 const world=createInitialWorld(start);
 const shooter=fighter('shooter');
 const profile=ensureProfile(world,shooter.key,shooter.name,shooter.color,start);
 profile.inventory.push('calico-cat');profile.equipment.weapon='calico-cat';
 world.monster={id:'uncle',active:true,variant:'uncle',model:'uncle',position:[75,0,8],hp:800,maxHp:800,skills:[],nextAttackAt:start+10000};
 return {world,shooter,profile};
}
test('calico spread has exactly twenty independent, normalized lanes and charged reach stays short of the SMG',()=>{
 const normal=calicoPellets([0,0,1],false),charged=calicoPellets([0,0,1],true);
 assert.equal(CALICO_PELLET_COUNT,20);
 assert.equal(normal.length,20);assert.equal(charged.length,20);
 assert.equal(new Set(normal.map(p=>p.direction.join(','))).size,20);
 assert.ok(normal.every(p=>Math.abs(Math.hypot(...p.direction)-1)<1e-10));
 const divergence=r=>r.reduce((sum,p)=>sum+Math.hypot(p.direction[0],p.direction[1]),0);
 assert.ok(divergence(charged)>divergence(normal));
 const shotgun=itemById('calico-cat'),smg=itemById('white-cat');
 assert.equal(attackStats(shotgun,0).range,10);
 assert.equal(attackStats(shotgun,1).range,17);
 assert.ok(attackStats(shotgun,1).range<attackStats(smg,0).range);
 assert.ok(attackStats(shotgun,1).damage>attackStats(shotgun,0).damage);
});
test('all twenty overlapping shotgun pellets hit a sixfold uncle as twenty damage numbers',()=>{
 const {world,shooter}=worldWithCat();
 const before=world.monster.hp;
 const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1],charge:0},{now:start+2000,rng:()=>.5,actors:[shooter]});
 assert.equal(result.attackEvent?.pellets?.length,20);
 assert.equal(result.monsterHits?.length,0,'no immediate impact on release');
 assert.equal(world.monster.hp,before);
 tickWorld(world,{now:start+2390,rng:()=>.5,actors:[shooter],activeFighters:0});
 assert.equal(world.monster.hp<before,true);
 const damage=worldView(world,shooter.key,start+2391).damageEvents.filter(e=>e.target==='uncle');
 assert.equal(damage.length,20);
 assert.equal(new Set(damage.map(e=>e.id)).size,20);
 assert.equal(world.monster.aggroTarget,shooter.key);
});
test('twenty pellet collisions can individually damage another fighter',()=>{
 const {world,shooter}=worldWithCat();world.monster.active=false;
 const target=fighter('victim',75,6);
 const victim=ensureProfile(world,target.key,target.name,target.color,start);
 // twenty independently travelling pellets must remain observable even after
 // the shotgun buff; a normal 100 HP victim dies before all twenty land.
 victim.level=300;victim.maxHp=1296;victim.hp=1296;
 const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1]},{now:start+2000,rng:()=>.5,actors:[shooter,target]});
 assert.equal(result.hits.length,0,'shot packets launch but cannot instantly hit');
 tickWorld(world,{now:start+2390,rng:()=>.5,actors:[shooter,target],activeFighters:0});
 assert.equal(worldView(world,target.key,start+2391).damageEvents.filter(e=>e.target===target.key).length,20);
});
test('stray shotgun particles outside the sixfold torso do not inflict phantom damage',()=>{
 const {world,shooter}=worldWithCat();world.monster.position=[87,0,8];
 const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1]},{now:start+2000,rng:()=>.5,actors:[shooter]});
 assert.equal(result.monsterHits.length,0);
 tickWorld(world,{now:start+2390,rng:()=>.5,actors:[shooter],activeFighters:0});
 assert.equal(world.monster.hp,800);
});
test('plant weapon roots a hit enemy and being hit triggers persistent pursuit',()=>{
 const world=createInitialWorld(start),shooter=fighter('gardener');
 const profile=ensureProfile(world,shooter.key,shooter.name,shooter.color,start);
 profile.inventory.push('planter-1');profile.equipment.weapon='planter-1';
 world.monster={id:'plant-target',active:true,variant:'uncle',model:'uncle',position:[75,0,4],hp:200,maxHp:200,skills:[],attackStyles:true,nextAttackAt:start+10000};
 const charge=applyAction(world,shooter,{action:'attack',phase:'charge'},{now:start+2000,rng:()=>.5,actors:[shooter]});
 assert.equal(charge.charging,true);
 const result=applyAction(world,shooter,{action:'attack',charge:1,direction:[0,0,1]},{now:start+6000,rng:()=>.5,actors:[shooter]});
 assert.equal(result.attackEvent?.ultimate,true);
 assert.equal(result.monsterHit,null,'damage waits for charged contact');
 tickWorld(world,{now:start+6250,rng:()=>.5,activeFighters:0,actors:[shooter]});
 assert.ok(world.monster.effects?.root?.until>start+6000,'only the charged planter roots');
 assert.equal(world.monster.aggroTarget,shooter.key);
 const before=world.monster.position.slice();
 tickWorld(world,{now:start+6500,rng:()=>.5,activeFighters:1,actors:[shooter]});
 assert.deepEqual(world.monster.position,before,'rooted enemy may not move');
 tickWorld(world,{now:start+10000,rng:()=>.5,activeFighters:1,actors:[shooter]});
 assert.ok(world.monster.position[2]<before[2],'after root, monster follows its attacker');
 shooter.position=[45,0,0]; // Inside the art appreciation sanctuary (< 60m)
 tickWorld(world,{now:start+10600,rng:()=>.5,activeFighters:1,actors:[shooter]});
 assert.equal(world.monster.aggroTarget,null,'art sanctuary cancels aggro');
});
test('flower staff, planter, giraffe and giant clam use distinct soft particle recipes',()=>{
 assert.equal(recipeFor(itemById('bloom-1')),'lotus-veil');
 assert.equal(recipeFor(itemById('planter-1')),'thorn-tower');
 assert.equal(recipeFor(itemById('giraffe')),'boomerang');
 const scene=new THREE.Scene(),signature=new WeaponSignatureEffects(scene),particles=new WeaponParticleEffects(scene);
 const origin=new THREE.Vector3(0,1,0),end=new THREE.Vector3(0,1,22);
 for(const id of ['bloom-1','giraffe']){
  const item=itemById(id);
  signature.play({origin:[0,1,0],ultimate:true,charge:1,direction:[0,0,1],range:22},item);
 }
 assert.deepEqual(signature.active.map(v=>v.obj.name),['One enormous forward rotating translucent particle blossom','Visible spinning yellow giraffe model, outbound and returning']);
 assert.equal(signature.play({origin:[0,1,0],ultimate:true,direction:[0,0,1]},itemById('planter-1')),false,'retired thorn forest must never play');
 assert.ok(signature.active[0].obj.children[0].geometry.getAttribute('position').count>=2000);
 particles.play({ultimate:true,charge:1,direction:[0,0,1],range:22},itemById('clam'),origin,end);
 assert.ok(particles.active.some(v=>v.recipe==='tidal'));
 signature.dispose();particles.dispose();assert.equal(scene.children.length,0);
});
