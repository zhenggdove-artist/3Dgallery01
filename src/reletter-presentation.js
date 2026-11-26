import {animateFlightVehicle} from './reletter/flight-vehicle.js';
import * as THREE from 'three';
import {CITY_OUTER_RADIUS} from './shared/city-layout.js';
import {WeaponVFX} from './weapon-vfx.js';
import {createMoonlitSky} from './night-sky.js';
import {isSpellWeapon,makeSpellEquipment} from './spell-equipment.js';
import {itemById} from './shared/catalog.js';
import {makePlant} from './reletter/plants.js';
import {makeHeldWeapon,attachHeldWeapon,setHeldTime} from './reletter/held-weapons.js';
import {attachHeadgear,disposeHeadgear,animateHeadgear} from './reletter/headgear-model.js';
import {attachOutfit,disposeOutfit,animateOutfit} from './reletter/outfit-model.js';
import {attachWings,disposeGardenModel} from './reletter/garden-art.js';
import {animateEpicDust} from './reletter/epic-specimens.js';
import {sampleMeleePose,meleeDuration,meleeFamilies} from './reletter/melee-motion.js';
import {animateOddWeapon,faceOddWeapon} from './reletter/odd-weapon-art.js';
import {supportOffhand} from './reletter/offhand-pose.js';
import {oddWeapon} from './reletter/odd-weapons.js';
import {poseOverheadStaff,advanceStaffRaise} from './staff-raise-pose.js';

export function buildReletterEnvironment(scene,renderer){
  renderer.toneMappingExposure=1.3;
  scene.background=new THREE.Color('#020516'); // fallback behind the animated nebula dome
  const env=document.createElement('canvas');env.width=256;env.height=128;const ec=env.getContext('2d'),eg=ec.createLinearGradient(0,0,256,0);['#152f64','#385fa0','#749bd5','#ffe7a2','#a7b9d8','#2c578a'].forEach((color,i)=>eg.addColorStop(i/5,color));ec.fillStyle=eg;ec.fillRect(0,0,256,128);ec.globalAlpha=.35;ec.fillStyle='#fff';ec.fillRect(0,0,256,128*.45);const tex=new THREE.CanvasTexture(env);tex.mapping=THREE.EquirectangularReflectionMapping;scene.environment=tex;
  scene.fog=new THREE.FogExp2('#12284d',.0011);scene.add(new THREE.HemisphereLight('#86adff','#15304c',.72));const moonlight=new THREE.DirectionalLight('#ffe2a1',1.05);moonlight.position.set(-32,55,-48);scene.add(moonlight,new THREE.AmbientLight('#8fafff',.35));scene.userData.moonlitSky=createMoonlitSky(scene,renderer);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(CITY_OUTER_RADIUS+1,192),new THREE.MeshStandardMaterial({color:'#2e6658',emissive:'#0c302b',emissiveIntensity:.16,roughness:.92,envMapIntensity:0}));ground.rotation.x=-Math.PI/2;ground.position.y=-.1;ground.name='Grass footprint only — direct nebula edge';scene.add(ground);scene.userData.terrainGround=ground;
  const p=[],colors=[];let seed=12847;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<9000;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*65,shade=.35+rand()*.3;p.push(Math.cos(a)*r,rand()*.25,Math.sin(a)*r);colors.push(shade*.45,shade*1.05,shade*.35);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));scene.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.07,vertexColors:true,transparent:true,opacity:.45,depthWrite:false})));
  const center=makePlant('TEMPLE RELETTER',{clipBelow:false});center.name='RELETTER message tree';center.scale.multiplyScalar(1.2);scene.add(center);
  return reletterPlatformMaterial();
}
export function reletterPlatformMaterial(){return new THREE.MeshPhysicalMaterial({color:'#E84887',roughness:.2,metalness:.1,clearcoat:1,clearcoatRoughness:.15,iridescence:1,iridescenceIOR:1.3,iridescenceThicknessRange:[100,800],specularIntensity:.9,specularColor:new THREE.Color('#FFB0D0'),sheen:.6,sheenColor:new THREE.Color('#FF6B9D'),envMapIntensity:1.4,emissive:'#E84887',emissiveIntensity:.08});}
export function disposeVisual(root){if(!root)return;const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}

export class ReletterPresentation{
  removeOdd(f){f.root.removeFromParent();if(!f.root.geometry.userData.sharedOdd)f.root.geometry.dispose();f.root.material.dispose();}
  removeGuardian(f){f.root.removeFromParent();f.root.traverse(o=>{if(o.geometry&&!o.geometry.userData.sharedGuardian)o.geometry.dispose();o.material?.dispose();});}
  constructor(scene){this.scene=scene;this.players=new Set();this.bursts=[];this.ultimates=[];this.restore=[];this.seen=new Set();this.charge=null;this.odd=[];this.guardians=[];this.echoes=[];this.fusionEchoLast=new Map();this.vfx=new WeaponVFX(scene);}
  equipment(root,equipment={}){
    const d=root.userData;this.players.add(root);d.equipment=equipment;
    const wing=itemById(equipment.wings);
    const next=[equipment.weapon||null,equipment.head||null,equipment.outfit||null,
      equipment.wings||null,wing?.updatedAt||0,equipment.shield||null];
    const last=d.equipmentVisualSlots||[];
    if(next.every((value,i)=>value===last[i]))return;
    if(next[0]!==last[0]){
     const weapon=itemById(equipment.weapon);
     if(d.blade)disposeVisual(d.blade);d.blade=null;if(weapon&&(weapon.exotic||weapon.id==='chiang-token'||meleeFamilies.includes(weapon.family)||isSpellWeapon(weapon))){d.blade=isSpellWeapon(weapon)?makeSpellEquipment(weapon):makeHeldWeapon(weapon);d.blade.scale.multiplyScalar(.30);d.blade.userData.heldScale=.30;root.add(d.blade);}d.weaponId=weapon?.id;d.staffRaise=0;d.localSwing=null;
    }
    if(next[1]!==last[1]){
     if(d.headgear)disposeHeadgear(d.headgear);d.headgear=equipment.head?attachHeadgear(THREE,d.model,itemById(equipment.head)):null;
    }
    if(next[2]!==last[2]||(equipment.outfit&&Boolean(next[1])!==Boolean(last[1]))){
     if(d.outfit)disposeOutfit(d.outfit);d.outfit=equipment.outfit?attachOutfit(THREE,d.model,itemById(equipment.outfit),{hood:!equipment.head}):null;
    }
    if(next[3]!==last[3]||next[4]!==last[4]){
     if(d.wings)disposeGardenModel(d.wings);d.wings=wing?attachWings(THREE,d.model,wing):null;
    }
    if(next[5]!==last[5]){
     if(d.shield)disposeVisual(d.shield);d.shield=null;const shield=itemById(equipment.shield);if(shield){const mat=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(shield.color)},pulse:{value:1},hit:{value:0}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 tint;uniform float pulse;uniform float hit;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.5);vec3 blue=mix(tint,vec3(1.,.035,.075),hit);float alpha=clamp((.04+rim*.55)*pulse+hit*(.70+rim*.30),0.,.96);gl_FragColor=vec4(blue,alpha);}',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});d.shield=new THREE.Mesh(new THREE.SphereGeometry(1.35,32,20),mat);d.shield.position.y=1;
      // Alpha-blended, near-opaque scarlet hit shell. Unlike the original
      // additive tint, this remains conspicuously red against bright scenery.
      // Share the sphere geometry: one extra draw call while shields exist.
      const redFlash=new THREE.Mesh(d.shield.geometry,new THREE.MeshBasicMaterial({
       color:'#ff0030',transparent:true,opacity:0,depthWrite:false,
       blending:THREE.NormalBlending,side:THREE.DoubleSide,toneMapped:false
      }));
      redFlash.scale.setScalar(1.025);redFlash.renderOrder=2;
      d.shield.add(redFlash);d.shield.userData.redFlash=redFlash;
      root.add(d.shield);}
    }
    if(!d.bones){d.bones=new Map();d.model.traverse(o=>{if(o.isBone)d.bones.set(o.name.replace(/[^a-z0-9]/gi,'').replace(/^mixamorig\d*/,''),o);});}
    d.equipmentVisualSlots=next;d.equipmentSignature=JSON.stringify(next);
  }
  beforeAnimation(){for(let i=this.restore.length-1;i>=0;i--){const [object,property,value]=this.restore[i];object[property].copy(value);}this.restore.length=0;}
  previewNormal(root,item,inputId,data){
   if(!root||root.userData.weaponId!==item.id)return false;
   const d=root.userData,now=performance.now();
   if(now-(d.lastNormalPreviewAt??-Infinity)<Math.max(70,Number(item.cooldown)||0))return false;
   d.lastNormalPreviewAt=now;
   if(meleeFamilies.includes(item.family))this.previewMelee(root,item,inputId);
   this.normalPreviews??=new Map();
   try{this.vfx.play({...item,...data},item,root);}catch(error){console.warn('Local attack visual failed',error);return false;}
   this.normalPreviews.set(inputId,now);
   if(this.normalPreviews.size>128)this.normalPreviews.delete(this.normalPreviews.keys().next().value);
   return true;
  }
  previewMelee(root,item,inputId){
   if(!root||!meleeFamilies.includes(item.family)||root.userData.weaponId!==item.id)return false;
   const d=root.userData,now=performance.now();
   if(d.localSwing&&now-d.localSwing.at<Math.max(100,Number(item.cooldown)||0))return false;
   if(now-(d.lastSwingAt??-Infinity)<Math.max(100,Number(item.cooldown)||0))return false;
   const combo=now-(d.lastSwingAt??-Infinity)<1200?((d.lastSwingCombo||0)+1)%6:0;
   d.localSwing={inputId,at:now};
   d.attack={age:0,duration:meleeDuration(item.family,combo),combo,data:{...item,charge:0},inputId};
   return true;
  }
  cancelMeleePreview(root,inputId){this.normalPreviews?.delete(inputId);const d=root?.userData;if(d?.localSwing?.inputId!==inputId)return;d.localSwing=null;if(d.attack?.inputId===inputId)d.attack=null;}
  play(event,root){if(!event||this.seen.has(event.id))return;this.seen.add(event.id);if(this.seen.size>100)this.seen.delete(this.seen.values().next().value);const item=itemById(event.weapon);if(!item)return;const data={...item,...event,charge:event.charge||0};if(root&&isSpellWeapon(item))root.userData.staffCastingUntil=performance.now()+
     (event.channel?Math.max(1700,(item.cooldown||700)*3):230);if(root&&meleeFamilies.includes(item.family)){
      const d=root.userData,combo=event.combo||0,predicted=event.inputId&&d.localSwing?.inputId===event.inputId;
      d.lastSwingAt=predicted?d.localSwing.at:performance.now();d.lastSwingCombo=combo;
      if(predicted){d.localSwing=null;if(d.attack?.inputId===event.inputId){d.attack.combo=combo;d.attack.duration=meleeDuration(item.family,combo);d.attack.data=data;}}
      else d.attack={age:0,duration:meleeDuration(item.family,combo),combo,data};
    }
    const predictedNormal=event.inputId&&this.normalPreviews?.has(event.inputId);
    if(predictedNormal){this.normalPreviews.delete(event.inputId);this.vfx.confirmNormalImpact(data,item);}else this.vfx.play(data,item,root);
    // Each bonus uses its real source weapon's ultimate and matched server collider.
    for(const echo of (event.fusionEchoes||[]).slice(0,2)){
       const source=itemById(echo.weapon);if(!source)continue;
       // Persist channel-staff echoes using the keyed native emitter. For
       // non-channel source ultimates, never allocate new multi-pass effects
       // on every 300–1000ms damage pulse.
       if(event.channel&&!echo.channel){
         const key=event.owner+':'+(echo.fusionSlot||0)+':'+echo.weapon;
         // Keep every borrowed ultimate visually present while the main staff channels.
          // Pooled beams stay continuous; distinct one-shot weapon ultimates refresh
          // only as their earlier effect fades, avoiding per-pulse allocations.
          const now=performance.now(),lifetime=({swatter:6000,whip:2100,pan:4200,planter:1800,palm:1700})[source.family]||
           (source.firstPerson?900:source.exotic?1900:1400);
         if(now-(this.fusionEchoLast.get(key)??-Infinity)<lifetime)continue;
         this.fusionEchoLast.set(key,now);
         if(this.fusionEchoLast.size>96)this.fusionEchoLast.delete(this.fusionEchoLast.keys().next().value);
       }
       this.vfx.play({...source,...echo},source,root);
     }
  }
  signature(data){const item=itemById(data.weapon);if(item)this.vfx.play(data,item,null);}
  charging(root,progress){this.vfx.charging(root,progress,itemById(root?.userData.weaponId));}
  update(dt,time,camera,world=null){
    setHeldTime(time);for(const root of this.players){if(!root.parent){this.players.delete(root);continue;}const d=root.userData,fx=d.attack;animateHeadgear(d.headgear,time,d.current!=='idle');animateOutfit(d.outfit,time,root,dt);if(d.deadUntil>Date.now()){d.deathLean=Math.min(Math.PI/2,(d.deathLean||0)+dt*4);this.restore.push([d.model,'quaternion',d.model.quaternion.clone()]);d.model.rotateZ(d.deathLean);}else d.deathLean=0;if(fx){fx.age+=dt;if(fx.age<fx.duration){const pose=sampleMeleePose(fx.data.family,fx.combo,fx.age);this.restore.push([d.model,'position',d.model.position.clone()],[d.model,'quaternion',d.model.quaternion.clone()]);d.model.position.add(new THREE.Vector3(...pose.offset).applyAxisAngle(new THREE.Vector3(0,1,0),d.model.rotation.y));d.model.rotateY(pose.turn);d.model.rotateX(pose.bones.Spine2[0]*.35);d.model.rotateZ(pose.bones.Spine2[2]*.3);for(const [name,angles] of Object.entries(pose.bones)){const bone=d.bones?.get(name);if(bone){this.restore.push([bone,'quaternion',bone.quaternion.clone()]);bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)));}}}else d.attack=null;}
      if(d.blade){attachHeldWeapon({model:d.model,character:root.uuid},root,d.blade,d.attack);if(d.blade.userData.spell){
         const casting=!!(d.staffCasting||performance.now()<(d.staffCastingUntil||0));
         d.staffRaise=advanceStaffRaise(d.staffRaise||0,casting,dt);
         if(d.staffRaise>0)poseOverheadStaff(root,d.blade,d.bones,this.restore,d.staffRaise);
        }else d.staffRaise=0;if(d.blade.userData.exotic){if(camera)faceOddWeapon(THREE,d.blade,camera);animateOddWeapon(d.blade,time,d.attack?Math.sin(d.attack.age/d.attack.duration*Math.PI):0);}if(d.attack&&(['planter','palm'].includes(d.attack.data.family)||d.attack.combo===6&&d.attack.data.family==='saber')){for(const name of ['LeftForeArm','LeftArm']){const bone=d.bones?.get(name);if(bone)this.restore.push([bone,'quaternion',bone.quaternion.clone()]);}supportOffhand(d.model,d.blade.localToWorld(new THREE.Vector3(0,d.attack.data.family==='planter'?.25:.18,.02)),Math.sin(Math.min(1,d.attack.age/meleeDuration(d.attack.data.family,d.attack.combo))*Math.PI)*.8);}}if(d.shield){
       const remaining=(d.shieldFlashUntil||0)-performance.now();
       const flashing=remaining>0;
       const elapsed=1300-Math.max(0,remaining);
       const blink=.5+.5*Math.sin(elapsed*Math.PI*10/1000);
       d.shield.material.uniforms.hit.value=flashing?1:0;
       d.shield.material.uniforms.pulse.value=.8+Math.sin(time*2)*.2+(flashing?1.2:0);
       const red=d.shield.userData.redFlash;
       if(red){
        red.visible=flashing;
        red.material.opacity=flashing?.4+.59*blink:0;
       }
      }const flying=d.current==='jump'||d.current==='fall'||d.current==='fly';
      if(d.wings&&!animateFlightVehicle(d.wings,time,flying))for(let i=0;i<Math.min(2,d.wings.children.length);i++)d.wings.children[i].rotation.y=Math.sin(time*(flying?11:2))*.24*(i?-1:1);
      if(flying&&['pedal-helicopter','zeppelin'].includes(d.wings?.userData.flightVehicle)){for(const side of ['Left','Right'])for(const [part,angle] of [['UpLeg',-1.05],['Leg',1.30]]){const bone=d.bones?.get(side+part);if(!bone)continue;this.restore.push([bone,'quaternion',bone.quaternion.clone()]);const pedal=d.wings.userData.flightVehicle==='pedal-helicopter'?Math.sin(time*8+(side==='Left'?0:Math.PI))*.32:0;bone.rotateX(angle+pedal);}}
      if(d.wings)animateEpicDust(d.wings,time,time*(flying?11:2));
    }
    this.vfx.update(dt,camera,world);
  }
}
