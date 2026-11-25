import * as THREE from 'three';
import {bindMobileStick} from './mobile-stick.js';
import {ARENA_RADIUS,PLAYER_SPAWNS} from './shared/arena.js';
import {PAN_BLAST_GRAVITY,PAN_BLAST_LAUNCH_SPEED,PAN_BLAST_BOUNCE_SPEEDS,PAN_BLAST_BOUNCE_GRAVITY,PAN_BLAST_INITIAL_DURATION} from './shared/pan-blast-flight.js';
import {WHIP_PULL_SPEED} from './shared/weapon-abilities.js';
import {vortexSpinPoint,VORTEX_SPIN_MS} from './shared/vortex-flight.js';

// RELETTER Explore's actual acceleration, camera, momentum and jump constants.
export const RELETTER_MOVEMENT=Object.freeze({speed:8.64,acceleration:6,deceleration:12,gravity:25,jump:10});
export class PlayerController{
  constructor({camera,canvas,arena,root,role='fighter',seat=0,mobileStick}){
    Object.assign(this,{camera,canvas,arena,root,role,seat});this.enabled=false;this.keys=new Set();this.yaw=0;this.pitch=.2;this.distance=7;this.speed=0;this.velocityY=0;this.grounded=true;this.animation='idle';this.move=new THREE.Vector2();this.jumpVelocity=new THREE.Vector3();this.direction=new THREE.Vector3();this.target=new THREE.Vector3();this.drag=null;this.pinch=null;this.pointers=new Map();this.followTarget=null;this.stats={speed:1,jump:1,gravity:1};this.castMoveFactor=1;this.status={};this.whipPull=null;this.vortexSpin=null;
    root.position.fromArray(PLAYER_SPAWNS[seat]||PLAYER_SPAWNS[0]);root.position.y=arena.groundHeight(root.position.x,root.position.z);this.bind(mobileStick);this.updateCamera(1);
  }
  bind(stick){
    addEventListener('keydown',e=>{if(!this.enabled||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.code==='Space'&&!e.repeat)this.jump();});
    addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>{this.keys.clear();this.move.set(0,0);this.drag=null;this.pinch=null;this.pointers.clear();this.channelAiming=false;this.channelMouseLast=null;});
     // A-button pointer capture delivers mouse movement to the document,
     // NOT to the game canvas. Listen in CAPTURE phase even when LMB is held.
     // Only one camera handler runs; canvas drag is suppressed while channeling.
     this.channelMouseLast=null;
     document.addEventListener('pointermove',e=>{
      if(!this.channelAiming||!this.enabled||this.status.freeze||
         e.pointerType!=='mouse'||(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches)){
       this.channelMouseLast=null;return;
      }
      const last=this.channelMouseLast;
      const dx=Number(e.movementX)||(!last?0:e.clientX-last.x);
      const dy=Number(e.movementY)||(!last?0:e.clientY-last.y);
      this.channelMouseLast={x:e.clientX,y:e.clientY};
      this.yaw-=dx/innerWidth*4;
      this.pitch=THREE.MathUtils.clamp(this.pitch+dy/innerHeight*2,-1.15,1.4);
     },true);
    // A gesture belongs to the pointers that actually started on the canvas.
    // Losing capture or lifting either finger must retire the pinch immediately;
    // otherwise a subsequent SINGLE finger can inherit a stale zoom gesture.
    if(this.canvas.style)this.canvas.style.touchAction='none';
    const rebuildCameraGesture=()=>{
      const entries=[...this.pointers];
      const touches=entries.filter(([,point])=>point.type==='touch');
      if(touches.length===2&&entries.length===2){
        const ids=touches.map(([id])=>id);
        if(!this.pinch||ids.some(id=>!this.pinch.ids.includes(id))){
          const [a,b]=touches.map(([,point])=>point);
          this.pinch={ids,span:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),distance:this.distance};
        }
        this.drag=null;
        return;
      }
      this.pinch=null;
      const [id,point]=entries[0]||[];
      this.drag=point?{id,x:point.x,y:point.y,yaw:this.yaw,pitch:this.pitch}:null;
    };
    this.canvas.addEventListener('pointerdown',e=>{
      if(!this.enabled||this.status.freeze||e.button>0)return;
      if(this.pointers.has(e.pointerId)||(e.pointerType==='touch'&&this.pointers.size>=2))return;
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
      try{this.canvas.setPointerCapture(e.pointerId);}catch{}
      rebuildCameraGesture();
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(!this.enabled||this.status.freeze||!this.pointers.has(e.pointerId))return;
      const point=this.pointers.get(e.pointerId);
      point.x=e.clientX;point.y=e.clientY;
      if(this.pinch&&this.pinch.ids.every(id=>this.pointers.has(id))){
        const [a,b]=this.pinch.ids.map(id=>this.pointers.get(id));
        this.distance=THREE.MathUtils.clamp(
          this.pinch.distance*this.pinch.span/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),3,50);
        return;
      }
      // One active touch is ALWAYS an orbit, never a zoom.
      if(this.pointers.size!==1||this.drag?.id!==e.pointerId)return;
      if(this.channelAiming&&e.pointerType==='mouse')return;
      this.yaw=this.drag.yaw-(e.clientX-this.drag.x)/innerWidth*4;
      this.pitch=THREE.MathUtils.clamp(this.drag.pitch+(e.clientY-this.drag.y)/innerHeight*2,-1.15,1.4);
    });
    const release=e=>{
      if(!this.pointers.delete(e.pointerId))return;
      rebuildCameraGesture();
    };
    for(const event of ['pointerup','pointercancel','lostpointercapture']){
      this.canvas.addEventListener(event,release);
      addEventListener(event,release,true);
    }
    // Safari may omit pointer-up during simultaneous touches. The live native
    // touch list is authoritative; purge any ghost pointer before a drag.
    const reconcileTouches=event=>{
      const live=[...event.touches].filter(t=>t.target===this.canvas);
      const saved=[...this.pointers].filter(([,point])=>point.type==='touch');
      const keep=new Set();
      for(const touch of live){
        let chosen=null,nearest=Infinity;
        for(const [id,point] of saved){
          if(keep.has(id))continue;
          const d=Math.hypot(point.x-touch.clientX,point.y-touch.clientY);
          if(d<nearest){nearest=d;chosen=id;}
        }
        if(chosen!==null)keep.add(chosen);
      }
      let changed=false;
      for(const [id] of saved)if(!keep.has(id)){this.pointers.delete(id);changed=true;}
      if(changed)rebuildCameraGesture();
    };
    for(const event of ['touchend','touchcancel'])
      addEventListener(event,reconcileTouches,{capture:true,passive:true});
    this.canvas.addEventListener('wheel',e=>{if(!this.enabled)return;e.preventDefault();this.distance=THREE.MathUtils.clamp(this.distance+e.deltaY*.015,3,50);},{passive:false});
    if(stick)this.mobileStick=bindMobileStick(stick,{enabled:()=>this.enabled,write:(x,y)=>this.move.set(x,y)});
  }
  jump(){if(this.awaitingSpawn||this.vortexSpin||this.panBlastFlight||!this.enabled||this.status.freeze||this.status.root||this.status.confuse||performance.now()<(this.stunUntil||0)||this.role!=='fighter')return;if(this.stats.impulse){const now=performance.now();if(now-(this.lastFlap||-Infinity)<this.stats.flapMs||this.root.position.y>=64)return;this.lastFlap=now;if(this.grounded)this.jumpVelocity.copy(this.direction).multiplyScalar(this.speed);this.walkOffMomentum=false;this.grounded=false;this.velocityY=this.stats.impulse*this.stats.jump;this.onJump?.();return;}if(!this.grounded)return;this.fallStartY=this.root.position.y;this.walkOffMomentum=false;this.grounded=false;this.velocityY=10*this.stats.jump;this.onJump?.();this.jumpVelocity.copy(this.direction).multiplyScalar(this.speed);}
  setEnabled(value){this.enabled=value;if(!value){this.mobileStick?.reset();this.keys.clear();this.move.set(0,0);this.drag=null;this.pinch=null;this.pointers.clear();}}
  setRole(role){if(this.role!==role)this.mobileStick?.reset();this.role=role;this.root.visible=role==='fighter';this.followTarget=null;this.spectatorLift=0;this.cameraLocked=false;this.authorityHoldUntil=0;this.stunUntil=0;}
  setFollowTarget(root=null){this.followTarget=root;}
  teleport(position){this.root.position.fromArray(position);this.speed=0;this.velocityY=0;this.jumpVelocity.set(0,0,0);this.walkOffMomentum=false;this.knockback=null;this.knockbackRemaining=0;this.knockbackSpeed=0;this.panBlastFlight=null;this.whipPull=null;this.vortexSpin=null;this.tidePush=null;}
  beginPanBlast(hit){
    if(!hit?.panBlast||!(Number(hit.knockbackDistance)>0))return false;
    const d=new THREE.Vector3(...hit.vector);d.y=0;
    if(d.lengthSq()<.0001)d.set(0,0,1);
    d.normalize();
    this.whipPull=null;
    this.panBlastFlight={
      direction:d,remaining:hit.knockbackDistance,
      horizontalSpeed:hit.knockbackDistance/PAN_BLAST_INITIAL_DURATION,
      rebounds:0,landings:0,elapsed:0
    };
    this.knockback=null;this.knockbackRemaining=0;
    this.jumpVelocity.set(0,0,0);this.walkOffMomentum=false;
    this.velocityY=PAN_BLAST_LAUNCH_SPEED;this.grounded=false;this.fallStartY=this.root.position.y;
    this.speed=0;
    return true;
  }
  beginVortexSpin(spin){
    if(!spin?.id||!Array.isArray(spin.start)||!Array.isArray(spin.center))return false;
    this.vortexSpin={...spin,startYaw:this.root.rotation.y};
    this.knockback=null;this.knockbackRemaining=0;this.whipPull=null;
    return true;
  }
  beginWhipPull(pull){
    if(!Array.isArray(pull?.center)||pull.center.length!==2||!pull.center.every(Number.isFinite))return false;
    const duration=Math.min(.8,Math.max(0,Number(pull.durationMs)||0)/1000);
    if(!duration)return false;
    this.whipPull={center:pull.center.slice(),speed:WHIP_PULL_SPEED,remaining:duration};
    this.knockback=null;this.knockbackRemaining=0;
    return true;
  }
  advanceWhipPull(dt){
    const pull=this.whipPull;if(!pull)return;
    const step=Math.min(Math.max(0,Number(dt)||0),pull.remaining);
    pull.remaining=Math.max(0,pull.remaining-step);
    const dx=pull.center[0]-this.root.position.x,dz=pull.center[1]-this.root.position.z;
    const distance=Math.hypot(dx,dz);
    if(distance>.0001&&step>0){
      const movement=Math.min(distance,pull.speed*step);
      this.stepHorizontal(dx/distance*movement,dz/distance*movement);
    }
    if(pull.remaining<=.000001)this.whipPull=null;
  }
  advancePanBlast(dt){
    let remaining=Math.max(0,Math.min(Number(dt)||0,.4));
    while(remaining>.0000001&&this.panBlastFlight){
      const step=Math.min(remaining,1/120),flight=this.panBlastFlight,root=this.root;
      remaining-=step;flight.elapsed+=step;
      if(flight.remaining>0){
        const move=Math.min(flight.remaining,flight.horizontalSpeed*step);
        const x=root.position.x,z=root.position.z;
        this.stepHorizontal(flight.direction.x*move,flight.direction.z*move);
        const travelled=Math.hypot(root.position.x-x,root.position.z-z);
        flight.remaining=Math.max(0,flight.remaining-travelled);
        // Real obstacles/arena limits stop the horizontal knockback.
        if(travelled<.000001)flight.remaining=0;
      }
      const previousY=root.position.y;
      this.velocityY-=(flight.rebounds>0?PAN_BLAST_BOUNCE_GRAVITY:PAN_BLAST_GRAVITY)*step;
      root.position.y+=this.velocityY*step;
      if(root.position.y>64){root.position.y=64;this.velocityY=0;}
      const floor=this.arena.groundHeight(root.position.x,root.position.z,Math.max(previousY,root.position.y));
      if(this.velocityY<=0&&previousY>=floor-.05&&root.position.y<=floor){
        root.position.y=floor;flight.landings++;
        if(flight.rebounds<PAN_BLAST_BOUNCE_SPEEDS.length){
          this.velocityY=PAN_BLAST_BOUNCE_SPEEDS[flight.rebounds++];
        }else{
          this.velocityY=0;this.grounded=true;this.panBlastFlight=null;
          this.jumpVelocity.set(0,0,0);
        }
      }
      if(root.position.y<-4){
        root.position.y=0;this.velocityY=0;this.grounded=true;this.panBlastFlight=null;
      }
    }
    this.animation=this.panBlastFlight?(this.velocityY>=0?'jump':'fall'):'idle';
  }
  stepHorizontal(dx,dz){
    const p=this.root.position,nx=p.x+dx,nz=p.z+dz;
    // All discs are walkable tops without invisible side colliders.
    // Keep only real build collision and the outer arena limit.
    const permitted=(x,z)=>Math.hypot(x,z)<=ARENA_RADIUS-1&&!this.arena.blocked(x,z,p.y);
    if(permitted(nx,nz)){p.x=nx;p.z=nz;}
    else{
      if(permitted(nx,p.z))p.x=nx;
      if(permitted(p.x,nz))p.z=nz;
    }
    if(this.grounded){
      const floor=this.arena.groundHeight(p.x,p.z,p.y);
      if(p.y-floor>.5){
       // Crossing the rim is not a wall. Carry walking velocity into
       // free fall instead of instantly reducing lateral travel to 30%.
       this.fallStartY=p.y;this.grounded=false;this.velocityY=0;
       const length=Math.hypot(dx,dz);
       if(length>.00001){this.jumpVelocity.set(dx/length*this.speed,0,dz/length*this.speed);this.walkOffMomentum=true;}
      }else if(floor>p.y+.06){
       // Higher neighbouring decks are not vertical elevators or invisible
       // guardrails. If feet are already below their top, pass the side.
       this.fallStartY=p.y;this.grounded=false;this.velocityY=Math.min(0,this.velocityY);
      }else p.y=floor;
    }
  }
  update(dt){
    if(!this.enabled||this.awaitingSpawn||(!this.panBlastFlight&&performance.now()<(this.authorityHoldUntil||0))){this.updateCamera(dt);return this.state();}
    if(this.panBlastFlight){
      // Hit stun cannot cancel the launch: steer/jump return only after
      // one big parabola and precisely three successively lower bounces.
      this.advancePanBlast(dt);this.updateCamera(dt);return this.state();
    }
    if(this.tidePush){
     const push=this.tidePush,progress=Math.min(1,Math.max(0,(Date.now()-push.time)/push.durationMs)),delta=Math.max(0,progress-push.progress);
     if(delta>0){this.stepHorizontal(push.vector[0]*push.distance*delta,push.vector[2]*push.distance*delta);push.progress=progress;}
     if(progress>=1)this.tidePush=null;
    }
    if(this.knockback&&this.knockbackRemaining>0){
     // Pan recoil follows the explosion radius unless a real obstacle
     // intervenes, independent of the frame rate.
     const speed=this.knockbackSpeed||Math.max(16,this.knockbackRemaining*2),step=Math.min(this.knockbackRemaining,speed*dt);
     const px=this.root.position.x,pz=this.root.position.z;
     this.stepHorizontal(this.knockback.x*step,this.knockback.z*step);
     const travelled=Math.hypot(this.root.position.x-px,this.root.position.z-pz);
     this.knockbackRemaining=Math.max(0,this.knockbackRemaining-travelled);
     if(travelled<.00001||this.knockbackRemaining<.0001){this.knockback=null;this.knockbackRemaining=0;this.knockbackSpeed=0;}
    }else if(this.knockback){
     this.stepHorizontal(this.knockback.x*dt,this.knockback.z*dt);
     this.knockback.multiplyScalar(Math.exp(-5*dt));
     if(this.knockback.lengthSq()<.001)this.knockback=null;
    }
    if(this.vortexSpin){
      const spin=this.vortexSpin,progress=(Date.now()-spin.time)/Math.max(1,spin.durationMs??VORTEX_SPIN_MS);
      if(progress>=1)this.vortexSpin=null;
      else{
       const point=vortexSpinPoint(spin,Date.now());
       if(point)this.stepHorizontal(point[0]-this.root.position.x,point[2]-this.root.position.z);
       this.root.rotation.y=spin.startYaw+Math.PI*4*Math.max(0,progress);
       this.speed=0;this.animation='walk';this.updateCamera(dt);return this.state();
      }
    }
    if(this.status.freeze&&this.role==='fighter'){this.speed=0;this.animation='idle';this.updateCamera(dt);return this.state();}
    if(this.role==='fighter'&&performance.now()<(this.stunUntil||0)){this.animation='idle';this.updateCamera(dt);return this.state();}
    const has=(a,b)=>this.keys.has(a)||this.keys.has(b);
    let x=Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft'))+this.move.x;
    let z=Number(has('KeyS','ArrowDown'))-Number(has('KeyW','ArrowUp'))+this.move.y;
    if(this.status.confuse&&this.role==='fighter'){const t=performance.now()*.0075;x=Math.cos(t*1.7+this.seat*1.31);z=Math.sin(t*1.3+this.seat*2.09);}
    if(this.status.root&&this.role==='fighter'){x=0;z=0;this.speed=0;}
    const moving=Math.hypot(x,z)>.1;
    this.direction.set(x*Math.cos(this.yaw)+z*Math.sin(this.yaw),0,-x*Math.sin(this.yaw)+z*Math.cos(this.yaw)).normalize();
    if(this.role==='spectator'){
      const rise=Number(this.keys.has('KeyE')||this.keys.has('Space'));
      const sink=Number(this.keys.has('KeyQ')||this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'));
      const lift=(this.spectatorLift||0)+rise-sink;
      if(moving||Math.abs(lift)>.1)this.followTarget=null;
      this.root.position.addScaledVector(this.direction,10*dt);
      this.root.position.y=THREE.MathUtils.clamp(this.root.position.y+THREE.MathUtils.clamp(lift,-1,1)*10*dt,1.5,72);
      const r=Math.hypot(this.root.position.x,this.root.position.z);
      if(r>ARENA_RADIUS+20){this.root.position.x*=(ARENA_RADIUS+20)/r;this.root.position.z*=(ARENA_RADIUS+20)/r;}
      this.updateCamera(dt);return this.state();
    }
    // Destroyed rooftops can lose height while the player is standing still.
    // Recheck support every tick, not only after horizontal input: otherwise
    // clients repeatedly fall into the old house collider and spring upward
    // when the next authoritative pose arrives.
    if(this.grounded){
      const feet=this.root.position;
      const support=this.arena.groundHeight(feet.x,feet.z,feet.y);
      if(feet.y>support+.25){
        this.fallStartY=feet.y;
        this.grounded=false;this.velocityY=0;this.walkOffMomentum=false;
      }
    }
    if(this.grounded){const factor=this.castMoveFactor===.05 ? .05 : 1;
     this.speed=Math.min(this.speed,8.64*this.stats.speed*factor);
     this.speed=moving?Math.min(8.64*this.stats.speed*factor,this.speed+6*this.stats.speed*factor*dt):Math.max(0,this.speed-12*dt);if(moving){this.stepHorizontal(this.direction.x*this.speed*dt,this.direction.z*this.speed*dt);this.root.rotation.y=Math.atan2(this.direction.x,this.direction.z);}}
    else{const previousY=this.root.position.y;this.velocityY-=25*this.stats.gravity*dt;this.root.position.y+=this.velocityY*dt;if(this.root.position.y>64){this.root.position.y=64;this.velocityY=0;}const airSpeed=(this.stats.impulse?8.64*this.stats.speed*.8:this.speed*.3)*(this.castMoveFactor===.05 ? .05 : 1);if(this.stats.impulse){this.jumpVelocity.multiplyScalar(Math.exp(-6*dt));if(moving)this.root.rotation.y=Math.atan2(this.direction.x,this.direction.z);}
     else if(this.walkOffMomentum)this.jumpVelocity.multiplyScalar(Math.exp(-2*dt));
     this.stepHorizontal((this.jumpVelocity.x+this.direction.x*airSpeed)*dt,(this.jumpVelocity.z+this.direction.z*airSpeed)*dt);const floor=this.arena.groundHeight(this.root.position.x,this.root.position.z,Math.max(previousY,this.root.position.y));if(this.velocityY<=0&&previousY>=floor-.05&&this.root.position.y<=floor){
      // Only land when falling THROUGH the top from above. A disc side
      // must never snap a descending actor back onto the deck.
      this.root.position.y=floor;this.velocityY=0;this.grounded=true;
      this.walkOffMomentum=false;this.jumpVelocity.set(0,0,0);
     }}
    // Apply suction after ordinary steering so outward input can resist it.
    this.advanceWhipPull(dt);
    this.animation=!this.grounded?(this.velocityY<0&&this.fallStartY>=40&&!this.stats.impulse?'fall':'jump'):moving?'walk':'idle';this.updateCamera(dt);return this.state();
  }
  // GM middle-mouse orbit works even when movement and regular camera drag
  // are disabled by TransformControls / artwork or platform edit modes.
  orbitEditCamera(deltaX,deltaY){
   if(!Number.isFinite(deltaX)||!Number.isFinite(deltaY))return;
   this.yaw-=deltaX/innerWidth*4;
   this.pitch=THREE.MathUtils.clamp(this.pitch+deltaY/innerHeight*2,-1.15,1.4);
   this.updateCamera(1,true);
  }
  frameWantedArtwork(bounds,heading){
    // Behind the player, facing the exhibit. Frame both complete bounding boxes.
    const player=new THREE.Box3().setFromObject(this.root);if(player.isEmpty())player.setFromCenterAndSize(this.root.position.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(2,3,2));
    const combined=bounds.clone().union(player),center=combined.getCenter(new THREE.Vector3()),radius=combined.getBoundingSphere(new THREE.Sphere()).radius;
    const halfVertical=THREE.MathUtils.degToRad(this.camera.fov||50)/2,halfHorizontal=Math.atan(Math.tan(halfVertical)*Math.max(.15,this.camera.aspect||1)),half=Math.min(halfVertical,halfHorizontal);
    const distance=Math.max(7,radius/Math.sin(half)*1.18),back=new THREE.Vector3(-Math.sin(heading),0,-Math.cos(heading));
    const offset=Math.max(distance,center.clone().sub(this.root.position).dot(back)+5);const position=center.clone().addScaledVector(back,offset);position.y+=Math.max(2,Math.min(10,radius*.25));
    this.distance=THREE.MathUtils.clamp(position.distanceTo(this.root.position),3,50);this.pitch=.15;this.wantedArtworkView={position,center};
  }
  updateCamera(dt,force=false){
    if(this.wantedArtworkView){if(!this.enabled){this.camera.position.copy(this.wantedArtworkView.position);this.camera.lookAt(this.wantedArtworkView.center);return;}this.wantedArtworkView=null;}
    if(this.cameraLocked&&!force)return;
    if(this.role==='spectator'&&!this.followTarget){
      // One invisible free camera for public spectators and GM test.
      this.camera.position.copy(this.root.position).add(new THREE.Vector3(0,1.5,0));
      const direction=new THREE.Vector3(
       -Math.sin(this.yaw)*Math.cos(this.pitch),-Math.sin(this.pitch),
       -Math.cos(this.yaw)*Math.cos(this.pitch));
      this.camera.lookAt(this.camera.position.clone().add(direction));
      this.target.copy(this.root.position);
      return;
    }
    const focus=this.artworkEditTarget?.position|| (this.followTarget?.visible?this.followTarget.position:this.root.position);
   this.target.lerp(new THREE.Vector3(focus.x,focus.y+(this.artworkEditTarget?0:1.5),focus.z),Math.min(1,dt*4));
   // Pull back the third-person view for the lightning/prism pair only.
   // Separate the player silhouette from the original vendor's long beam.
   const id=this.root.userData.weaponId||'';
   const longBeam=id.startsWith('storm-')||id.startsWith('prism-');
   const distance=this.distance+(longBeam?2.6:0);
   this.camera.position.set(
    this.target.x+distance*Math.cos(this.pitch)*Math.sin(this.yaw),
    this.target.y+distance*Math.sin(this.pitch),
    this.target.z+distance*Math.cos(this.pitch)*Math.cos(this.yaw)
   );
   if(this.pitch<0){
    this.camera.position.y=Math.max(this.camera.position.y,focus.y+.6);
    this.camera.lookAt(this.target.x-Math.sin(this.yaw)*20,this.camera.position.y+Math.tan(-this.pitch)*20,this.target.z-Math.cos(this.yaw)*20);
   }else this.camera.lookAt(this.target);
  }
  aimDirection(){const elevation=THREE.MathUtils.clamp(-this.pitch,-.7,.8),h=this.root.rotation.y;return [Math.sin(h)*Math.cos(elevation),Math.sin(elevation),Math.cos(h)*Math.cos(elevation)];}
  buildPosition(distance=5){const h=this.root.rotation.y,x=this.root.position.x+Math.sin(h)*distance,z=this.root.position.z+Math.cos(h)*distance;return [x,this.arena.groundHeight(x,z),z];}
  state(){return {position:this.root.position.toArray(),rotation:this.root.rotation.y,animation:this.animation,visible:true};}
}
