import * as THREE from 'three';
// Keep the authored vertex buffers, lot IDs, shader deformation and collision
// data intact. Only draw indices of batches that can intersect the camera.
export class CityVisibleIndices{
 constructor(geometry,mesh=null){
  this.geometry=geometry;
  const index=geometry.index,positions=geometry.attributes.position,ids=geometry.attributes.cityLotId;
  this.source=index.array.slice();this.runs=[];const bounds=new Map();
  for(let i=0;i<positions.count;i++){
   const id=ids.getX(i);if(id<0)continue;
   let b=bounds.get(id);if(!b){b=new THREE.Box3();bounds.set(id,b);}
   const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
   b.min.x=Math.min(b.min.x,x);b.min.y=Math.min(b.min.y,y);b.min.z=Math.min(b.min.z,z);
   b.max.x=Math.max(b.max.x,x);b.max.y=Math.max(b.max.y,y);b.max.z=Math.max(b.max.z,z);
  }
  // Diagonal corner displacement <= sqrt(2)*2.65, shear <= .35,
  // plus shake. Hidden faces are moved down to -120 by the existing system.
  for(const box of bounds.values()){box.expandByScalar(8);box.min.y=Math.min(-128,box.min.y);}
  for(let start=0;start<this.source.length;){
   const id=ids.getX(this.source[start]);let end=start+3;
   while(end<this.source.length&&ids.getX(this.source[end])===id)end+=3;
   this.runs.push({start,end,view:this.source.subarray(start,end),box:bounds.get(id),active:true});start=end;
  }
  index.setUsage(THREE.DynamicDrawUsage);geometry.setDrawRange(0,this.source.length);
  // Rendering compaction must not change picking/raycast results. The full
  // CPU index view is restored for raycasts only; never uploaded to the GPU.
  if(mesh){const raycast=mesh.raycast,full=new THREE.BufferAttribute(this.source,1);mesh.raycast=function(raycaster,hits){const draw=geometry.drawRange,count=draw.count,start=draw.start,renderIndex=geometry.index;geometry.index=full;geometry.setDrawRange(0,full.count);try{return raycast.call(this,raycaster,hits);}finally{geometry.index=renderIndex;geometry.setDrawRange(start,count);}};}
 }
 prepare(frustum){
  let changed=false;
  for(const run of this.runs){const visible=!run.box||frustum.intersectsBox(run.box);if(visible!==run.active){run.active=visible;changed=true;}}
  if(!changed)return;
  const index=this.geometry.index;let n=0;
  for(const run of this.runs)if(run.active){index.array.set(run.view,n);n+=run.view.length;}
  this.geometry.setDrawRange(0,n);
  if(n){index.clearUpdateRanges();index.addUpdateRange(0,n);index.needsUpdate=true;}
 }
}
