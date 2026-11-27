import * as THREE from 'three';
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
  ranges.push({id:s.id,start,end:indices.length/3});
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 if(positions.length){geometry.computeVertexNormals();geometry.computeBoundingSphere();}
 return {geometry,ranges};
}
export class SpacePainter{
 constructor({scene,canvas,camera,send,ui}){
  Object.assign(this,{scene,canvas,camera,send,ui});
  this.archive=[];this.revision=-1;this.pending=new Map();this.erasing=new Set();this.queue=Promise.resolve();this.undoStack=[];this.redoStack=[];this.gesture=null;
  this.ray=new THREE.Raycaster();this.ndc=new THREE.Vector2();this.point=new THREE.Vector3();this.normal=new THREE.Vector3();this.plane=new THREE.Plane();
  this.pointer=null;this.stroke=null;this.frame=0;this.material=null;this.saved=null;this.preview=null;this.ranges=[];
 }
 mesh(which,strokes){
  if(!strokes.length){if(this[which]){this[which].removeFromParent();this[which].geometry.dispose();this[which]=null;}return [];}
  const {geometry,ranges}=spacePaintGeometry(strokes);
  this.material??=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  if(this[which]){this[which].geometry.dispose();this[which].geometry=geometry;}
  else{const mesh=new THREE.Mesh(geometry,this.material);mesh.name='3D Paint '+which;this.scene.add(mesh);this[which]=mesh;}
  return ranges;
 }
 rebuild(){
  const ids=new Set(this.archive.map(s=>s.id));
  this.ranges=this.mesh('saved',[...this.archive,...[...this.pending.values()].filter(s=>!ids.has(s.id))]);
  if(!this.saved&&!this.preview&&this.material){this.material.dispose();this.material=null;}
 }
 sync(world){
  const rev=world.spacePaintRevision||0;if(rev===this.revision)return;
  this.revision=rev;this.archive=world.spacePaint||[];this.rebuild();
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
   const from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack,edit=from.at(-1);
   if(!edit){this.ui.toast(redo?'Nothing to redo':'Nothing to undo');return;}
   const remove=(redo?edit.remove:edit.add).map(s=>s.id),add=redo?edit.add:edit.remove;
   try{const result=await this.send('gm-edit-3d',{remove,add});if(!result?.spacePaintEdited)throw Error('3D history could not be saved');from.pop();to.push(edit);}
   catch(e){this.ui.toast(/unknown action|unsupported action/i.test(e.message||'')?'3D history requires the updated Worker':e.message||'3D history could not be saved');}
  });
 }
 setRay(event){
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return false;
  this.ndc.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
  this.camera.updateMatrixWorld(true);this.ray.setFromCamera(this.ndc,this.camera);return true;
 }
 down(event,{tool,color,size,thickness,distance}){
  if(this.pointer!==null||!this.setRay(event))return;
  if(tool==='eraser'){
   if(!this.saved)return;
   this.saved.updateMatrixWorld(true);
   const hit=this.ray.intersectObject(this.saved,false)[0];const id=hit&&this.ranges.find(r=>hit.faceIndex>=r.start&&hit.faceIndex<r.end)?.id;
   if(id&&!this.erasing.has(id)){
    this.erasing.add(id);this.queue=this.queue.catch(()=>{}).then(async()=>{
     try{const result=await this.send('gm-erase-3d',{id});if(!result?.erased3DStroke||!result.erasedStroke)throw Error('3D erase failed');this.record({add:[],remove:[result.erasedStroke]});}
     catch(e){this.ui.toast(e.message||'3D erase failed');}finally{this.erasing.delete(id);}
    });
   }
   return;
  }
  const stored=new Set(this.archive.map(s=>s.id)),pending=[...this.pending.values()].filter(s=>!stored.has(s.id));
  if(this.archive.length+pending.length>=SPACE_PAINT_STROKE_BUDGET||this.archive.concat(pending).reduce((n,s)=>n+s.points.length,0)>=SPACE_PAINT_POINT_BUDGET){this.ui.toast('3D paint archive full; erase a stroke first');return;}
  if(this.pending.size>=8){this.ui.toast('3D paint is still saving');return;}
  this.camera.getWorldDirection(this.normal);
  this.plane.setFromNormalAndCoplanarPoint(this.normal,this.point.copy(this.camera.position).addScaledVector(this.normal,distance));
  if(!this.ray.ray.intersectPlane(this.plane,this.point)||!spacePaintPointAllowed(this.point.toArray())){this.ui.toast('Aim inside the 3D paint area');return;}
  this.pointer=event.pointerId;this.canvas.setPointerCapture(event.pointerId);
  this.gesture=globalThis.crypto.randomUUID();this.begin({color,size,thickness,normal:this.normal.toArray()});this.append(this.point);
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
  if(event.pointerId!==this.pointer||!this.stroke||!this.setRay(event))return;
  if(!this.ray.ray.intersectPlane(this.plane,this.point))return;
  if(this.stroke.points.length>=SPACE_PAINT_MAX_POINTS){
   const {color,size,thickness,normal,points}=this.stroke,last=points.at(-1);
   this.finish();if(this.pending.size>=8){this.end();this.ui.toast('3D paint is still saving');return;}this.begin({color,size,thickness,normal});this.stroke.points.push(last);
  }
  this.append(this.point);
 }
 end(event){
  if(event&&event.pointerId!==this.pointer)return;
  const pointer=this.pointer;this.pointer=null;
  if(event?.type==='pointerup'&&this.stroke&&this.stroke.points.length<SPACE_PAINT_MAX_POINTS&&this.setRay(event)&&this.ray.ray.intersectPlane(this.plane,this.point))this.append(this.point);
  if(pointer!==null&&this.canvas.hasPointerCapture(pointer))this.canvas.releasePointerCapture(pointer);
  this.finish();
 }
 finish(){
  const s=this.stroke,gesture=this.gesture;this.stroke=null;
  if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
  this.mesh('preview',[]);
  if(!s?.points.length)return;
  this.pending.set(s.id,s);this.rebuild();
  this.queue=this.queue.catch(()=>{}).then(async()=>{
   try{const result=await this.send('gm-paint-3d',{stroke:s});if(!result?.spacePaintStroke)throw Error('3D paint could not be saved');this.record({gesture,add:[result.spacePaintStroke],remove:[]});}
   catch(e){this.ui.toast(e.message||'3D paint could not be saved');}
   finally{this.pending.delete(s.id);if(!this.archive.some(p=>p.id===s.id))this.rebuild();}
  });
 }
}
