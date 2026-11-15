import * as THREE from 'three';
import {journeyPose,WRITE_HEIGHT} from './shared/write-journey.js';

// RELETTER's WRITE sequence, ported from the original index.html:
// platform ascent -> write -> animated mouth-absorbed lettering and drink ->
// automatic edge walk -> fall -> golden 22,000-particle burst -> new plant
// growth -> orbiting plant reveal. Server records alone are persisted.
const smooth=t=>{const k=Math.max(0,Math.min(1,t));return k*k*(3-2*k);};
const duration=4300;
export class WriteCinematic{
 constructor({scene,controller,arena,ui,send,audio,bursts,upload}){
  Object.assign(this,{scene,controller,arena,ui,send,audio,bursts,upload});
  this.disc=new THREE.Mesh(new THREE.CylinderGeometry(9,9,.4,48),new THREE.MeshPhysicalMaterial({color:'#e84887',roughness:.25,metalness:.1,clearcoat:.8}));
  this.disc.name='RELETTER writing flight disc';this.disc.visible=false;scene.add(this.disc);
  const material=new THREE.MeshBasicMaterial({color:'#ffe38c',transparent:true,opacity:.65,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
  this.plantHalo=new THREE.Mesh(new THREE.RingGeometry(.55,.68,64),material);
  this.plantHalo.rotation.x=-Math.PI/2;this.plantHalo.visible=false;scene.add(this.plantHalo);
  this.drinkLight=new THREE.PointLight('#ffe2a0',0,6,2);scene.add(this.drinkLight);
  this.mouthLayer=document.createElement('div');this.mouthLayer.id='write-mouth-layer';
  this.mouthLayer.style.cssText='position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:26';
  document.body.append(this.mouthLayer);
  this.active=false;this.legacy=false;this.phase='';this.busy=false;this.journey=null;
  this.pending=null;this.reveal=null;this.letters=[];this.textStarted=0;
 }
 async begin(){
  if(this.active||this.busy)return;
  const c=this.controller();if(!c?.enabled)return;
  let result,legacy=false;
  try{result=await this.send('write-begin',{}, {throwOnError:true});}
  catch(error){
   if(!/unknown action/i.test(String(error?.message||error))){this.ui.toast(error.message||'WRITE 無法啟動');return;}
   // Old live Workers do not implement the journey. Animate the *same*
   // sequence locally and save through their existing /plant endpoint.
   // Keep the player's real server position near the central tree.
   if(Math.hypot(c.root.position.x,c.root.position.z)>10){this.ui.toast('請靠近中央留言樹再開始 WRITE');return;}
   legacy=true;
  }
  if(!legacy&&!result?.journey)return;
  this.legacy=legacy;this.journey=result?.journey||{
   origin:c.root.position.toArray(),start:Date.now(),expires:Date.now()+900000
  };
  this.active=true;this.phase='ascend';this.pending=null;this.reveal=null;
  this.disc.visible=true;this.drinkLight.intensity=0;
  c.setEnabled(false);c.cameraLocked=false;c.yaw=0;c.pitch=.2;c.distance=7;
 }
 startMouthText(text){
  this.clearMouthText();this.textStarted=performance.now();
  const chars=Array.from(String(text||'').trim()).slice(0,80),count=Math.min(12,Math.max(4,Math.ceil(chars.length/4)));
  const chunks=[];
  for(let i=0;i<count;i++)chunks.push(chars.slice(i*4,i*4+9).join('')||'...');
  const rect=this.ui.panel?.getBoundingClientRect();
  const startX=rect?.width?rect.left+rect.width*.5:innerWidth*.7;
  const startY=rect?.height?rect.top+rect.height*.6:innerHeight*.65;
  this.letters=chunks.map((value,i)=>{
   const el=document.createElement('span');el.textContent=value;
   el.style.cssText='position:absolute;left:0;top:0;white-space:nowrap;font:700 16px serif;color:#ffe3a0;text-shadow:0 0 12px #dca84d;opacity:0;will-change:transform,opacity';
   this.mouthLayer.append(el);
   return {el,startX:startX+(Math.random()-.5)*50,startY:startY+(Math.random()-.5)*35,delay:i*90};
  });
 }
 clearMouthText(){for(const l of this.letters)l.el.remove();this.letters=[];this.textStarted=0;}
 mouthPosition(){
  const c=this.controller(),root=c?.root,model=root?.userData.model;
  if(!root)return new THREE.Vector3(0,1,0);
  if(model&&!this.mouthBone){model.traverse(o=>{
   if(this.mouthBone||!o.isBone)return;
   if(/head|mouth|jaw/i.test(o.name))this.mouthBone=o;
  });}
  if(this.mouthBone){const point=new THREE.Vector3(),rot=new THREE.Quaternion();
   this.mouthBone.getWorldPosition(point);this.mouthBone.getWorldQuaternion(rot);
   return point.add(new THREE.Vector3(0,0,.12).applyQuaternion(rot));
  }
  return root.localToWorld(new THREE.Vector3(0,1.6,.15));
 }
 updateMouthText(){
  if(!this.letters.length)return;
  const c=this.controller(),camera=c?.camera;if(!camera)return;
  const point=this.mouthPosition().project(camera);
  const endX=(point.x+1)*innerWidth/2,endY=(1-point.y)*innerHeight/2;
  const elapsed=performance.now()-this.textStarted;
  for(const l of this.letters){
   const t=smooth((elapsed-l.delay)/850);
   const x=l.startX+(endX-l.startX)*t,y=l.startY+(endY-l.startY)*t;
   l.el.style.transform='translate('+x+'px,'+y+'px) scale('+(1-t*.82)+')';
   l.el.style.opacity=String(Math.max(0,Math.min(1,t*5,(1-t)*3)));
  }
  if(elapsed>2200)this.clearMouthText();
 }
 async submit(detail){
  if(!this.active||this.phase!=='write'||this.busy)return;
  this.busy=true;
  try{
   const pending={...detail};if(detail.file)pending.media=await this.upload(detail.file);
   delete pending.file;
   const action=this.controller()?.root.userData.actions.drink;
   const drinkDuration=Math.max(.6,Math.min(7,(action?.getClip().duration||5)*.4));
   if(this.legacy){
    const now=Date.now(),angle=(now%6283)/1000;
    this.journey={...this.journey,drinkAt:now,drinkDuration,landing:[Math.cos(angle)*3,0,Math.sin(angle)*3]};
   }else{
    const result=await this.send('write-drink',{duration:drinkDuration},{throwOnError:true});
    if(!result?.journey)return;
    this.journey=result.journey;
   }
   this.pending=pending;this.phase='submitted';
   this.startMouthText(pending.text);
   this.ui.closePanel();this.audio.play('drink');
  }catch(error){this.ui.toast(error.message||'WRITE 儲存準備失敗');}
  finally{this.busy=false;}
 }
 async cancel(){
  if(!this.active||this.phase!=='write'||this.busy)return;
  if(this.legacy){this.journey={...this.journey,drinkAt:Date.now(),drinkDuration:0,landing:[0,0,0]};}
  else{
   const result=await this.send('write-cancel');
   if(!result?.journey)return;
   this.journey=result.journey;
  }
  this.pending=null;this.phase='submitted';this.ui.closePanel();
 }
 land(pose){
  const c=this.controller();this.disc.visible=false;this.clearMouthText();
  this.drinkLight.intensity=0;this.phase='showcase';
  c.teleport(pose.position);c.grounded=true;c.cameraLocked=true;c.setEnabled(false);
  c.root.userData.plantHiddenUntil=performance.now()+duration+450;
  this.audio.play('explosion');
  this.bursts.play(pose.position,'write-'+this.journey.start);
  if(!this.pending){this.finish();return;}
  const payload={...this.pending,position:pose.position};
  this.pending=null;this.reveal={started:performance.now(),position:[...pose.position],plantId:null};
  this.plantHalo.position.set(pose.position[0],.12,pose.position[2]);
  this.plantHalo.visible=true;
  this.send('plant',payload,{throwOnError:true}).then(result=>{
   if(!result?.plant){this.ui.toast('留言尚未成功儲存');return;}
   this.reveal.plantId=result.plant.id;
   this.reveal.position=[...result.plant.position];
  }).catch(error=>this.ui.toast('WRITE 植物儲存失敗：'+error.message));
 }
 finish(){
  const c=this.controller();this.active=false;this.legacy=false;this.phase='';
  this.disc.visible=false;this.plantHalo.visible=false;this.drinkLight.intensity=0;
  this.clearMouthText();this.mouthBone=null;this.reveal=null;
  c?.root&&(c.root.userData.plantHiddenUntil=0);
  if(c){c.cameraLocked=false;c.setEnabled(!this.ui.panelName);c.updateCamera(.2);}
 }
 showcase(){
  const c=this.controller();if(!c||!this.reveal)return this.finish();
  const t=(performance.now()-this.reveal.started)/1000;
  const p=this.reveal.position,angle=t*.95+Math.PI*.25;
  const target=this.reveal.plantId&&this.arena.adventure.plants.get(this.reveal.plantId);
  if(target){target.updateMatrixWorld(true);target.getWorldPosition(this.plantHalo.position);this.plantHalo.position.y+=.11;}
  else this.plantHalo.position.set(p[0],.11,p[2]);
  this.plantHalo.rotation.z+=.016;this.plantHalo.material.opacity=.3+.32*Math.sin(t*5)**2;
  this.plantHalo.scale.setScalar(1+Math.sin(t*4)*.08);
  const center=this.plantHalo.position;
  const radius=4.2-t*.16;
  c.camera.position.set(center.x+Math.sin(angle)*radius,center.y+1.6+Math.sin(t*.8)*.18,center.z+Math.cos(angle)*radius);
  c.camera.lookAt(center.x,center.y+.8,center.z);
  if(t>=duration/1000)this.finish();
 }
 update(){
  if(!this.active)return;
  if(this.phase==='showcase'){this.showcase();return;}
  const c=this.controller(),pose=journeyPose(this.journey,Date.now());
  if(!pose){this.finish();return;}
  c.setEnabled(false);
  c.root.position.fromArray(pose.position);
  this.disc.position.set(pose.position[0],pose.phase==='ascend'?pose.position[1]-1.5:WRITE_HEIGHT-1.5,pose.phase==='ascend'?pose.position[2]:0);
  this.disc.visible=!['fall','land'].includes(pose.phase);
  c.root.rotation.y=['walk','fall','land'].includes(pose.phase)?Math.PI:0;
  c.animation=pose.animation;this.arena.setPlayerAnimation(c.root,pose.animation);
  if(pose.phase!==this.phase){
   this.phase=pose.phase;
   if(pose.phase==='write')this.ui.openPanel('social',true);
   if(pose.phase==='drink'){
    const action=c.root.userData.actions.drink;
    if(action){action.setLoop(THREE.LoopOnce);action.clampWhenFinished=true;action.time=action.getClip().duration*.6;}
   }
   if(pose.phase==='walk')this.clearMouthText();
   if(pose.phase==='fall')this.audio.play('jump');
   if(pose.phase==='land'){this.land(pose);return;}
  }
  if(pose.phase==='drink'||pose.phase==='walk'){
   const light=this.drinkLight;
   light.position.copy(this.mouthPosition());light.intensity=pose.phase==='drink'?3.5+Math.sin(performance.now()*.009):1;
   this.updateMouthText();
  }else this.drinkLight.intensity=0;
  c.updateCamera(.016);
 }
}