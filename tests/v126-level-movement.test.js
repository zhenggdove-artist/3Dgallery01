import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,addXp,validateState} from '../src/shared/temple-rules.js';
import {playerStats,levelAttributeScale,levelXpRequired} from '../src/shared/player-stats.js';
import {LevelUpEffect,observeLevel} from '../src/level-up-effect.js';
import {GrassField,grassPositions} from '../src/grass-field.js';

test('every level improves primary stats, with unchanged level one and original XP requirements',()=>{
 const now=100000000,w=createInitialWorld(now),p=ensureProfile(w,'a','A','#123456',now);
 const initial=playerStats(w,p,now);assert.equal(levelAttributeScale(1),1);assert.equal(levelXpRequired(1),100);
 p.hp=55;p.xp=90;addXp(w,p,20,now);
 const next=playerStats(w,p,now);
 assert.equal(p.level,2);assert.equal(p.xp,10);assert.equal(levelXpRequired(p.level),200);
 assert.equal(p.hp,67);assert.equal(p.maxHp,next.maxHp);assert.equal(p.maxMana,next.maxMana);
 for(const key of ['maxHp','maxMana','manaRegen','attack','speed','jump'])assert.ok(next[key]>initial[key],key);
 assert.ok(next.defense<initial.defense);for(const key of ['gravity','impulse','flapMs'])assert.equal(next[key],initial[key]);
 for(let n=1;n<999;n++)assert.ok(levelAttributeScale(n+1)>levelAttributeScale(n));
 assert.ok(levelAttributeScale(999)<2);
});
test('GM-set high levels use the same movement allowance and do not bypass arena bounds',()=>{
 const w=createInitialWorld(100000000),p=ensureProfile(w,'a','A','#123456',100000000);p.level=999;
 const stats=playerStats(w,p,100000000),start={position:[0,0,0],rotation:0},next={position:[stats.speed*8.64*.09,0,0],rotation:0};
 assert.ok(validateState(start,next,90,'fighter',null,null,100000100,{stats}).state);
 const result=validateState(start,{position:[9999,0,0],rotation:0},90,'fighter',null,null,100000100,{stats});assert.ok(result.error);
});
test('level effect only starts on increases, follows avatar, and releases active material',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);const fx=new LevelUpEffect(scene);
 assert.equal(observeLevel(root,20),false);assert.equal(observeLevel(root,21),true);assert.equal(observeLevel(root,21),false);assert.equal(observeLevel(root,19),false);
 fx.play(root);const e=fx.active.get(root);assert.equal(e.mesh.geometry,fx.geometry);assert.equal(fx.geometry.attributes.position.count,960);
 root.position.set(3,4,5);fx.update(e.start+500,800);assert.deepEqual(e.mesh.position.toArray(),[3,4,5]);assert.ok(Math.abs(e.mesh.material.uniforms.age.value-.5)<1e-9);
 fx.update(e.start+1400,800);assert.equal(fx.active.size,0);assert.equal(e.mesh.parent,null);fx.material.dispose();fx.geometry.dispose();
});
test('all grass attributes share one buffer and retain exact original seed values',()=>{
 const scene=new THREE.Scene(),grass=new GrassField(scene,{mobile:true,count:1800}),g=grass.mesh.geometry,seed=grassPositions(1800);
 try{
  const p=g.getAttribute('aOffset'),h=g.getAttribute('aHeight'),a=g.getAttribute('aAngle'),t=g.getAttribute('aPhase'),s=g.getAttribute('aShade');
  for(const attr of [h,a,t,s])assert.equal(attr.data,p.data);
  const ids=new Map(Array.from({length:1800},(_,i)=>[seed.points[i*2]+':'+seed.points[i*2+1],i]));
  const order=new Map(),seen=new Set();
  for(let i=0;i<1800;i++){const key=p.getX(i)+':'+p.getY(i),n=ids.get(key);assert.ok(n!==undefined&&!seen.has(n));seen.add(n);order.set(key,i);assert.deepEqual([h.getX(i),a.getX(i),t.getX(i),s.getX(i)],[seed.heights[n],seed.angles[n],seed.phases[n],seed.shades[n]]);}
  assert.equal(seen.size,1800);
  const view=new THREE.PerspectiveCamera(55,1.33,.1,1000);view.position.set(0,4,0);view.lookAt(40,0,0);grass.prepareVisibility(view);
  let last=-1;
  for(let i=0;i<g.instanceCount;i++){const key=p.getX(i)+':'+p.getY(i),n=ids.get(key),k=order.get(key);assert.ok(k>last);last=k;assert.deepEqual([h.getX(i),a.getX(i),t.getX(i),s.getX(i)],[seed.heights[n],seed.angles[n],seed.phases[n],seed.shades[n]]);}
 }finally{grass.dispose();}
});
