import * as THREE from 'three';
import {farMesh,updateResidency} from './render-residency.js';
import {surfaceInfo,surfaceFace} from './shared/space-paint-surface.js';
import {SpacePaintTexture} from './space-paint-texture.js';
import {isSurfaceCheckpoint} from './shared/space-paint-raster.js';
import {cityGroundHeight} from './shared/city-layout.js';
import {SPACE_PAINT_MAX_POINTS,spacePaintPointAllowed} from './shared/space-paint.js';

const SIDES=12;
// A camera-facing drawing plane provides independent width and depth.
// One indexed mesh for all completed strokes; one temporary mesh while drawing.
export function spacePaintGeometry(strokes){
 const positions=[],indices=[],colors=[],ranges=[];
 const color=new THREE.Color(),normal=new THREE.Vector3(),side=new THREE.Vector3(),tangent=new THREE.Vector3();
 const a=new THREE.Vector3(),b=new THREE.Vector3(),center=new THREE.Vector3();
 for(const s of strokes){
  if(!s.points?.length)continue;
  const start=indices.length/3;normal.fromArray(s.normal).normalize();color.set(s.color);
  const radius=s.size,depth=s.thickness/2,points=s.points.map(p=>new THREE.Vector3(...p));
  const scales=[];
  if(points.length===1){
   // Round dot, using the same closed mesh as longer strokes.
   const axis=new THREE.Vector3(1,0,0).addScaledVector(normal,-normal.x);
   if(axis.lengthSq()<.01)axis.set(0,1,0).addScaledVector(normal,-normal.y);
   axis.normalize();const p=points[0];
   points.splice(0,1,p.clone().addScaledVector(axis,-radius*.999),p,p.clone().addScaledVector(axis,radius*.999));scales.push(.045,1,.045);
  }
  const base=positions.length/3;
  const vertex=(x,y,z)=>{positions.push(x,y,z);colors.push(color.r,color.g,color.b);};
  for(let i=0;i<points.length;i++){
   center.copy(points[i]);
   a.copy(points[Math.max(0,i-1)]);b.copy(points[Math.min(points.length-1,i+1)]);
   tangent.subVectors(b,a);
   if(tangent.lengthSq()<1e-8)tangent.subVectors(points[Math.min(points.length-1,i+1)],center);
   if(tangent.lengthSq()<1e-8)tangent.subVectors(center,points[Math.max(0,i-1)]);
   tangent.addScaledVector(normal,-tangent.dot(normal)).normalize();
   side.crossVectors(normal,tangent).normalize();
   const scale=scales[i]??1;
   for(let j=0;j<SIDES;j++){
    const angle=j*Math.PI*2/SIDES,u=Math.cos(angle)*radius*scale,v=Math.sin(angle)*depth*scale;
    vertex(center.x+side.x*u+normal.x*v,center.y+side.y*u+normal.y*v,center.z+side.z*u+normal.z*v);
    if(i>0){
     const p=base+(i-1)*SIDES+j,q=base+(i-1)*SIDES+(j+1)%SIDES;
     indices.push(p,q,p+SIDES,q,q+SIDES,p+SIDES);
    }
   }
  }
  const first=positions.length/3,last=first+1,p=points[0],q=points.at(-1),end=base+(points.length-1)*SIDES;
  vertex(p.x,p.y,p.z);vertex(q.x,q.y,q.z);
  for(let j=0;j<SIDES;j++){const k=(j+1)%SIDES;indices.push(first,base+k,base+j,last,end+j,end+k);}
  ranges.push({id:s.id,start,end:indices.length/3,info:surfaceInfo(s)});
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 if(positions.length){geometry.computeVertexNormals();geometry.computeBoundingSphere();}
 return {geometry,ranges};
}
// Vertical visual-surface query. The tube's existing face ranges and centreline
// reject distant segments before testing their actual triangles, not avatar colliders.
export function spacePaintGuideHeight(geometry,ranges,x,z,floor){
 const p=geometry.attributes.position.array,index=geometry.index?.array;
 const near=(a,b,r)=>x>=Math.min(a[0],b[0])-r&&x<=Math.max(a[0],b[0])+r&&z>=Math.min(a[2],b[2])-r&&z<=Math.max(a[2],b[2])+r&&Math.max(a[1],b[1])+r>=floor;
 const scan=(start,end)=>{
  for(let f=start;f<end;f++){
   const i=f*3,a=(index?index[i]:i)*3,b=(index?index[i+1]:i+1)*3,c=(index?index[i+2]:i+2)*3;
   const ax=p[a],az=p[a+2],bx=p[b]-ax,bz=p[b+2]-az,cx=p[c]-ax,cz=p[c+2]-az;
   const det=bx*cz-bz*cx;if(Math.abs(det)<1e-12)continue;
   const dx=x-ax,dz=z-az,u=(dx*cz-dz*cx)/det,v=(bx*dz-bz*dx)/det;
   if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)floor=Math.max(floor,p[a+1]+u*(p[b+1]-p[a+1])+v*(p[c+1]-p[a+1]));
  }
 };
 for(const {start,end,info} of ranges){
  const points=info.points,r=Math.max(info.a,info.b)+.0001;
  for(let i=1;i<points.length;i++)if(near(points[i-1],points[i],r))scan(start+(i-1)*SIDES*2,start+i*SIDES*2);
  const first=points[0],last=points.at(-1);
  if(near(first,first,r)||near(last,last,r))scan(start+info.sideFaces,end);
 }
 return floor;
}
// Find the closest actual surface only at stroke start. Existing tube ranges
// provide conservative segment bounds, so distant triangles are never tested.
export function nearestSpacePaintPoint(geometry,ranges,point,out,maxDistanceSquared=Infinity){
 const p=geometry.attributes.position,index=geometry.index?.array;
 const triangle=new THREE.Triangle(),candidate=new THREE.Vector3();
 let best=maxDistanceSquared,found=false;
 const near=(a,b,r)=>{
  const dx=Math.max(0,Math.min(a[0],b[0])-r-point.x,point.x-Math.max(a[0],b[0])-r);
  const dy=Math.max(0,Math.min(a[1],b[1])-r-point.y,point.y-Math.max(a[1],b[1])-r);
  const dz=Math.max(0,Math.min(a[2],b[2])-r-point.z,point.z-Math.max(a[2],b[2])-r);
  return dx*dx+dy*dy+dz*dz<=best;
 };
 const scan=(start,end)=>{
  for(let f=start;f<end;f++){
   const i=f*3;
   triangle.a.fromBufferAttribute(p,index?index[i]:i);
   triangle.b.fromBufferAttribute(p,index?index[i+1]:i+1);
   triangle.c.fromBufferAttribute(p,index?index[i+2]:i+2);
   triangle.closestPointToPoint(point,candidate);
   const d=candidate.distanceToSquared(point);
   if(d<best&&spacePaintPointAllowed(candidate.toArray())){best=d;found=true;out.copy(candidate);}
  }
 };
 for(const {start,end,info} of ranges){
  const points=info.points,r=Math.max(info.a,info.b)+.001;
  for(let i=1;i<points.length;i++)if(near(points[i-1],points[i],r))scan(start+(i-1)*SIDES*2,start+i*SIDES*2);
  const first=points[0],last=points.at(-1);
  if(near(first,first,r)||near(last,last,r))scan(start+info.sideFaces,end);
 }
 return found;
}
// Cache exact triangle-block bounds once for a batch. A surface ray need not
// intersect or sort every triangle in every nearby stroke on each pointer move.
// Atlas conversion retains triangle order; both indexed and nonindexed meshes
// use the same bounds and the same exact Three.js triangle intersection.
export function surfaceRayBlocks(geometry,ranges){
 const p=geometry.attributes.position,index=geometry.index?.array,blocks=[],v=new THREE.Vector3();
 for(const range of ranges)for(let start=range.start;start<range.end;start+=192){
  const end=Math.min(start+192,range.end),bounds=new THREE.Box3();
  for(let i=start*3;i<end*3;i++)bounds.expandByPoint(v.fromBufferAttribute(p,index?index[i]:i));
  blocks.push({start,end,range,bounds});
 }
 return blocks;
}
export function closestSurfaceHit(pages,raycaster){
 let best=null,bestRange=null,bestDistance=raycaster.far;
 const ray=raycaster.ray,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),point=new THREE.Vector3();
 for(const page of pages){
  if(!ray.intersectsBox(page.bounds)||page.bounds.distanceToPoint(ray.origin)>bestDistance)continue;
  const geometry=page.mesh.geometry,p=geometry.attributes.position,index=geometry.index?.array;
  page.rayBlocks??=surfaceRayBlocks(geometry,page.ranges);
  for(const block of page.rayBlocks){
   if(!ray.intersectsBox(block.bounds)||block.bounds.distanceToPoint(ray.origin)>bestDistance)continue;
   for(let f=block.start;f<block.end;f++){
    const i=f*3,ia=index?index[i]:i,ib=index?index[i+1]:i+1,ic=index?index[i+2]:i+2;
    a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);
    if(!ray.intersectTriangle(a,b,c,false,point))continue;
    const distance=ray.origin.distanceTo(point);
    if(distance<raycaster.near||distance>bestDistance||best&&distance===bestDistance)continue;
    bestDistance=distance;bestRange=block.range;best={distance,point:point.clone(),faceIndex:f,face:{a:ia,b:ib,c:ic},object:page.mesh};
   }
  }
 }
 return best?{hit:best,range:bestRange}:null;
}
export class SpacePainter{
 constructor({scene,canvas,camera,send,ui,loadRaster,controller=()=>null,arena=null,ownerKey=()=>null,renderer=null}){
  Object.assign(this,{scene,canvas,camera,send,ui,loadRaster,controller,arena,ownerKey,renderer});
  this.archive=[];this.archiveIds=new Set();this.revision=-1;this.pending=new Map();this.erasing=new Set();this.queue=Promise.resolve();this.undoStack=[];this.redoStack=[];this.gesture=null;this.surfaceArchive={};this.surfaceRevision=-1;this.surfacePending=new Map();this.surfacePreview=null;this.surfaceFrame=0;this.atlas=null;this.renderedStrokes=[];this.ownerEpoch=null;
  this.ray=new THREE.Raycaster();this.ndc=new THREE.Vector2();this.point=new THREE.Vector3();
  this.pointer=null;this.stroke=null;this.frame=0;this.material=null;this.saved=null;this.preview=null;this.ranges=[];
  this.guide=null;this.guideKey=null;this.previewRanges=[];this.pages=[];this.pageById=new Map();this.geometryVersion=0;
  this.paintCenter=new THREE.Vector3();this.paintNormal=new THREE.Vector3();this.paintPlane=new THREE.Plane();this.connected=false;this.paintOffset=new THREE.Vector3();this.connectPoint=new THREE.Vector3();this.connectKey=null;
 }
 mesh(which,strokes){
  if(!strokes.length){if(this[which]){this[which].removeFromParent();this[which].geometry.dispose();this[which]=null;}if(which==='preview')this.previewRanges=[];return [];}
  const {geometry,ranges}=spacePaintGeometry(strokes);
  this.material??=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  if(this[which]){this[which].geometry.dispose();this[which].geometry=geometry;}
  else{const mesh=new THREE.Mesh(geometry,this.material);mesh.name='3D Paint '+which;this.scene.add(mesh);this[which]=mesh;}
  if(which==='preview')this.previewRanges=ranges;
  return ranges;
 }
 // Keep completed geometry in bounded batches. Adding a stroke replaces
 // only its batch, not the entire scene or every painted surface atlas.
 rebuild(){
  const ids=new Set(this.archive.map(s=>s.id));
  this.renderedStrokes=[...this.archive,...[...this.pending.values()].filter(s=>!ids.has(s.id))];
  const groups=[];let group=[],points=0;
  for(const s of this.renderedStrokes){
   if(group.length&&(group.length>=16||points+s.points.length>2048)){groups.push(group);group=[];points=0;}
   group.push(s);points+=s.points.length;
  }
  if(group.length)groups.push(group);
  const previous=this.pages,next=[],byId=new Map();let changed=previous.length!==groups.length;
  for(let i=0;i<groups.length;i++){
   const strokes=groups[i],old=previous[i];
   // Owner/epoch metadata can change at acknowledgement; the shape need not.
   const same=old&&old.strokes.length===strokes.length&&strokes.every((s,j)=>{
    const p=old.strokes[j];
    return s===p||s.id===p.id&&s.color===p.color&&s.size===p.size&&s.thickness===p.thickness&&JSON.stringify(s.normal)===JSON.stringify(p.normal)&&JSON.stringify(s.points)===JSON.stringify(p.points);
   });
   let page;
   if(same){page=old;page.strokes=strokes;}
   else{
    changed=true;const {geometry,ranges}=spacePaintGeometry(strokes);
    this.material??=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
    geometry.computeBoundingBox();
    const mesh=new THREE.Mesh(geometry,this.material);mesh.name='3D Paint saved';this.scene.add(mesh);
    page={mesh,ranges,strokes,bounds:geometry.boundingBox.clone(),atlas:null};
    if(old)this.disposePage(old);
   }
   next.push(page);
   for(const s of strokes)byId.set(s.id,page);
  }
  for(let i=groups.length;i<previous.length;i++)this.disposePage(previous[i]);
  this.pages=next;this.pageById=byId;this.saved=next[0]?.mesh||null;this.ranges=next[0]?.ranges||[];
  if(changed){this.geometryVersion++;this.guideKey=null;}
  const priorPages=new Set(previous);
  for(const page of next)if(!priorPages.has(page))this.refreshPage(page);
  this.atlas=next[0]?.atlas||null;
  if(!this.saved&&!this.preview&&this.material){this.material.dispose();this.material=null;}
 }
 disposePage(page){page.atlas?.dispose();page.mesh.removeFromParent();page.mesh.geometry.dispose();}
 nearestHit(){
  let best=null,range=null;
  for(const page of this.pages){
   if(!this.ray.ray.intersectsBox(page.bounds))continue;
   page.mesh.updateMatrixWorld(true);
   const hit=this.ray.intersectObject(page.mesh,false)[0];
   if(hit&&(!best||hit.distance<best.distance)){best=hit;range=page.ranges.find(r=>hit.faceIndex>=r.start&&hit.faceIndex<r.end);}
  }
  return best&&range?{hit:best,range}:null;
 }
 suspend(world){
  if(this.suspended)return;this.suspended=true;
  this.stroke=null;this.end();this.hideGuide();for(const mesh of [this.guide,this.guideAnchor])if(mesh){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}this.guide=this.guideAnchor=null;this.connectKey=null;if(this.surfaceFrame){cancelAnimationFrame(this.surfaceFrame);this.surfaceFrame=0;}
  this.pending.clear();this.erasing.clear();this.surfacePending.clear();this.surfacePreview=null;this.undoStack.length=0;this.redoStack.length=0;
  this.archive=[];this.archiveIds.clear();this.surfaceArchive={};this.ownerEpoch=world.profile?.spacePaintEpoch??null;this.revision=world.spacePaintRevision||0;this.surfaceRevision=world.spacePaintSurfaceRevision||0;this.rebuild();
 }
 sync(world){
  if(world.environment?.spacePaintSuspended===true){this.suspend(world);return;}
  if(this.suspended){this.suspended=false;this.revision=-1;this.surfaceRevision=-1;}
  const epoch=world.profile?.spacePaintEpoch;
  if(epoch!==undefined&&this.ownerEpoch!==null&&epoch!==this.ownerEpoch){this.undoStack.length=0;this.redoStack.length=0;this.pending.clear();if(this.stroke){this.stroke=null;this.end();}}
  if(epoch!==undefined)this.ownerEpoch=epoch;
  const previousSurface=this.surfaceArchive,rev=world.spacePaintRevision||0,srev=world.spacePaintSurfaceRevision||0,changed=srev!==this.surfaceRevision;
  if(changed){this.surfaceRevision=srev;this.surfaceArchive=world.spacePaintSurface||{};for(const [key,pending] of this.surfacePending)if(pending.ackRevision!==undefined&&pending.ackRevision<=srev)this.surfacePending.delete(key);}
  if(rev!==this.revision){this.revision=rev;this.archive=world.spacePaint||[];this.archiveIds=new Set(this.archive.map(s=>s.id));for(const s of this.archive)this.pending.delete(s.id);for(const [id,p] of this.pending)if(Number.isFinite(p.ackRevision)&&p.ackRevision<=world.revision)this.pending.delete(id);this.rebuild();}
  if(changed)for(const id of new Set([...Object.keys(previousSurface),...Object.keys(this.surfaceArchive)])){if(previousSurface[id]!==this.surfaceArchive[id]&&JSON.stringify(previousSurface[id])!==JSON.stringify(this.surfaceArchive[id]))this.refreshSurface(id);}
 }
 surfacePaints(id){
  return [...(this.surfaceArchive[id]||[]),...[...this.surfacePending.values()].filter(s=>s.id===id),...(this.surfacePreview?.id===id?[this.surfacePreview]:[])];
 }
 refreshPage(page,id=null){
  if(typeof document==='undefined')return;
  if(!page.atlas){
   if(!page.strokes.some(s=>this.surfaceArchive[s.id]?.length||this.surfacePreview?.id===s.id||[...this.surfacePending.values()].some(p=>p.id===s.id)))return;
   try{page.atlas=new SpacePaintTexture(page.mesh,page.ranges,page.strokes,this.loadRaster,this.renderer);if(page.residency?.dormant)page.atlas.suspendGPU();}catch(error){if(!page.atlasWarning){page.atlasWarning=true;console.warn('3D surface texture deferred; keeping original geometry colours',error);}return;}id=null;
  }
  if(id)page.atlas.repaint(id,this.surfacePaints(id));
  else for(const s of page.strokes)page.atlas.repaint(s.id,this.surfacePaints(s.id));
 }
 updateResidency(view,now,manager=null){
  let retired=false;for(const page of this.pages){const state=page.residency??={};
   if(updateResidency(state,farMesh(page.mesh,view),now,()=>{page.atlas?.suspendGPU();page.mesh.geometry.dispose();},()=>page.atlas?.resumeGPU(),!retired,manager,'spacePaint'))retired=true;
  }
 }
 residencyStats(){let dormant=0,atlasBytes=0;for(const p of this.pages){if(p.residency?.dormant)dormant++;const a=p.atlas;if(a)atlasBytes+=a.pixels?.byteLength??(a.packedPixels?a.packedPixels.reduce((n,t)=>n+(typeof t==='number'?4:t.byteLength),0):a.side*a.side*4);}return {pages:this.pages.length,dormant,atlasBytes};}
 restoreSurfaceTextures(){for(const page of this.pages){if(page.atlas)page.atlas.restoreTexture();else this.refreshPage(page);}}
 refreshSurface(id=null){
  if(id){const page=this.pageById.get(id);if(page)this.refreshPage(page,id);}
  else for(const page of this.pages)this.refreshPage(page);
  this.atlas=this.pages[0]?.atlas||null;
 }
 previewSurface(stroke){
  this.surfacePreview=stroke;
  if(!this.surfaceFrame)this.surfaceFrame=requestAnimationFrame(()=>{this.surfaceFrame=0;if(this.surfacePreview)this.refreshSurface(this.surfacePreview.id);});
 }
 queueSurface(stroke){
  this.surfacePreview=null;this.surfacePending.set(stroke.clientId,stroke);this.refreshSurface(stroke.id);
 }
 finishSurface(stroke,revision=null){
  if(Number.isFinite(revision)&&revision>this.surfaceRevision){stroke.ackRevision=revision;return;}
  this.surfacePending.delete(stroke.clientId);this.refreshSurface(stroke.id);
 }
 pickColor(event){
  if(!this.saved||!this.setRay(event))return null;
  const picked=this.nearestHit();if(!picked)return null;
  const {range}=picked;
  // Face ranges map both indexed and atlas-converted meshes to the saved stroke.
  // Read the original sRGB hex string, never a shaded framebuffer or graffiti texture.
  const color=this.renderedStrokes.find(s=>s.id===range.id)?.color;
  return /^#[0-9a-f]{6}$/i.test(color||'')?color.toLowerCase():null;
 }
 pickSurface(event,player){
  if(!this.saved||!player||!this.setRay(event))return null;
  const picked=closestSurfaceHit(this.pages,this.ray);if(!picked)return null;
  const {hit,range}=picked;
  if(hit.point.distanceTo(player.clone().add(new THREE.Vector3(0,1.4,0)))>19||!this.archiveIds.has(range.id))return null;
  const face=surfaceFace(range.info,hit.faceIndex-range.start),pos=hit.object.geometry.attributes.position;
  const verts=[hit.face.a,hit.face.b,hit.face.c].map(i=>new THREE.Vector3().fromBufferAttribute(pos,i));
  const bary=THREE.Triangle.getBarycoord(hit.point,...verts,new THREE.Vector3());if(!bary||bary.x<-.001)return null;
  const weights=bary.toArray(),uv=[0,1].map(i=>Math.max(0,Math.min(1,face.uv.reduce((n,v,j)=>n+v[i]*weights[j],0))));
  return {lotId:range.id,wall:'space:'+face.chart,u:uv[0],v:uv[1],distance:hit.distance,info:range.info};
 }
 record(edit){
  const last=this.undoStack.at(-1);
  if(edit.gesture&&last?.gesture===edit.gesture)last.add.push(...edit.add);
  else{this.undoStack.push(edit);if(this.undoStack.length>64)this.undoStack.shift();}
  this.redoStack.length=0;
 }
 history(redo=false){
  this.end();
  return this.queue=this.queue.catch(()=>{}).then(async()=>{
   const epoch=this.ownerEpoch,from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack,edit=from.at(-1);
   if(!edit){this.ui.toast(redo?'Nothing to redo':'Nothing to undo');return;}
   const remove=(redo?edit.remove:edit.add).map(s=>s.id),add=redo?edit.add:edit.remove;
   try{const result=await this.send('gm-edit-3d',{remove,add});if(!result?.spacePaintEdited)throw Error('3D history could not be saved');if(epoch!==this.ownerEpoch)return;if(result.removedStrokes?.length){if(redo)edit.remove=result.removedStrokes;else edit.add=result.removedStrokes;}from.pop();to.push(edit);}
   catch(e){this.ui.toast(/unknown action|unsupported action/i.test(e.message||'')?'3D history requires the updated Worker':e.message||'3D history could not be saved');}
  });
 }
 setRay(event){
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return false;
  this.ndc.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
  this.camera.updateMatrixWorld(true);this.ray.setFromCamera(this.ndc,this.camera);return true;
 }
 // Anchor to the avatar's existing camera-focus height, with controller
 // heading/elevation independent of the camera's zoom, lag or ground clamp.
 setDrawingFrame(distance){
  const player=this.controller();
  if(!player?.root?.position||!Number.isFinite(player.yaw)||!Number.isFinite(player.pitch))return false;
  const {yaw,pitch}=player,c=Math.cos(pitch);
  this.paintNormal.set(-Math.sin(yaw)*c,-Math.sin(pitch),-Math.cos(yaw)*c);
  this.paintCenter.copy(player.root.position);this.paintCenter.y+=1.5;
  this.paintCenter.addScaledVector(this.paintNormal,distance);
  this.paintPlane.setFromNormalAndCoplanarPoint(this.paintNormal,this.paintCenter);this.paintOffset.set(0,0,0);
  return true;
 }
 setConnected(enabled){
  if(this.pointer!==null)return false;
  this.connected=!!enabled;this.guideKey=null;return true;
 }
 drawingPoint(event,out){
  if(!event){out.copy(this.paintCenter).add(this.paintOffset);return true;}
  // Direct painting: intersect the pointer ray with the avatar-anchored plane.
  if(!this.setRay(event)||!this.ray.ray.intersectPlane(this.paintPlane,out))return false;
  out.add(this.paintOffset);
  return true;
 }
 baseFloor(point,arena=this.arena){
  const {x,y,z}=point,top=y+.003;
  return Math.max(0,arena?.displayPlatforms?.ground(x,z,top)||0,cityGroundHeight(x,z,top,arena?.world?.cityDamage||{}));
 }
 // Ground is always a valid candidate, not just a fallback after searching
 // every stroke. Its distance bounds the nearest-surface search.
 connectedStart(point,arena=this.arena){
  const floor=this.baseFloor(point,arena),version=this.geometryVersion,k=this.connectKey;
  if(!k||k[0]!==version||k[1]!==point.x||k[2]!==point.y||k[3]!==point.z||k[4]!==floor){
   this.connectPoint.set(point.x,floor,point.z);
   let best=(point.y-floor)**2;
   for(const page of this.pages){
    if(page.bounds.distanceToPoint(point)**2>best)continue;
    if(nearestSpacePaintPoint(page.mesh.geometry,page.ranges,point,this.connectPoint,best))best=this.connectPoint.distanceToSquared(point);
   }
   this.connectKey=[version,point.x,point.y,point.z,floor];
  }
  return this.connectPoint;
 }
 hideGuide(){if(this.guide){this.guide.visible=false;this.guideAnchor.visible=false;}this.guideKey=null;}
 updateGuide(event,settings,arena){
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height){this.hideGuide();return;}
  const x=event?.clientX??r.left+r.width/2,y=event?.clientY??r.top+r.height/2;
  const player=this.controller(),p=player?.root?.position,stroke=this.stroke,color=stroke?.color??settings.color,size=stroke?.size??settings.size,thickness=stroke?.thickness??settings.thickness;
  if(!p){this.hideGuide();return;}
  const key=[x,y,!!event,r.left,r.top,r.width,r.height,p.x,p.y,p.z,player.yaw,player.pitch,this.camera.fov,this.connected,size,color,thickness,settings.distance,stroke?.id,this.geometryVersion,this.preview?.geometry,arena.world?.cityDamage,arena.displayPlatforms?.discs];
  if(event){const cp=this.camera.position,q=this.camera.quaternion;key.push(cp.x,cp.y,cp.z,q.x,q.y,q.z,q.w,this.camera.zoom,this.camera.aspect);}
  if(this.guideKey&&key.every((v,i)=>v===this.guideKey[i]))return;
  this.guideKey=key;
  if(!this.guide){
   this.guide=new THREE.Mesh(new THREE.RingGeometry(.78,1,48),new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
   this.guide.name='3D Paint landing guide';this.guide.rotation.x=-Math.PI/2;this.guide.visible=false;this.scene.add(this.guide);
   this.guidePoint=new THREE.Vector3();
   this.guideAnchor=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false}));
   this.guideAnchor.name='3D Paint exact brush point';this.guideAnchor.visible=false;this.guideAnchor.renderOrder=10;this.scene.add(this.guideAnchor);
  }
  const g=this.guide;
  const point=this.guidePoint;
  if((!stroke&&!this.setDrawingFrame(settings.distance))||!this.drawingPoint(event,point)||!spacePaintPointAllowed(point.toArray())){g.visible=this.guideAnchor.visible=false;return;}
  // Use exactly the same anchor for the preview and the next stroke.
  if(!stroke&&this.connected)point.copy(this.connectedStart(point,arena));
  if(!spacePaintPointAllowed(point.toArray())){g.visible=this.guideAnchor.visible=false;return;}
  // The coloured ring remains on the uppermost structure. A separate small
  // point marks the true 3D brush position, even on a vertical or hidden face.
  this.guideAnchor.position.copy(point);this.guideAnchor.scale.setScalar(Math.max(.045,Math.min(.12,size*.35)));this.guideAnchor.visible=true;
  let floor=this.baseFloor(point,arena);
  for(const page of this.pages){
   const {min,max}=page.bounds;
   if(point.x>=min.x&&point.x<=max.x&&point.z>=min.z&&point.z<=max.z&&max.y>=floor)floor=spacePaintGuideHeight(page.mesh.geometry,page.ranges,point.x,point.z,floor);
  }
  if(this.preview)floor=spacePaintGuideHeight(this.preview.geometry,this.previewRanges,point.x,point.z,floor);
  g.position.set(point.x,floor+.025,point.z);g.scale.set(size,size,1);g.material.color.set(color);g.visible=true;
 }
 down(event,{tool,color,size,thickness,distance},capture=true){
  if(this.pointer!==null)return;
  if(tool==='eraser'){
   if(!this.saved||!this.setRay(event))return;
   const id=this.nearestHit()?.range.id;
   const owner=this.ownerKey();
   if(id&&(!owner||this.renderedStrokes.find(s=>s.id===id)?.ownerKey!==owner)){this.ui.toast('You can only erase your own 3D paint');return;}
   if(id&&(this.surfaceArchive[id]||[]).some(v=>isSurfaceCheckpoint(v)?!Array.isArray(v.owners)||v.owners.some(key=>key!==owner):v.tool==='brush'&&v.owner!==owner)){this.ui.toast('This structure contains another artist’s graffiti');return;}
   if(id&&!this.erasing.has(id)){
    const epoch=this.ownerEpoch;this.erasing.add(id);this.queue=this.queue.catch(()=>{}).then(async()=>{
     try{const result=await this.send('gm-erase-3d',{id});if(!result?.erased3DStroke||!result.erasedStroke)throw Error('3D erase failed');if(epoch===this.ownerEpoch)this.record({add:[],remove:[result.erasedStroke]});}
     catch(e){this.ui.toast(e.message||'3D erase failed');}finally{this.erasing.delete(id);}
    });
   }
   return;
  }
  if(this.pending.size>=8){this.ui.toast('3D paint is still saving');return;}
  if(!this.setDrawingFrame(distance)||!this.drawingPoint(event,this.point)||!spacePaintPointAllowed(this.point.toArray())){this.ui.toast('Aim inside the 3D paint area');return;}
  // Translate the whole new planar stroke by a single offset. No per-move
  // snapping, bridge to the original touch point, or mutation of old strokes.
  if(this.connected){
   const anchor=this.connectedStart(this.point);
   if(!spacePaintPointAllowed(anchor.toArray())){this.ui.toast('Aim at a valid ground or 3D surface');return;}
   this.paintOffset.subVectors(anchor,this.point);this.point.copy(anchor);
  }
  this.pointer=event.pointerId;if(capture)this.canvas.setPointerCapture(event.pointerId);
  this.gesture=globalThis.crypto.randomUUID();this.gestureEpoch=this.ownerEpoch;this.begin({color,size,thickness,normal:this.paintNormal.toArray()});this.append(this.point);
 }
 begin(settings){this.stroke={...settings,id:globalThis.crypto.randomUUID(),points:[]};}
 append(point){
  if(!this.stroke)return;
  const p=point.toArray().map(v=>+v.toFixed(3));if(!spacePaintPointAllowed(p))return;
  const last=this.stroke.points.at(-1);
  if(last&&Math.hypot(...p.map((v,i)=>v-last[i]))<Math.min(.04,this.stroke.size*.25))return;
  this.stroke.points.push(p);
  if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.mesh('preview',this.stroke?[this.stroke]:[]);});
 }
 move(event){
  if(event.pointerId!==this.pointer||!this.stroke||!this.drawingPoint(event,this.point))return;
  if(this.stroke.points.length>=SPACE_PAINT_MAX_POINTS){
   const {color,size,thickness,normal,points}=this.stroke,last=points.at(-1);
   this.finish();if(this.pending.size>=8){this.end();this.ui.toast('3D paint is still saving');return;}this.begin({color,size,thickness,normal});this.stroke.points.push(last);
  }
  this.append(this.point);
 }
 end(event,retainCapture=false){
  if(event&&event.pointerId!==this.pointer)return;
  const pointer=this.pointer;this.pointer=null;
  if(event?.type==='pointerup'&&this.stroke&&this.stroke.points.length<SPACE_PAINT_MAX_POINTS&&this.drawingPoint(event,this.point))this.append(this.point);
  if(!retainCapture&&pointer!==null&&this.canvas.hasPointerCapture(pointer))this.canvas.releasePointerCapture(pointer);
  this.finish();
 }
 finish(){
  const s=this.stroke,gesture=this.gesture,epoch=this.gestureEpoch??this.ownerEpoch;this.stroke=null;
  if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
  this.mesh('preview',[]);
  if(!s?.points.length)return;
  this.pending.set(s.id,{...s,ownerKey:this.ownerKey()});this.rebuild();
  this.queue=this.queue.catch(()=>{}).then(async()=>{
   if(this.suspended)return;
   let accepted=false;
   try{const result=await this.send('gm-paint-3d',{stroke:s,...(epoch===null?{}:{ownerEpoch:epoch})});if(!result?.spacePaintStroke)throw Error('3D paint could not be saved');accepted=true;if(epoch===this.ownerEpoch){this.record({gesture,add:[result.spacePaintStroke],remove:[]});if(!this.archive.some(p=>p.id===s.id)&&this.pending.has(s.id))this.pending.set(s.id,{...result.spacePaintStroke,ackRevision:result.worldRevision});}}
   catch(e){this.ui.toast(e.message||'3D paint could not be saved');}
   finally{if(!accepted||this.archive.some(p=>p.id===s.id)){this.pending.delete(s.id);if(!accepted)this.rebuild();}}
  });
 }
}
