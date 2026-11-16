import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createInitialWorld,applyAction,worldView} from '../src/shared/temple-rules.js';
import {ISLAND_ENEMIES} from '../src/shared/island-combat.js';
import {spawnMonsterPack} from '../src/shared/monster-pack.js';
import {patrolMonster} from '../src/shared/monster-patrol.js';
import {DisplayPlatforms} from '../src/display-platforms.js';
import {PLATFORMS} from '../src/shared/arena.js';
import {WEAPONS,attackStats} from '../src/shared/catalog.js';
import {recipeFor} from '../src/weapon-particle-effects.js';

const actor=(key,admin=false)=>({key,name:key,role:'fighter',admin,position:[75,0,0],color:'#44aa88'});

test('Temple only spawns humanoid enemies, including migration of old active animals/auntie',()=>{
 assert.deepEqual(ISLAND_ENEMIES,['uncle','flower']);
 const world=createInitialWorld(1000);
 world.monsters=Array.from({length:5},(_,i)=>({id:'existing-'+i,slot:i,active:true,model:['auntie','cow','deer','fox','uncle'][i],variant:'legacy',position:[72+i,0,0],hp:300,skills:[]}));
 assert.equal(spawnMonsterPack(world,2000,()=>.6),true);
 for(let i=0;i<5;i++){
  assert.equal(world.monsters[i].model,ISLAND_ENEMIES[i%2]);
  assert.equal(world.monsters[i].variant,ISLAND_ENEMIES[i%2]);
  assert.equal(world.monsters[i].id,'existing-'+i,'living monsters remain stable');
 }
 assert.ok(!ISLAND_ENEMIES.includes('auntie'));
 for(const animal of ['cow','deer','fox'])assert.ok(!ISLAND_ENEMIES.includes(animal));
});

test('idle monster patrolling traverses the arena instead of freezing at edge',()=>{
 const mob={active:true,position:[76,0,0],skills:[],moving:false};
 let steps=0;
 for(let t=1000;t<8500;t+=500){
  patrolMonster(mob,t,()=>.65,(target,distance)=>{
   const x=target[0]-mob.position[0],z=target[2]-mob.position[2],d=Math.hypot(x,z)||1;
   const step=Math.min(distance,d);
   mob.position[0]+=x/d*step;mob.position[2]+=z/d*step;steps++;
  });
 }
 assert.ok(steps>=10);
 assert.ok(Math.hypot(mob.position[0]-76,mob.position[2])>5,'monster has moved away from spawn');
 assert.ok(Math.hypot(...[mob.position[0],mob.position[2]])<91);
 assert.ok(Array.isArray(mob.patrolTarget));
});

test('GM can independently size original exhibit deck, but never create one for uploads',()=>{
 const world=createInitialWorld(1000),gm=actor('gm',true),id=PLATFORMS[0].id,rev=world.artworkLayout?.[id]?.revision||0;
 const transform={position:[-12,2,-12],rotation:[0,0,0],scale:[4,4,4],platformRadius:3.25};
 const allowed=applyAction(world,gm,{action:'set-artwork-layout',platformId:id,expectedRevision:rev,layout:transform},{now:2000});
 assert.equal(allowed.error,undefined);
 assert.equal(world.artworkLayout[id].platformRadius,3.25);
 const denied=applyAction(world,gm,{action:'set-artwork-layout',platformId:id,expectedRevision:rev+1,layout:{...transform,platformRadius:15}},{now:3000});
 assert.match(denied.error,/radius/i);
 const original=new THREE.Group();original.userData={platformId:id};original.add(new THREE.Mesh(new THREE.BoxGeometry(2,3,1),new THREE.MeshBasicMaterial()));
 const upload=new THREE.Group();upload.userData={platformId:'bomb-local'};upload.add(new THREE.Mesh(new THREE.BoxGeometry(3,3,.2),new THREE.MeshBasicMaterial()));
 world.customArtworks=[{id:'bomb-local',title:'Sample',position:[72,0,1],bomb:true,owner:'player'}];
 world.artworkLayout['bomb-local']={position:[72,0,1],rotation:[0,0,0],scale:[3,3,3]};
 const arena={scene:new THREE.Scene(),world,artworks:new Map([[id,original],['bomb-local',upload]]),defaultLayout:{}};
 const platforms=new DisplayPlatforms(arena);platforms.sync();
 assert.ok(platforms.discs.some(d=>d.artwork===id&&d.display&&d.radius===3.25));
 assert.ok(!platforms.discs.some(d=>d.artwork==='bomb-local'),'player art has no display disc or stairs');
 assert.equal(platforms.pedestals.geometry.type,'ConeGeometry');
 assert.ok(platforms.pedestals.material.color.equals(new THREE.Color('#777d85')));
 const originalTop=platforms.discs.find(d=>d.display).top;
 assert.equal(platforms.ground(-12,-12,originalTop),originalTop);
});

test('creator can edit uploaded artwork colour, while another player cannot',()=>{
 const world=createInitialWorld(1000),owner=actor('owner'),other=actor('other');
 const placed=applyAction(world,owner,{action:'publish-art-bomb',artwork:{title:'A',position:[78,0,0]},size:2,verifiedArtMedia:{id:'test-upload',type:'image/png'}},{now:2000});
 assert.ok(placed.artwork?.id,placed.error);
 const id=placed.artwork.id,appearance={depth:.22,brightness:1.8,contrast:1.4,saturation:2.3,blackPoint:.18,tint:'#eeccee'};
 assert.match(applyAction(world,other,{action:'update-art-bomb-appearance',id,appearance},{now:2100}).error,/creator|GM/);
 assert.match(applyAction(world,owner,{action:'update-art-bomb-appearance',id,appearance:{...appearance,brightness:8}},{now:2200}).error,/Invalid/);
 const saved=applyAction(world,owner,{action:'update-art-bomb-appearance',id,appearance,expectedRevision:1},{now:2300});
 assert.equal(saved.error,undefined);
 assert.deepEqual(world.artworkLayout[id].appearance,appearance);
 assert.equal(worldView(world,'owner',2300).artworkLayout[id].appearance.saturation,2.3);
 assert.match(applyAction(world,owner,{action:'update-art-bomb-appearance',id,appearance,expectedRevision:1},{now:2400}).error,/Reload/);
});

test('charged weapons use identifiable fine particle concepts and cats fire rainbows',()=>{
 const idToRecipe={accordion:'music','white-cat':'rainbow','black-cat':'rainbow','calico-cat':'rainbow-scatter',giraffe:'boomerang',goldfish:'jet'};
 for(const [id,expected] of Object.entries(idToRecipe))assert.equal(recipeFor(WEAPONS.find(w=>w.id===id)),expected);
 for(const [family,expected] of Object.entries({saber:'fissure',swatter:'flies',pan:'food',wave:'singularity'})){
  const w=WEAPONS.find(w=>w.family===family&&!w.exotic);
  assert.equal(recipeFor(w),expected);
 }
 const shotgun=WEAPONS.find(w=>w.id==='calico-cat');
 assert.equal(shotgun.firstPerson,false);
 assert.equal(attackStats(shotgun,0).range,10);
 assert.equal(attackStats(shotgun,1).range,17);
 const particles=readFileSync(new URL('../src/weapon-particle-effects.js',import.meta.url),'utf8');
 assert.match(particles,/THREE\.Points\(/);
 assert.match(particles,/fine-grained GPU particles/i);
 assert.ok(!particles.includes('new THREE.Mesh('),'bespoke attacks must not summon solid meshes');
 const sky=readFileSync(new URL('../src/night-sky.js',import.meta.url),'utf8');
 for(const feature of ['Translucent ','depthTest:true','World-oriented distant cloud sky'])assert.ok(sky.includes(feature));
 assert.ok(!sky.includes('makeMoon('),'no rendered moon');
 const thrower=readFileSync(new URL('../src/artwork-throw.js',import.meta.url),'utf8');
 assert.match(thrower,/Thick red ballistic arc/);
 assert.match(thrower,/Large red artwork landing marker/);
});

test('server-side WRITE landing can plant despite delayed browser position packets',()=>{
 const world=createInitialWorld(1000),visitor=actor('writer');
 assert.ok(applyAction(world,visitor,{action:'write-begin'},{now:1000}).journey);
 assert.ok(applyAction(world,visitor,{action:'write-drink',duration:2},{now:4500}).journey);
 // Avatar has landed at the central tree according to the server, but its
 // most recent player socket position still refers to the outer arena.
 const planted=applyAction(world,visitor,{action:'plant',text:'A reliable landing',position:[0,0,0]},{now:10500});
 assert.ok(planted.plant?.id,planted.error);
 assert.equal(world.plants[0].text,'A reliable landing');
});
