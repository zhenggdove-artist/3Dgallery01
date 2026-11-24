import * as THREE from 'three';
import {makeHeldWeapon} from './reletter/held-weapons.js';
import {isSpellWeapon,makeSpellEquipment} from './spell-equipment.js';
import {createHeadgear} from './reletter/headgear-model.js';
import {attachOutfit,disposeOutfit} from './reletter/outfit-model.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {orientPortraitModel} from './equipment-portrait.js';
import {createWings} from './reletter/garden-art.js';
import {itemById} from './shared/catalog.js';
import {comfortCashImage} from './comfort-cash-art.js';

// Only the actual model (or the outfit's authored full-resolution artwork)
// may appear in SHOP/BAG. There is no legacy glyph or temporary icon layer.
// Shared promises prevent redundant GPU work across both panels.
const finished=new Map(),pending=new Map(),failed=new Set();
let renderer,scene,camera,queue=Promise.resolve();
let previewCharacterSource=null,previewIdleEnabled=false,previewIdleTimer=null;
export function setOutfitPreviewCharacter(source){previewCharacterSource=source||null;}

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
   url=await renderPreview(item);
   finished.set(key,url);
   return url;
  }catch(error){
   failed.add(key);
   console.warn('Full equipment preview unavailable',item.id,error);
   return null;
  }finally{pending.delete(key);if(!pending.size&&previewIdleEnabled){clearTimeout(previewIdleTimer);previewIdleTimer=setTimeout(()=>{if(!pending.size)releasePreviewRenderer();},1500);}}
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
 // Product images are encoded blobs; they do not depend on the preview GL context.
 // Release its framebuffer, program cache and GPU allocations before gameplay.
 await queue;
 releasePreviewRenderer();previewIdleEnabled=true;
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
 if(!previewCharacterSource)throw Error('Character GLB must load before outfit portraits');
 // Same skinned body, fabric shader and attachment method as an equipped
 // original outfit. Never show a primitive-body stand-in in SHOP or BAG.
 const model=cloneSkeleton(previewCharacterSource);
 model.scale.setScalar(100);
 model.traverse(object=>{
  if(object.isMesh){
   if(object.geometry)object.geometry=object.geometry.clone();
   const materials=Array.isArray(object.material)?object.material:[object.material];
   const copies=materials.map(mat=>mat?.clone()).filter(Boolean);
   if(copies.length)object.material=Array.isArray(object.material)?copies:copies[0];
  }
  if(object.isSkinnedMesh)object.skeleton.pose();
 });
 model.updateMatrixWorld(true);
 const outfit=attachOutfit(THREE,model,item,{hood:true});
 if(!outfit)throw Error('Creature outfit could not attach to skeleton: '+item.id);
 model.userData.previewOutfitRecord=outfit;
 orientPortraitModel(model,{precise:false});
 model.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2));
 // The wooden horse product image was rolled sideways; correct only the portrait.
 if(item.creature==='wooden-horse-disguise')model.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2));
 model.updateMatrixWorld(true);
 return model;
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
// Creature outfits are photographed with the full animated character, which
// occupies much less of the initial square camera frame than an old, tightly
// cropped outfit illustration. Trim only the transparent margins; do not
// enlarge the actual equipped model or any other product category.
export function cropCreatureOutfitPortrait(source){
 const width=source.width,height=source.height;
 const source2d=document.createElement('canvas');
 source2d.width=width;source2d.height=height;
 const ctx=source2d.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(source,0,0);
 const pixels=ctx.getImageData(0,0,width,height).data;
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(pixels[(y*width+x)*4+3]<32)continue;
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);
  minY=Math.min(minY,y);maxY=Math.max(maxY,y);
 }
 if(maxX<minX||maxY<minY)return source2d;
 const side=Math.max(maxX-minX+1,maxY-minY+1)/.86;
 const centerX=(minX+maxX)*.5,centerY=(minY+maxY)*.5;
 const result=document.createElement('canvas');
 result.width=width;result.height=height;
 const out=result.getContext('2d');
 out.imageSmoothingEnabled=true;out.imageSmoothingQuality='high';
 out.drawImage(source2d,centerX-side*.5,centerY-side*.5,side,side,0,0,width,height);
 return result;
}

function releasePreviewRenderer(){
 if(!renderer)return;
 renderer.dispose();renderer.forceContextLoss();
 renderer=null;scene=null;camera=null;
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
 const creatureSuit=item.slot==='outfit';
 const portraitMask=['trump-mask','huang-mask','musk-mask','xi-mask','putin-mask','kim-mask'].includes(item.design);const resolution=portraitMask?768:creatureSuit?768:192;renderer.setSize(resolution,resolution);
 const model=item.family==='saber'?saberProductPortrait():creatureSuit?creatureOutfitProductPortrait(item):shapeModel(item);
 scene.add(model);model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
 const size=box.getSize(new THREE.Vector3()),distance=Math.max(size.x,size.y,size.z,.1)*(item.design==='disguise'?2.15:item.slot==='outfit'?1.75:portraitMask?1.8:2.2);
 camera.position.copy(center).add((item.design==='disguise'?new THREE.Vector3(.55,.15,1):item.family==='saber'||item.slot==='outfit'||['trump-mask','huang-mask','musk-mask','xi-mask','putin-mask','kim-mask'].includes(item.design)?new THREE.Vector3(0,.02,1):new THREE.Vector3(.65,.35,1)).normalize().multiplyScalar(distance));
 camera.near=Math.max(.001,distance*.01);camera.far=Math.max(100,distance*8);camera.updateProjectionMatrix();
 camera.lookAt(center);
 try{
  if(model.portraitReady)await model.portraitReady;
  await renderer.compileAsync(scene,camera);
  renderer.render(scene,camera);
  const portrait=creatureSuit?cropCreatureOutfitPortrait(renderer.domElement):renderer.domElement;
  const blob=await new Promise(resolve=>portrait.toBlob(resolve,creatureSuit||portraitMask?'image/png':'image/webp',.96));
  if(!blob)throw Error('WebGL preview image encoding failed');
  // Decode during loading, not when the inventory is first opened.
  const url=URL.createObjectURL(blob);
  try{await preloadImage(url);}catch(error){URL.revokeObjectURL(url);throw error;}
  return url;
 }finally{
  if(model.userData.previewOutfitRecord){disposeOutfit(model.userData.previewOutfitRecord);delete model.userData.previewOutfitRecord;}
  model.portraitDisposed=true;model.portraitTexture?.dispose();
  model.removeFromParent();
  const geometries=new Set(),materials=new Set();
  model.traverse(o=>{
   if(o.geometry)geometries.add(o.geometry);
   for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);
  });
  model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose?.();});
  geometries.forEach(g=>{if(!g.userData?.sharedPreview)g.dispose();});
  materials.forEach(m=>{if(!m.userData?.sharedPreview)m.dispose();});
  if(!model.userData.texture?.userData.sharedGarden)model.userData.texture?.dispose();
 }
}
