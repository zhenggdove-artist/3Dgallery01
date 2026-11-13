import * as THREE from 'three';
import {makeHeldWeapon} from './reletter/held-weapons.js';
import {createHeadgear} from './reletter/headgear-model.js';
import {createWings} from './reletter/garden-art.js';
import {itemIcon} from './reletter/item-art.js';

// One offscreen context, rendered once per item; never one renderer per card.
const cache=new Map();let renderer,scene,camera;
export function itemPreview(item){
 if(cache.has(item.id))return cache.get(item.id);
 if(!['weapon','head','wings','rod','tool'].includes(item.slot))return itemIcon(item);
 if(!renderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setPixelRatio(1);scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x786c86,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);camera=new THREE.PerspectiveCamera(35,1,.01,1000);}
 const model=item.slot==='head'?createHeadgear(THREE,item):item.slot==='wings'?createWings(THREE,item):makeHeldWeapon(item);
 scene.add(model);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),distance=Math.max(size.x,size.y,size.z,.1)*2.2;
 camera.position.copy(center).add(new THREE.Vector3(.65,.35,1).normalize().multiplyScalar(distance));camera.lookAt(center);renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/webp');cache.set(item.id,url);
 model.removeFromParent();const geometries=new Set(),materials=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());return url;
}
