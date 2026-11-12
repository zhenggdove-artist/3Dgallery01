// Extracted from RELETTER index.html. Host supplies time/fishing adapter only.
import * as THREE from 'three';
import {createToken} from './token-model.js';
import {createOddWeapon,animateOddWeapon} from './odd-weapon-art.js';
let globalTime=0;
const fstate=()=>({sessions:{}}),fishingPoseFor=()=>false;
function glowMaterial(color,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});}
export function setHeldTime(time){globalTime=time;}
const boneCache=new WeakMap(),handPosition=new THREE.Vector3(),handRotation=new THREE.Quaternion(),auraRotation=new THREE.Quaternion();
function rightHand(model){if(!boneCache.has(model)){let hand;model.traverse(b=>{if(b.isBone&&b.name.replace(/[^a-z]/gi,'').endsWith('RightHand'))hand=b;});boneCache.set(model,hand);}return boneCache.get(model);}
function makeHeldWeapon(item){
 if(item.exotic)return createOddWeapon(THREE,item);
 if(item.id==='chiang-token')return createToken(THREE);
 if(['swatter','pan','planter','palm'].includes(item.family))return makeNovelWeapon(item);
 const tier=item.tier||1,length=1.6+(tier-1)*1.05,width=1+(tier-1)*.8;const group=new THREE.Group();group.userData.tier=tier;group.name='Hand-held '+item.family;group.userData.family=item.family;group.userData.reach=length+.35;
 const metal=new THREE.MeshStandardMaterial({color:'#bcb6c9',metalness:.88,roughness:.22}),gold=new THREE.MeshStandardMaterial({color:'#dabd7e',metalness:.85,roughness:.27}),grip=new THREE.MeshStandardMaterial({color:'#33253f',roughness:.7});
 const cylinder=(r,h,y,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),mat);m.position.y=y;group.add(m);return m;};
 cylinder(.055,.28,0,grip);for(let i=0;i<7;i++)cylinder(.06,.012,-.12+i*.04,metal);cylinder(.075,.055,-.17,gold);cylinder(.09,.07,.18,gold);
 const jewel=new THREE.Mesh(new THREE.OctahedronGeometry(.085),new THREE.MeshStandardMaterial({color:item.color,emissive:item.color,emissiveIntensity:.7,metalness:.5,roughness:.15}));jewel.position.y=-.23;group.add(jewel);
 if(item.family==='saber'){
  const guard=new THREE.Mesh(new THREE.TorusGeometry(.16,.024,8,32,Math.PI*1.55),gold);guard.position.y=.21;guard.rotation.z=.7;group.add(guard);
  // Faceted blade and engraved rails remain visible even against the bright sky.
  const bladeGeo=new THREE.CylinderGeometry(.012*width,.055*width,length,4);const blade=new THREE.Mesh(bladeGeo,new THREE.MeshStandardMaterial({color:'#f6eeff',emissive:item.color,emissiveIntensity:.85,metalness:.3,roughness:.12}));blade.position.y=.26+length/2;group.add(blade);
  for(const [r,opacity] of [[.065,.2],[.105,.07]]){const halo=new THREE.Mesh(new THREE.CylinderGeometry(.012*width,r*width,length+.05,12),glowMaterial(item.color,opacity));halo.position.y=.26+length/2;group.add(halo);}
  for(const sign of [-1,1]){const rail=new THREE.Mesh(new THREE.CylinderGeometry(.012,.024,.52,8),gold);rail.position.set(sign*.055,.49,0);rail.rotation.z=sign*.12;group.add(rail);}
  const runes=new THREE.Group();for(let i=0;i<6+tier*2;i++){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.023),glowMaterial(i%2?'#fff7dd':item.color,.8));gem.position.set(0,.48+i*(length-.3)/(6+tier*2),.055*width);gem.rotation.z=Math.PI/4;runes.add(gem);}group.add(runes);
 }else{
  const geo=new THREE.BufferGeometry(),positions=new Float32Array(49*8*3),indices=[];for(let n=0;n<48;n++)for(let j=0;j<8;j++){const a=n*8+j,b=n*8+(j+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const normals=new Float32Array(positions.length);for(let n=0;n<49;n++)for(let j=0;j<8;j++){normals[(n*8+j)*3]=Math.cos(j*Math.PI/4);normals[(n*8+j)*3+1]=Math.sin(j*Math.PI/4);}geo.setAttribute('normal',new THREE.BufferAttribute(normals,3));geo.setIndex(indices);
  const lash=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:item.color,emissive:item.color,emissiveIntensity:.65,metalness:.45,roughness:.28}));lash.frustumCulled=false;group.add(lash);group.userData.lash=lash;const braid=new THREE.BufferGeometry();braid.setAttribute('position',new THREE.BufferAttribute(new Float32Array(49*3),3));const braidLine=new THREE.Line(braid,new THREE.LineBasicMaterial({color:'#ffe3b4',transparent:true,opacity:.85}));braidLine.frustumCulled=false;group.add(braidLine);group.userData.braid=braidLine;
  const tip=new THREE.Mesh(new THREE.IcosahedronGeometry(.075,1),glowMaterial('#fff4d9',.9));group.add(tip);group.userData.tip=tip;
 }return group;
}
function attachHeldWeapon(player,aura,blade,fx){
 const activeCast=fstate().sessions?.[player.character];if(activeCast&&fishingPoseFor(player.character)){blade.visible=false;return;}const hand=rightHand(player.model);if(!hand){blade.visible=false;return;}blade.visible=true;
 player.model.updateMatrixWorld(true);aura.updateMatrixWorld(true);hand.getWorldPosition(handPosition);blade.position.copy(aura.worldToLocal(handPosition));hand.getWorldQuaternion(handRotation);aura.getWorldQuaternion(auraRotation);blade.quaternion.copy(auraRotation.invert().multiply(handRotation)).normalize();if(['swatter','pan'].includes(blade.userData.family))blade.rotateY(.55);
 // Stop large rigid weapons at the ground rather than burying their visible head.
 if(!blade.userData.lash){const worldQ=blade.getWorldQuaternion(new THREE.Quaternion()),up=new THREE.Vector3(0,1,0).applyQuaternion(worldQ),gripY=hand.getWorldPosition(new THREE.Vector3()).y,minY=THREE.MathUtils.clamp((.2-gripY)/(blade.userData.reach||2),-.95,.95);if(up.y<minY){const desired=up.clone();desired.y=0;if(desired.lengthSq()<.001)desired.set(0,0,1);desired.normalize().multiplyScalar(Math.sqrt(1-minY*minY));desired.y=minY;const correction=new THREE.Quaternion().setFromUnitVectors(up,desired),parent=aura.getWorldQuaternion(new THREE.Quaternion()).invert();blade.quaternion.copy(parent.multiply(correction).multiply(worldQ));}}
 // Grip origin remains at the hand in idle, running and all attack poses.
 if(blade.userData.lash){const attr=blade.userData.lash.geometry.attributes.position,age=fx?.age||0,energy=fx?Math.sin(Math.min(1,age/fx.duration)*Math.PI):0,combo=fx?.combo||0;let tip;
  for(let n=0;n<=48;n++){const t=n/48,length=1.3+energy*(3.4+(blade.userData.tier-1)*1.5),a=t*Math.PI*(2+(combo%3))+globalTime*3,x=Math.sin(a-age*10)*t*(.2+energy*.8),y=.23+t*(.7+energy*2.4)-(1-energy)*t*t*1.8,z=t*length*energy+Math.cos(a)*t*.18;for(let j=0;j<8;j++){const q=j*Math.PI/4,r=.03*(1-t)+.006;attr.setXYZ(n*8+j,x+Math.cos(q)*r,y+Math.sin(q)*r,z);}const braid=blade.userData.braid.geometry.attributes.position,twist=t*55;braid.setXYZ(n,x+Math.cos(twist)*.035,y+Math.sin(twist)*.035,z);tip=[x,y,z];}blade.userData.braid.geometry.attributes.position.needsUpdate=true;attr.needsUpdate=true;blade.userData.tip.position.fromArray(tip);
 }
}


function makeNovelWeapon(item){
 const g=new THREE.Group(),tier=item.tier||1,scale=1+(tier-1)*.17;
 g.name='Hand-held '+item.family;g.userData.family=item.family;
 const steel=new THREE.MeshStandardMaterial({color:'#aab9bf',metalness:.85,roughness:.27});
 const enamel=new THREE.MeshStandardMaterial({color:item.color,metalness:.35,roughness:.28});
 const gold=new THREE.MeshStandardMaterial({color:'#e3bc78',metalness:.75,roughness:.3});
 const wood=new THREE.MeshStandardMaterial({color:'#76513f',roughness:.8});
 const leafMat=new THREE.MeshStandardMaterial({color:'#4d9b64',roughness:.6,side:THREE.DoubleSide});
 function mesh(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;}
 function bar(x,y,z,w,h,d,mat){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
 const shaft=(height,radius=.045,mat=wood)=>mesh(new THREE.CylinderGeometry(radius,radius,height,12),mat,0,height/2-.1,0);
 const leaf=(x,y,z,a,length,width)=>{
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(width,length*.4,0,length);shape.quadraticCurveTo(-width,length*.4,0,0);
  const m=mesh(new THREE.ShapeGeometry(shape,12),leafMat,x,y,z);m.rotation.set(.4,a,-.6);return m;
 };
 if(item.family==='swatter'){
  shaft(1.05,.035,enamel);const y=1.25,w=.65*scale,h=.75*scale;
  for(const side of [-1,1]){bar(side*w/2,y,0,.035,h,.045,enamel);bar(0,y+side*h/2,0,w,.035,.045,enamel);}
  for(let i=1;i<9;i++){bar(-w/2+w*i/9,y,0,.012,h,.015,steel);bar(0,y-h/2+h*i/9,0,w,.012,.015,steel);}
  for(let i=0;i<tier;i++)mesh(new THREE.OctahedronGeometry(.035),gold,0,.25+i*.11,0);
 }else if(item.family==='pan'){
  shaft(.85,.055,wood);const pan=mesh(new THREE.CylinderGeometry(.48*scale,.44*scale,.11,48),new THREE.MeshStandardMaterial({color:'#29323d',metalness:.9,roughness:.3}),0,1.12,0);pan.rotation.x=Math.PI/2;
  const rim=mesh(new THREE.TorusGeometry(.48*scale,.027,10,64),steel,0,1.12,.07);
  const base=mesh(new THREE.CylinderGeometry(.31*scale,.31*scale,.012,48),steel,0,1.12,-.062);base.rotation.x=Math.PI/2;
  for(let i=0;i<tier;i++){const ring=mesh(new THREE.TorusGeometry((.15+i*.045)*scale,.008,6,48),gold,0,1.12,-.075);ring.rotation.z=i*.3;}
 }else if(item.family==='planter'){
  mesh(new THREE.CylinderGeometry(.48*scale,.3*scale,.65*scale,32),new THREE.MeshStandardMaterial({color:'#c08266',roughness:.72}),0,.34*scale,0);
  const rim=mesh(new THREE.TorusGeometry(.48*scale,.05,10,40),enamel,0,.67*scale,0);rim.rotation.x=Math.PI/2;
  mesh(new THREE.CylinderGeometry(.43*scale,.43*scale,.045,32),new THREE.MeshStandardMaterial({color:'#302a28',roughness:1}),0,.64*scale,0);
  for(let i=0;i<8+tier*2;i++){const a=i*2.4,r=.18*scale;const m=leaf(Math.cos(a)*r,.67*scale,Math.sin(a)*r,a,.55*scale,.17*scale);m.rotation.z=Math.sin(a)*.65;}
  for(let i=0;i<tier+2;i++){const a=i*2.4;mesh(new THREE.IcosahedronGeometry(.09,1),enamel,Math.cos(a)*.28*scale,.95*scale+Math.sin(a)*.2,Math.sin(a)*.28*scale);}
 }else{
  const h=2.5*scale;shaft(h,.105,wood);
  for(let i=0;i<18;i++){const ring=mesh(new THREE.TorusGeometry(.108,.009,5,14),gold,0,i*h/18,0);ring.rotation.x=Math.PI/2;}
  for(let i=0;i<9+tier;i++){const a=i/(9+tier)*Math.PI*2;const shape=new THREE.Shape();shape.moveTo(0,0);for(let j=1;j<=14;j++){const t=j/14;shape.lineTo(t*1.3*scale,Math.sin(t*Math.PI)*.26*scale*(j%2?.7:1));}for(let j=14;j>=0;j--){const t=j/14;shape.lineTo(t*1.3*scale,-Math.sin(t*Math.PI)*.26*scale*(j%2?.7:1));}const frond=mesh(new THREE.ShapeGeometry(shape),leafMat,0,h-.12,0);frond.rotation.set(Math.PI/2+.25,a,0);}
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;mesh(new THREE.SphereGeometry(.17,12,10),wood,Math.cos(a)*.18,h-.15,Math.sin(a)*.18);}
 }
 g.userData.reach=new THREE.Box3().setFromObject(g).max.y+.2;return g;
}

export {makeHeldWeapon,makeNovelWeapon,attachHeldWeapon,rightHand};
