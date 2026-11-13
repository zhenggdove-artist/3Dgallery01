import test from 'node:test';import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {validateAppearance} from '../src/shared/artwork-library.js';
test('GM artwork upload requires verified media; appearance and custom IDs survive save/reload',()=>{
 const world=createInitialWorld(1000),actor={key:'gm',name:'Ely',admin:true,role:'fighter',position:[0,0,0]};
 const body={action:'add-artwork',artwork:{title:'Transparent PNG',position:[2,2,0]},verifiedArtMedia:{id:'test-file',type:'image/png'}};
 assert.equal(applyAction(world,{...actor,admin:false},body,{now:1000}).error,'GM only');
 assert.ok(applyAction(world,actor,{...body,verifiedArtMedia:null},{now:1000}).error);
 const added=applyAction(world,actor,body,{now:1000});assert.ok(added.artwork.id);const id=added.artwork.id;
 const result=applyAction(world,actor,{action:'set-artwork-layout',platformId:id,expectedRevision:1,layout:{position:[2,3,0],rotation:[0,1,0],scale:[1,2,1],appearance:{depth:.4,brightness:1.2,contrast:.8,saturation:.6,blackPoint:.1,tint:'#abcdef'}}},{now:2000});assert.ok(!result.error,result.error);
 const restored=migrateWorld(JSON.parse(JSON.stringify(world)));assert.equal(worldView(restored,'gm').customArtworks[0].id,id);assert.equal(restored.artworkLayout[id].appearance.depth,.4);
 assert.equal(validateAppearance({brightness:NaN}),null);assert.equal(validateAppearance({depth:-1}),null);assert.equal(validateAppearance({tint:'url(evil)'}),null);
});
test('damage produces authoritative 100ms hit reaction away from attacker',()=>{
 const world=createInitialWorld(1000),a={key:'a',name:'A',role:'fighter',position:[20,0,0]},b={key:'b',name:'B',role:'fighter',position:[21,0,0]};ensureProfile(world,'a','A',null,1000);ensureProfile(world,'b','B',null,1000);
 const result=applyAction(world,a,{action:'attack',direction:[1,0,0],charge:0},{now:10000,actors:[a,b],rng:()=>.99});assert.ok(result.hit?.damage>0);assert.equal(world.profiles.b.hitReaction.stunMs,100);assert.deepEqual(world.profiles.b.hitReaction.vector,[1,0,0]);
 assert.equal(applyAction(world,b,{action:'attack',direction:[-1,0,0]},{now:10099,actors:[a,b]}).error,'Recovering from hit');
 assert.notEqual(applyAction(world,b,{action:'attack',direction:[-1,0,0]},{now:10100,actors:[a,b]}).error,'Recovering from hit');
});
