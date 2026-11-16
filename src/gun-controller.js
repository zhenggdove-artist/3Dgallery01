import * as THREE from 'three';
import {weaponMuzzle} from './weapon-muzzle.js';

// CSS uses a transparent 35vmin-radius circular sniper viewport. The opaque
// remainder is an exit target, even though the overlay ignores hit-testing.
export function outsideScopeCircle(x,y,width,height){
 const radius=.35*Math.min(width,height);
 return Math.hypot(x-width*.5,y-height*.5)>radius;
}

// RELETTER gun-additions: shoulder / sniper scope, original sensitivity and FOV.
export class GunController {
  constructor({canvas,camera,controller,weapon,ui,attack}) {
    Object.assign(this,{canvas,camera,controller,weapon,ui,attack});this.mode=0;this.held=false;this.nextShot=0;this.recoilOffset=0;this.recoilAmount=0;this.lastKick=-Infinity;
    this.overlay=document.createElement('div');this.overlay.id='gun-overlay';this.overlay.hidden=true;
    this.overlay.innerHTML='<div class="gun-reticle"></div><div class="scope-lines"></div><span>A/Q · CAMERA / TAP SCENE · FIRE</span>';document.body.append(this.overlay);
    // Capture before the canvas firing handler and all HUD controls: any tap
    // in the black scope mask dismisses mobile zoom without shooting or
    // accidentally activating whatever UI lies beneath that mask.
    addEventListener('pointerdown',e=>{
      if(this.mode!==2||e.button>0||!outsideScopeCircle(e.clientX,e.clientY,innerWidth,innerHeight))return;
      e.preventDefault();e.stopImmediatePropagation();this.end();
    },true);
    addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||ui.panelName)return;if(e.code==='KeyV'&&weapon()?.firstPerson&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();this.cycle();}if(e.code==='Escape'&&this.mode){this.end();}},true);
    addEventListener('pointermove',e=>{if(!this.mode||controller()?.status?.freeze||e.target!==canvas)return;e.stopImmediatePropagation();const c=controller(),s=.002*(this.mode===2?.3:1);const previous=this.lookPointer?.id===e.pointerId?this.lookPointer:null,dx=e.pointerType==='touch'?(previous?e.clientX-previous.x:0):e.movementX,dy=e.pointerType==='touch'?(previous?e.clientY-previous.y:0):e.movementY;if(e.pointerType==='touch')this.lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};c.yaw-=dx*s;c.pitch=THREE.MathUtils.clamp(c.pitch+dy*s,-1.1,1.2);},true);
    for(const type of ['pointerdown','pointerup','pointercancel'])addEventListener(type,e=>{
      const button=e.target.closest?.('#attack-button');if(!weapon()?.firstPerson||!controller()?.enabled||controller()?.holdingArt)return;
      // A/Q cycles CAMERA only. Direct canvas taps shoot while aiming;
      // neither the first nor subsequent A presses may trigger gunfire.
      if(button)return;
      if(!this.mode||controller()?.status?.freeze||e.target!==canvas||e.button>0)return;e.preventDefault();e.stopImmediatePropagation();
      if(type==='pointerdown'){this.lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};if(!document.pointerLockElement)canvas.setPointerCapture(e.pointerId);if(weapon().id==='white-cat'){this.held=true;this.nextShot=0;}else ui.emit('gun-fire');}
      else{this.lookPointer=null;this.held=false;}
    },true);
    addEventListener('blur',()=>this.end());document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement){this.held=false;ui.emit('attack-cancel');}});
  }
  cycle(){const c=this.controller(),w=this.weapon();if(!c?.enabled||!w?.firstPerson)return;if(!this.mode){this.savedFov=this.camera.fov;this.weaponId=w.id;this.mode=1;}else if(w.id==='black-cat'&&this.mode===1)this.mode=2;else return this.end();this.held=false;this.ui.emit('attack-cancel');if(matchMedia('(pointer:fine)').matches){try{this.canvas.requestPointerLock()?.catch(()=>{});}catch{}}}
  end(){if(!this.mode)return;this.mode=0;this.held=false;this.recoilAmount=0;this.recoilOffset=0;this.lookPointer=null;this.overlay.hidden=true;this.ui.emit('attack-cancel');this.camera.fov=this.savedFov;this.camera.updateProjectionMatrix();const root=this.controller()?.root;if(root){root.userData.model.visible=true;if(root.userData.blade)root.userData.blade.visible=true;}if(document.pointerLockElement===this.canvas)document.exitPointerLock();}
  direction(){const c=this.controller();return new THREE.Vector3(-Math.sin(c.yaw)*Math.cos(c.pitch),-Math.sin(c.pitch),-Math.cos(c.yaw)*Math.cos(c.pitch));}
  shot(){const ray=new THREE.Raycaster();this.camera.updateMatrixWorld();ray.setFromCamera(new THREE.Vector2(),this.camera);const c=this.controller(),range=this.weapon().chargedRange||this.weapon().range,origin=weaponMuzzle(c.root,this.weapon())||c.root.position.clone().add(new THREE.Vector3(0,1,0));let point=ray.ray.at(range,new THREE.Vector3());const targets=[...c.arena.artworks.values(),c.arena.monster,...(c.arena.remoteAimTargets||[])].filter(o=>o?.visible&&o!==c.root);const hit=ray.intersectObjects(targets,true).find(h=>h.distance>.15&&h.distance<=range);if(hit)point.copy(hit.point);return {origin:origin.toArray(),aimPoint:point.toArray(),direction:point.clone().sub(origin).normalize().toArray()};}
  shotDirection(){return new THREE.Vector3(...this.shot().direction);}
  kick(weapon){if(!this.mode)return;const amount=weapon?.id==='black-cat'?.24:weapon?.id==='white-cat'?.06:0;if(!amount)return;this.recoilAmount=Math.min(.4,this.recoilAmount+amount);this.lastKick=performance.now();}
  aimWithRecoil(){return this.direction().add(new THREE.Vector3(0,this.recoilOffset,0)).normalize();}
  pose(presentation){if(!this.mode)return;const root=this.controller().root,d=root.userData,direction=this.aimWithRecoil(),right=new THREE.Vector3(Math.cos(this.controller().yaw),0,-Math.sin(this.controller().yaw));
    const solve=(side,target)=>{const hand=d.bones?.get(side+'Hand');if(!hand)return;const chain=[d.bones.get(side+'ForeArm'),d.bones.get(side+'Arm')].filter(Boolean);for(const bone of chain)presentation.restore.push([bone,'quaternion',bone.quaternion.clone()]);root.updateMatrixWorld(true);for(let i=0;i<3;i++)for(const bone of chain){const origin=bone.getWorldPosition(new THREE.Vector3()),actual=hand.getWorldPosition(new THREE.Vector3()).sub(origin),desired=target.clone().sub(origin);if(actual.lengthSq()<1e-8||desired.lengthSq()<1e-8)continue;const delta=new THREE.Quaternion().setFromUnitVectors(actual.normalize(),desired.normalize()),world=bone.getWorldQuaternion(new THREE.Quaternion()),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(delta).multiply(world));bone.updateMatrixWorld(true);}return hand;};
    const target=root.position.clone().add(new THREE.Vector3(0,.95,0)).addScaledVector(direction,.35).addScaledVector(right,.2),hand=solve('Right',target);if(hand&&d.blade){root.updateMatrixWorld(true);d.blade.position.copy(root.worldToLocal(hand.getWorldPosition(new THREE.Vector3())));d.blade.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction)));d.blade.updateMatrixWorld(true);solve('Left',d.blade.localToWorld(new THREE.Vector3(0,.45,0)));}
  }
  update(){if(!this.mode)return;const c=this.controller(),w=this.weapon();if(!c?.enabled||w?.id!==this.weaponId||this.ui.panelName){this.end();return;}const recoilAge=Math.max(0,(performance.now()-this.lastKick)/1000);this.recoilOffset=this.recoilAmount*Math.exp(-recoilAge*9);if(recoilAge>1)this.recoilAmount=0;const scope=this.mode===2,d=this.aimWithRecoil(),right=new THREE.Vector3(Math.cos(c.yaw),0,-Math.sin(c.yaw));c.root.rotation.y=Math.atan2(d.x,d.z);this.camera.position.copy(c.root.position).add(new THREE.Vector3(0,1.05,0));if(!scope)this.camera.position.addScaledVector(d,-2.3).addScaledVector(right,.55).add(new THREE.Vector3(0,.35,0));this.camera.lookAt(this.camera.position.clone().add(d));this.camera.fov=scope?20:62;this.camera.updateProjectionMatrix();c.root.userData.model.visible=!scope;if(c.root.userData.blade)c.root.userData.blade.visible=!scope;this.overlay.hidden=false;this.overlay.className=scope?'scoped':w.id==='black-cat'?'sniper-shoulder':'';if(this.held&&!c.status?.freeze&&performance.now()>=this.nextShot){this.nextShot=performance.now()+w.cooldown;this.attack(0);}}
}
