import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,VectorKeyframeTrack,Group,Texture} from 'three';
import {inPlaceLocomotion} from '../src/locomotion-clips.js';
import {changedWorldFields,createWorldPatch,applyWorldPatch} from '../src/shared/world-patch.js';
import {CityImpactPlumes} from '../src/city-ruins-vfx.js';

test('visual footsteps loop in place while preserving hip bob and the local-space gait',()=>{
 const track=new VectorKeyframeTrack('mixamorigHips.position',[0,.25,1],[.1,0,.31,.12,.2,.35,.1,.68,.31]);
 const walk=new AnimationClip('walk',1,[track]), fixed=inPlaceLocomotion(walk);
 assert.notEqual(walk,fixed);
 const out=fixed.tracks[0].values;
 assert.deepEqual(Array.from(out.slice(0,3)),Array.from(out.slice(-3)));
 assert.equal(out[3],track.values[3]);assert.equal(out[5],track.values[5]);
 assert.ok(Math.abs(out[4]-.03)<1e-6);
 assert.ok(track.values.at(-2)>.67,'source stays intact');
 const jump=new AnimationClip('jump',1,[track]);assert.equal(inPlaceLocomotion(jump),jump);
});

test('compact HP or effect patches preserve unchanged inventory and handle an effect clear',()=>{
 const profile={inventory:['white-cat'],fusion:{'white-cat':{layer:1}},hp:95,effects:{stun:{until:1234}}};
 const previous={revision:10,serverTime:1200,cityDamage:{},profile};
 const next={...previous,revision:11,serverTime:1300,profile:{...structuredClone(profile),hp:93,effects:{}}};
 const patch={...createWorldPatch(previous,next,true),profile:changedWorldFields(previous.profile,next.profile)};
 assert.deepEqual(patch.profile,{hp:93,effects:{}});
 const reconstructed=applyWorldPatch(previous,patch);
 assert.deepEqual(reconstructed,next);
 assert.equal(reconstructed.profile.inventory,profile.inventory);
 assert.equal(reconstructed.profile.fusion,profile.fusion);
 const legacy=createWorldPatch(previous,next);
 assert.deepEqual(applyWorldPatch(previous,legacy),next);
});

test('24 concurrent hit plumes use two resident draws and never reupload in the frame loop',()=>{
 const root=new Group(),resources={flame:new Texture(),smoke:new Texture()};
 const field=new CityImpactPlumes(root,resources);
 for(let n=0;n<30;n++)field.spawn([n,1,0],n);
 assert.equal(root.children.length,2);
 assert.equal(field.slots.length,24);
 assert.ok(root.children.every(o=>o.visible));
 const generations=field.layers.map(l=>[l.initial.version,l.motion.version,l.birth.version]);
 field.update(1);field.update(2);
 assert.deepEqual(field.layers.map(l=>[l.initial.version,l.motion.version,l.birth.version]),generations);
 field.update(2);assert.ok(root.children.every(o=>!o.visible));
 field.reset();field.dispose();
 assert.equal(root.children.length,0);
});
