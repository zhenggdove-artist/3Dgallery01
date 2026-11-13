import * as THREE from 'three';

// RELETTER gun-additions: shoulder / sniper scope, original sensitivity and FOV.
export class GunController {
  constructor({canvas,camera,controller,weapon,ui,attack}) {
    Object.assign(this,{canvas,camera,controller,weapon,ui,attack});this.mode=0;this.held=false;this.nextShot=0;
    this.overlay=document.createElement('div');this.overlay.id='gun-overlay';this.overlay.hidden=true;
    this.overlay.innerHTML='<div class="gun-reticle"></div><div class="scope-lines"></div><span>V · CAMERA / ESC · EXIT</span>';document.body.append(this.overlay);
    addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||ui.panelName)return;if(e.code==='KeyV'&&weapon()?.firstPerson&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();this.cycle();}if(e.code==='Escape'&&this.mode){this.end();}},true);
    addEventListener('pointermove',e=>{if(!this.mode||e.target!==canvas)return;e.stopImmediatePropagation();const c=controller(),s=.002*(this.mode===2?.3:1);c.yaw-=e.movementX*s;c.pitch=THREE.MathUtils.clamp(c.pitch+e.movementY*s,-1.1,1.2);},true);
    for(const type of ['pointerdown','pointerup','pointercancel'])addEventListener(type,e=>{
      const button=e.target.closest?.('#attack-button');if(!weapon()?.firstPerson||!controller()?.enabled)return;
      // The sketch's attack button always charges/releases, including guns.
      // V still selects the original shoulder/scope camera on desktop.
      if(button){e.preventDefault();e.stopImmediatePropagation();if(type==='pointerup')this.cycle();return;}
      if(!this.mode||e.target!==canvas||e.button>0)return;e.preventDefault();e.stopImmediatePropagation();
      if(type==='pointerdown'){if(!document.pointerLockElement)canvas.setPointerCapture(e.pointerId);if(weapon().id==='white-cat'){this.held=true;this.nextShot=0;}else ui.emit('attack-start');}
      else{this.held=false;ui.emit(type==='pointercancel'?'attack-cancel':'attack-release');}
    },true);
    addEventListener('blur',()=>this.end());document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement){this.held=false;ui.emit('attack-cancel');}});
  }
  cycle(){const c=this.controller(),w=this.weapon();if(!c?.enabled||!w?.firstPerson)return;if(!this.mode){this.savedFov=this.camera.fov;this.weaponId=w.id;this.mode=1;}else if(w.id==='black-cat'&&this.mode===1)this.mode=2;else return this.end();this.held=false;this.ui.emit('attack-cancel');if(matchMedia('(pointer:fine)').matches){try{this.canvas.requestPointerLock()?.catch(()=>{});}catch{}}}
  end(){if(!this.mode)return;this.mode=0;this.held=false;this.overlay.hidden=true;this.ui.emit('attack-cancel');this.camera.fov=this.savedFov;this.camera.updateProjectionMatrix();const root=this.controller()?.root;if(root){root.userData.model.visible=true;if(root.userData.blade)root.userData.blade.visible=true;}if(document.pointerLockElement===this.canvas)document.exitPointerLock();}
  direction(){const c=this.controller();return new THREE.Vector3(-Math.sin(c.yaw)*Math.cos(c.pitch),-Math.sin(c.pitch),-Math.cos(c.yaw)*Math.cos(c.pitch));}
  shotDirection(){const ray=new THREE.Raycaster();this.camera.updateMatrixWorld();ray.setFromCamera(new THREE.Vector2(),this.camera);const origin=this.controller().root.position.clone().add(new THREE.Vector3(0,1,0)),range=this.weapon().chargeRange||this.weapon().range,point=ray.ray.at(range,new THREE.Vector3()),d=point.sub(origin).normalize();if(this.weapon().id==='black-cat'&&this.mode===1){d.x+=(Math.random()-.5)*.07;d.y+=(Math.random()-.5)*.07;d.z+=(Math.random()-.5)*.07;d.normalize();}return d;}
  pose(presentation){if(this.mode!==1)return;const root=this.controller().root,d=root.userData,direction=this.direction(),right=new THREE.Vector3(Math.cos(this.controller().yaw),0,-Math.sin(this.controller().yaw));
    const solve=(side,target)=>{const hand=d.bones?.get(side+'Hand');if(!hand)return;const chain=[d.bones.get(side+'ForeArm'),d.bones.get(side+'Arm')].filter(Boolean);for(const bone of chain)presentation.restore.push([bone,'quaternion',bone.quaternion.clone()]);root.updateMatrixWorld(true);for(let i=0;i<3;i++)for(const bone of chain){const origin=bone.getWorldPosition(new THREE.Vector3()),actual=hand.getWorldPosition(new THREE.Vector3()).sub(origin),desired=target.clone().sub(origin);if(actual.lengthSq()<1e-8||desired.lengthSq()<1e-8)continue;const delta=new THREE.Quaternion().setFromUnitVectors(actual.normalize(),desired.normalize()),world=bone.getWorldQuaternion(new THREE.Quaternion()),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(delta).multiply(world));bone.updateMatrixWorld(true);}return hand;};
    const target=root.position.clone().add(new THREE.Vector3(0,.95,0)).addScaledVector(direction,.35).addScaledVector(right,.2),hand=solve('Right',target);if(hand&&d.blade){root.updateMatrixWorld(true);d.blade.position.copy(root.worldToLocal(hand.getWorldPosition(new THREE.Vector3())));d.blade.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction)));d.blade.updateMatrixWorld(true);solve('Left',d.blade.localToWorld(new THREE.Vector3(0,.45,0)));}
  }
  update(){if(!this.mode)return;const c=this.controller(),w=this.weapon();if(!c?.enabled||w?.id!==this.weaponId||this.ui.panelName){this.end();return;}const scope=this.mode===2,d=this.direction(),right=new THREE.Vector3(Math.cos(c.yaw),0,-Math.sin(c.yaw));c.root.rotation.y=Math.atan2(d.x,d.z);this.camera.position.copy(c.root.position).add(new THREE.Vector3(0,1.05,0));if(!scope)this.camera.position.addScaledVector(d,-2.3).addScaledVector(right,.55).add(new THREE.Vector3(0,.35,0));this.camera.lookAt(this.camera.position.clone().add(d));this.camera.fov=scope?20:62;this.camera.updateProjectionMatrix();c.root.userData.model.visible=!scope;if(c.root.userData.blade)c.root.userData.blade.visible=!scope;this.overlay.hidden=false;this.overlay.className=scope?'scoped':w.id==='black-cat'?'sniper-shoulder':'';if(this.held&&performance.now()>=this.nextShot){this.nextShot=performance.now()+w.cooldown;this.attack(0);}}
}
