import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {signatureKindFor,createChargedSignature,updateChargedSignature,disposeChargedSignature} from '../src/charged-signatures.js';
import {WEAPONS} from '../src/shared/catalog.js';

test('every weapon has a distinct, finite charged particle signature',()=>{
 for(const weapon of WEAPONS){
  const kind=signatureKindFor(weapon);
  assert.equal(typeof kind,'string',weapon.id);
  const shot={range:30,impactPoint:[12,0,18]};
  const sig=createChargedSignature(THREE,shot,weapon,new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),{mode:'area',center:[0,.12,18],radius:4},{mobile:true});
  assert.ok(sig.root.geometry.getAttribute('seed').count>=1450,weapon.id);
  assert.ok(sig.root.material.uniforms.spread.value>0,weapon.id);
  assert.ok(sig.root.position.y>=.12,weapon.id);
  assert.ok(updateChargedSignature(sig,.1));
  disposeChargedSignature(sig);
 }
});
test('swatter emits fly cloud; pan sends food; accordion musical notes; saber fissure',()=>{
 assert.equal(signatureKindFor({id:'swatter-1',family:'swatter'}),'flies');
 assert.equal(signatureKindFor({id:'pan-1',family:'pan'}),'food');
 assert.equal(signatureKindFor({id:'accordion',family:'pan'}),'notes');
 assert.equal(signatureKindFor({id:'saber-1',family:'saber'}),'fissure');
 assert.equal(signatureKindFor({id:'white-cat',family:'water',firstPerson:true}),'rainbow');
});
