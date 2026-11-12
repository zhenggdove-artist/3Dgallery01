import * as THREE from 'three';
import {ARENA_RADIUS,PLAYER_SPAWNS} from './shared/arena.js';

// RELETTER Explore's actual acceleration, camera, momentum and jump constants.
export const RELETTER_MOVEMENT=Object.freeze({speed:8.64,acceleration:6,deceleration:12,gravity:25,jump:10});
export class PlayerController{
  constructor({camera,canvas,arena,root,role='fighter',seat=0,mobileStick}){
    Object.assign(this,{camera,canvas,arena,root,role,seat});this.enabled=false;this.keys=new Set();this.yaw=0;this.pitch=.2;this.distance=7;this.speed=0;this.velocityY=0;this.grounded=true;this.animation='idle';this.move=new THREE.Vector2();this.jumpVelocity=new THREE.Vector3();this.direction=new THREE.Vector3();this.target=new THREE.Vector3();this.drag=null;this.pointers=new Map();this.followTarget=null;this.stats={speed:1,jump:1,gravity:1};
    root.position.fromArray(PLAYER_SPAWNS[seat]||PLAYER_SPAWNS[0]);this.bind(mobileStick);this.updateCamera(1);
  }
  bind(stick){
    addEventListener('keydown',e=>{if(!this.enabled||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.code==='Space'&&!e.repeat)this.jump();});
    addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>{this.keys.clear();this.move.set(0,0);this.drag=null;this.pointers.clear();});
    this.canvas.addEventListener('pointerdown',e=>{if(!this.enabled||e.button>0)return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.canvas.setPointerCapture(e.pointerId);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};if(this.pointers.size===2){const [a,b]=[...this.pointers.values()];this.pinch={span:Math.hypot(a.x-b.x,a.y-b.y),distance:this.distance};}});
    this.canvas.addEventListener('pointermove',e=>{if(!this.enabled||!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const [a,b]=[...this.pointers.values()];this.distance=THREE.MathUtils.clamp(this.pinch.distance*this.pinch.span/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),3,50);return;}if(this.drag?.id!==e.pointerId)return;this.yaw=this.drag.yaw-(e.clientX-this.drag.x)/innerWidth*4;this.pitch=THREE.MathUtils.clamp(this.drag.pitch+(e.clientY-this.drag.y)/innerHeight*2,-1.15,1.4);});
    const release=e=>{this.pointers.delete(e.pointerId);this.drag=null;};this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);
    this.canvas.addEventListener('wheel',e=>{if(!this.enabled)return;e.preventDefault();this.distance=THREE.MathUtils.clamp(this.distance+e.deltaY*.015,3,50);},{passive:false});
    if(stick){let pointer=null;const knob=stick.firstElementChild;const move=e=>{if(e.pointerId!==pointer)return;const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,f=20/Math.max(20,Math.hypot(x,y));this.move.set(x*f/20,y*f/20);knob.style.transform=`translate(${x*f}px,${y*f}px)`;};stick.onpointerdown=e=>{pointer=e.pointerId;stick.setPointerCapture(pointer);move(e);};stick.onpointermove=move;stick.onpointerup=stick.onpointercancel=()=>{pointer=null;this.move.set(0,0);knob.style.transform='';};}
  }
  jump(){if(!this.enabled||this.role!=='fighter')return;if(this.stats.impulse){const now=performance.now();if(now-(this.lastFlap||-Infinity)<this.stats.flapMs||this.root.position.y>38)return;this.lastFlap=now;if(this.grounded)this.jumpVelocity.copy(this.direction).multiplyScalar(this.speed);this.grounded=false;this.velocityY=this.stats.impulse*this.stats.jump;return;}if(!this.grounded)return;this.grounded=false;this.velocityY=10*this.stats.jump;this.jumpVelocity.copy(this.direction).multiplyScalar(this.speed);}
  setEnabled(value){this.enabled=value;if(!value){this.keys.clear();this.move.set(0,0);this.drag=null;this.pointers.clear();}}
  setRole(role){this.role=role;this.root.visible=role==='fighter';}
  setFollowTarget(root=null){this.followTarget=root;}
  teleport(position){this.root.position.fromArray(position);this.speed=0;this.velocityY=0;this.jumpVelocity.set(0,0,0);}
  stepHorizontal(dx,dz){const p=this.root.position,nx=p.x+dx,nz=p.z+dz;if(Math.hypot(nx,nz)>ARENA_RADIUS-1)return;const targetY=this.arena.groundHeight(nx,nz);if(this.grounded&&targetY-p.y>=3)return;if(!this.arena.blocked(nx,nz,p.y)){p.x=nx;p.z=nz;}else{if(!this.arena.blocked(nx,p.z,p.y))p.x=nx;if(!this.arena.blocked(p.x,nz,p.y))p.z=nz;}if(this.grounded){if(p.y-targetY>4){this.grounded=false;this.velocityY=0;}else p.y=targetY;}}
  update(dt){
    if(!this.enabled){this.updateCamera(dt);return this.state();}
    if(this.knockback){this.stepHorizontal(this.knockback.x*dt,this.knockback.z*dt);this.knockback.multiplyScalar(Math.exp(-5*dt));if(this.knockback.lengthSq()<.001)this.knockback=null;}
    const has=(a,b)=>this.keys.has(a)||this.keys.has(b),x=Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft'))+this.move.x,z=Number(has('KeyS','ArrowDown'))-Number(has('KeyW','ArrowUp'))+this.move.y,moving=Math.hypot(x,z)>.1;
    this.direction.set(x*Math.cos(this.yaw)+z*Math.sin(this.yaw),0,-x*Math.sin(this.yaw)+z*Math.cos(this.yaw)).normalize();
    if(this.role==='spectator'){if(moving)this.followTarget=null;this.root.position.addScaledVector(this.direction,10*dt);this.root.position.y=THREE.MathUtils.clamp(this.root.position.y+((this.keys.has('KeyE')?1:0)-(this.keys.has('KeyQ')?1:0))*10*dt,2,28);const r=Math.hypot(this.root.position.x,this.root.position.z);if(r>ARENA_RADIUS+20){this.root.position.x*=(ARENA_RADIUS+20)/r;this.root.position.z*=(ARENA_RADIUS+20)/r;}this.updateCamera(dt);return this.state();}
    if(this.grounded){this.speed=moving?Math.min(8.64*this.stats.speed,this.speed+6*this.stats.speed*dt):Math.max(0,this.speed-12*dt);if(moving){this.stepHorizontal(this.direction.x*this.speed*dt,this.direction.z*this.speed*dt);this.root.rotation.y=Math.atan2(this.direction.x,this.direction.z);}}
    else{this.velocityY-=25*this.stats.gravity*dt;this.root.position.y+=this.velocityY*dt;const airSpeed=this.stats.impulse?8.64*this.stats.speed*.8:this.speed*.3;if(this.stats.impulse){this.jumpVelocity.multiplyScalar(Math.exp(-6*dt));if(moving)this.root.rotation.y=Math.atan2(this.direction.x,this.direction.z);}this.stepHorizontal((this.jumpVelocity.x+this.direction.x*airSpeed)*dt,(this.jumpVelocity.z+this.direction.z*airSpeed)*dt);const floor=this.arena.groundHeight(this.root.position.x,this.root.position.z);if(this.root.position.y<=floor&&this.velocityY<=0){this.root.position.y=floor;this.velocityY=0;this.grounded=true;}}
    this.animation=!this.grounded?(this.velocityY>0?'jump':'fall'):moving?'walk':'idle';this.updateCamera(dt);return this.state();
  }
  updateCamera(dt){if(this.cameraLocked)return;const focus=this.followTarget?.visible?this.followTarget.position:this.root.position;this.target.copy(focus);this.target.y+=1.2;this.camera.position.set(this.target.x+this.distance*Math.cos(this.pitch)*Math.sin(this.yaw),this.target.y+this.distance*Math.sin(this.pitch),this.target.z+this.distance*Math.cos(this.pitch)*Math.cos(this.yaw));if(this.pitch<0){this.camera.position.y=Math.max(this.camera.position.y,focus.y+.6);this.camera.lookAt(this.target.x-Math.sin(this.yaw)*20,this.camera.position.y+Math.tan(-this.pitch)*20,this.target.z-Math.cos(this.yaw)*20);}else this.camera.lookAt(this.target);}
  aimDirection(){const elevation=THREE.MathUtils.clamp(-this.pitch,-.7,.8),h=this.root.rotation.y;return [Math.sin(h)*Math.cos(elevation),Math.sin(elevation),Math.cos(h)*Math.cos(elevation)];}
  buildPosition(distance=5){const h=this.root.rotation.y,x=this.root.position.x+Math.sin(h)*distance,z=this.root.position.z+Math.cos(h)*distance;return [x,this.arena.groundHeight(x,z),z];}
  state(){return {position:this.root.position.toArray(),rotation:this.root.rotation.y,animation:this.animation,visible:true};}
}
