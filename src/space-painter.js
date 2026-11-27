import * as THREE from 'three';
import {surfaceInfo,surfaceFace} from './shared/space-paint-surface.js';
import {SpacePaintTexture} from './space-paint-texture.js';
import {cityGroundHeight} from './shared/city-layout.js';
import {SPACE_PAINT_MAX_POINTS,SPACE_PAINT_POINT_BUDGET,SPACE_PAINT_STROKE_BUDGET,spacePaintPointAllowed} from './shared/space-paint.js';

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
export class SpacePainter{
 constructor({scene,canvas,camera,send,ui,loadRaster,controller=()=>null}){
  Object.assign(this,{scene,canvas,camera,send,ui,loadRaster,controller});
  this.archive=[];this.revision=-1;this.pending=new Map();this.erasing=new Set();this.queue=Promise.resolve();this.undoStack=[];this.redoStack=[];this.gesture=null;this.surfaceArchive={};this.surfaceRevision=-1;this.surfacePending=new Map();this.surfacePreview=null;this.surfaceFrame=0;this.atlas=null;this.renderedStrokes=[];this.ownerEpoch=null;
  this.ray=new THREE.Raycaster();this.ndc=new THREE.Vector2();this.point=new THREE.Vector3();
  this.pointer=null;this.stroke=null;this.frame=0;this.material=null;this.saved=null;this.preview=null;this.ranges=[];
  this.guide=null;this.guideKey=null;this.previewRanges=[];
  this.paintCenter=new THREE.Vector3();this.paintNormal=new THREE.Vector3();this.paintRight=new THREE.Vector3();this.paintUp=new THREE.Vector3();this.paintScale=0;this.paintPlane=new THREE.Plane();this.fixedScale=false;
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
 rebuild(){
  this.atlas?.dispose();this.atlas=null;
  const ids=new Set(this.archive.map(s=>s.id));
  this.renderedStrokes=[...this.archive,...[...this.pending.values()].filter(s=>!ids.has(s.id))];
  this.ranges=this.mesh('saved',this.renderedStrokes);this.refreshSurface();
  if(!this.saved&&!this.preview&&this.material){this.material.dispose();this.material=null;}
 }
 sync(world){
  const epoch=world.profile?.spacePaintEpoch;
  if(epoch!==undefined&&this.ownerEpoch!==null&&epoch!==this.ownerEpoch){this.undoStack.length=0;this.redoStack.length=0;this.pending.clear();if(this.stroke){this.stroke=null;this.end();}}
  if(epoch!==undefined)this.ownerEpoch=epoch;
  const previousSurface=this.surfaceArchive,rev=world.spacePaintRevision||0,srev=world.spacePaintSurfaceRevision||0,changed=srev!==this.surfaceRevision;
  if(changed){this.surfaceRevision=srev;this.surfaceArchive=world.spacePaintSurface||{};for(const [key,pending] of this.surfacePending)if(pending.ackRevision!==undefined&&pending.ackRevision<=srev)this.surfacePending.delete(key);}
  if(rev!==this.revision){this.revision=rev;this.archive=world.spacePaint||[];this.rebuild();}
  else if(changed){if(!this.atlas)this.refreshSurface();else for(const id of new Set([...Object.keys(previousSurface),...Object.keys(this.surfaceArchive)])){if(previousSurface[id]!==this.surfaceArchive[id]&&JSON.stringify(previousSurface[id])!==JSON.stringify(this.surfaceArchive[id]))this.refreshSurface(id);}}
 }
 surfacePaints(id){
  return [...(this.surfaceArchive[id]||[]),...[...this.surfacePending.values()].filter(s=>s.id===id),...(this.surfacePreview?.id===id?[this.surfacePreview]:[])];
 }
 refreshSurface(id=null){
  if(!this.saved||typeof document==='undefined')return;
  if(!this.atlas){
   if(!Object.keys(this.surfaceArchive).length&&!this.surfacePending.size&&!this.surfacePreview)return;
   this.atlas=new SpacePaintTexture(this.saved,this.ranges,this.renderedStrokes,this.loadRaster);id=null;
  }
  if(id)this.atlas.repaint(id,this.surfacePaints(id));
  else for(const s of this.renderedStrokes)this.atlas.repaint(s.id,this.surfacePaints(s.id));
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
  this.saved.updateMatrixWorld(true);
  const hit=this.ray.intersectObject(this.saved,false)[0];
  if(!hit)return null;
  const range=this.ranges.find(r=>hit.faceIndex>=r.start&&hit.faceIndex<r.end);
  if(!range)return null;
  // Face ranges map both indexed and atlas-converted meshes to the saved stroke.
  // Read the original sRGB hex string, never a shaded framebuffer or graffiti texture.
  const color=this.renderedStrokes.find(s=>s.id===range.id)?.color;
  return /^#[0-9a-f]{6}$/i.test(color||'')?color.toLowerCase():null;
 }
 pickSurface(event,player){
  if(!this.saved||!player||!this.setRay(event))return null;
  this.saved.updateMatrixWorld(true);const hit=this.ray.intersectObject(this.saved,false)[0];
  if(!hit||hit.point.distanceTo(player.clone().add(new THREE.Vector3(0,1.4,0)))>19)return null;
  const range=this.ranges.find(r=>hit.faceIndex>=r.start&&hit.faceIndex<r.end);
  if(!range||!this.archive.some(s=>s.id===range.id))return null;
  const face=surfaceFace(range.info,hit.faceIndex-range.start),pos=this.saved.geometry.attributes.position;
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
  this.paintRight.set(Math.cos(yaw),0,-Math.sin(yaw));
  this.paintUp.crossVectors(this.paintRight,this.paintNormal);
  this.paintCenter.copy(player.root.position);this.paintCenter.y+=1.5;
  this.paintCenter.addScaledVector(this.paintNormal,distance);
  this.paintPlane.setFromNormalAndCoplanarPoint(this.paintNormal,this.paintCenter);
  // Match the existing default third-person viewing distance (7). Camera
  // zoom changes presentation only, never the drawing-coordinate scale.
  this.paintScale=(distance+7)*Math.tan(this.camera.fov*Math.PI/360);
  return true;
 }
 setFixedScale(enabled){
  if(this.pointer!==null)return false;
  this.fixedScale=!!enabled;this.guideKey=null;return true;
 }
 drawingPoint(event,out){
  if(!event){out.copy(this.paintCenter);return true;}
  // Default: the actual camera ray meets the avatar-anchored drawing plane.
  // Only the optional fixed-scale mode uses zoom-independent screen offsets.
  if(!this.fixedScale)return this.setRay(event)&&!!this.ray.ray.intersectPlane(this.paintPlane,out);
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return false;
  const x=(event.clientX-r.left)/r.width*2-1,y=1-(event.clientY-r.top)/r.height*2;
  out.copy(this.paintCenter).addScaledVector(this.paintRight,x*this.paintScale*r.width/r.height).addScaledVector(this.paintUp,y*this.paintScale);
  return true;
 }
 hideGuide(){if(this.guide)this.guide.visible=false;this.guideKey=null;}
 updateGuide(event,settings,arena){
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height){this.hideGuide();return;}
  const x=event?.clientX??r.left+r.width/2,y=event?.clientY??r.top+r.height/2;
  const player=this.controller(),p=player?.root?.position,stroke=this.stroke,color=stroke?.color??settings.color,size=stroke?.size??settings.size,thickness=stroke?.thickness??settings.thickness;
  if(!p){this.hideGuide();return;}
  const key=[x,y,!!event,r.left,r.top,r.width,r.height,p.x,p.y,p.z,player.yaw,player.pitch,this.camera.fov,this.fixedScale,size,color,thickness,settings.distance,stroke?.id,this.saved?.geometry,this.preview?.geometry,arena.world?.cityDamage,arena.displayPlatforms?.discs];
  if(event&&!this.fixedScale){const cp=this.camera.position,q=this.camera.quaternion;key.push(cp.x,cp.y,cp.z,q.x,q.y,q.z,q.w,this.camera.zoom,this.camera.aspect);}
  if(this.guideKey&&key.every((v,i)=>v===this.guideKey[i]))return;
  this.guideKey=key;
  if(!this.guide){
   this.guide=new THREE.Mesh(new THREE.RingGeometry(.78,1,48),new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
   this.guide.name='3D Paint landing guide';this.guide.rotation.x=-Math.PI/2;this.guide.visible=false;this.scene.add(this.guide);
   this.guidePoint=new THREE.Vector3();
  }
  const g=this.guide;
  const point=this.guidePoint;
  if((!stroke&&!this.setDrawingFrame(settings.distance))||!this.drawingPoint(event,point)||!spacePaintPointAllowed(point.toArray())){g.visible=false;return;}
  // Keep the same X/Z prediction; use the uppermost 3D surface even when
  // the drawing plane is inside or below a structure.
  const top=point.y+.003;
  let floor=Math.max(0,arena.displayPlatforms?.ground(point.x,point.z,top)||0,cityGroundHeight(point.x,point.z,top,arena.world?.cityDamage||{}));
  if(this.saved)floor=spacePaintGuideHeight(this.saved.geometry,this.ranges,point.x,point.z,floor);
  if(this.preview)floor=spacePaintGuideHeight(this.preview.geometry,this.previewRanges,point.x,point.z,floor);
  g.position.set(point.x,floor+.025,point.z);g.scale.set(size,size,1);g.material.color.set(color);g.visible=true;
 }
 down(event,{tool,color,size,thickness,distance},capture=true){
  if(this.pointer!==null)return;
  if(tool==='eraser'){
   if(!this.saved||!this.setRay(event))return;
   this.saved.updateMatrixWorld(true);
   const hit=this.ray.intersectObject(this.saved,false)[0];const id=hit&&this.ranges.find(r=>hit.faceIndex>=r.start&&hit.faceIndex<r.end)?.id;
   if(id&&!this.erasing.has(id)){
    const epoch=this.ownerEpoch;this.erasing.add(id);this.queue=this.queue.catch(()=>{}).then(async()=>{
     try{const result=await this.send('gm-erase-3d',{id});if(!result?.erased3DStroke||!result.erasedStroke)throw Error('3D erase failed');if(epoch===this.ownerEpoch)this.record({add:[],remove:[result.erasedStroke]});}
     catch(e){this.ui.toast(e.message||'3D erase failed');}finally{this.erasing.delete(id);}
    });
   }
   return;
  }
  const stored=new Set(this.archive.map(s=>s.id)),pending=[...this.pending.values()].filter(s=>!stored.has(s.id));
  if(this.archive.length+pending.length>=SPACE_PAINT_STROKE_BUDGET||this.archive.concat(pending).reduce((n,s)=>n+s.points.length,0)>=SPACE_PAINT_POINT_BUDGET){this.ui.toast('3D paint archive full; erase a stroke first');return;}
  if(this.pending.size>=8){this.ui.toast('3D paint is still saving');return;}
  if(!this.setDrawingFrame(distance)||!this.drawingPoint(event,this.point)||!spacePaintPointAllowed(this.point.toArray())){this.ui.toast('Aim inside the 3D paint area');return;}
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
  this.pending.set(s.id,s);this.rebuild();
  this.queue=this.queue.catch(()=>{}).then(async()=>{
   try{const result=await this.send('gm-paint-3d',{stroke:s,...(epoch===null?{}:{ownerEpoch:epoch})});if(!result?.spacePaintStroke)throw Error('3D paint could not be saved');if(epoch===this.ownerEpoch)this.record({gesture,add:[result.spacePaintStroke],remove:[]});}
   catch(e){this.ui.toast(e.message||'3D paint could not be saved');}
   finally{this.pending.delete(s.id);if(!this.archive.some(p=>p.id===s.id))this.rebuild();}
  });
 }
}
