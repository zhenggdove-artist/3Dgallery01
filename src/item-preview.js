import * as THREE from 'three';
import {makeHeldWeapon} from './reletter/held-weapons.js';
import {isSpellWeapon,makeSpellEquipment} from './spell-equipment.js';
import {createHeadgear} from './reletter/headgear-model.js';
import {createWings} from './reletter/garden-art.js';
import {itemById} from './shared/catalog.js';
import {comfortCashImage} from './comfort-cash-art.js';

// Only the actual model (or the outfit's authored full-resolution artwork)
// may appear in SHOP/BAG. There is no legacy glyph or temporary icon layer.
// Shared promises prevent redundant GPU work across both panels.
const finished=new Map(),pending=new Map(),failed=new Set();
let renderer,scene,camera,queue=Promise.resolve();
const keyOf=item=>item.id+':'+(item.updatedAt||0);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const itemPreviewUrl=item=>item?finished.get(keyOf(item))||null:null;
export const previewCount=()=>({ready:finished.size,pending:pending.size,failed:failed.size});
export function itemPreview(item){
 if(!item)return Promise.resolve(null);
 const key=keyOf(item);
 if(item.slot==='consumable'){
  const image=comfortCashImage(item);
  finished.set(key,image);
  return Promise.resolve(image);
 }
 if(finished.has(key))return Promise.resolve(finished.get(key));
 if(failed.has(key))return Promise.resolve(null);
 if(pending.has(key))return pending.get(key);
 const job=queue.then(async()=>{
  try{
   let url;
   if(item.slot==='outfit'&&!item.creature){
    // These are actual authored outfit illustrations, not old inventory icons.
    url='./art/outfits/'+encodeURIComponent(item.id)+'.webp';
    await preloadImage(url);
   }else url=await renderPreview(item);
   finished.set(key,url);
   return url;
  }catch(error){
   failed.add(key);
   console.warn('Full equipment preview unavailable',item.id,error);
   return null;
  }finally{pending.delete(key);}
 });
 pending.set(key,job);
 queue=job.then(()=>undefined,()=>undefined);
 return job;
}
async function preloadImage(url){
 const image=new Image();image.decoding='async';image.src=url;
 if(image.decode)await image.decode();
 else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
}
export async function warmItemPreviews(items,onProgress=()=>{}){
 const unique=[...new Map((items||[]).filter(Boolean).map(i=>[keyOf(i),i])).values()];
 for(let i=0;i<unique.length;i++){
  await itemPreview(unique[i]);
  onProgress(i+1,unique.length);
  if(i%6===5)await new Promise(resolve=>requestAnimationFrame(resolve));
 }
 return previewCount();
}
// Always creates the actual detailed preview. Entire sets are updated in one
// DOM turn after the required assets resolve, never as a visible glyph cascade.
export function previewMarkup(item){
 const url=item?.slot==='consumable'?comfortCashImage(item):itemPreviewUrl(item);
 return url?'<img data-preview="'+escape(item.id)+'" src="'+escape(url)+'" alt="" decoding="async" loading="eager">':
  '<span class="equipment-preview-pending" data-preview="'+escape(item.id)+'" aria-label="Loading full equipment model"></span>';
}
export async function hydrateItemPreviews(root){
 const nodes=[...root.querySelectorAll('.equipment-preview-pending[data-preview]')];
 if(!nodes.length)return;
 const items=[...new Set(nodes.map(n=>n.dataset.preview))].map(itemById).filter(Boolean);
 await Promise.all(items.map(itemPreview));
 if(!root.isConnected)return;
 for(const node of nodes){
  if(!node.isConnected)return;
  const item=itemById(node.dataset.preview),url=itemPreviewUrl(item);
  if(!url){node.textContent='Preview unavailable';node.classList.add('equipment-preview-error');continue;}
  const img=document.createElement('img');
  img.dataset.preview=item.id;img.src=url;img.alt='';img.decoding='async';img.loading='eager';
  node.replaceWith(img);
 }
}
function shapeModel(item){
 if(item.slot==='head')return createHeadgear(THREE,item);
 if(item.slot==='wings')return createWings(THREE,item);
 if(item.slot==='weapon'||item.slot==='rod'||item.slot==='tool')
  return isSpellWeapon(item)?makeSpellEquipment(item):makeHeldWeapon(item);
 const group=new THREE.Group(),color=new THREE.Color(item.color||'#a6b8c5');
 if(item.slot==='armor'){
  // Armor is a body stat in the arena; preview its complete protective plate.
  const metal=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.28,side:THREE.DoubleSide});
  const plate=new THREE.Mesh(new THREE.CylinderGeometry(.64,.87,1.22,12,1,true),metal);
  plate.scale.z=.5;group.add(plate);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(.65,.063,10,36),new THREE.MeshStandardMaterial({color:'#f3cf88',metalness:.8,roughness:.2}));
  trim.rotation.x=Math.PI/2;trim.position.y=.52;group.add(trim);
 }else if(item.slot==='shield'){
  // The old translucent sphere + torus projected as an anonymous pastel disc,
  // making all ten real shield items appear to be broken inventory entries.
  // Preview a recognisable physical shield, not the in-combat bubble field.
  const outline=new THREE.Shape();
  outline.moveTo(0,-.91);
  outline.bezierCurveTo(-.44,-.65,-.79,-.10,-.72,.61);
  outline.quadraticCurveTo(-.35,.90,0,.93);
  outline.quadraticCurveTo(.35,.90,.72,.61);
  outline.bezierCurveTo(.79,-.10,.44,-.65,0,-.91);
  const back=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{
   depth:.11,steps:1,curveSegments:12,bevelEnabled:true,
   bevelSize:.035,bevelThickness:.025,bevelSegments:2
  }),new THREE.MeshStandardMaterial({
   color:'#d9b975',metalness:.76,roughness:.27,side:THREE.DoubleSide
  }));
  group.add(back);
  const enamel=new THREE.Mesh(new THREE.ShapeGeometry(outline,16),
   new THREE.MeshStandardMaterial({color,metalness:.30,roughness:.32,
    emissive:color,emissiveIntensity:.15,side:THREE.DoubleSide}));
  enamel.scale.set(.84,.84,1);enamel.position.z=.18;group.add(enamel);
  const spine=new THREE.Mesh(new THREE.BoxGeometry(.075,1.43,.052),
   new THREE.MeshStandardMaterial({color:'#f4e0a3',metalness:.76,roughness:.21}));
  spine.position.set(0,.05,.23);group.add(spine);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.19,0),
   new THREE.MeshStandardMaterial({color:color.clone().lerp(new THREE.Color('#ffffff'),.52),
    emissive:color,emissiveIntensity:.34,metalness:.40,roughness:.18}));
  gem.position.set(0,.26,.28);gem.rotation.z=Math.PI/4;group.add(gem);
  // Three separate lower facets keep the shape legible at inventory size.
  for(const side of [-1,1]){
   const brace=new THREE.Mesh(new THREE.BoxGeometry(.045,.71,.045),
    new THREE.MeshStandardMaterial({color:'#ffe4a4',metalness:.68,roughness:.25}));
   brace.position.set(side*.24,-.25,.22);brace.rotation.z=side*.38;group.add(brace);
  }
 }else throw Error('No full equipment preview model for '+item.slot);
 return group;
}
// Shop renders the complete luminous blue blade and its contrasting hilt.
// This dedicated camera-facing model changes only the product portrait.
// Lightweight 3D SHOP portrait for procedurally created creature outfits.
// Uses the exact same animal hood sculpture as the equipped costume.
function creatureOutfitProductPortrait(item){
 const g=new THREE.Group(),color=new THREE.Color(item.color||'#94b8cb');
 const fabric=new THREE.MeshStandardMaterial({color,roughness:.76});
 const pale=new THREE.MeshStandardMaterial({color:'#f0e7d9',roughness:.8});
 const metal=new THREE.MeshStandardMaterial({color:'#363c48',roughness:.64});
 const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;};
 add(new THREE.CylinderGeometry(.45,.52,1.35,12),fabric,0,-.45,0);
 add(new THREE.SphereGeometry(.30,16,12),pale,0,-.35,.45).scale.set(1,1.25,.2);
 for(const side of [-1,1]){
  const arm=add(new THREE.CapsuleGeometry(.16,.82,4,8),fabric,side*.62,-.35,0);arm.rotation.z=-side*.28;
  add(new THREE.CapsuleGeometry(.18,.45,4,8),fabric,side*.27,-1.38,0);
  add(new THREE.BoxGeometry(.32,.16,.45),metal,side*.27,-1.68,.09);
 }
 const hood=createHeadgear(THREE,{...item,design:item.creature});
 hood.scale.setScalar(.57);hood.position.set(0,.61,.06);g.add(hood);
 return g;
}
function saberProductPortrait(){
 const g=new THREE.Group();
 const dark=new THREE.MeshStandardMaterial({color:'#152334',metalness:.62,roughness:.32});
 const chrome=new THREE.MeshStandardMaterial({color:'#a8c2d7',metalness:.85,roughness:.18});
 const blue=new THREE.MeshBasicMaterial({color:'#238dff'});
 const white=new THREE.MeshBasicMaterial({color:'#d9f7ff'});
 const aura=new THREE.MeshBasicMaterial({color:'#188fff',transparent:true,opacity:.36,depthWrite:false,blending:THREE.AdditiveBlending});
 const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;};
 add(new THREE.CylinderGeometry(.13,.12,.86,16),dark,0,-.96,0);
 add(new THREE.CylinderGeometry(.16,.16,.13,16),chrome,0,-1.44,0);
 for(let i=0;i<7;i++)add(new THREE.TorusGeometry(.132,.013,6,24),chrome,0,-1.27+i*.105,0).rotation.x=Math.PI/2;
 add(new THREE.CylinderGeometry(.21,.16,.16,16),chrome,0,-.47,0);
 add(new THREE.BoxGeometry(.62,.10,.17),chrome,0,-.44,0);
 add(new THREE.CylinderGeometry(.11,.12,2.55,16),aura,0,.93,0);
 add(new THREE.CylinderGeometry(.076,.086,2.51,16),blue,0,.95,0);
 add(new THREE.CylinderGeometry(.026,.039,2.49,12),white,0,.96,.069);
 add(new THREE.SphereGeometry(.092,12,8),white,0,2.20,0);
 g.rotation.z=-.12;
 return g;
}
async function renderPreview(item){
 if(!renderer){
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(192,192);renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x786c86,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
  camera=new THREE.PerspectiveCamera(35,1,.01,1000);
 }
 const model=item.family==='saber'?saberProductPortrait():item.slot==='outfit'&&item.creature?creatureOutfitProductPortrait(item):shapeModel(item);
 scene.add(model);model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
 const size=box.getSize(new THREE.Vector3()),distance=Math.max(size.x,size.y,size.z,.1)*2.2;
 camera.position.copy(center).add((item.family==='saber'?new THREE.Vector3(0,.06,1):new THREE.Vector3(.65,.35,1)).normalize().multiplyScalar(distance));
 camera.lookAt(center);
 try{
  await renderer.compileAsync(scene,camera);
  renderer.render(scene,camera);
  const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/webp',.92));
  if(!blob)throw Error('WebGL preview image encoding failed');
  // Decode during loading, not when the inventory is first opened.
  const url=URL.createObjectURL(blob);
  try{await preloadImage(url);}catch(error){URL.revokeObjectURL(url);throw error;}
  return url;
 }finally{
  model.removeFromParent();
  const geometries=new Set(),materials=new Set();
  model.traverse(o=>{
   if(o.geometry)geometries.add(o.geometry);
   for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);
  });
  geometries.forEach(g=>{if(!g.userData?.sharedPreview)g.dispose();});
  materials.forEach(m=>{if(!m.userData?.sharedPreview)m.dispose();});
  if(!model.userData.texture?.userData.sharedGarden)model.userData.texture?.dispose();
 }
}
