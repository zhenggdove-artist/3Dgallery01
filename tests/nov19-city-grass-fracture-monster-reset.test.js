import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,tickWorld,applyAction} from '../src/shared/temple-rules.js';
import {MONSTER_PACK_SIZE} from '../src/shared/monster-pack.js';
import * as THREE from 'three';
import {IslandEnemies} from '../src/island-enemies.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const T=Date.now();
test('on entering as a fighter, live humanoid uncle and flower monsters spawn in a full synchronized pack',()=>{
 const world=createInitialWorld(T);
 const changed=tickWorld(world,{now:T+1,activeFighters:1,actors:[],rng:()=>.35});
 assert.equal(changed,true);
 assert.equal(world.monsters.length,MONSTER_PACK_SIZE);
 assert.ok(world.monsters.every(m=>m.active&&m.position.length===3&&m.hp>0));
 assert.deepEqual(new Set(world.monsters.map(m=>m.model)),new Set(['uncle','flower']));
 assert.equal(world.monsters.some(m=>m.model==='uncle'),true);
 assert.equal(world.monsters.some(m=>m.model==='flower'),true);
});
test('browser scene binds the uncle and flower packed actors to visible original rig slots',()=>{
 const world=createInitialWorld(T+200);
 tickWorld(world,{now:T+210,activeFighters:1,actors:[],rng:()=>.55});
 const scene=new THREE.Scene(),actors=new IslandEnemies(scene);
 actors.extraModels=Array.from({length:MONSTER_PACK_SIZE},()=>new THREE.Group());
 actors.sync(world.monster,world.monsters);
 assert.equal(actors.extraLive.length,MONSTER_PACK_SIZE);
 assert.ok(actors.extraModels.every(root=>root.visible===true));
 for(let i=0;i<MONSTER_PACK_SIZE;i++){
  assert.deepEqual(actors.extraModels[i].position.toArray(),world.monsters[i].position);
  assert.ok(['uncle','flower'].includes(actors.extraLive[i].state.model));
 }
});
test('GM building reset restores authoritative building collision/health but nonadmins cannot reset',()=>{
 const world=createInitialWorld(T),lot='city-lot-example';
 const gm=ensureProfile(world,'gm','Ely','#ff5500',T,true);
 const actor={key:'gm',name:'Ely',color:'#ff5500',position:[0,0,0],role:'fighter',admin:true};
 world.cityDamage[lot]={hp:0,parts:{masonry:0}};
 const denied=applyAction(world,{...actor,key:'other',name:'Other',admin:false},{action:'reset-buildings'},{now:T+10,actors:[]});
 assert.equal(denied.error==='GM only'||!!denied.error,true);
 const result=applyAction(world,actor,{action:'reset-buildings'},{now:T+20,actors:[]});
 assert.equal(result.resetBuildings,true);
 assert.deepEqual(world.cityDamage,{});
 assert.equal(result.restoredBuildings,1);
});
test('GM message reset clears the central garden and bumps revision',()=>{
 const world=createInitialWorld(T);
 ensureProfile(world,'gm2','Ely','#ff5500',T,true);
 world.plants=[{id:'test-a',author:'One',text:'text'},{id:'test-b',author:'Two',text:'hello'}];
 const revision=world.revision;
 const result=applyAction(world,{key:'gm2',name:'Ely',color:'#ff5500',position:[0,0,0],role:'fighter',admin:true},
  {action:'reset-messages'},{now:T+30,actors:[]});
 assert.equal(result.resetMessages,true);assert.deepEqual(world.plants,[]);
 assert.ok(world.revision>revision);
});
test('ruined city has surface-integrated cracks, detached architectural fittings, animated smoke and no visible ochre ground',()=>{
 const city=source('src/outer-city.js'),vfx=source('src/city-ruins-vfx.js'),grass=source('src/grass-field.js');
 assert.match(city,/installFacadeCracks\(this\.walls\)/);
 assert.doesNotMatch(city,/\bfront\+/,'bare undefined front variable must never block boot');
 assert.match(city,/buildDetachableFixture\(lot,part/);
 assert.match(city,/buildBrokenStructure\(lot,index/);
 assert.match(city,/emitFireSmoke\(/);
 assert.match(city,/resetBuildings\(\)/);
 assert.doesNotMatch(city,/this\.root\.add\(ground\)/);
 assert.match(vfx,/vCitySurface/);
 assert.match(vfx,/uCityDamage/);
 assert.match(grass,/this\.outerCanopy/);
 assert.match(grass,/this\.outerMesh/);
});
test('GM command menu and live server clear messages and restore houses for everyone',()=>{
 const ui=source('src/ui.js'),main=source('src/main.js'),worker=source('cloudflare/worker.js');
 assert.match(ui,/\/reset building/);assert.match(ui,/\/reset message/);
 assert.match(main,/reset-buildings/);assert.match(main,/reset-messages/);
 assert.match(main,/chat-reset/);
 assert.match(worker,/this\.broadcast\('chat-reset'/);
 assert.match(worker,/tickWorld\(world,\{now,activeFighters:1,actors:\[\]\}\)/);
});
