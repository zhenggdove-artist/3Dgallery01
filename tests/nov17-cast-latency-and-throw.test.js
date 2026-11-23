import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {WeaponParticleEffects} from '../src/weapon-particle-effects.js';
import {ArtworkThrow} from '../src/artwork-throw.js';
import {artworkRenderFlight} from '../src/shared/artwork-flight.js';
import {itemById} from '../src/shared/catalog.js';

test('repeated original 00GameDevs ultimate recycles the exact native instance',()=>{
 const scene=new THREE.Scene(),effects=new NumberedWeaponEffects(scene);
 const item=itemById('pan-1');
 const event={id:'strike-1',origin:[0,1,0],direction:[0,0,1],range:16,
   ultimate:true,channel:false,qualityScale:1,qualityTier:1,
   area:{mode:'area',radius:3,visualCenter:[0,.12,12]}};
 assert.equal(effects.play(event,item),true);
 const original=effects.active[0].fx;
 assert.equal(original.group.userData.vfxSource,'00GameDevs');
 effects.remove(effects.active[0]);
 assert.equal(effects.prewarmed.get('rolling-fireburst')?.length,1);
 assert.equal(effects.play({...event,id:'strike-2'},item),true);
 assert.equal(effects.active[0].fx,original,'do not build a new heavy VFX when the same one is available');
 effects.dispose();
 assert.equal(scene.children.length,0);
});

test('point-sprite charge particles reuse GPU geometry instead of allocating again',()=>{
 const scene=new THREE.Scene(),effects=new WeaponParticleEffects(scene),item=itemById('tide-1');
 const a=effects.make('tidal',item,{amount:1200,range:18,duration:2.5});
 const buffers=a.geometry;
 effects.add(a);effects.remove(a);
 const b=effects.make('tidal',item,{amount:1200,range:18,duration:2.5});
 assert.equal(b,a);
 assert.equal(b.geometry,buffers);
 assert.equal(b.material.uniforms.uAge.value,0);
 effects.add(b);effects.dispose();
 assert.equal(scene.children.length,0);
});

test('A-button throw launches its predicted ballistic flight immediately and cancels if rejected',async()=>{
 const scene=new THREE.Scene();
 const state={holder:'player-1',availableAt:0,throwEvent:null};
 const arena={world:{artworks:{art1:state}},groundHeight:()=>0};
 const controller={root:{position:new THREE.Vector3(6,0,9)},aimDirection:()=>[0,0,1]};
 let reply,payload;
 const blocked=new Promise(resolve=>reply=resolve);
 const thrower=new ArtworkThrow({scene,controller:()=>controller,holderKey:()=> 'player-1',arena,
  send:(action,data)=>{assert.equal(action,'throw-artwork');payload=data;return blocked;},
  bursts:{play(){}},audio:{play(){}}
 });
 thrower.begin();
 thrower.started-=1500;
 const waiting=thrower.release();
 assert.equal(thrower.started,null,'release must not wait for a server response');
 assert.equal(state.holder,null,'the object must leave the hand on the same frame');
 assert.ok(state.throwEvent.id.startsWith('local-'));
 assert.ok(arena.localArtworkFlights.has('art1'));
 const predicted=arena.localArtworkFlights.get('art1');
 const authoritative={holder:null,availableAt:predicted.event.time+30000,throwEvent:{...predicted.event,id:'server-event',origin:[3,1.4,4],time:predicted.event.time+300}};
 const visual=artworkRenderFlight(authoritative,predicted,predicted.event.time+400);
 assert.equal(visual.event,predicted.event,'delayed authoritative snapshot must not pull the 3D artwork backwards');
 assert.equal(artworkRenderFlight(authoritative,predicted,predicted.event.time+predicted.landing.time*1000+1).waiting,true,'hide after landing instead of replaying the server launch');
 assert.ok(payload.power>1.39,'full A-button charge reaches maximum throw distance');
 reply(null);
 await waiting;
 assert.equal(state.holder,'player-1','rejecting the throw restores held artwork');
 assert.equal(state.throwEvent,null);
 assert.equal(arena.localArtworkFlights.size,0,'rejected throw also clears optimistic visual');
});

test('desktop artwork control uses the on-screen A and does not create an extra USE button',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const script=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.doesNotMatch(html, /data-action="interact"/);
 assert.match(html, /id="attack-button"/);
 assert.match(script, /nearbyArt\?\.type==='artwork'/);
 assert.match(script, /if\(!artworkThrow\.started&&!shoulderMouse\)/);
});
