import * as THREE from 'three';
import {ARENA_RADIUS,PLAYER_SPAWNS} from './shared/arena.js';

export class PlayerController{
  constructor({camera,canvas,arena,root,role='fighter',seat=0,mobileStick}){
    this.camera=camera;this.canvas=canvas;this.arena=arena;this.root=root;this.role=role;this.seat=seat;this.enabled=false;this.keys=new Set();this.yaw=Math.PI;this.pitch=-.22;this.distance=6.6;this.velocityY=0;this.grounded=true;this.animation='idle';this.touchMove=new THREE.Vector2();this.touchLook=null;this.stick=mobileStick;this.stickPointer=null;this.followTarget=null;
    root.position.fromArray(PLAYER_SPAWNS[seat]||PLAYER_SPAWNS[0]);this.bind();this.updateCamera(1);
  }
  bind(){
    addEventListener('keydown',event=>{if(/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName))return;this.keys.add(event.code);if(event.code==='Space'&&this.role==='fighter'&&this.grounded){this.velocityY=8.8;this.grounded=false;}if(event.code==='Escape'&&document.pointerLockElement)this.canvas.ownerDocument.exitPointerLock();});
    addEventListener('keyup',event=>this.keys.delete(event.code));addEventListener('blur',()=>this.keys.clear());
    this.canvas.addEventListener('pointerdown',event=>{if(!this.enabled)return;if(event.pointerType==='mouse'&&event.button===0&&matchMedia('(pointer:fine)').matches&&!document.querySelector('#panel:not([hidden])'))this.canvas.requestPointerLock?.();else if(event.pointerType!=='mouse'){this.touchLook={id:event.pointerId,x:event.clientX,y:event.clientY};this.canvas.setPointerCapture(event.pointerId);}});
    addEventListener('mousemove',event=>{if(document.pointerLockElement===this.canvas){this.yaw-=event.movementX*.0024;this.pitch=THREE.MathUtils.clamp(this.pitch-event.movementY*.0019,-1.05,.48);}});
    this.canvas.addEventListener('pointermove',event=>{if(this.touchLook?.id!==event.pointerId)return;const dx=event.clientX-this.touchLook.x,dy=event.clientY-this.touchLook.y;this.touchLook.x=event.clientX;this.touchLook.y=event.clientY;this.yaw-=dx*.007;this.pitch=THREE.MathUtils.clamp(this.pitch-dy*.006,-1.05,.48);});
    this.canvas.addEventListener('pointerup',event=>{if(this.touchLook?.id===event.pointerId)this.touchLook=null;});
    this.canvas.addEventListener('wheel',event=>{this.distance=THREE.MathUtils.clamp(this.distance+Math.sign(event.deltaY)*.7,3.4,11);},{passive:true});
    if(this.stick){const knob=this.stick.firstElementChild,move=event=>{if(event.pointerId!==this.stickPointer)return;const rect=this.stick.getBoundingClientRect(),x=event.clientX-(rect.left+rect.width/2),y=event.clientY-(rect.top+rect.height/2),length=Math.hypot(x,y),limit=36,scale=length>limit?limit/length:1;this.touchMove.set(x*scale/limit,y*scale/limit);knob.style.transform=`translate(${x*scale}px,${y*scale}px)`;};this.stick.addEventListener('pointerdown',event=>{this.stickPointer=event.pointerId;this.stick.setPointerCapture(event.pointerId);move(event);});this.stick.addEventListener('pointermove',move);const stop=event=>{if(event.pointerId!==this.stickPointer)return;this.stickPointer=null;this.touchMove.set(0,0);knob.style.transform='';};this.stick.addEventListener('pointerup',stop);this.stick.addEventListener('pointercancel',stop);}
  }
  setEnabled(value){this.enabled=value;if(!value)this.keys.clear();}
  setRole(role){this.role=role;this.root.visible=role==='fighter';if(role==='spectator'){this.root.position.fromArray(PLAYER_SPAWNS[this.seat]||[0,9,34]);this.pitch=-.25;}}
  setFollowTarget(root=null){this.followTarget=root;}
  teleport(position){this.root.position.fromArray(position);this.velocityY=0;}
  update(dt){
    if(!this.enabled){this.updateCamera(dt);return this.state();}
    const inputX=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0)+this.touchMove.x,inputZ=(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0)+this.touchMove.y,length=Math.hypot(inputX,inputZ),moving=length>.05;
    const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)),right=new THREE.Vector3(-forward.z,0,forward.x),direction=new THREE.Vector3();if(moving)direction.addScaledVector(right,inputX/Math.max(1,length)).addScaledVector(forward,-inputZ/Math.max(1,length)).normalize();
    if(this.role==='spectator'){
      const vertical=(this.keys.has('KeyE')?1:0)-(this.keys.has('KeyQ')?1:0),speed=this.keys.has('ShiftLeft')?18:10;if(moving||vertical)this.followTarget=null;this.root.position.addScaledVector(direction,speed*dt);this.root.position.y=THREE.MathUtils.clamp(this.root.position.y+vertical*speed*dt,2,28);const radius=Math.hypot(this.root.position.x,this.root.position.z);if(radius>ARENA_RADIUS+20)this.root.position.multiplyScalar((ARENA_RADIUS+20)/radius);this.animation=moving?'walk':'idle';this.updateCamera(dt,true);return this.state();
    }
    const running=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'),speed=running?10:6.4;if(moving){const next=this.root.position.clone().addScaledVector(direction,speed*dt),radius=Math.hypot(next.x,next.z);if(radius<ARENA_RADIUS-1&&!this.arena.blocked(next.x,next.z,next.y)){this.root.position.x=next.x;this.root.position.z=next.z;}this.root.rotation.y=Math.atan2(direction.x,direction.z);}
    const ground=this.arena.groundHeight(this.root.position.x,this.root.position.z);this.velocityY-=22*dt;this.root.position.y+=this.velocityY*dt;if(this.root.position.y<=ground){this.root.position.y=ground;this.velocityY=0;this.grounded=true;}else this.grounded=false;
    this.animation=!this.grounded?(this.velocityY>0?'jump':'fall'):moving?(running?'run':'walk'):'idle';this.updateCamera(dt);return this.state();
  }
  updateCamera(dt,spectator=false){const focus=spectator&&this.followTarget?.visible?this.followTarget.position:this.root.position,target=focus.clone().add(new THREE.Vector3(0,spectator?1.2:1.45,0)),distance=spectator?this.distance*1.1:this.distance,offset=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*distance,Math.sin(-this.pitch)*distance+1.2,Math.cos(this.yaw)*Math.cos(this.pitch)*distance),desired=target.clone().add(offset);this.camera.position.lerp(desired,1-Math.exp(-dt*12));this.camera.lookAt(target);}
  aimDirection(){return new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion).normalize().toArray();}
  buildPosition(distance=5){const d=new THREE.Vector3(...this.aimDirection());d.y=0;d.normalize();return [this.root.position.x+d.x*distance,this.arena.groundHeight(this.root.position.x+d.x*distance,this.root.position.z+d.z*distance),this.root.position.z+d.z*distance];}
  state(){return {position:this.root.position.toArray(),rotation:this.root.rotation.y,animation:this.animation,visible:true};}
}
