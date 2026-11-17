import * as THREE from 'three';
import {artworkDefinitions} from './shared/artwork-library.js';

// Only the thirteen original exhibition works use display decks and pedestals.
// Player uploads have no surrounding discs, staircases or cone bases.
export class DisplayPlatforms{
 constructor(arena){
  this.arena=arena;this.discs=[];
  this.geometry=new THREE.CylinderGeometry(1,1.06,.4,48);
  this.coneGeometry=new THREE.ConeGeometry(1,1,3,1);
  this.highlight=new THREE.Mesh(new THREE.CylinderGeometry(1.015,1.07,.45,48),new THREE.MeshBasicMaterial({color:'#1676ff',transparent:true,opacity:.88,depthTest:true,depthWrite:false,toneMapped:false}));
  this.highlight.name='GM selected disc (delete mode)';this.highlight.visible=false;arena.scene.add(this.highlight);this.selectedKey=null;
  this.material=new THREE.MeshPhysicalMaterial({color:'#E84887',roughness:.25,metalness:.1,clearcoat:.8,iridescence:.6,emissive:'#E84887',emissiveIntensity:.06});
  this.coneMaterial=new THREE.MeshStandardMaterial({color:'#777d85',roughness:.89,metalness:.06,flatShading:true});
 }
 sync(){
  const a=this.arena,defs=artworkDefinitions(a.world);
  const signature=JSON.stringify([a.world?.artworkLayout||a.defaultLayout,a.world?.floatingPlatforms,defs.map(d=>d.id),a.artworks.size,a.world?.removedPlatformIds,defs.map(d=>a.artworks.get(d.id)?.userData.previewPlatformRadius??null)]);
  if(signature===this.signature)return;this.signature=signature;
  const discs=[],cones=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  const customIds=new Set((a.world?.customArtworks||[]).map(d=>d.id)),removed=new Set(a.world?.removedPlatformIds||[]);
  for(const d of defs){
   if(customIds.has(d.id))continue;
   const root=a.artworks.get(d.id);if(!root)continue;
   let box=root.userData.displayBounds;
   if(!box){
    root.updateMatrixWorld(true);
    const inverse=root.matrixWorld.clone().invert();box=new THREE.Box3();
    root.traverse(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();
     box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));
    });
    root.userData.displayBounds=box;
   }
   const l=a.world?.artworkLayout?.[d.id]||a.defaultLayout[d.id]||{position:d.artPosition,rotation:[0,d.artYaw,0],scale:[1,1,1]};
   const transformed=box.clone().applyMatrix4(matrix.compose(new THREE.Vector3(),q.setFromEuler(new THREE.Euler(...l.rotation)),scale.fromArray(l.scale)));
   // Exhibition decks are world fixtures: moving the artwork does not relocate its floor.
   const top=Math.max(0,d.size[1]);
   // Radius is a standalone GM-editable property, never hard-locked to art scale.
   const automatic=Math.max(2.4,Math.min(8,Math.max(transformed.max.x-transformed.min.x,transformed.max.z-transformed.min.z)*.54+.75));
   const chosenRadius=root.userData.previewPlatformRadius??l.platformRadius;
   const radius=Number.isFinite(chosenRadius)?THREE.MathUtils.clamp(chosenRadius,1.5,14):automatic;
   const position=[d.position[0],top-.2,d.position[2]];
   if(!removed.has('display:'+d.id)){
    discs.push({position,radius,top,artwork:d.id,display:true,key:'display:'+d.id});
    // Deleting the disc removes its support, never the artwork.
    const coneHeight=.62;
    cones.push({position:[position[0],top+coneHeight*.5+.015,position[2]],radius:Math.min(.72,Math.max(.3,radius*.13)),height:coneHeight,artwork:d.id});
   }
   // Narrow jumpable access steps remain independent of artwork dimensions.
   const steps=Math.max(10,Math.ceil(top/1.7));
   const angle=Math.atan2(position[2],position[0]);
   for(let i=0;i<steps;i++){
    const t=(i+1)/(steps+1),dist=radius+1.2+(1-t)*4;
    const turn=angle+(1-t)*Math.PI*1.6,x=position[0]+Math.cos(turn)*dist,z=position[2]+Math.sin(turn)*dist,stepTop=Math.max(.15,top*t);
    const key='stair:'+d.id+':'+i;
    if(!removed.has(key))discs.push({position:[x,stepTop-.2,z],top:stepTop,radius:2.7,artwork:d.id,stair:true,key});
   }
  }
  for(const d of a.world?.floatingPlatforms||[])discs.push({position:[d.position[0],d.position[1]-.2,d.position[2]],top:d.position[1],radius:d.radius*2,id:d.id,key:'floating:'+d.id});
  for(const mesh of [this.mesh,this.pedestals]){mesh?.removeFromParent();mesh?.dispose();}
  const draw=(list,name,geometry,material)=>{
   if(!list.length)return null;
   const mesh=new THREE.InstancedMesh(geometry,material,list.length);mesh.name=name;
   list.forEach((d,i)=>{
    mesh.setMatrixAt(i,matrix.compose(new THREE.Vector3(...d.position),q.identity(),scale.set(d.radius,d.height||1,d.radius)));
   });
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();a.scene.add(mesh);return mesh;
  };
  this.mesh=draw(discs,'Original artwork platforms and access stairs',this.geometry,this.material);
  this.pedestals=draw(cones,'Gray triangular-cone artwork pedestals',this.coneGeometry,this.coneMaterial);
  this.discs=discs;this.select(this.selectedKey);
 }
 select(key){
  const disc=this.discs.find(d=>d.key===key);
  this.selectedKey=disc?.key||null;this.highlight.visible=!!disc;
  if(disc){this.highlight.position.set(...disc.position);this.highlight.scale.set(disc.radius,1,disc.radius);}
  return disc||null;
 }
 pick(ray){
  if(!this.mesh)return null;
  const hit=ray.intersectObject(this.mesh,false).find(h=>Number.isInteger(h.instanceId));
  return hit?this.discs[hit.instanceId]||null:null;
 }
 ground(x,z,y){
  let h=0;
  // A disc only supports a foot at/above its top. The old half-metre
  // underside tolerance could latch falling players back onto an edge.
  for(const d of this.discs)if(y>=d.top-.06&&Math.hypot(x-d.position[0],z-d.position[2])<d.radius)h=Math.max(h,d.top);
  return h;
 }
}
