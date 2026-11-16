import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SaberImpact} from '../src/saber-impact.js';
import {runeColorFor,ChargeTargetPreview} from '../src/charge-target-preview.js';
import {ElementalCharge,chargePalette} from '../src/elemental-charge.js';
test('fully charged saber creates a moving blade wave, floor crack and rocks',()=>{
 const scene=new THREE.Scene(),fx=new SaberImpact(scene);
 const effect=fx.play({range:28,origin:[1,1,2]},new THREE.Vector3(1,1,2),new THREE.Vector3(0,0,1));
 assert.equal(effect.rocks.count,75);assert.equal(effect.wave.name,'Enormous forward cutting blade wave');
 assert.equal(effect.gap.name,'Visible split in the floor');
 fx.update(.5);assert.equal(effect.gap.visible,true);
 assert.equal(effect.shockwave.visible,true);assert.ok(effect.wave.position.z>2);
 fx.dispose();assert.equal(scene.children.length,0);
});
test('charged marker uses coloured magic rune circles, not rectangle guides',()=>{
 const scene=new THREE.Scene(),preview=new ChargeTargetPreview(scene);
 const parent={position:new THREE.Vector3(0,0,0)},arena={world:{floatingPlatforms:[]}};
 preview.update(parent,{family:'ice',range:10,radius:2,damage:4,chargeDamage:8,chargeRange:12,cooldown:500},.7,[0,0,1],arena);
 assert.equal(preview.group.visible,true);
 assert.ok(preview.guides.every(g=>!g.visible),'area spells use one destination circle');
 assert.equal(preview.outer.material.color.getHexString(),'98eaff');
 preview.update(parent,{family:'saber',range:5,radius:1,damage:5,chargeDamage:10,chargeRange:12,cooldown:300},.7,[0,0,1],arena);
 assert.ok(preview.guides.some(g=>g.visible),'forward sword spells use a runic path');
 assert.equal(preview.outer.geometry.type,'RingGeometry');
 assert.equal(preview.outer.material.color.getHexString(),'ffc879');
 preview.dispose();assert.equal(scene.children.length,0);
});
test('charging aura is anchored, cleanable and uses fire/ice palettes',()=>{
 const scene=new THREE.Scene(),aura=new ElementalCharge(scene);
 assert.notDeepEqual(chargePalette({family:'fire'}),chargePalette({family:'ice'}));
 const player={position:new THREE.Vector3(0,0,0)};
 aura.charging(player,.8,{family:'fire'});
 assert.equal(aura.root.visible,true);assert.equal(aura.geometry.getAttribute('position').count,160);
 aura.charging(null,0,null);assert.equal(aura.root.visible,false);
 aura.dispose();
});
