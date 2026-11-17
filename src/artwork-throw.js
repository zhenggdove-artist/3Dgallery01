import * as THREE from 'three';
import {artworkPosition,artworkLanding} from './shared/artwork-flight.js';
import {ARTWORK_BLAST_RADIUS} from './shared/art-bomb.js';
export class ArtworkThrow{
 constructor({scene,controller,holderKey=()=>null,arena,send,bursts,audio}){Object.assign(this,{scene,controller,holderKey,arena,send,bursts,audio});this.started=null;this.pending=new Map();this.seen=new Set();this.lastPreviewAt=0;this.marker=new THREE.Group();this.marker.name='Large red artwork landing marker';
  const red=new THREE.MeshBasicMaterial({color:'#ff2038',transparent:true,opacity:.94,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
  const glow=new THREE.MeshBasicMaterial({color:'#ff334d',transparent:true,opacity:.27,depthTest:false,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  for(const [inner,outer,material] of [[1.55,1.85,red],[1.08,1.23,red],[1.87,2.12,glow]]){const ring=new THREE.Mesh(new THREE.RingGeometry(inner,outer,96),material);ring.rotation.x=-Math.PI/2;ring.renderOrder=110;this.marker.add(ring);}
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const bar=new THREE.Mesh(new THREE.BoxGeometry(.18,.05,.93),red);bar.position.set(Math.sin(angle)*2.34,.06,Math.cos(angle)*2.34);bar.rotation.y=angle;bar.renderOrder=111;this.marker.add(bar);}
  this.marker.visible=false;scene.add(this.marker);
  // WebGL native lines ignore linewidth on many devices: use thick instanced
  // cylinders for a genuinely readable crimson trajectory in 3D.
  this.path=new THREE.InstancedMesh(new THREE.CylinderGeometry(.105,.105,1,6),new THREE.MeshBasicMaterial({color:'#ff264b',transparent:true,opacity:.93,depthTest:false,depthWrite:false}),32);
  this.path.name='Thick red ballistic arc';this.path.frustumCulled=false;this.path.renderOrder=109;this.path.visible=false;scene.add(this.path);
  this.trajectoryPoints=Array.from({length:33},()=>new THREE.Vector3());
  this.segmentMatrix=new THREE.Matrix4();this.segmentQuaternion=new THREE.Quaternion();this.segmentMid=new THREE.Vector3();this.segmentScale=new THREE.Vector3();
  this.segmentUp=new THREE.Vector3(0,1,0);this.segmentDirection=new THREE.Vector3();}
 begin(){if(this.started===null){this.started=performance.now();this.lastPreviewAt=0;}}
 cancel(){this.started=null;this.path.visible=this.marker.visible=false;}
 get progress(){return this.started===null?0:Math.min(1,(performance.now()-this.started)/1500);}
 trajectory(){const c=this.controller();return {origin:[c.root.position.x,c.root.position.y+1.4,c.root.position.z],direction:c.aimDirection(),power:.4+this.progress};}
 async release(){
  if(this.started===null)return;
  const event=this.trajectory();this.cancel();
  const held=Object.entries(this.arena.world?.artworks||{}).find(([,art])=>art.holder===this.holderKey());
  let rollback=null;
  if(held){
   const [platformId,art]=held,previous={holder:art.holder,availableAt:art.availableAt,throwEvent:art.throwEvent};
   const predicted={id:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2),platformId,origin:event.origin,direction:event.direction,power:event.power,time:Date.now(),owner:this.holderKey()};
   // The artwork leaves the hand in the SAME frame; only the server awards hits.
   art.holder=null;art.throwEvent=predicted;art.availableAt=predicted.time+12000;
   // Preserve the first-frame trajectory through every network/world update.
   // The confirmed server origin/time may be older than this visible launch.
   this.arena.localArtworkFlights??=new Map();
   this.arena.localArtworkFlights.set(platformId,{event:predicted,
    landing:artworkLanding(predicted,(x,z,y)=>this.arena.groundHeight(x,z,y))});
   rollback=()=>{if(art.throwEvent===predicted)Object.assign(art,previous);
    if(this.arena.localArtworkFlights.get(platformId)?.event===predicted)
     this.arena.localArtworkFlights.delete(platformId);};
  }
  try{
   const result=await this.send('throw-artwork',{direction:event.direction,power:event.power});
   if(!result)rollback?.();
   if(result?.throwEvent)this.queue(result.throwEvent);
   return result;
  }catch(error){rollback?.();throw error;}
 }
 queue(event){if(this.seen.has(event.id))return;this.seen.add(event.id);if(this.seen.size>128)this.seen.delete(this.seen.values().next().value);this.pending.set(event.id,{event,landing:artworkLanding(event,(x,z,y)=>this.arena.groundHeight(x,z,y))});}
 update(){if(this.started!==null&&performance.now()-this.lastPreviewAt>=65){this.lastPreviewAt=performance.now();const event=this.trajectory(),landing=artworkLanding(event,(x,z,y)=>this.arena.groundHeight(x,z,y));this.marker.position.fromArray(landing.position);this.marker.position.y+=.22;
  this.marker.rotation.y=0;this.marker.scale.setScalar(ARTWORK_BLAST_RADIUS/2.12);
  this.marker.visible=this.path.visible=true;
  for(let i=0;i<33;i++)this.trajectoryPoints[i].fromArray(artworkPosition(event,landing.time*i/32));
  for(let i=0;i<32;i++){const a=this.trajectoryPoints[i],b=this.trajectoryPoints[i+1],d=this.segmentDirection.subVectors(b,a),length=d.length();
    this.segmentQuaternion.setFromUnitVectors(this.segmentUp,d.normalize());
    this.segmentMid.addVectors(a,b).multiplyScalar(.5);
    this.segmentScale.set(.12,length,.12);
    this.segmentMatrix.compose(this.segmentMid,this.segmentQuaternion,this.segmentScale);
    this.path.setMatrixAt(i,this.segmentMatrix);
  }
  this.path.instanceMatrix.needsUpdate=true;this.prediction=landing.position;}for(const [id,{event,landing}]of this.pending){if(Date.now()<event.time+landing.time*1000)continue;this.pending.delete(id);if(Date.now()-event.time-landing.time*1000<1500){this.bursts.play(landing.position,id);this.audio.play('explosion');}}}
}
