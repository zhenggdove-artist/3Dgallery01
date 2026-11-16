import * as THREE from 'three';
import {artworkDefinitions} from './shared/artwork-library.js';
import {PLATFORMS} from './shared/arena.js';

// Only original gallery works receive walkable pink discs and pedestals.
const originals=new Set(PLATFORMS.map(d=>d.id));
export class DisplayPlatforms{
 constructor(arena){
  this.arena=arena;this.discs=[];
  this.geometry=new THREE.CylinderGeometry(1,1.06,.4,32);
  this.material=new THREE.MeshPhysicalMaterial({color:'#E84887',roughness:.25,metalness:.1,clearcoat:.8,iridescence:.6,emissive:'#E84887',emissiveIntensity:.06});
  this.pedestalGeometry=new THREE.CylinderGeometry(.68,1,1,3);
  this.pedestalMaterial=new THREE.MeshStandardMaterial({color:'#878990',metalness:.16,roughness:.68,flatShading:true});
 }
 sync(){
  const a=this.arena,defs=artworkDefinitions(a.world);
  const editing=[...a.artworks.values()].filter(r=>r.userData.editing).map(r=>[r.userData.platformId,r.userData.previewDiscRadius,r.position.toArray(),r.rotation.toArray(),r.scale.toArray()]);
  const signature=JSON.stringify([a.world?.artworkLayout||a.defaultLayout,a.world?.floatingPlatforms,defs.map(d=>d.id),a.artworks.size,editing]);
  if(signature===this.signature)return;this.signature=signature;
  const discs=[],pedestals=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const d of defs){
   if(!originals.has(d.id))continue;
   const root=a.artworks.get(d.id);if(!root)continue;
   let box=root.userData.displayBounds;
   if(!box){root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();box=new THREE.Box3();root.traverse(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));});root.userData.displayBounds=box;}
   const saved=a.world?.artworkLayout?.[d.id]||a.defaultLayout[d.id]||{position:d.artPosition,rotation:[0,d.artYaw,0],scale:[1,1,1]};
   const l=root.userData.editing?{...saved,position:root.position.toArray(),rotation:[root.rotation.x,root.rotation.y,root.rotation.z],scale:root.scale.toArray(),discRadius:root.userData.previewDiscRadius??saved.discRadius}:saved;
   const b=box.clone().applyMatrix4(matrix.compose(new THREE.Vector3(),q.setFromEuler(new THREE.Euler(...l.rotation)),scale.fromArray(l.scale)));
   const artBottom=l.position[1]+b.min.y,top=Math.max(0,artBottom-1.25);
   const naturalRadius=2*Math.max(2.3,Math.min(7,Math.max(b.max.x-b.min.x,b.max.z-b.min.z)/2+.8));
   const radius=Number.isFinite(l.discRadius)?THREE.MathUtils.clamp(l.discRadius,2,24):naturalRadius;
   const position=[l.position[0],top-.2,l.position[2]];
   discs.push({position,radius,top,artwork:d.id,display:true});
   const h=Math.max(.18,Math.min(1.25,artBottom-top));
   pedestals.push({position:[position[0],top+h*.5,position[2]],radius:Math.min(2.1,radius*.28),height:h});
   const steps=Math.max(10,Math.ceil(top/1.7)),angle=Math.atan2(position[2],position[0]);
   for(let i=0;i<steps;i++){
    const f=(i+1)/(steps+1),dist=radius+1.2+(1-f)*4,turn=angle+(1-f)*Math.PI*1.6;
    discs.push({position:[position[0]+Math.cos(turn)*dist,Math.max(.15,top*f)-.2,position[2]+Math.sin(turn)*dist],top:Math.max(.15,top*f),radius:2.7,artwork:d.id});
   }
  }
  for(const d of a.world?.floatingPlatforms||[])discs.push({position:[d.position[0],d.position[1]-.2,d.position[2]],top:d.position[1],radius:d.radius*2,id:d.id});
  for(const old of [this.mesh,this.pedestals])old?.removeFromParent();
  const make=(list,name,geometry,material)=>{const mesh=new THREE.InstancedMesh(geometry,material,list.length);mesh.name=name;list.forEach((d,i)=>mesh.setMatrixAt(i,matrix.compose(new THREE.Vector3(...d.position),q.identity(),scale.set(d.radius,d.height||1,d.radius))));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();a.scene.add(mesh);return mesh;};
  this.mesh=make(discs,'Artwork discs and individual stairs',this.geometry,this.material);
  this.pedestals=make(pedestals,'Small artwork pedestals',this.pedestalGeometry,this.pedestalMaterial);
  this.discs=discs;
 }
 ground(x,z,y){let h=0;for(const d of this.discs)if(y>=d.top-.5&&Math.hypot(x-d.position[0],z-d.position[2])<d.radius)h=Math.max(h,d.top);return h;}
}
