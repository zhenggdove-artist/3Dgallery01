import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {WeaponVFX} from '../src/weapon-vfx.js';
import {requestedEffect} from '../src/numbered-weapon-effects.js';
import {cameraAimDirection,crosshairNdc,AIM_RAISE_PX} from '../src/aiming.js';
import {SHOP_ITEMS,itemById} from '../src/shared/catalog.js';

test('original vendor #08 lightning and #29 charged yellow beam are used exclusively for channel',()=>{
 for(const [id,asset,number] of [['storm-3','arc-ray',8],['prism-3','charged-beam',29]]){
  const item=itemById(id);
  assert.equal(requestedEffect(item,{channel:true,ultimate:true})?.asset,asset);
  assert.equal(requestedEffect(item,{channel:true,ultimate:true})?.number,number);
  assert.equal(requestedEffect(item,{channel:false,ultimate:false}),null);
  assert.equal(requestedEffect(item,{channel:false,ultimate:true}),null);
 }
 const numbered=readFileSync(new URL('../src/numbered-weapon-effects.js',import.meta.url),'utf8');
 const weapon=readFileSync(new URL('../src/weapon-vfx.js',import.meta.url),'utf8');
 assert.match(numbered,/fx\.setEndpoints\(origin,end\)/);
 assert.match(numbered,/'charged-beam':'#f6c76c'/);
 assert.match(weapon,/new ForwardChannelBeam\(this.scene,false\)/,'four cardinal Prism arcs are channel-only overlays');
});
test('tap fires only a traveling elemental orb; channel delegates to actual vendor VFX',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const vfx=new WeaponVFX(scene),native=[];
 vfx.numberedEffects.play=(data,item)=>{native.push({data,item});return true;};
 for(const id of ['storm-3','prism-3']){
  const item=itemById(id);
  const shot={channel:false,ultimate:false,origin:[0,1,0],direction:[0,0,1],range:30};
  const previous=vfx.staffOrbs.length,previousNative=native.length;
  vfx.play(shot,item,root);
  assert.equal(vfx.staffOrbs.length,previous+1,'normal attacks must create an orb');
  const orb=vfx.staffOrbs.at(-1);
  if(item.family==='lightning'){
   assert.ok(orb.arcs?.isLineSegments,'electric orb carries orbiting sparks');
   assert.ok(orb.arcs.geometry.attributes.position.count>60);
  }else{
   assert.ok(orb.core.material.color.r>orb.core.material.color.b*.7,'prism orb is warm yellow');
   assert.equal(orb.arcs,undefined,'ordinary prism projectile is not a laser');
  }
  assert.equal(native.length,previousNative,'normal attack must not render a vendor beam');
  vfx.play({...shot,ultimate:true},item,root);
  assert.equal(native.length,previousNative,'non-channel charged attacks cannot become continuous lasers');
  vfx.play({...shot,channel:true,ultimate:true},item,root);
 }
 assert.deepEqual(native.map(x=>x.item.family),['lightning','beam']);
 assert.equal(scene.children.some(node=>/forward-channel|prism-forward|lightning-forward/.test(node.name)),false);
 vfx.dispose();
});
test('all camera rays share thirty-pixel-up crosshair in a viewport-independent NDC',()=>{
 assert.equal(AIM_RAISE_PX,30);
 assert.equal(crosshairNdc(500).y,.12);
 assert.equal(crosshairNdc(1000).y,.06);
 const camera=new THREE.PerspectiveCamera(55,1,0.1,500);
 camera.position.set(0,2,10);camera.lookAt(0,2,0);
 assert.ok(cameraAimDirection(camera).y>0,'camera ray rises along screen reticle');
});
test('ordinary shop includes exactly fourteen purchasable material wings',()=>{
 const wings=SHOP_ITEMS.filter(item=>item.slot==='wings');
 assert.equal(wings.length,14);
 assert.equal(new Set(wings.map(x=>x.motif)).size,14);
 assert.ok(wings.every(x=>x.price>0));
});
