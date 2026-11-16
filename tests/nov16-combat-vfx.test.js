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
test('calico spread has exactly ten independent, normalized lanes and charged reach stays short of the SMG',()=>{
 const normal=calicoPellets([0,0,1],false),charged=calicoPellets([0,0,1],true);
 assert.equal(CALICO_PELLET_COUNT,10);
 assert.equal(normal.length,10);assert.equal(charged.length,10);
 assert.equal(new Set(normal.map(p=>p.direction.join(','))).size,10);
 assert.ok(normal.every(p=>Math.abs(Math.hypot(...p.direction)-1)<1e-10));
 assert.ok(Math.abs(charged[0].direction[0])>Math.abs(normal[0].direction[0]));
 const shotgun=itemById('calico-cat'),smg=itemById('white-cat');
 assert.equal(attackStats(shotgun,0).range,10);
 assert.equal(attackStats(shotgun,1).range,17);
 assert.ok(attackStats(shotgun,1).range<attackStats(smg,0).range);
 assert.ok(attackStats(shotgun,1).damage>attackStats(shotgun,0).damage);
});
test('all ten overlapping shotgun pellets hit a sixfold uncle as TEN damage numbers',()=>{
 const {world,shooter}=worldWithCat();
 const before=world.monster.hp;
 const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1],charge:0},{now:start+2000,rng:()=>.5,actors:[shooter]});
 assert.equal(result.attackEvent?.pellets?.length,10);
 assert.equal(result.monsterHits?.length,10,result.error);
 assert.equal(world.monster.hp<before,true);
 const damage=worldView(world,shooter.key,start+2001).damageEvents.filter(e=>e.target==='uncle');
 assert.equal(damage.length,10);
 assert.equal(new Set(damage.map(e=>e.id)).size,10);
 assert.equal(world.monster.aggroTarget,shooter.key);
});
test('ten pellet collisions can individually damage another fighter',()=>{
 const {world,shooter}=worldWithCat();world.monster.active=false;
 const target=fighter('victim',75,6);
 const victim=ensureProfile(world,target.key,target.name,target.color,start);
 // Ten independently travelling pellets must remain observable even after
 // the shotgun buff; a normal 100 HP victim dies before all ten land.
 victim.level=300;victim.maxHp=1296;victim.hp=1296;
 const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1]},{now:start+2000,rng:()=>.5,actors:[shooter,target]});
 assert.equal(result.hits.length,10);
 assert.equal(worldView(world,target.key,start+2002).damageEvents.filter(e=>e.target===target.key).length,10);
});
test('stray shotgun particles outside the sixfold torso do not inflict phantom damage',()=>{
 const {world,shooter}=worldWithCat();world.monster.position=[87,0,8];
 const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1]},{now:start+2000,rng:()=>.5,actors:[shooter]});
 assert.equal(result.monsterHits.length,0);
 assert.equal(world.monster.hp,800);
});
test('plant weapon roots a hit enemy and being hit triggers persistent pursuit',()=>{
 const world=createInitialWorld(start),shooter=fighter('gardener');
 const profile=ensureProfile(world,shooter.key,shooter.name,shooter.color,start);
 profile.inventory.push('planter-1');profile.equipment.weapon='planter-1';
 world.monster={id:'plant-target',active:true,variant:'uncle',model:'uncle',position:[75,0,4],hp:200,maxHp:200,skills:[],attackStyles:true,nextAttackAt:start+10000};
 const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1]},{now:start+2000,rng:()=>.5,actors:[shooter]});
 assert.ok(result.monsterHit?.damage>0,result.error);
 assert.ok(world.monster.effects?.root?.until>start+2000);
 assert.equal(world.monster.aggroTarget,shooter.key);
 const before=world.monster.position.slice();
 tickWorld(world,{now:start+2500,rng:()=>.5,activeFighters:1,actors:[shooter]});
 assert.deepEqual(world.monster.position,before,'rooted enemy may not move');
 tickWorld(world,{now:start+6000,rng:()=>.5,activeFighters:1,actors:[shooter]});
 assert.ok(world.monster.position[2]<before[2],'after root, monster follows its attacker');
 shooter.position=[45,0,0]; // Inside the art appreciation sanctuary (< 60m)
 tickWorld(world,{now:start+6600,rng:()=>.5,activeFighters:1,actors:[shooter]});
 assert.equal(world.monster.aggroTarget,null,'art sanctuary cancels aggro');
});
test('flower staff, planter, giraffe and giant clam use distinct soft particle recipes',()=>{
 assert.equal(recipeFor(itemById('bloom-1')),'lotus-veil');
 assert.equal(recipeFor(itemById('planter-1')),'thorn-tower');
 assert.equal(recipeFor(itemById('giraffe')),'boomerang');
 const scene=new THREE.Scene(),signature=new WeaponSignatureEffects(scene),particles=new WeaponParticleEffects(scene);
 const origin=new THREE.Vector3(0,1,0),end=new THREE.Vector3(0,1,22);
 for(const id of ['bloom-1','planter-1','giraffe']){
  const item=itemById(id);
  signature.play({origin:[0,1,0],ultimate:true,charge:1,direction:[0,0,1],range:22},item);
 }
 assert.deepEqual(signature.active.map(v=>v.obj.name),['One enormous forward rotating translucent particle blossom','Three stacked solid thorn-vine tiers','Visible spinning yellow giraffe model, outbound and returning']);
 assert.ok(signature.active[0].obj.children[0].geometry.getAttribute('position').count>=2000);
 particles.play({ultimate:true,charge:1,direction:[0,0,1],range:22},itemById('clam'),origin,end);
 assert.ok(particles.active.some(v=>v.recipe==='tidal'));
 signature.dispose();particles.dispose();assert.equal(scene.children.length,0);
});
