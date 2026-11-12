import * as THREE from 'three';
import {itemById} from './shared/catalog.js';
import {makePlant} from './reletter/plants.js';
import {makeHeldWeapon,attachHeldWeapon,setHeldTime} from './reletter/held-weapons.js';
import {attachHeadgear,disposeHeadgear} from './reletter/headgear-model.js';
import {attachOutfit,disposeOutfit} from './reletter/outfit-model.js';
import {attachWings,disposeGardenModel} from './reletter/garden-art.js';
import {sampleMeleePose,meleeDuration,meleeFamilies} from './reletter/melee-motion.js';
import {createWeaponSignature,updateWeaponSignature,disposeWeaponSignature} from './reletter/weapon-effects.js';
import {updateUltimate} from './reletter/ultimate-effects.js';
import {acquireUltimate,recycleUltimate} from './ultimate-pool.js';
import {createOriginalCombatVisuals} from './reletter/combat-visuals.js';
import {createTokenGuardian} from './reletter/token-model.js';
import {animateOddWeapon} from './reletter/odd-weapon-art.js';
import {oddWeapon} from './reletter/odd-weapons.js';
import {createOddEffect,updateOddEffect} from './reletter/odd-weapon-effects.js';
import {createFusionEcho,updateFusionEcho,disposeFusionEcho} from './reletter/fusion-effects.js';

export function buildReletterEnvironment(scene,renderer){
  renderer.toneMappingExposure=1.3;
  const sky=document.createElement('canvas');sky.width=2;sky.height=512;const c=sky.getContext('2d'),g=c.createLinearGradient(0,0,0,512);
  ['#ff2aa1','#ff4bb8','#ff79d0','#ff9fe2','#ffd1f2'].forEach((color,i)=>g.addColorStop(i/4,color));c.fillStyle=g;c.fillRect(0,0,2,512);scene.background=new THREE.CanvasTexture(sky);
  const env=document.createElement('canvas');env.width=256;env.height=128;const ec=env.getContext('2d'),eg=ec.createLinearGradient(0,0,256,0);['#ffd1f2','#b5e2fa','#bde0fe','#cdb4db','#ffb7b2','#fff1c1'].forEach((color,i)=>eg.addColorStop(i/5,color));ec.fillStyle=eg;ec.fillRect(0,0,256,128);ec.globalAlpha=.35;ec.fillStyle='#fff';ec.fillRect(0,0,256,128*.45);const tex=new THREE.CanvasTexture(env);tex.mapping=THREE.EquirectangularReflectionMapping;scene.environment=tex;
  scene.fog=new THREE.FogExp2('#f5c6d8',.0008);scene.add(new THREE.HemisphereLight('#87CEEB','#5a9e6a',.65));const sun=new THREE.DirectionalLight('#fff5e6',.7);sun.position.set(8,18,5);scene.add(sun,new THREE.AmbientLight('#fff',.35));
  const ground=new THREE.Mesh(new THREE.CircleGeometry(500,80),new THREE.MeshStandardMaterial({color:'#5a9e6a',emissive:'#1a5a2a',emissiveIntensity:.18,roughness:.92,envMapIntensity:0}));ground.rotation.x=-Math.PI/2;ground.position.y=-.1;ground.name='RELETTER meadow';scene.add(ground);
  const p=[],colors=[];let seed=12847;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<9000;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*65,shade=.35+rand()*.3;p.push(Math.cos(a)*r,rand()*.25,Math.sin(a)*r);colors.push(shade*.45,shade*1.05,shade*.35);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));scene.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.07,vertexColors:true,transparent:true,opacity:.45,depthWrite:false})));
  const center=makePlant('TEMPLE RELETTER',{clipBelow:false});center.name='RELETTER message tree';center.scale.multiplyScalar(1.2);scene.add(center);
  return reletterPlatformMaterial();
}
export function reletterPlatformMaterial(){return new THREE.MeshPhysicalMaterial({color:'#E84887',roughness:.2,metalness:.1,clearcoat:1,clearcoatRoughness:.15,iridescence:1,iridescenceIOR:1.3,iridescenceThicknessRange:[100,800],specularIntensity:.9,specularColor:new THREE.Color('#FFB0D0'),sheen:.6,sheenColor:new THREE.Color('#FF6B9D'),envMapIntensity:1.4,emissive:'#E84887',emissiveIntensity:.08});}
export function disposeVisual(root){if(!root)return;const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}

export class ReletterPresentation{
  removeOdd(f){f.root.removeFromParent();if(!f.root.geometry.userData.sharedOdd)f.root.geometry.dispose();f.root.material.dispose();}
  removeGuardian(f){f.root.removeFromParent();f.root.traverse(o=>{if(o.geometry&&!o.geometry.userData.sharedGuardian)o.geometry.dispose();o.material?.dispose();});}
  constructor(scene){this.scene=scene;this.players=new Set();this.bursts=[];this.ultimates=[];this.restore=[];this.seen=new Set();this.charge=null;this.odd=[];this.guardians=[];this.echoes=[];this.original=createOriginalCombatVisuals(scene,data=>this.signature(data));}
  equipment(root,equipment={}){
    const d=root.userData;this.players.add(root);d.equipment=equipment;
    const weapon=itemById(equipment.weapon),signature=JSON.stringify(equipment);if(d.equipmentSignature===signature)return;d.equipmentSignature=signature;
    if(d.blade)disposeVisual(d.blade);d.blade=null;if(weapon&&(weapon.exotic||weapon.id==='chiang-token'||meleeFamilies.includes(weapon.family))){d.blade=makeHeldWeapon(weapon);root.add(d.blade);}d.weaponId=weapon?.id;
    if(d.headgear)disposeHeadgear(d.headgear);d.headgear=equipment.head?attachHeadgear(THREE,d.model,itemById(equipment.head)):null;
    if(d.outfit)disposeOutfit(d.outfit);d.outfit=equipment.outfit?attachOutfit(THREE,d.model,itemById(equipment.outfit),{hood:!equipment.head}):null;
    if(d.wings)disposeGardenModel(d.wings);d.wings=equipment.wings?attachWings(THREE,d.model,itemById(equipment.wings)):null;
    if(d.shield)disposeVisual(d.shield);d.shield=null;const shield=itemById(equipment.shield);if(shield){const mat=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(shield.color)},pulse:{value:1}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 tint;uniform float pulse;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.5);gl_FragColor=vec4(tint,(.04+rim*.55)*pulse);}',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});d.shield=new THREE.Mesh(new THREE.SphereGeometry(1.35,32,20),mat);d.shield.position.y=1;root.add(d.shield);}
    d.bones=new Map();d.model.traverse(o=>{if(o.isBone)d.bones.set(o.name.replace(/[^a-z0-9]/gi,'').replace(/^mixamorig\d*/,''),o);});
  }
  beforeAnimation(){for(const [object,property,value] of this.restore)object[property].copy(value);this.restore.length=0;}
  play(event,root){if(!event||this.seen.has(event.id))return;this.seen.add(event.id);if(this.seen.size>100)this.seen.delete(this.seen.values().next().value);const item=itemById(event.weapon);if(!item)return;const data={...item,...event,charge:event.charge||0};if(root&&meleeFamilies.includes(item.family))root.userData.attack={age:0,duration:meleeDuration(item.family,event.combo||0),combo:event.combo||0,data};
    const echo=createFusionEcho(THREE,data);if(echo){this.scene.add(echo.root);this.echoes.push(echo);while(this.echoes.length>6)disposeFusionEcho(this.echoes.shift());}
    const odd=oddWeapon(item.id)||(item.family==='swatter'&&event.ultimate?{...item,pattern:'fly'}:null);
    if(odd){const fx=createOddEffect(THREE,data,odd);this.scene.add(fx.root);this.odd.push(fx);while(this.odd.length>6||this.odd.filter(f=>f.charged).length>2)this.removeOdd(this.odd.shift());}
    else if(item.id==='chiang-token'&&event.ultimate){for(let i=0;i<3;i++){const o=createTokenGuardian(THREE);o.position.fromArray(event.origin);o.position.x+=(i-1)*3;o.position.y-=1;o.rotation.y=Math.atan2(event.direction[0],event.direction[2]);this.scene.add(o);this.guardians.push({root:o,age:0,direction:new THREE.Vector3(...event.direction)});}while(this.guardians.length>6)this.removeGuardian(this.guardians.shift());}
    else if(event.ultimate){const fx=acquireUltimate(item,data);this.scene.add(fx.root);this.ultimates.push(fx);while(this.ultimates.length>3)recycleUltimate(this.ultimates.shift());}
    else{this.original.show(data);if(!meleeFamilies.includes(item.family))this.signature(data);}
  }
  signature(data){const item=itemById(data.weapon);if(!item)return;const fx=createWeaponSignature(THREE,item,'burst');fx.root.position.fromArray(data.origin);fx.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...data.direction).normalize());fx.root.position.addScaledVector(new THREE.Vector3(...data.direction),Math.min(data.range*.3,3));fx.duration=data.charge>=.65?1.05:.55;fx.power=data.charge>=.65?1.5:.8;fx.age=0;this.scene.add(fx.root);this.bursts.push(fx);while(this.bursts.length>6)disposeWeaponSignature(this.bursts.shift());}
  charging(root,progress){const item=itemById(root?.userData.weaponId);if(this.charge&&(!item||progress<=0||this.charge.weapon!==item.id)){disposeWeaponSignature(this.charge);this.charge=null;}if(!item||progress<=.06)return;if(!this.charge){this.charge=createWeaponSignature(THREE,item);this.charge.weapon=item.id;this.scene.add(this.charge.root);}this.charge.root.position.copy(root.position);this.charge.root.position.y+=1.1;this.charge.root.rotation.y=root.rotation.y;updateWeaponSignature(THREE,this.charge,performance.now()/1000,progress);}
  update(dt,time){
    setHeldTime(time);for(const root of this.players){if(!root.parent){this.players.delete(root);continue;}const d=root.userData,fx=d.attack;if(d.deadUntil>Date.now()){d.deathLean=Math.min(Math.PI/2,(d.deathLean||0)+dt*4);this.restore.push([d.model,'quaternion',d.model.quaternion.clone()]);d.model.rotateZ(d.deathLean);}else d.deathLean=0;if(fx){fx.age+=dt;if(fx.age<fx.duration){const pose=sampleMeleePose(fx.data.family,fx.combo,fx.age);this.restore.push([d.model,'position',d.model.position.clone()],[d.model,'quaternion',d.model.quaternion.clone()]);d.model.position.add(new THREE.Vector3(...pose.offset));d.model.rotateY(pose.turn);d.model.rotateX(pose.bones.Spine2[0]*.35);d.model.rotateZ(pose.bones.Spine2[2]*.3);for(const [name,angles] of Object.entries(pose.bones)){const bone=d.bones?.get(name);if(bone){this.restore.push([bone,'quaternion',bone.quaternion.clone()]);bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)));}}}else d.attack=null;}
      if(d.blade){attachHeldWeapon({model:d.model,character:root.uuid},root,d.blade,d.attack);if(d.blade.userData.exotic)animateOddWeapon(d.blade,time,d.attack?Math.sin(d.attack.age/d.attack.duration*Math.PI):0);}if(d.shield)d.shield.material.uniforms.pulse.value=.8+Math.sin(time*2)*.2;if(d.wings)for(let i=0;i<d.wings.children.length;i++)d.wings.children[i].rotation.y=Math.sin(time*(d.current==='jump'||d.current==='fall'?11:2))* .24*(i?-1:1);
    }
    for(let i=this.odd.length-1;i>=0;i--)if(!updateOddEffect(this.odd[i],dt)){this.removeOdd(this.odd[i]);this.odd.splice(i,1);}
    for(let i=this.guardians.length-1;i>=0;i--){const f=this.guardians[i];f.age+=dt;f.root.position.addScaledVector(f.direction,dt*9);f.root.material.uniforms.time.value=time;f.root.material.uniforms.fade.value=Math.min(1,f.age/.3,(2-f.age)/.5);if(f.age>=2){this.removeGuardian(f);this.guardians.splice(i,1);}}
    for(let i=this.echoes.length-1;i>=0;i--)if(updateFusionEcho(THREE,this.echoes[i],dt)){disposeFusionEcho(this.echoes[i]);this.echoes.splice(i,1);}
    this.original.update(dt);for(let i=this.bursts.length-1;i>=0;i--){const f=this.bursts[i];f.age+=dt;if(f.age>=f.duration){disposeWeaponSignature(f);this.bursts.splice(i,1);}else{updateWeaponSignature(THREE,f,f.age,f.age/f.duration);f.root.scale.multiplyScalar(f.power);}}
    for(let i=this.ultimates.length-1;i>=0;i--){const f=this.ultimates[i];updateUltimate(THREE,f,dt);if(f.age>=f.duration){recycleUltimate(f);this.ultimates.splice(i,1);}}
  }
}
