import * as THREE from 'three';
import {artworkDefinitions} from './shared/artwork-library.js';
// A display disc + pedestal and its own walkable chain, instanced in two draws.
export class DisplayPlatforms{
 constructor(arena){this.arena=arena;this.discs=[];this.geometry=new THREE.CylinderGeometry(1,1.06,.4,32);this.material=new THREE.MeshPhysicalMaterial({color:'#E84887',roughness:.25,metalness:.1,clearcoat:.8,iridescence:.6,emissive:'#E84887',emissiveIntensity:.06});}
 sync(){const a=this.arena,defs=artworkDefinitions(a.world),signature=JSON.stringify([a.world?.artworkLayout||a.defaultLayout,a.world?.floatingPlatforms,defs.map(d=>d.id),a.artworks.size]);if(signature===this.signature)return;this.signature=signature;const discs=[],pedestals=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
 for(const d of defs){const root=a.artworks.get(d.id);if(!root)continue;let box=root.userData.displayBounds;if(!box){root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();box=new THREE.Box3();root.traverse(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));});root.userData.displayBounds=box;}
 const l=a.world?.artworkLayout?.[d.id]||a.defaultLayout[d.id]||{position:d.artPosition,rotation:[0,d.artYaw,0],scale:[1,1,1]},b=box.clone().applyMatrix4(matrix.compose(new THREE.Vector3(),q.setFromEuler(new THREE.Euler(...l.rotation)),scale.fromArray(l.scale))),top=Math.max(0,l.position[1]+b.min.y-.1),radius=Math.max(2.3,Math.min(7,Math.max(b.max.x-b.min.x,b.max.z-b.min.z)/2+.8)),position=[l.position[0],top-.2,l.position[2]];
 discs.push({position,radius,top,artwork:d.id,display:true});pedestals.push({position:[position[0],top-.65,position[2]],radius:radius*.35});
 // Max 1.7 rise remains below the original jump's 2-unit apex.
 const steps=Math.max(10,Math.ceil(top/1.7)),angle=Math.atan2(position[2],position[0]);for(let i=0;i<steps;i++){const f=(i+1)/(steps+1),dist=radius+1.2+(1-f)*4,turn=angle+(1-f)*Math.PI*1.6,x=position[0]+Math.cos(turn)*dist,z=position[2]+Math.sin(turn)*dist;discs.push({position:[x,Math.max(.15,top*f)-.2,z],top:Math.max(.15,top*f),radius:1.35,artwork:d.id});}}
 for(const d of a.world?.floatingPlatforms||[])discs.push({position:[d.position[0],d.position[1]-.2,d.position[2]],top:d.position[1],radius:d.radius,id:d.id});
 for(const old of [this.mesh,this.pedestals]){old?.removeFromParent();old?.dispose();}const make=(list,name,height)=>{const mesh=new THREE.InstancedMesh(this.geometry,this.material,list.length);mesh.name=name;list.forEach((d,i)=>mesh.setMatrixAt(i,matrix.compose(new THREE.Vector3(...d.position),q.identity(),scale.set(d.radius,height,d.radius))));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();a.scene.add(mesh);return mesh;};this.mesh=make(discs,'Artwork discs and individual stairs',1);this.pedestals=make(pedestals,'Small artwork pedestals',1.25);this.discs=discs;
 }
 ground(x,z,y){let h=0;for(const d of this.discs)if(y>=d.top-.5&&Math.hypot(x-d.position[0],z-d.position[2])<d.radius)h=Math.max(h,d.top);return h;}
}
