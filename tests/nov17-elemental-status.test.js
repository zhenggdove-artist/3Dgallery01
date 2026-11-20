import test from 'node:test';
import assert from 'node:assert/strict';
import {applyElementalHit,effectActive} from '../src/shared/combat-status.js';
import {createProfile,publicProfile,validateState} from '../src/shared/temple-rules.js';
import {attackStats,itemById} from '../src/shared/catalog.js';
import {ELEMENTAL_FILTERS} from '../src/elemental-status-visuals.js';

const T=50_000,source={key:'artist'};
const target=()=>({hp:100,maxHp:100,effects:{},effectLocks:{}});
const hit=(victim,family,element,at=T)=>applyElementalHit(victim,source,{family,element},at);

test('water makes target take 1.5x damage for precisely five seconds',()=>{
 const victim=target();
 assert.equal(hit(victim,'water','water'),'soaked');
 assert.equal(victim.effects.soaked.power,.5);
 assert.equal(victim.effects.soaked.until,T+5000);
 assert.ok(effectActive(victim,'soaked',T+4999));
 assert.ok(!effectActive(victim,'soaked',T+5000));
});

test('freeze prevents actions for three seconds, with five-second proc lock',()=>{
 const victim=target();
 assert.equal(hit(victim,'ice','water'),'freeze');
 assert.equal(victim.effects.freeze.until,T+3000);
 assert.equal(hit(victim,'ice','water',T+1200),null);
 assert.equal(victim.effects.freeze.until,T+3000);
 assert.equal(hit(victim,'ice','water',T+5000),'freeze');
 const profile=createProfile('fighter','Fighter','#ffffff',T,false);
 profile.effects=victim.effects;
 assert.ok(publicProfile(profile).effects.freeze);
 const previous={position:[75,0,0],rotation:.2,animation:'idle',visible:true},
  next={position:[78,0,0],rotation:1.1,animation:'walk',visible:true};
 const stuck=validateState(previous,next,120,'fighter',null,null,T+5000,{effects:victim.effects});
 assert.deepEqual(stuck.state.position,previous.position);
 assert.equal(stuck.state.rotation,previous.rotation);
});

test('plants root movement but allow rotation, reapply only after 5 seconds',()=>{
 const victim=target();
 assert.equal(hit(victim,'planter','earth'),'root');
 assert.equal(victim.effects.root.until,T+1000);
 hit(victim,'planter','earth',T+1100);
 assert.equal(victim.effects.root.until,T+1000);
 const previous={position:[75,0,0],rotation:.2,animation:'idle',visible:true},
  next={position:[78,0,0],rotation:1.1,animation:'walk',visible:true};
 const result=validateState(previous,next,120,'fighter',null,null,T+500,{effects:victim.effects});
 assert.deepEqual(result.state.position,previous.position);
 assert.equal(result.state.rotation,1.1);
 assert.equal(hit(victim,'planter','earth',T+5000),'root');
});

test('dark confusion and light dizziness have 10-second proc immunity',()=>{
 for(const [family,element,key] of [
  ['swatter','dark','confuse'],['beam','light','dazzle']
 ]){
  const victim=target();
  assert.equal(hit(victim,family,element),key);
  assert.equal(victim.effects[key].until,T+3000);
  assert.equal(hit(victim,family,element,T+4000),null);
  assert.equal(hit(victim,family,element,T+10000),key);
 }
});

test('burn attaches a five-second damage-over-time visual status',()=>{
 const victim=target();
 assert.equal(hit(victim,'fire','fire'),'burn');
 assert.equal(victim.effects.burn.until,T+5000);
});
test('target-only overlays include 30%-alpha violet paralysis',()=>{
 assert.deepEqual(Object.keys(ELEMENTAL_FILTERS).sort(),['dazzle','freeze','paralysis','root','soaked']);
});
test('charged saber authoritative range is 60% of previous four-times multiplier',()=>{
 const item=itemById('saber-1'),charged=attackStats(item,1);
 const former=Math.max(30,item.range*2,(item.range+item.chargeRange)*1.8)*4;
 assert.ok(Math.abs(charged.range-former*.60)<.01);
});

test('model-only 30% filters and fire sprites restore original materials on expiry',async()=>{
 const THREE=await import('three');
 const {ElementalStatusVisuals}=await import('../src/elemental-status-visuals.js');
 const root=new THREE.Group(),scene=new THREE.Scene();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,.5),new THREE.MeshStandardMaterial({color:'#dddddd'}));
 root.add(mesh);root.userData.model=mesh;scene.add(root);
 const original=mesh.material,visuals=new ElementalStatusVisuals();
 visuals.sync(root,{soaked:{until:T+5000} },T);
 assert.notEqual(mesh.material,original);
 assert.equal(visuals.entries.get(root).uniforms.alpha.value,.30);
 assert.equal(visuals.entries.get(root).uniforms.color.value.getHexString(),'328dfb');
 visuals.sync(root,{burn:{until:T+3000},root:{until:T+1000}},T);
 assert.equal(visuals.entries.get(root).uniforms.alpha.value,.30);
 assert.ok(visuals.entries.get(root).flames);
 const burnFX=visuals.entries.get(root).flames.pulses[0].fx;
 assert.equal(burnFX.group.userData.vfxNumber,1);
 assert.equal(burnFX.group.userData.vfxSource,'00GameDevs');
 assert.ok(burnFX.group.scale.x<=.055,'each original fireball must be miniature');
 const localBody=new THREE.Box3().setFromObject(mesh);
 assert.ok(burnFX.group.position.y>localBody.min.y+localBody.getSize(new THREE.Vector3()).y*.20,
  'small flames must spawn ON the body, not at its feet');
 visuals.update(.5,T+500);
 assert.ok(visuals.entries.get(root).flames.pulses.length<=8);
 assert.ok(visuals.entries.get(root).flames.group.parent===root);
 assert.equal(visuals.entries.get(root).uniforms.color.value.getHexString(),'69bf49');
 visuals.update(.25,T+1200);
 assert.equal(visuals.entries.get(root).uniforms.alpha.value,0);
 visuals.update(.25,T+3000);
 assert.equal(mesh.material,original);
 visuals.dispose();mesh.geometry.dispose();original.dispose();
});


test('official #01 burn VFX matches the exact downloaded 00GameDevs source bytes',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {createHash}=await import('node:crypto');
 const manifest=JSON.parse(await readFile(new URL('../vendor/00gamedevs/fireball-source.json',import.meta.url)));
 const original=Buffer.from((await readFile(new URL('../vendor/00gamedevs/source/fireball.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n'));
 const header=Buffer.from('blob '+original.length+'\0');
 const blobSha=createHash('sha1').update(header).update(original).digest('hex');
 assert.equal(manifest.number,1);
 assert.equal(manifest.slug,'fireball');
 assert.equal(manifest.modified_original,false);
 assert.equal(blobSha,manifest.source_git_blob_sha1);
 assert.equal(original.toString('utf8').includes('00GameDevs exported assets — original code only'),true);
});
