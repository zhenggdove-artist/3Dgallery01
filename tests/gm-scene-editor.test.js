import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,migrateWorld,applyAction,worldView} from '../src/shared/temple-rules.js';

const gm={key:'gm-scene-tests',name:'GM',color:'#123456',admin:true,role:'fighter',position:[5,0,5]};
const player={key:'visitor-scene-tests',name:'Visitor',color:'#abcdef',admin:false,role:'fighter',position:[8,2,8]};
const action=(world,actor,body)=>applyAction(world,actor,body,{now:10_000,rng:()=>.5});
const ok=(world,actor,body)=>{
 const result=action(world,actor,body);
 assert.equal(result.error,undefined,JSON.stringify(result));
 return result;
};

test('GM can create, move, resize and delete discs and pedestals without deleting artwork',()=>{
 const world=createInitialWorld(1_000);
 const disc=ok(world,gm,{action:'create-platform',kind:'disc',position:[5,2,5],radius:2.5});
 assert.match(disc.platformId,/^floating:/);
 assert.equal(world.floatingPlatforms[0].radius,1.25);
 ok(world,gm,{action:'update-platform',platformId:disc.platformId,position:[7,3,8],radius:4});
 assert.deepEqual(world.floatingPlatforms[0].position,[7,3,8]);
 assert.equal(world.floatingPlatforms[0].radius,2);

 const cone=ok(world,gm,{action:'create-platform',kind:'pedestal',position:[4,1,6],radius:.7,height:1.3});
 assert.match(cone.platformId,/^pedestal:custom:/);
 ok(world,gm,{action:'update-platform',platformId:cone.platformId,position:[6,2,8],radius:.8,height:2});
 assert.deepEqual(world.customPedestals[0].position,[6,2,8]);
 assert.equal(world.customPedestals[0].height,2);
 ok(world,gm,{action:'update-platform',platformId:'display:platform-01',position:[1,2,3],radius:5});
 ok(world,gm,{action:'update-platform',platformId:'pedestal:platform-01',position:[1,2,3],radius:.6,height:.8});
 assert.equal(world.platformOverrides['display:platform-01'].radius,5);
 assert.equal(world.platformOverrides['pedestal:platform-01'].height,.8);
 const before=Object.keys(world.artworks).length;
 ok(world,gm,{action:'delete-platform',platformId:'display:platform-01'});
 ok(world,gm,{action:'delete-platform',platformId:disc.platformId});
 ok(world,gm,{action:'delete-platform',platformId:cone.platformId});
 assert.equal(Object.keys(world.artworks).length,before);
 assert.equal(world.floatingPlatforms.length,0);
 assert.equal(world.customPedestals.length,0);
 assert.equal(worldView(world,gm.key,10_000).removedPlatformIds.includes('display:platform-01'),true);
});

test('custom artwork 22 recovers missing pickup state and an invalid saved position',()=>{
 const world=createInitialWorld(1_000);
 world.customArtworks=[{id:'art-22',title:'22',position:[8,2,8],mime:'image/png'}];
 world.artworkLayout['art-22']={position:[-100,2,8],rotation:[0,0,0],scale:[1,1,1],revision:1};
 migrateWorld(world,10_000);
 assert.deepEqual(world.artworkLayout['art-22'].position,[8,2,8]);
 assert.equal(world.artworks['art-22'].holder,null);
 const repair=ok(world,gm,{action:'repair-artwork',platformId:'art-22',position:[8,2,8]});
 assert.equal(repair.artworkLayout.position[0],8);
 assert.equal(world.artworks['art-22'].availableAt,0);
 ok(world,player,{action:'pickup-artwork',platformId:'art-22'});
 assert.equal(world.artworks['art-22'].holder,player.key);
 const edited=ok(world,gm,{action:'set-artwork-layout',platformId:'art-22',
  expectedRevision:world.artworkLayout['art-22'].revision,
  layout:{position:[9,2,9],rotation:[0,0,0],scale:[1,1,1],appearance:{}}});
 assert.equal(edited.artworkLayout.position[0],9);
 assert.equal(world.artworks['art-22'].holder,null);
});
