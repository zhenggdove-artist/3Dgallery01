import test from 'node:test';
import assert from 'node:assert/strict';
import {reflectWingArtwork,pinchWingView} from '../src/gm-wing-painter.js';
import {createInitialWorld,ensureProfile,applyAction,worldProfileView,migrateWorld} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
test('right wing canonicalizes outline, strokes and offset without modifying input',()=>{
 const a={outline:[[.1,.2],[.3,.4],[.7,.8]],strokes:[{points:[[.2,.3]],color:'#ffffff'}],offsetX:.2,scaleX:1};
 const b=reflectWingArtwork(a);assert.equal(b.outline[0][0],.9);assert.equal(b.strokes[0].points[0][0],.8);assert.equal(b.offsetX,-.2);assert.equal(a.offsetX,.2);assert.ok(Math.abs(reflectWingArtwork(b).outline[0][0]-.1)<1e-10);
});
test('pinch zoom is anchored to finger midpoint and clamped',()=>{
 const start={zoom:1,pan:[0,0],mid:[100,100],distance:50};
 const next=pinchWingView(start,[100,100],100,[150,150]);
 assert.equal(next.zoom,2);assert.deepEqual(next.pan,[50,50]);assert.equal(pinchWingView(start,[100,100],10000,[150,150]).zoom,5);
});
test('offline account receives GM canvas and saved wing persists across a fresh room load',()=>{
 const now=Date.now(),world=createInitialWorld(now),gm={key:'firebase:gm',name:'GM',color:'#abcdef',admin:true,role:'fighter'},user={key:'firebase:offline',name:'Offline',color:'#abcdef',role:'fighter'};
 ensureProfile(world,gm.key,gm.name,gm.color,now,true);ensureProfile(world,user.key,user.name,user.color,now,false);
 assert.ok(!applyAction(world,gm,{action:'gm-wing-canvas',targetKey:user.key},{now,actors:[gm]}).error);
 const wing={name:'Saved Wing',tier:3,color:'#abcdef',abilities:['glide','sparkle'],drawRatePct:0,outline:[[.1,.1],[.8,.2],[.3,.8]],strokes:[],scaleX:1,scaleY:1,impulse:10.15,gravity:.585,flapMs:300};
 const result=applyAction(world,user,{action:'redeem-wing-design',wing},{now:now+1000,actors:[user]});
 assert.ok(result.personalWingId,result.error);assert.equal(result.savedWing.id,result.personalWingId);
 const reload=migrateWorld(JSON.parse(JSON.stringify(world)),now+2000);
 const p=ensureProfile(reload,user.key,user.name,user.color,now+2000,false);
 assert.ok(p.inventory.includes(result.personalWingId));assert.equal(p.equipment.wings,result.personalWingId);
 assert.equal(worldProfileView(reload,user.key,now+2000).wingDesignCredits,0);assert.equal(itemById(result.personalWingId).name,'Saved Wing');
});

import {mergeWingCatalog,applyWorldPatch} from '../src/shared/world-patch.js';
test('queued combat world cannot erase a recently saved wing or revert its edits',()=>{
 const older=[{id:'a',name:'original',createdAt:1}];
 const saved=[...older,{id:'b',name:'new',createdAt:2}];
 const wire={revision:1,customWings:mergeWingCatalog(older,saved)};
 const patch=applyWorldPatch(wire,{base:1,revision:2,serverTime:3,fields:{}});
 assert.equal(patch.customWings.length,2);
 assert.equal(mergeWingCatalog(saved,older),saved);
 const edited=mergeWingCatalog(saved,[{id:'b',name:'edited',createdAt:2,updatedAt:4}]);
 assert.equal(mergeWingCatalog(edited,saved).find(w=>w.id==='b').name,'edited');
});
