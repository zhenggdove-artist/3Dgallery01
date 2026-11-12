import * as THREE from 'three';
import {createUltimate,updateUltimate,disposeUltimate,prepareUltimates,ultimateNames} from './reletter/ultimate-effects.js';
const pool=new Map();
export const warmUltimates=(renderer,camera)=>prepareUltimates(THREE,renderer,camera);
export function acquireUltimate(item,shot){
 const family=item.family in ultimateNames?item.family:'water',list=pool.get(family),f=list?.pop();if(!f)return createUltimate(THREE,item,shot);
 Object.assign(f,{age:0,originY:shot.origin[1],elevation:shot.direction[1],range:shot.range||30,radius:shot.radius||6,tier:item.tier||1});
 f.travel=Math.min(f.range,shot.impact?new THREE.Vector3(...shot.impact).distanceTo(new THREE.Vector3(...shot.origin)):f.range);
 f.root.position.fromArray(shot.origin);f.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(shot.direction[0],shot.direction[2]));
 const ground=f.flows.find(p=>p.kind==='ground');if(ground)ground.position.copy(new THREE.Vector3(0,(-shot.origin[1]+.03)/(.8+Math.min(5,f.tier)*.04),0).applyQuaternion(f.root.quaternion.clone().invert()));
 for(const m of f.materials)if(m.uniforms?.uSpan)m.uniforms.uSpan.value=f.travel;updateUltimate(THREE,f,0);return f;
}
export function recycleUltimate(f){f.root.removeFromParent();let list=pool.get(f.family);if(!list)pool.set(f.family,list=[]);if(list.length<3)list.push(f);else disposeUltimate(f);}
