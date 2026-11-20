import * as THREE from 'three';
import {makeHeldWeapon} from './reletter/held-weapons.js';
import {isSpellWeapon,makeSpellEquipment} from './spell-equipment.js';
import {createHeadgear} from './reletter/headgear-model.js';
import {createWings} from './reletter/garden-art.js';
import {itemById} from './shared/catalog.js';

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
 if(finished.has(key))return Promise.resolve(finished.get(key));
 if(failed.has(key))return Promise.resolve(null);
 if(pending.has(key))return pending.get(key);
 const job=queue.then(async()=>{
  try{
   let url;
   if(item.slot==='outfit'){
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
 const url=itemPreviewUrl(item);
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
  // In combat the shield is a luminous spherical barrier.
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.93,40,28),new THREE.MeshStandardMaterial({
   color,emissive:color,emissiveIntensity:.45,transparent:true,opacity:.48,
   metalness:.18,roughness:.12,depthWrite:false,side:THREE.DoubleSide
  }));
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.9,.055,12,64),new THREE.MeshStandardMaterial({
   color:color.clone().lerp(new THREE.Color('#ffffff'),.55),metalness:.65,roughness:.23
  }));
  rim.rotation.y=Math.PI/5;group.add(shell,rim);
 }else throw Error('No full equipment preview model for '+item.slot);
 return group;
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
 const model=shapeModel(item);
 scene.add(model);model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
 const size=box.getSize(new THREE.Vector3()),distance=Math.max(size.x,size.y,size.z,.1)*2.2;
 camera.position.copy(center).add(new THREE.Vector3(.65,.35,1).normalize().multiplyScalar(distance));
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
