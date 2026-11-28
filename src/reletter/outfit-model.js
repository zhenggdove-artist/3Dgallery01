import {staticPaintTexture} from '../paint-texture-source.js';
import {acquireOutfitTexture,releaseOutfitTexture,disposeOutfitTexture,registerWearable,releaseWearable,wearableMaterial,disposeWearableParts} from '../shared-render-resources.js';
import {softPorkGeometry,buildStreetOutfit,animateStreetOutfit,streetMotionStep} from './street-outfits.js';
import {buildSoftGarbage,buildNewStreetProp,attachStreetMotion,animateExtraStreet,animateFaultyMutton,buildSoftCardboard,addSwayingPoleWires,buildTreeDisguise} from './street-outfit-motion.js';
import {createHeadgear,disposeHeadgear} from './headgear-model.js';
// Clothing uses the original skinned surface, preserving animation and exposed face/hands.
function fabric(T,item){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle=item.color;x.fillRect(0,0,512,512);
 // The Collector's suit uses a restrained pinstripe rather than the ordinary
 // playful outfit print. This texture is applied to the original skinned body.
 if(item.design==='leather'){
  x.strokeStyle='#544a51';x.lineWidth=2;for(let i=0;i<512;i+=32){x.beginPath();x.moveTo(i,0);x.lineTo(i+12,512);x.stroke();}const texture=staticPaintTexture(T,c);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;return texture;
 }
 if(item.design==='suit'){
  x.fillStyle='#c6c9dc';x.globalAlpha=.10;
  for(let px=15;px<512;px+=27)x.fillRect(px,0,1,512);
  x.globalAlpha=1;
  const texture=staticPaintTexture(T,c);
  texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.anisotropy=2;return texture;
 }
 // Creature suits use the same UV-weighted cloth shader as the original
 // fifty outfits. Individual patterns are woven on the character's skinned
 // surface instead of assembling a rigid mannequin from boxes.
 if(item.design==='creature'){
  const k=item.creature;
  const palette={
   elephant:['#d5dde1','#658398'],rooster:['#e9c077','#b13c47'],
   anteater:['#e6c2a2','#765c4d'],'guinea-pig':['#fff4db','#ab7863'],
   penguin:['#f3f0e7','#263247'],'polar-bear':['#fbfdfc','#a5bbc6'],
   jellyfish:['#e8f9ff','#6ba5d4'],'crab-claw':['#f8bf8b','#a43e36'],
   lion:['#f0d080','#9d633c'],'banana-bunch':['#ffeb8d','#a58332'],
   eggplant:['#c4a5d7','#4e346e']
  };
  const [light,dark]=palette[k]||['#ffffff','#3d3d3d'];
  x.strokeStyle=dark;x.fillStyle=light;x.lineWidth=2.5;
  x.globalAlpha=k==='polar-bear'?.18:.38;
  for(let y=12;y<512;y+=48){
   for(let xx=(Math.floor(y/48)%2)*24;xx<512;xx+=48){
    const t=(xx+y)%4;
    x.save();x.translate(xx,y);
    if(['elephant','polar-bear','lion','guinea-pig','anteater'].includes(k)){
     x.beginPath();x.ellipse(0,0,7+t,12,Math.sin(xx+y)*.5,0,Math.PI*2);x.stroke();
     if(k==='guinea-pig'||k==='anteater'){x.beginPath();x.arc(0,0,2,0,Math.PI*2);x.fill();}
    }else if(k==='penguin'){
     x.beginPath();x.moveTo(-7,-7);x.quadraticCurveTo(0,0,0,11);x.quadraticCurveTo(0,0,7,-7);x.stroke();
    }else if(k==='jellyfish'){
     x.beginPath();x.arc(0,0,11,Math.PI,0);x.stroke();for(const dx of [-6,0,6]){x.beginPath();x.moveTo(dx,0);x.quadraticCurveTo(dx+5,8,dx,13);x.stroke();}
    }else if(k==='rooster'){
     for(let j=0;j<3;j++){x.beginPath();x.moveTo(j*5-7,-12);x.quadraticCurveTo(j*4-5,0,j*5-7,13);x.stroke();}
    }else if(k==='crab-claw'){
     x.beginPath();x.arc(0,0,8,0,Math.PI);x.stroke();x.beginPath();x.moveTo(-7,2);x.lineTo(0,11);x.lineTo(7,2);x.stroke();
    }else if(k==='banana-bunch'){
     x.beginPath();x.moveTo(-8,-12);x.quadraticCurveTo(13,0,-6,12);x.quadraticCurveTo(9,-2,-8,-12);x.stroke();
    }else if(k==='eggplant'){
     x.beginPath();x.ellipse(0,2,9,14,0,0,Math.PI*2);x.stroke();x.beginPath();x.moveTo(-5,-9);x.lineTo(0,-15);x.lineTo(5,-9);x.stroke();
    }
    x.restore();
   }
  }
  x.globalAlpha=1;
  // Thin tonal threads preserve cloth shading and UV folds during movement.
  x.strokeStyle=light;x.globalAlpha=.08;x.lineWidth=1;
  for(let n=0;n<512;n+=5){x.beginPath();x.moveTo(n,0);x.lineTo(n,512);x.stroke();}
  x.globalAlpha=1;
  const texture=staticPaintTexture(T,c);texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=2;return texture;
 }
 x.strokeStyle='#f6eee2';x.fillStyle='#f3eadb';x.lineWidth=5;const p=item.pattern;
 if(p===0){for(let i=-512;i<1024;i+=48){x.beginPath();x.moveTo(i,0);x.lineTo(i+512,512);x.stroke();}}
 if(p===2){x.globalAlpha=.3;for(let i=0;i<512;i+=64){x.fillRect(i,0,22,512);x.fillRect(0,i,512,22);}x.globalAlpha=1;}
 for(let y=32;y<512;y+=96)for(let xx=32;xx<512;xx+=96){x.save();x.translate(xx+(y%192?20:0),y);x.fillStyle=(xx+y)%192?'#eee4d8':'#756b85';x.globalAlpha=.7;if(p===1||p===4){x.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,r=k%2?6:15;x.lineTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();x.fill();}else if(p===3){for(const [a,b,r]of [[0,0,12],[-9,-11,6],[9,-11,6]]){x.beginPath();x.arc(a,b,r,0,Math.PI*2);x.fill();}}else{x.beginPath();x.ellipse(0,0,11,7,-.4,0,Math.PI*2);x.fill();}x.restore();}
 // Fine woven threads remain subtle, with no additional draw calls.
 x.globalAlpha=.08;x.fillStyle='#ffffff';for(let i=0;i<512;i+=4){x.fillRect(i,0,1,512);x.fillRect(0,i,512,1);}const texture=staticPaintTexture(T,c);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=2;return texture;}
function acquireFabric(T,item){const key='fabric:'+JSON.stringify([item.color,item.design,item.creature,item.pattern]);return {key,texture:acquireOutfitTexture(key,()=>fabric(T,item))};}
function releaseFabric(record){if(!releaseOutfitTexture(record.fabricKey,record.texture))disposeOutfitTexture(record.texture);}
// Compute an anatomical frame in the model's own local coordinates. Its
// vertical axis follows head-to-feet, while shoulders determine facing.
export function disguiseFrame(T,model,bones,headHeight){
 const at=b=>model.worldToLocal(b.getWorldPosition(new T.Vector3()));
 const head=bones.get('Head'),hip=bones.get('Hips')||head,top=bones.get('HeadTop_End')||head;
 const hp=at(hip),hd=at(head),up=hd.clone().sub(hp);
 if(up.lengthSq()<1e-12)up.set(0,1,0);else up.normalize();
 const left=bones.get('LeftShoulder')||bones.get('LeftArm'),right=bones.get('RightShoulder')||bones.get('RightArm');
 const across=left&&right?at(left).sub(at(right)):new T.Vector3(1,0,0);
 across.addScaledVector(up,-across.dot(up));
 if(across.lengthSq()<1e-12){across.set(Math.abs(up.x)<.9?1:0,0,Math.abs(up.x)<.9?0:1);across.addScaledVector(up,-across.dot(up));}
 across.normalize();const forward=across.clone().cross(up).normalize(),rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(across,up,forward));
 const feet=['LeftFoot','RightFoot','LeftToeBase','RightToeBase'].map(n=>bones.get(n)).filter(Boolean).map(at);
 const worldScale=model.getWorldScale(new T.Vector3()),unit=headHeight/Math.max(.00001,Math.abs(worldScale.y));
 const low=feet.length?Math.min(...feet.map(p=>p.clone().sub(hp).dot(up)))-unit*.10:-unit*2.2;
 const high=at(top).sub(hp).dot(up)+unit*.18;
 return {base:hp.clone().addScaledVector(up,low),up,rotation,height:Math.max(unit*2,high-low),head:hd,unit};
}
// Coordinates are baked into each mesh's attribute in the canonical prop frame.
 // This makes the aperture independent of the avatar, portrait camera and
 // cloned mesh world transforms, and works for instanced decorative meshes.
 export function cutDisguiseOpening(T,root,x,y,rx,ry,frontZ){
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),p=new T.Vector3(),used=new Set();
  root.traverse(o=>{
   if(!o.isMesh)return;
   const position=o.geometry.attributes.position,values=new Float32Array(position.count*3);
   const transform=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld);
   for(let i=0;i<position.count;i++){
    p.fromBufferAttribute(position,i);
    if(!o.isInstancedMesh)p.applyMatrix4(transform);
    p.toArray(values,i*3);
   }
   o.geometry.setAttribute('disguisePosition',new T.BufferAttribute(values,3));
   for(const material of Array.isArray(o.material)?o.material:[o.material]){
    if(used.has(material))continue;used.add(material);
    const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader){
     prior.call(this,shader);
     shader.uniforms.disguiseOpening={value:new T.Vector4(x,y,Math.max(.001,rx),Math.max(.001,ry))};
     shader.uniforms.disguiseFront={value:frontZ-Math.max(rx,ry)*1.1};
     shader.vertexShader='attribute vec3 disguisePosition; varying vec3 vDisguisePosition;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
       vDisguisePosition=disguisePosition;
       #ifdef USE_INSTANCING
       vDisguisePosition=(instanceMatrix*vec4(disguisePosition,1.0)).xyz;
       #endif`);
     shader.fragmentShader='uniform vec4 disguiseOpening; uniform float disguiseFront; varying vec3 vDisguisePosition;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
       vec2 openingDelta=(vDisguisePosition.xy-disguiseOpening.xy)/disguiseOpening.zw;
       if(vDisguisePosition.z>disguiseFront && dot(openingDelta,openingDelta)<1.0) discard;`);
    };
    material.customProgramCacheKey=()=>priorKey+'-disguise-aperture-v030';
    material.needsUpdate=true;
   }
  });
 }

 // A padded mascot suit follows individual joints, unlike a rigid disguise.
 export function attachPlushBear(T,model,bones,height,record,mat){
  const frame=disguiseFrame(T,model,bones,height),u=frame.unit,head=bones.get('Head');
  const pos=name=>model.worldToLocal((bones.get(name)||head).getWorldPosition(new T.Vector3()));
  const front=new T.Vector3(0,0,1).applyQuaternion(frame.rotation),up=frame.up;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#c5c5c5';ctx.fillRect(0,0,256,256);
  let seed=2193;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<12500;i++){const x=rand()*256,y=rand()*256;ctx.strokeStyle=i%2?'#eeeeee':'#929292';ctx.lineWidth=.6+rand()*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+rand()*2-1,y-1,x+rand()*2-1,y-2-rand()*2);ctx.stroke();}
  const tex=staticPaintTexture(T,canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(2,2);record.extraTextures??=[];record.extraTextures.push(tex);
  const plush=(color,bump=.025)=>{const m=mat(color);m.roughness=1;m.metalness=0;m.map=tex;m.bumpMap=tex;m.bumpScale=bump;return m;};
  const fur=plush('#efb94c'),red=plush('#d32735',.012),edge=plush('#b77b2a'),hoodFur=plush('#efb94c'),hoodMuzzle=plush('#efc36c'),hoodInside=plush('#bd832d'),dark=mat('#251b16');
  const group=(boneName,p,q=frame.rotation)=>{const g=new T.Group();g.name='plush-bear:'+boneName;g.userData.outfit=record.id;model.add(g);g.position.copy(p);g.quaternion.copy(q);g.scale.setScalar(u);g.updateMatrixWorld(true);(bones.get(boneName)||head).attach(g);record.parts.push(g);return g;};
  const puff=(g,p,s,m=fur,seed=0)=>{const geo=new T.SphereGeometry(1,24,16),a=geo.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),v=1+.018*Math.sin(5*x+4*y+seed)*Math.cos(4*z-3*y);a.setXYZ(i,x*v,y*v,z*v);}a.needsUpdate=true;geo.computeVertexNormals();const mesh=new T.Mesh(geo,m);mesh.position.set(...p);mesh.scale.set(...s);g.add(mesh);return mesh;};
  const hips=pos('Hips'),chest=pos('Spine2'),neck=pos('Neck');
  const torsoLength=Math.max(1.25,neck.clone().sub(hips).dot(up)/u),body=group('Spine',hips.clone().lerp(neck,.43));
  puff(body,[0,-.16,.08],[.77,torsoLength*.60,.57],fur,1);
  const shirt=puff(body,[0,torsoLength*.19,.055],[.79,torsoLength*.42,.60],red,2);
  // A slightly raised curved hem reads as sewn cloth, not armour.
  const hem=new T.Mesh(new T.TorusGeometry(1,.035,8,36),red);hem.rotation.x=Math.PI/2;hem.scale.set(.73,.56,1);hem.position.set(0,-torsoLength*.12,.055);body.add(hem);
  const pelvis=group('Hips',hips.clone().addScaledVector(up,-.16*u));puff(pelvis,[0,0,0],[.77,.55,.60],fur,3);
  const tail=new T.Group();tail.position.set(0,-.12,-.49);pelvis.add(tail);puff(tail,[0,0,-.21],[.25,.23,.35],fur,4);
  record.plushMotion={tail,pos:new T.Vector3(),last:null,energy:0,angle:0};
  const axis=new T.Vector3(0,1,0),across=new T.Vector3(1,0,0).applyQuaternion(frame.rotation);
  const segment=(name,end,r,depth,m=fur,offset=0)=>{if(!bones.has(name)||!bones.has(end))return;const a=pos(name),b=pos(end),delta=b.clone().sub(a),len=delta.length()/u;if(len<.05)return;const local=delta.normalize().applyQuaternion(frame.rotation.clone().invert());const q=frame.rotation.clone().multiply(new T.Quaternion().setFromUnitVectors(axis,local));const g=group(name,a.clone().lerp(b,.5).addScaledVector(across,offset*u),q);puff(g,[0,0,0],[r,len*.61,depth],m,len);return {g,len};};
  for(const side of ['Left','Right']){
   const outward=side==='Left'?1:-1;const upper=segment(side+'Arm',side+'ForeArm',.30,.31,fur,outward*.14);
   if(upper)puff(upper.g,[0,-upper.len*.26,0],[.34,upper.len*.34,.35],red);
   segment(side+'ForeArm',side+'Hand',.27,.28,fur,outward*.28);
   if(bones.has(side+'Hand'))puff(group(side+'Hand',pos(side+'Hand').addScaledVector(across,outward*.31*u)),[0,-.15,.03],[.30,.42,.28],fur);
   segment(side+'UpLeg',side+'Leg',.43,.43);segment(side+'Leg',side+'Foot',.35,.37);
   if(bones.has(side+'Foot'))puff(group(side+'Foot',pos(side+'Foot')),[0,-.06,.26],[.43,.29,.65],fur);
  }
  const hood=group('Head',frame.head.clone().addScaledVector(up,.39*u).addScaledVector(front,-.08*u));
  const hoodGeo=new T.SphereGeometry(1,40,28),a=hoodGeo.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),soft=1+.025*Math.sin(x*8+y*4)*Math.cos(z*6);a.setXYZ(i,x*.76*soft,y*.81*soft,z*.61*soft+.10*Math.max(0,z)*(1-y*y));}
  a.needsUpdate=true;hoodGeo.computeVertexNormals();
  const hoodMesh=new T.Mesh(hoodGeo,hoodFur);hoodFur.side=T.DoubleSide;hood.add(hoodMesh);
  const rim=new T.Mesh(new T.TorusGeometry(1,.075,10,48),hoodMuzzle);rim.scale.set(.49,.56,.72);rim.position.set(0,-.09,.54);hood.add(rim);
  for(const side of [-1,1]){
   puff(hood,[side*.54,.69,-.02],[.25,.27,.20],hoodFur);
   puff(hood,[side*.54,.71,.13],[.15,.17,.06],hoodInside);
   puff(hood,[side*.30,.44,.52],[.053,.062,.03],dark);
   const brow=puff(hood,[side*.31,.60,.43],[.09,.025,.03],dark);brow.rotation.z=side*.18;
  }
  cutDisguiseOpening(T,hood,0,-.09,.49,.56,.64);
  return record;
 }
 export function animatePlushBear(record,time,root,dt){
  const d=record.plushMotion;if(!d||!root)return;
  dt=Math.max(.001,Math.min(.1,dt));root.getWorldPosition(d.pos);
  if(!d.last){d.last=d.pos.clone();return;}
  const dx=d.pos.x-d.last.x,dz=d.pos.z-d.last.z;d.last.copy(d.pos);
  const distance=Math.hypot(dx,dz),target=distance>3?0:Math.min(1,distance/dt/2);
  d.energy+=(target-d.energy)*(1-Math.exp(-dt*9));
  const desired=Math.sin(time*12)*.65*d.energy;
  d.angle+=(desired-d.angle)*(1-Math.exp(-dt*15));
  d.tail.rotation.y=d.angle;d.tail.rotation.x=Math.cos(time*12)*.14*d.energy;
 }

// Layered limestone: multi-frequency erosion and fracture bands on overlapping
// asymmetric slabs, baked into one mesh with vertex color and normals.
export function createRockDisguiseGeometry(T){
 const layers=[
  [0,.32,0,.76,.32,.62,-.16,1],[-.25,.57,.09,.59,.31,.56,.21,2],[.32,.66,-.09,.53,.40,.52,-.27,3],
  [-.08,.94,-.03,.77,.41,.60,-.25,4],[-.29,1.26,-.10,.58,.39,.57,.17,5],[.27,1.24,-.07,.46,.36,.49,-.35,6],
  [-.22,1.55,-.13,.43,.32,.44,.19,7],[.09,.79,.34,.55,.25,.30,-.31,8],[-.39,.23,.23,.43,.20,.36,.12,9],
  [.47,.40,.27,.31,.25,.30,-.28,10],[-.52,1.05,.12,.27,.26,.29,.22,11]
 ];
 const positions=[],normals=[],colors=[],indices=[],color=new T.Color(),q=new T.Quaternion(),axis=new T.Vector3(0,0,1),v=new T.Vector3(),n=new T.Vector3();
 const noise=(x,y,z,k)=>Math.sin(x*4.3+y*2.8+z*3.1+k)*.48+Math.cos(y*8.2-z*3.9+x*2.1+k*1.3)*.28+Math.sin(z*13.5+x*11.2-y*5.6+k*.7)*.15+Math.cos(x*26+y*19-z*22+k)*.09;
 for(const [cx,cy,cz,sx,sy,sz,tilt,seed] of layers){
  const geo=new T.SphereGeometry(1,72,48),a=geo.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),ang=Math.atan2(z,x),soft=k=>Math.sign(k)*Math.pow(Math.abs(k),.82),wave=y*12+x*3.5+z*2.1+seed*.8+noise(x,y,z,seed)*1.7,seam=Math.pow(.5+.5*Math.cos(wave),13),rough=noise(x,y,z,seed);
   const fine=noise(x*5.2,y*5.2,z*5.2,seed+19),chips=noise(x*2.7,y*2.7,z*2.7,seed+7),d=1+.21*rough+.09*chips+.035*fine-.105*seam+.045*Math.sin(ang*5+seed+y*2);
   a.setXYZ(i,soft(x)*sx*d,soft(y)*sy*(1+.14*rough+.06*chips)+.022*Math.sin(wave)+.008*fine,soft(z)*sz*d);
  }
  geo.computeVertexNormals();const no=geo.attributes.normal,offset=positions.length/3;q.setFromAxisAngle(axis,tilt);
  for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);const x=v.x/sx,y=v.y/sy,z=v.z/sz,grain=noise(x*2.5,y*2.5,z*2.5,seed),line=Math.pow(.5+.5*Math.cos(y*18+x*4+z*3+seed+grain),15);
   const tone=Math.max(.035,.105+.048*noise(x,y,z,seed)+.025*grain-.045*line+.014*noise(x*9,y*9,z*9,seed+21));
   color.setRGB(tone*.95,tone*.99,tone*1.05);colors.push(color.r,color.g,color.b);
   v.applyQuaternion(q);positions.push(v.x+cx,v.y+cy,v.z+cz);n.fromBufferAttribute(no,i).applyQuaternion(q);normals.push(n.x,n.y,n.z);
  }
  for(let i=0;i<geo.index.count;i++)indices.push(offset+geo.index.getX(i));geo.dispose();
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function attachRockDisguise(T,model,bones,height,record,mat){
 const frame=disguiseFrame(T,model,bones,height),g=new T.Group(),geometry=createRockDisguiseGeometry(T);
 const stone=mat('#ffffff');stone.vertexColors=true;stone.roughness=.97;stone.metalness=0;
 const rock=new T.Mesh(geometry,stone);g.add(rock);g.name='rock-disguise:layered-limestone';g.userData.outfit=record.id;
 const bounds=geometry.boundingBox,extent=bounds.getSize(new T.Vector3()),factor=frame.height*3/Math.max(.001,extent.y);
 g.scale.setScalar(factor);g.quaternion.copy(frame.rotation);
 const front=new T.Vector3(0,0,1).applyQuaternion(frame.rotation),headCenter=frame.head.clone().addScaledVector(frame.up,frame.unit*.42);
 const y=headCenter.clone().sub(frame.base).dot(frame.up)/factor+bounds.min.y;
 let frontZ=-Infinity;const a=geometry.attributes.position;for(let i=0;i<a.count;i++)if(Math.abs(a.getY(i)-y)<.13&&Math.abs(a.getX(i))<.18)frontZ=Math.max(frontZ,a.getZ(i));if(!Number.isFinite(frontZ))frontZ=bounds.max.z;
 g.position.copy(frame.base).addScaledVector(frame.up,-bounds.min.y*factor).addScaledVector(front,-frontZ*factor+frame.unit*.10);
 cutDisguiseOpening(T,g,0,y,frame.unit*.80/factor,frame.unit*.93/factor,frontZ);
 model.add(g);g.updateMatrixWorld(true);record.parts.push(g);return record;
}

function buildOutfit(T,model,item,{hood=true}={}){if(!item)return null;model.updateMatrixWorld(true);const bones=new Map();model.traverse(o=>{if(o.isBone)bones.set(o.name.replace(/^mixamorig/,''),o);});const head=bones.get('Head');if(!head)return null;const top=bones.get('HeadTop_End'),height=top?head.getWorldPosition(new T.Vector3()).distanceTo(top.getWorldPosition(new T.Vector3())):.28,forward=head.getWorldQuaternion(new T.Quaternion()),fabricRef=acquireFabric(T,item),texture=fabricRef.texture,record={id:item.id,parts:[],surfaces:[],texture,fabricKey:fabricRef.key};
 const meshes=[];model.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.skinIndex)meshes.push(o);});
 for(const mesh of meshes){const originalGeometry=mesh.geometry,originalMaterial=mesh.material,geometry=originalGeometry.clone(),si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight,mask=new Float32Array(si.count);for(let i=0;i<si.count;i++)for(let k=0;k<4;k++){const idx=si.array[i*si.itemSize+k],name=mesh.skeleton.bones[idx]?.name||'';if(/Hips|Spine|Arm|Leg|Foot|Toe/.test(name))mask[i]+=sw.array[i*sw.itemSize+k];}geometry.setAttribute('outfitMask',new T.BufferAttribute(mask,1));const mats=(Array.isArray(originalMaterial)?originalMaterial:[originalMaterial]).map(source=>{const m=source.clone(),before=source.onBeforeCompile,key=source.customProgramCacheKey();m.onBeforeCompile=function(shader){before.call(m,shader);shader.uniforms.outfitFabric={value:texture};shader.vertexShader='attribute float outfitMask;varying float vOutfitMask;varying vec2 vOutfitUV;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOutfitMask=outfitMask;vOutfitUV=uv*3.;');shader.fragmentShader='uniform sampler2D outfitFabric;varying float vOutfitMask;varying vec2 vOutfitUV;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 ${item.exposedHead||item.creature==='rock-disguise'?'if(vOutfitMask>.48) discard;':''}\n vec3 cloth=texture2D(outfitFabric,vOutfitUV).rgb;float shade=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.4,1.);diffuseColor.rgb=mix(diffuseColor.rgb,cloth*(.82+.18*shade),smoothstep(.35,.8,vOutfitMask));`);};m.customProgramCacheKey=()=>key+'-outfit-'+item.id;m.needsUpdate=true;return m;});mesh.geometry=geometry;mesh.material=Array.isArray(originalMaterial)?mats:mats[0];record.surfaces.push({mesh,originalGeometry,originalMaterial,geometry,mats});}
 const materials=[],mat=(color,metal=0)=>{return wearableMaterial(T,materials,color,.72,metal);},main=mat(item.color),cream=mat('#e8dfcf'),dark=mat('#514b62'),trim=mat('#c9b58b',.3),pink=mat('#c597a2');record.materials=materials;
 function anchor(name){const bone=bones.get(name)||head,g=new T.Group(),scale=bone.getWorldScale(new T.Vector3());g.name=item.id;g.userData.outfit=item.id;bone.add(g);g.quaternion.copy(bone.getWorldQuaternion(new T.Quaternion()).invert().multiply(forward));g.scale.set(height/scale.x,height/scale.y,height/scale.z);record.parts.push(g);return g;}
 const add=(g,geo,p,scale,m=main)=>{const o=new T.Mesh(geo,m);o.position.set(...p);o.scale.set(...scale);g.add(o);return o;},ball=(g,p,s,m=main)=>add(g,new T.SphereGeometry(1,16,12),p,s,m),box=(g,p,s,m=main)=>add(g,new T.BoxGeometry(1,1,1),p,s,m),cone=(g,p,r,h,m=main)=>add(g,new T.ConeGeometry(r,h,12),p,[1,1,1],m),tube=(g,pts,r,m=main)=>add(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),18,r,6,false),[0,0,0],[1,1,1],m);
 if(item.creature==='pooh-plush-disguise')return attachPlushBear(T,model,bones,height,record,mat);
 if(item.creature==='rock-disguise')return attachRockDisguise(T,model,bones,height,record,mat);
 if(item.creature==='tree-disguise'){
  const frame=disguiseFrame(T,model,bones,height),g=new T.Group();g.name='tree-disguise:old-growth';g.userData.outfit=item.id;
  const tree=buildTreeDisguise(T,g,record,mat);g.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(g,true),extent=bounds.getSize(new T.Vector3()),factor=frame.height*3/Math.max(.001,extent.y);
  const headCenter=frame.head.clone().addScaledVector(frame.up,frame.unit*.42),front=new T.Vector3(0,0,1).applyQuaternion(frame.rotation),y=headCenter.clone().sub(frame.base).dot(frame.up)/factor+bounds.min.y,frontZ=tree.trunkRadius(y);
  g.scale.setScalar(factor);g.quaternion.copy(frame.rotation);g.position.copy(frame.base).addScaledVector(frame.up,-bounds.min.y*factor).addScaledVector(front,-frontZ*factor+frame.unit*.10);
  g.remove(tree.crown);cutDisguiseOpening(T,g,0,y,frame.unit*.82/factor,frame.unit*.95/factor,frontZ);g.add(tree.crown);model.add(g);g.updateMatrixWorld(true);record.parts.push(g);attachStreetMotion(T,g,'tree-disguise',record,mat);return record;
 }
 const chest=anchor('Spine2'),hips=anchor('Hips'),d=item.design,t=item.tier;
 if(d==='disguise'){
  // Props are rigid avatar-local objects, not children of animated hips or
  // of the head's imported Mixamo quaternion (which can be upside down).
  const g=new T.Group(),frame=disguiseFrame(T,model,bones,height);
  // Build and measure in an unparented, canonical Y-up coordinate system.
  record.parts.push(g);
  g.name='disguise:'+item.creature;g.userData.disguiseHeight=item.disguiseHeight;g.userData.outfit=item.id;
  const black=mat('#211f20'),rust=mat('#86523a'),silver=mat('#a6a6a0',.65),wood=mat('#b28b58'),woodDark=mat('#715037'),tape=mat('#b9aa87'),soot=mat('#39302e');
  const kind=item.creature;
  const b=(p,s,m=main)=>box(g,p,s,m);
  const o=(p,s,m=main)=>ball(g,p,s,m);
  const c=(p,r1,r2,h,m=main,n=20)=>add(g,new T.CylinderGeometry(r1,r2,h,n),p,[1,1,1],m);
  const slit=(y,z,w=.25)=>{b([0,y,z],[w,.073,.022],black);b([0,y+.045,z],[w+.04,.018,.04],soot);};
  const mark=(p,s,m)=>{const q=b(p,s,m);q.rotation.z=.16*Math.sin(p[0]*43+p[1]*31);return q;};
  const street=buildStreetOutfit(T,g,kind,record,mat)||buildNewStreetProp(T,g,kind,record,mat);
  if(street){/* constructed using the same avatar-local prop frame */}
  else if(kind==='chimney-disguise'){
   const mortar=mat('#938078'),bricks=['#98513d','#ad6349','#7e4737','#b16d53','#864836'].map(v=>mat(v));
   b([0,1.50,0],[.64,2.88,.60],mortar);
   // Instanced brick courses keep the tall disguise inexpensive to render.
   const brickGeo=new T.BoxGeometry(1,1,1),dummy=new T.Object3D(),groups=bricks.map(()=>[]);
   for(let row=0;row<24;row++)for(let side=0;side<4;side++)for(let col=0;col<3;col++){
    const x=(col-1)*.205,y=.10+row*.116;
    const edge=side%2?.315:.305;
    dummy.position.set(side%2?Math.sign(1.5-side)*edge:x,y,side%2?x:(side===0?edge:-edge));
    dummy.rotation.set(0,side%2?Math.PI/2:0,0);dummy.scale.set(.197,.106,.034);dummy.updateMatrix();
    groups[(row*7+side*3+col*11)%bricks.length].push(dummy.matrix.clone());
   }
   groups.forEach((list,i)=>{const inst=new T.InstancedMesh(brickGeo,bricks[i],list.length);list.forEach((m,n)=>inst.setMatrixAt(n,m));g.add(inst);});
   b([0,.055,0],[.77,.11,.72],soot);b([0,2.91,0],[.77,.13,.73],soot);
   b([0,2.975,0],[.47,.05,.45],black);
   slit(.82,.342,.29);
  }else if(kind==='cardboard-disguise'){
   buildSoftCardboard(T,g,record,mat);
  }else if(kind==='garbage-bag-disguise'){
   buildSoftGarbage(T,g,record,mat);
  }else if(kind==='trash-can-disguise'){
   const metal=mat('#777c7a',.55);
   add(g,new T.CylinderGeometry(.39,.33,.94,28,1,true),[0,.49,0],[1,1,1],metal);metal.side=T.DoubleSide;c([0,.79,0],.365,.365,.022,black,28);
   c([0,.055,0],.36,.36,.08,rust);const lid=c([0,.985,0],.43,.40,.11,metal);
   for(let i=0;i<18;i++){const a=i*6.283/18;const rib=b([Math.cos(a)*.365,.48,Math.sin(a)*.365],[.035,.84,.043],i%5===0?rust:silver);rib.rotation.y=-a;}
   for(let i=0;i<7;i++){const a=i*2.4;const patch=o([Math.sin(a)*.372,.14+(i%3)*.23,Math.cos(a)*.372],[.056,.085,.020],rust);patch.rotation.y=a;}
   const handle=tube(g,[[-.13,1.035,0],[-.13,1.075,0],[.13,1.075,0],[.13,1.035,0]],.021,black);const hinge=new T.Group();hinge.position.set(0,.94,-.4);g.add(hinge);g.updateMatrixWorld(true);hinge.attach(lid);if(handle)hinge.attach(handle);record.trashLid=hinge;
   for(const side of [-1,1])tube(g,[[side*.38,.70,-.09],[side*.49,.70,-.09],[side*.49,.57,.09],[side*.38,.57,.09]],.025,silver);
   slit(.77,.397,.25);
  }else if(kind==='postbox-disguise'){
   const red=mat('#b52a35'),green=mat('#186d42'),ivory=mat('#f4eedb');
   for(const side of [-1,1]){
    const x=side*.245,m=side<0?green:red;
    b([x,.50,0],[.48,.90,.62],m);o([x,.94,0],[.24,.14,.31],m);
    b([x,.12,0],[.43,.18,.57],m);b([x,.75,.324],[.35,.09,.065],silver);b([x,.75,.363],[.30,.042,.012],black);
    b([x,.49,.321],[.32,.18,.012],ivory);
    // Small text panel is real canvas typography, not a separate shop icon.
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#eee8d7';ctx.fillRect(0,0,256,128);ctx.fillStyle=side<0?'#185e38':'#97242d';ctx.textAlign='center';ctx.font='bold 28px sans-serif';ctx.fillText(side<0?'普通郵件':'限時郵件',128,45);ctx.font='bold 20px sans-serif';ctx.fillText(side<0?'ORDINARY MAIL':'PROMPT DELIVERY',128,76);ctx.font='18px sans-serif';ctx.fillText('中華郵政',128,105);
    const labelTex=staticPaintTexture(T,canvas);labelTex.colorSpace=T.SRGBColorSpace;const labelMat=mat('#ffffff');labelMat.map=labelTex;record.extraTextures??=[];record.extraTextures.push(labelTex);b([x,.49,.333],[.31,.17,.006],labelMat);
    for(let i=0;i<3;i++)mark([x-.16+i*.12,.20+(i%2)*.04,.324],[.04,.02,.01],rust);
   }
  }else if(kind==='water-tower-disguise'){
   const steel=mat('#b0bdbe',.72),rim=mat('#65777a',.65),stain=mat('#8a6150',.2);
   c([0,.13,0],.51,.53,.26,rim);c([0,1.08,0],.51,.51,1.59,steel,24);
   for(let i=0;i<9;i++)c([0,.34+i*.18,0],.529,.529,.044,rim,24);
   c([0,1.93,0],.18,.51,.19,steel,24);c([0,2.055,0],.18,.18,.08,rim);
   for(const side of [-1,1]){b([side*.35,.07,0],[.12,.14,.60],rim);b([side*.17,.88,.536],[.043,1.56,.055],rim);}
   for(let i=0;i<9;i++)b([0,.20+i*.16,.55],[.36,.035,.055],rim);
   for(let i=0;i<8;i++)mark([-.34+i*.085,.45+(i%4)*.16,.518],[.035,.17,.014],stain);
   tube(g,[[.43,.14,.22],[.62,.24,.22],[.62,1.57,.22],[.49,1.71,.22]],.045,rim);
   slit(.91,.53,.26);
  }else if(kind==='utility-pole-disguise'){
   const concrete=mat('#a39f91'),darkConcrete=mat('#716f66'),ceramic=mat('#755042',.18),wire=mat('#39383a',.3);
   c([0,1.48,0],.115,.21,2.96,concrete,12);c([0,.08,0],.24,.25,.16,darkConcrete,12);
   for(let i=0;i<5;i++)b([0,.27+i*.13,.187],[.18,.06,.025],i%2?black:mat('#d7ae36'));
   for(const y of [2.43,2.75]){b([0,y,0],[1.18,.10,.14],darkConcrete);
    for(const x of [-.49,0,.49]){c([x,y+.13,0],.085,.085,.13,ceramic,10);for(let k=0;k<3;k++)c([x,y+.09+k*.05,0],.114,.114,.025,ceramic,10);}
   }
   addSwayingPoleWires(T,g,record,mat,wire);
   b([.24,1.98,0],[.32,.48,.34],silver);c([.24,2.26,0],.16,.16,.12,rimSafe());
   function rimSafe(){return darkConcrete;}
   tube(g,[[.18,.27,-.05],[.23,1.32,-.05],[.17,2.43,-.05]],.025,wire);
   slit(.9,.184,.14);
  }else if(kind==='tin-pipe-disguise'){
   const metal=mat('#aebabe',.72),rim=mat('#727d80',.72),inner=mat('#323c3f',.32);
   metal.roughness=.43;rim.roughness=.42;
   // Tall flexible pipe: keep the lower head opening stable and bend the upper sections.
   const joints=[],radius=.43;
   for(let i=0;i<14;i++){
    const q=new T.Group(),bend=Math.max(0,(i-5)/8);q.position.set(.48*bend*bend,.075+i*.13,0);q.rotation.z=-.43*bend;q.userData.pipeBend=bend;g.add(q);joints.push(q);
    const shell=add(q,new T.CylinderGeometry(radius,radius,.158,28,1,true),[0,0,0],[1,1,1],metal);shell.material.side=T.DoubleSide;
    const ring=add(q,new T.TorusGeometry(radius,.028,8,28),[0,.065,0],[1,1,1],rim);ring.rotation.x=Math.PI/2;
   }
   for(const y of [.055,1.89]){
    const x=y>1?.48:0;const flange=add(g,new T.TorusGeometry(radius,.07,10,32),[x,y,0],[1,1,1],rim);flange.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;c([x+Math.cos(a)*.47,y-.018,Math.sin(a)*.47],.034,.034,.05,silver,6);}
   }
   add(g,new T.CylinderGeometry(.40,.40,.20,28,1,true),[.48,1.80,0],[1,1,1],inner).material.side=T.DoubleSide;
   record.flexPipe=joints;
  }else if(['luroufan-sign-disguise','notok-sign-disguise','987-sign-disguise'].includes(kind)){
   const food=kind==='luroufan-sign-disguise',brand=kind==='notok-sign-disguise'?'NOTOK':'987';
   const casing=mat('#77736c',.45),edge=mat(food?'#d1a400':'#ac222d',.2);
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const ctx=canvas.getContext('2d');
   ctx.fillStyle=food?'#f5cf19':'#fff9f0';ctx.fillRect(0,0,1024,384);
   if(food){
    ctx.fillStyle='#ce2522';ctx.fillRect(0,0,1024,22);ctx.fillRect(0,362,1024,22);
    ctx.textAlign='center';ctx.font='bold 164px sans-serif';ctx.strokeStyle='#fff7d3';ctx.lineWidth=9;ctx.strokeText('魯肉飯',410,174);ctx.fillText('魯肉飯',410,174);
    ctx.fillStyle='#243963';ctx.fillRect(18,209,668,42);ctx.fillStyle='#ffffff';ctx.font='bold 28px sans-serif';ctx.fillText('古早味・便當・每日供應',352,239);
    ctx.fillStyle='#211f20';ctx.font='bold 34px sans-serif';ctx.fillText('雞腿飯 80　排骨飯 70　魯肉飯 45',470,314);
    ctx.font='bold 30px sans-serif';ctx.fillText('便當',849,80);ctx.fillText('雞腿飯',849,131);ctx.fillText('排骨飯',849,182);ctx.fillText('控肉飯',849,233);ctx.fillText('55　70　80',849,314);
   }else{
    ctx.fillStyle='#c92131';ctx.fillRect(0,0,1024,52);ctx.fillRect(0,324,1024,60);ctx.textAlign='center';ctx.font=brand==='987'?'bold 230px sans-serif':'bold 184px sans-serif';ctx.fillText(brand,512,244);ctx.font='bold 30px sans-serif';ctx.fillText('CONVENIENCE STORE',512,299);
   }
   const tex=staticPaintTexture(T,canvas);tex.colorSpace=T.SRGBColorSpace;record.extraTextures??=[];record.extraTextures.push(tex);
   const face=mat('#ffffff');face.map=tex;face.emissive.set('#ffffff');face.emissiveMap=tex;face.emissiveIntensity=.8;record.blinkLight=face;
   b([0,.56,0],[2.85,1.12,.22],casing);
   for(const side of [-1,1]){b([0,.56,side*.125],[2.76,1.04,.028],face);b([0,.035,side*.14],[2.85,.06,.035],edge);b([0,1.085,side*.14],[2.85,.06,.035],edge);}
   for(const x of [-1.42,1.42])b([x,.56,0],[.06,1.12,.27],edge);
  }else if(kind==='luroufan-bowl-disguise'){
   const porcelain=mat('#f6ebd8'),blue=mat('#31578c'),rice=mat('#fff4dd'),pork=mat('#804222'),fat=mat('#b97743'),sauce=mat('#5a301d');
   pork.roughness=.32;fat.roughness=.38;sauce.roughness=.25;
   const profile=[[.18,0],[.26,.04],[.37,.10],[.52,.25],[.65,.52],[.72,.82],[.70,.89],[.66,.87],[.60,.57],[.48,.30],[.25,.10]].map(v=>new T.Vector2(...v));
   add(g,new T.LatheGeometry(profile,48),[0,0,0],[1,1,1],porcelain).material.side=T.DoubleSide;
   for(const [r,y] of [[.70,.86],[.63,.64],[.31,.06]]){const ring=add(g,new T.TorusGeometry(r,.022,8,48),[0,y,0],[1,1,1],blue);ring.rotation.x=Math.PI/2;}
   o([0,.76,0],[.65,.17,.65],rice);
   const dummy=new T.Object3D(),grainGeo=new T.SphereGeometry(1,6,4),grains=new T.InstancedMesh(grainGeo,rice,180);
   for(let i=0;i<180;i++){const a=i*2.39996,r=.64*Math.sqrt((i+.5)/180);dummy.position.set(Math.cos(a)*r,.87+.035*Math.cos(r*2),Math.sin(a)*r);dummy.rotation.set(.1,i*.77,.3);dummy.scale.set(.034,.016,.018);dummy.updateMatrix();grains.setMatrixAt(i,dummy.matrix);}g.add(grains);
   const groups=[];
   for(let k=0;k<3;k++){const pieces=new T.InstancedMesh(softPorkGeometry(T,k+1),[pork,fat,sauce][k],35),rest=[];pieces.frustumCulled=false;for(let i=0;i<35;i++){const a=(i*3+k)*2.39996,r=.49*Math.sqrt((i+.5)/35),x=Math.cos(a)*r,z=Math.sin(a)*r,y=.92+.19*(1-r/.55)+(i%4)*.026,sx=.045+(i%4)*.013,sy=.035+(i%3)*.014,sz=.046+(i%5)*.01;rest.push([x,y,z,sx,sy,sz,i*.83]);dummy.position.set(x,y,z);dummy.rotation.set(0,i*.83,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();pieces.setMatrixAt(i,dummy.matrix);}g.add(pieces);groups.push({mesh:pieces,rest});}
   record.riceMotion={groups,dummy,pos:new T.Vector3(),delta:new T.Vector3(),last:null,energy:0,resting:true};
   const scallion=mat('#4a823e');for(let i=0;i<12;i++){const a=i*2.4,r=.34+i%4*.06;const ring=add(g,new T.TorusGeometry(.029,.011,5,8),[Math.cos(a)*r,1.025,Math.sin(a)*r],[1,1,1],scallion);ring.rotation.x=Math.PI/2;}
   const herb=mat('#438c35'),leaf=new T.InstancedMesh(new T.SphereGeometry(1,7,4),herb,60);for(let i=0;i<60;i++){const a=i*2.39996,r=.18*Math.sqrt((i+.5)/60);dummy.position.set(.40+Math.cos(a)*r,.94+(i%5)*.018,.20+Math.sin(a)*r);dummy.rotation.set(.2*Math.sin(i),a,.5*Math.cos(i));dummy.scale.set(.045,.012,.019);dummy.updateMatrix();leaf.setMatrixAt(i,dummy.matrix);}g.add(leaf);
  }else if(kind==='mutton-sign-disguise'){
   // Vertical Taiwanese street lightbox, manually redrawn from the reference.
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=864;const ctx=canvas.getContext('2d');
   const yellow=ctx.createLinearGradient(0,0,512,864);yellow.addColorStop(0,'#f9e326');yellow.addColorStop(1,'#d7ba13');ctx.fillStyle=yellow;ctx.fillRect(0,0,512,864);
   ctx.fillStyle='#ae171c';ctx.textAlign='center';ctx.font='bold 122px "Noto Serif TC",serif';ctx.fillText('老 家',315,139);
   // Hand-cut black-and-white goat silhouette and curled horns.
   ctx.save();ctx.translate(15,25);ctx.scale(.95,.94);
   const goat=new Path2D('M64 78 Q30 40 51 17 Q72 0 96 22 Q65 11 63 40 L85 80 Q103 37 147 17 Q118 44 110 91 L136 121 Q154 168 206 178 Q294 165 356 199 L424 220 L455 250 L425 248 L403 237 L384 269 L398 346 L425 397 L404 410 L374 372 L350 305 L318 294 L299 356 L284 402 L260 405 L275 361 L279 304 L218 286 L192 335 L177 396 L152 400 L162 334 L162 283 L134 253 L103 205 L84 177 L55 178 L39 152 L51 126 Z');
   ctx.strokeStyle='#fff9d8';ctx.lineWidth=10;ctx.stroke(goat);ctx.fillStyle='#171717';ctx.fill(goat);
   ctx.fillStyle='#f7f4e9';ctx.fill(new Path2D('M125 157 Q155 183 210 188 Q289 178 354 203 L396 225 L363 260 L352 233 L329 268 L311 241 L282 278 L265 247 L234 275 L217 243 L194 266 L170 224 L151 207 Z'));
   ctx.fill(new Path2D('M59 113 L82 91 L95 113 L83 136 L64 153 L48 149 L63 139 L56 132 Z'));ctx.fillStyle='#171717';ctx.beginPath();ctx.ellipse(77,124,4,6,.2,0,Math.PI*2);ctx.fill();ctx.restore();
   const column=(str,x,y,step,color,size)=>{ctx.fillStyle=color;ctx.font='bold '+size+'px "Noto Serif TC",serif';[...str].forEach((ch,i)=>ctx.fillText(ch,x,y+i*step));};
   column('羊肉爐',45,208,76,'#ad191d',61);column('螺肉',466,338,62,'#171717',49);
   column('鍋燒',72,523,96,'#228232',78);column('烏龍',44,724,70,'#228232',53);column('意麵',104,724,70,'#228232',53);
   column('蝦仁炒飯',190,530,91,'#171717',76);column('什錦炒麵',294,530,91,'#171717',76);
   column('羊肉',422,528,92,'#ad191d',77);column('炒飯',389,721,69,'#ad191d',53);column('燴飯',454,721,69,'#ad191d',53);
   for(let x=2;x<512;x+=5){ctx.fillStyle=x%10===2?'rgba(255,255,255,.08)':'rgba(99,69,0,.05)';ctx.fillRect(x,0,1,864);}
   const tex=staticPaintTexture(T,canvas);tex.colorSpace=T.SRGBColorSpace;record.extraTextures??=[];record.extraTextures.push(tex);
   const casing=mat('#75674e',.5),face=mat('#ffffff');face.map=tex;face.emissive.set('#fff4c2');face.emissiveMap=tex;face.emissiveIntensity=.65;record.muttonLight=face;
   b([0,1.18,0],[1.43,2.36,.23],casing);
   for(const side of [-1,1]){b([0,1.18,side*.125],[1.32,2.24,.025],face);for(const x of [-.69,.69])b([x,1.18,side*.14],[.045,2.36,.032],woodDark);}
   for(const y of [.025,2.335])b([0,y,0],[1.47,.05,.29],woodDark);
  }else if(kind==='bubble-tea-disguise'){
   const tea=mat('#c99762'),ice=mat('#e8d5b4'),pearl=mat('#37221c'),straw=mat('#d94d70'),cup=mat('#f7efe2'),label=mat('#fff3dc');
   tea.roughness=.27;pearl.roughness=.20;ice.roughness=.24;cup.transparent=true;cup.opacity=.26;cup.depthWrite=false;cup.roughness=.19;
   tea.transparent=true;tea.opacity=.62;tea.depthWrite=false;
   // The top surface is actually deformed by the damped slosh simulation.
   const milk=c([0,.715,0],.555,.37,1.32,tea,40);milk.renderOrder=1;
   const shell=add(g,new T.CylinderGeometry(.59,.39,1.50,40,1,true),[0,.79,0],[1,1,1],cup);shell.material.side=T.DoubleSide;shell.renderOrder=2;
   for(const [r,y] of [[.40,.055],[.59,1.53]]){const ring=add(g,new T.TorusGeometry(r,.027,8,40),[0,y,0],[1,1,1],cup);ring.rotation.x=Math.PI/2;ring.renderOrder=3;}
   const dummy=new T.Object3D(),geo=new T.SphereGeometry(1,10,8),pearls=new T.InstancedMesh(geo,pearl,68),rest=[];
   for(let i=0;i<68;i++){const a=i*2.39996,y=.11+(i%4)*.116,r=(.25+y*.10)*Math.sqrt(((i*29)%68+.5)/68),size=.050+(i%5)*.006;dummy.position.set(Math.cos(a)*r,y,Math.sin(a)*r);dummy.rotation.set(0,-a,0);dummy.scale.setScalar(size);dummy.updateMatrix();pearls.setMatrixAt(i,dummy.matrix);rest.push([dummy.position.x,y,dummy.position.z,size,a]);}g.add(pearls);pearls.frustumCulled=false;
   const cubes=[];for(let i=0;i<8;i++){const a=i*2.39996,iceCube=b([Math.cos(a)*.39,1.31,Math.sin(a)*.39],[.14,.13,.14],ice);iceCube.rotation.set(i*.3,i*.8,i*.4);cubes.push({mesh:iceCube,x:iceCube.position.x,z:iceCube.position.z,a});}
   const strawMesh=c([.44,1.66,-.15],.065,.065,.45,straw,16);strawMesh.rotation.z=-.22;
   const lid=add(g,new T.TorusGeometry(.56,.048,10,40),[0,1.55,0],[1,1,1],cup);lid.rotation.x=Math.PI/2;
   const splashMat=mat('#d7a36f');splashMat.roughness=.23;const drops=new T.InstancedMesh(new T.SphereGeometry(1,7,5),splashMat,36);drops.frustumCulled=false;
   for(let i=0;i<36;i++){dummy.position.set(0,1.45,0);dummy.scale.setScalar(0);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);}g.add(drops);
   record.teaMotion={group:g,milk,vertices:milk.geometry.attributes.position.array.slice(),pearls,rest,cubes,drops,dummy,particles:Array.from({length:36},()=>({age:99,p:new T.Vector3(),v:new T.Vector3()})),last:null,velocity:new T.Vector3(),accel:new T.Vector3(),tilt:new T.Vector2(),tiltVelocity:new T.Vector2(),worldPos:new T.Vector3(),delta:new T.Vector3(),localVelocity:new T.Vector3(),localAccel:new T.Vector3(),q:new T.Quaternion(),inverse:new T.Matrix4(),next:0,credit:0};
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff3dc';ctx.fillRect(0,0,256,192);ctx.fillStyle='#583a25';ctx.textAlign='center';ctx.font='bold 47px sans-serif';ctx.fillText('珍珠奶茶',128,82);ctx.font='bold 24px sans-serif';ctx.fillText('BUBBLE TEA',128,135);const tex=staticPaintTexture(T,canvas);tex.colorSpace=T.SRGBColorSpace;label.map=tex;record.extraTextures??=[];record.extraTextures.push(tex);b([0,1.05,.535],[.49,.34,.022],label);
  }else if(kind==='fried-chicken-disguise'){
   // Irregular grilled/fried cutlet: a thick sculpted base plus two scales
   // of real raised batter granules, warm glaze and pale sesame seeds.
   const crust=mat('#b56e27'),crumbMat=mat('#ffffff'),seedMat=mat('#fff0bb');crust.roughness=.45;crumbMat.roughness=.48;seedMat.roughness=.66;
   const outline=new T.Shape();const lobes=72,edge=a=>1+.075*Math.sin(5*a+.2)+.047*Math.sin(11*a+1.7)+.035*Math.cos(19*a-.6);
   for(let i=0;i<=lobes;i++){const a=i/lobes*Math.PI*2,r=edge(a),x=Math.cos(a)*.68*r,y=1+Math.sin(a)*.94*r;i?outline.lineTo(x,y):outline.moveTo(x,y);}outline.closePath();
   const geo=new T.ExtrudeGeometry(outline,{depth:.31,bevelEnabled:true,bevelSize:.075,bevelThickness:.09,bevelSegments:3,steps:1,curveSegments:1});geo.translate(0,0,-.155);add(g,geo,[0,0,0],[1,1,1],crust);
   const dummy=new T.Object3D(),color=new T.Color(),palette=['#9c4c16','#bc6d24','#d98e39','#e6aa54','#f0b863','#a65920'];let seed=41273;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
   // Shared geometry and per-instance colours: thousands of relief facets,
   // but only three additional draw calls, not thousands of individual meshes.
   for(const [count,small] of [[560,false],[1300,true]]){
    const crumbGeo=new T.IcosahedronGeometry(1,small?0:1),inst=new T.InstancedMesh(crumbGeo,crumbMat,count);
    for(let i=0;i<count;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.98,rr=edge(a)*r,x=Math.cos(a)*.68*rr,y=1+Math.sin(a)*.94*rr,side=i%2?1:-1;
     const bump=.023*Math.sin(x*21+y*17)+.022*Math.cos(x*31-y*16),size=(small?.012:.035)+rand()*(small?.024:.067);
     dummy.position.set(x,y,side*(.155+.032*(1-r)+bump+(r>.91?.025:0)));dummy.rotation.set(rand()*6.28,rand()*6.28,rand()*6.28);dummy.scale.set(size*(.8+rand()*.9),size*(.65+rand()*.7),size*(.75+rand()*.95));dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);color.set(palette[Math.floor(rand()*palette.length)]);inst.setColorAt(i,color);
    }g.add(inst);
   }
   const sesame=new T.InstancedMesh(new T.SphereGeometry(1,7,4),seedMat,230);
   for(let i=0;i<230;i++){const a=rand()*6.283,r=Math.sqrt(rand())*.88,rr=edge(a)*r,x=Math.cos(a)*.68*rr,y=1+Math.sin(a)*.94*rr;dummy.position.set(x,y,(i%2?1:-1)*(.245+.018*Math.sin(x*21+y*17)));dummy.rotation.set(rand()*.5,rand()*.5,rand()*6.28);dummy.scale.set(.011+rand()*.005,.023+rand()*.007,.007);dummy.updateMatrix();sesame.setMatrixAt(i,dummy.matrix);}g.add(sesame);
  }else if(kind==='wooden-horse-disguise'){
   const red=mat('#8b3d32'),gold=mat('#c2a36b'),saddle=mat('#344d73');
   // A tall carved wooden horse with a long body, four legs and rocker rails.
   o([0,1.00,-.13],[.55,.44,.88],wood);o([0,1.33,.46],[.32,.59,.36],wood);
   const skull=o([0,1.69,.65],[.32,.31,.46],wood);skull.rotation.x=-.14;
   o([0,1.58,.96],[.24,.18,.22],woodDark);
   for(const side of [-1,1]){
    const ear=cone(g,[side*.18,1.88,.58],.095,.24,wood);ear.rotation.z=-side*.20;
    o([side*.285,1.73,.73],[.045,.069,.069],black);
    for(const z of [-.66,.45]){const leg=b([side*.37,.53,z],[.20,.80,.23],wood);leg.rotation.x=z<0?.16:-.16;b([side*.37,.17,z],[.25,.14,.30],woodDark);}
    tube(g,[[side*.42,.28,-1.08],[side*.42,.12,-.73],[side*.42,.08,0],[side*.42,.12,.73],[side*.42,.28,1.08]],.075,red);
    tube(g,[[side*.30,1.44,.57],[side*.33,1.62,.90],[side*.24,1.70,1.00]],.026,red);
    for(let i=0;i<4;i++)mark([side*.46,.88,-.58+i*.25],[.018,.16,.11],woodDark);
   }
   b([0,1.37,-.18],[.76,.10,.61],saddle);b([0,1.43,-.18],[.68,.08,.56],red);
   for(let i=0;i<6;i++)o([0,1.42+i*.067,.29],[.19,.12,.13],red);
   tube(g,[[0,1.22,-.91],[0,1.44,-1.13],[0,1.15,-1.26],[0,.83,-1.25]],.12,red);
   b([0,.14,.67],[.94,.12,.16],gold);b([0,.14,-.67],[.94,.12,.16],gold);
   slit(1.02,.73,.22);
  }
  g.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(g,true),extent=bounds.getSize(new T.Vector3());
  const giant=!!street||['chimney-disguise','cardboard-disguise','water-tower-disguise','utility-pole-disguise','tin-pipe-disguise','luroufan-sign-disguise','luroufan-bowl-disguise','bubble-tea-disguise','fried-chicken-disguise','notok-sign-disguise','987-sign-disguise','mutton-sign-disguise'].includes(kind);
  const widest=kind==='luroufan-bowl-disguise';
  const factor=frame.height*item.disguiseHeight/Math.max(.001,widest?Math.max(extent.x,extent.y,extent.z):extent.y);
  g.scale.setScalar(factor);g.quaternion.copy(frame.rotation);
  g.position.copy(frame.base).addScaledVector(frame.up,-bounds.min.y*factor);
  if(street?.waterHead){
   const headCenter=frame.head.clone().addScaledVector(frame.up,frame.unit*.42);g.position.copy(headCenter).addScaledVector(frame.up,-street.openingY*factor-frame.unit*.35);
  }else if(item.exposedHead&&giant){
   const front=new T.Vector3(0,0,1).applyQuaternion(frame.rotation);
   const headCenter=frame.head.clone().addScaledVector(frame.up,frame.unit*.42);
   const headY=headCenter.clone().sub(frame.base).dot(frame.up)/factor+bounds.min.y;
   const preferred=street?(street.openingY??headY):kind==='luroufan-bowl-disguise'? .46:kind==='bubble-tea-disguise'? .68:kind==='tin-pipe-disguise'? .55:kind==='cardboard-disguise'? .52:kind==='mutton-sign-disguise'?1.42:kind.endsWith('sign-disguise')? .56:headY;
   const y=T.MathUtils.clamp(preferred,bounds.min.y+extent.y*.17,bounds.max.y-extent.y*.17);
   // One uniform scale for the entire prop, including the opening. The head
   // projects from the front wall instead of being moved above a squashed prop.
   const frontZ=street?street.frontZ:kind==='bubble-tea-disguise'?.39+.20*(y/1.50):kind==='luroufan-bowl-disguise'?.59:kind==='tin-pipe-disguise'?.43:kind==='water-tower-disguise'?.53:kind==='utility-pole-disguise'?.19:bounds.max.z;
   g.position.copy(headCenter).addScaledVector(frame.up,-y*factor).addScaledVector(front,-frontZ*factor+frame.unit*.10);
   cutDisguiseOpening(T,g,0,y,frame.unit*.82/factor,frame.unit*.95/factor,frontZ);
  }else if(item.exposedHead){
   // Legacy small disguises keep their established torso fit.
   const neckSpan=Math.max(frame.unit*.6,frame.head.clone().sub(frame.base).dot(frame.up)-frame.unit*.25);
   const fy=neckSpan/Math.max(.001,extent.y),side=Math.max(fy,frame.height*.58/Math.max(.15,Math.min(extent.x,extent.z)));
   g.scale.set(side,fy,side);g.position.copy(frame.base).addScaledVector(frame.up,-bounds.min.y*fy);
  }
  model.add(g);g.updateMatrixWorld(true);
  attachStreetMotion(T,g,kind,record,mat);
  // Existing avatar and collision dimensions remain untouched by cosmetic props.
  return record;
 }
 // Soft collar and front fastening define the garment rather than merely recolouring skin.
 for(const side of [-1,1]){const lapel=ball(chest,[side*.2,.1,.3],[.24,.09,.1],cream);lapel.rotation.z=side*.4;}
 for(let i=0;i<3;i++)ball(chest,[0,-.15-i*.22,.44],[.035,.035,.025],trim);
 // Creature suits retain the animated skinned character; only small props
 // and fabric accents are bone-attached. Hood is suppressed when a separate
 // HEAD item is equipped, exactly like other outfits.
 if(d==='creature'){
  const kind=item.creature, fur=['polar-bear','guinea-pig','lion'],beak=['rooster','penguin'];
  const shell=mat(kind==='polar-bear'?'#ebf4f5':kind==='lion'?'#b6874f':'#edf0ec');
  const cuff=mat(kind==='crab-claw'?'#ad4d4b':kind==='eggplant'?'#4c315c':'#e0d3c1');
  const seam=mat(kind==='penguin'?'#dfe6ed':'#faf0df');
  // Anatomical cuffs, lapels and boot edges are attached to moving Mixamo
  // bones. Main clothing remains the full original skinned player mesh.
  for(const side of ['LeftForeArm','RightForeArm']){
   const arm=anchor(side);
   const border=ball(arm,[0,-.19,.06],[.195,.065,.19],cuff);
   border.rotation.x=.1;
   if(fur.includes(kind)){
    for(let n=0;n<7;n++){
     const a=n*6.283/7;
     const tufts=cone(arm,[Math.cos(a)*.17,-.25,Math.sin(a)*.16],.035,.18,main);
     tufts.rotation.z=Math.cos(a)*.6;
    }
   }
  }
  for(const side of ['LeftFoot','RightFoot']){
   const foot=anchor(side);
   ball(foot,[0,-.05,.24],[.24,.13,.34],kind==='penguin'?shell:main);
   if(['elephant','lion','crab-claw','polar-bear','anteater'].includes(kind)){
    for(let n=-1;n<=1;n++){
     const nail=ball(foot,[n*.13,-.085,.55],[.05,.06,.09],shell);
     nail.rotation.y=n*.13;
    }
   }
  }
  // Cloth seams rather than box-shaped chest plates.
  for(const side of [-1,1]){
   const stitch=tube(chest,[[side*.31,.26,.32],[side*.39,.04,.32],[side*.36,-.37,.37]],.017,seam);
   stitch.rotation.z=side*.04;
  }
  if(['penguin','polar-bear','elephant','guinea-pig','anteater'].includes(kind))
   ball(chest,[0,-.27,.38],[.39,.57,.055],kind==='penguin'?shell:seam);
  if(kind==='rooster'){
   for(let n=0;n<5;n++){
    const a=(n-2)*.28;
    const plume=tube(hips,[[0,-.01,-.25],[a*.65,.45,-.55],[a, .32,-1.02],[a*1.2,-.12,-1.17]],.075,n%2?cuff:main);
    plume.rotation.y=a;
   }
  }
  if(kind==='anteater'){
   const tail=tube(hips,[[0,-.05,-.32],[0,-.26,-.73],[.16,-.41,-1.18],[.3,-.50,-1.28]],.16,main);
   tail.rotation.y=.07;
  }
  if(kind==='elephant')tube(hips,[[0,-.20,-.29],[0,-.34,-.65],[.08,-.55,-.82]],.043,main);
  if(kind==='jellyfish'){
   const sheer=mat('#b6dff4');sheer.transparent=true;sheer.opacity=.58;sheer.depthWrite=false;
   for(let n=0;n<8;n++){
    const a=n*6.283/8;
    tube(hips,[[Math.cos(a)*.36,-.16,Math.sin(a)*.30],
      [Math.cos(a+.35)*.42,-.56,Math.sin(a+.35)*.35],
      [Math.cos(a+.7)*.40,-.95,Math.sin(a+.7)*.30]],.035,n%2?sheer:seam);
   }
  }
  if(kind==='crab-claw'){
   for(const side of ['LeftForeArm','RightForeArm']){
    const arm=anchor(side);
    for(const sign of [-1,1]){
     const claw=cone(arm,[sign*.16,-.25,.32],.095,.30,main);
     claw.rotation.x=Math.PI/2;claw.rotation.z=sign*.22;
    }
   }
  }
  if(kind==='lion'){
   tube(hips,[[0,-.10,-.28],[0,-.25,-.66],[.14,-.45,-1.03],[.30,-.48,-1.16]],.07,main);
   ball(hips,[.30,-.48,-1.16],[.13,.15,.13],cuff);
  }
  if(kind==='banana-bunch'){
   // Pleated banana peel skirt: curved thin sheets, never cube body geometry.
   for(let n=0;n<5;n++){
    const a=n*6.283/5;
    const peel=ball(hips,[Math.cos(a)*.42,-.42,Math.sin(a)*.30],[.13,.43,.09],main);
    peel.rotation.z=Math.cos(a)*.33;peel.rotation.x=Math.sin(a)*.28;
   }
  }
  if(kind==='eggplant'){
   const leaf=mat('#6e995d');
   for(let n=0;n<5;n++){
    const a=n*6.283/5;
    const blade=cone(chest,[Math.cos(a)*.31,.35,Math.sin(a)*.22],.18,.36,leaf);
    blade.rotation.z=-Math.cos(a)*.48;
   }
  }
  if(hood&&!item.r106Wearable){
   // The original headgear sculptor also provides the matching outfit hood.
   // A separate HEAD-slot item suppresses this hood, never the whole suit.
   const h=anchor('Head'),headpiece=createHeadgear(T,{...item,design:kind});
   h.add(headpiece);headpiece.position.set(0,.20,.04);
   (record.headpieces??=[]).push(headpiece);
  }
 }
 // New wearable sculptures follow the same body bones and skinned cloth.
 if(d==='leather'){
  const silver=mat('#bfc4ca',.8),black=mat('#19171c',.18);
  main.roughness=.34;
  tube(chest,[[0,.34,.46],[.04,.05,.49],[.04,-.55,.45]],.035,silver);
  for(const sign of [-1,1]){
   const lapel=box(chest,[sign*.23,.12,.47],[.14,.39,.045],black);lapel.rotation.z=sign*.5;
   const zip=box(chest,[sign*.24,-.29,.46],[.22,.025,.04],silver);zip.rotation.z=sign*.3;
   const arm=anchor(sign<0?'LeftForeArm':'RightForeArm');ball(arm,[0,-.21,.05],[.20,.08,.19],black);
   const foot=anchor(sign<0?'LeftFoot':'RightFoot');ball(foot,[0,-.04,.22],[.25,.18,.36],black);
  }
  box(hips,[0,.06,.34],[.72,.14,.10],black);box(hips,[0,.06,.41],[.17,.13,.06],silver);
 }
 if(item.r106Wearable&&d==='creature'){
  const kind=item.creature;
  if(kind==='spider'){
   ball(hips,[0,.05,-.70],[.68,.52,.75],dark);ball(chest,[0,-.05,-.32],[.47,.45,.42],main);
   for(const side of [-1,1])for(let i=0;i<4;i++){
    const z=(i-1.5)*.27,leg=tube(hips,[[side*.25,.15,z],[side*.84,.50,z-.15],[side*1.19,.12,z-.30],[side*1.36,-.84,z+.1]],.065,i%2?dark:main);leg.name='Spider leg '+side+' '+i;
   }
   if(hood){const h=anchor('Head');ball(h,[0,.37,.22],[.66,.48,.47],dark);for(let i=0;i<8;i++)ball(h,[(i%4-1.5)*.20,.42+Math.floor(i/4)*.16,.65],[.065,.065,.045],trim);}
  }else if(kind==='caterpillar'){
   for(let i=0;i<7;i++){const part=ball(hips,[0,-.08-i*.055,-.37-i*.29],[.52-i*.035,.44-i*.025,.30],i%2?cream:main);part.rotation.x=.12;for(const side of [-1,1])ball(hips,[side*(.39-i*.02),-.39,-.37-i*.29],[.10,.15,.11],main);}
   if(hood){const h=anchor('Head');ball(h,[0,.40,.13],[.63,.53,.54],main);for(const side of [-1,1]){tube(h,[[side*.21,.74,0],[side*.37,1.06,.05],[side*.43,1.13,.15]],.055,main);ball(h,[side*.43,1.13,.15],[.10,.10,.10],trim);ball(h,[side*.21,.40,.62],[.10,.11,.04],dark);}}
  }else if(kind==='doghouse-disguise'){
   const roof=mat('#a74538'),wood=mat('#c48e58'),door=mat('#30241e');
   box(chest,[0,-.52,0],[1.36,1.66,1.16],wood);box(chest,[0,-.70,.60],[.67,.98,.055],door);
   for(const sign of [-1,1]){const panel=box(chest,[sign*.39,.57,0],[.94,.13,1.40],roof);panel.rotation.z=-sign*.67;}
   for(let i=0;i<5;i++)box(chest,[0,-1.26+i*.28,.589],[1.31,.025,.015],main);
   box(chest,[0,-.01,.64],[.50,.12,.035],cream);
  }
 }
 // Tailored Collector suit: the native skinned torso/arms/legs carry the
 // jacket fabric, while slim lapels, shirt and tie follow the actual Spine2
 // bone. These details never replace the animated character with boxes.
 if(d==='suit'){
  const offwhite=mat('#fbf9f0'),lapel=mat('#3d4558'),silk=mat('#85253d'),
   oxford=mat('#171824');
  function flat(points,material,z){
   const shape=new T.Shape();
   shape.moveTo(...points[0]);
   for(const point of points.slice(1))shape.lineTo(...point);
   shape.closePath();
   const surface=new T.Mesh(new T.ShapeGeometry(shape),material);
   surface.position.z=z;surface.material.side=T.DoubleSide;chest.add(surface);
   return surface;
  }
  flat([[-.18,.29],[.18,.29],[.12,-.28],[0,-.46],[-.12,-.28]],offwhite,.44);
  for(const sign of [-1,1]){
   flat([[sign*.14,.32],[sign*.43,.28],[sign*.33,.03],[sign*.21,-.16],[sign*.08,.14]],lapel,.47);
   ball(chest,[sign*.23,-.32,.48],[.025,.025,.015],trim);
   const sleeve=anchor(sign===-1?'LeftForeArm':'RightForeArm');
   ball(sleeve,[0,-.22,.12],[.19,.055,.17],offwhite);
   const foot=anchor(sign===-1?'LeftFoot':'RightFoot');
   ball(foot,[0,-.06,.18],[.23,.14,.34],oxford);
  }
  flat([[-.075,.20],[.075,.20],[.035,.07],[-.035,.07]],silk,.49);
  flat([[-.035,.08],[.035,.08],[.085,-.28],[0,-.44],[-.085,-.28]],silk,.495);
  flat([[-.37,-.03],[-.24,-.03],[-.305,.05]],offwhite,.515);
 }

 if(d==='pajamas'||d==='silk'){box(chest,[.23,-.25,.41],[.23,.22,.035],cream);for(const side of ['LeftFoot','RightFoot']){const foot=anchor(side);ball(foot,[0,0,.15],[.22,.14,.37],main);ball(foot,[0,.09,.4],[.15,.08,.12],cream);}if(hood){const h=anchor('Head'),cap=cone(h,[.03,.94,-.06],.5,.75,main);cap.rotation.z=.3;ball(h,[-.1,1.3,-.06],[.12,.12,.12],cream);}}
 if(d==='fuzzy'){for(const side of ['LeftLeg','RightLeg']){const foot=anchor(side);ball(foot,[0,-.15,.04],[.24,.32,.25],cream);const fur=new T.InstancedMesh(new T.ConeGeometry(.025,.18,4),cream,160),dummy=new T.Object3D();for(let i=0;i<160;i++){const a=i*2.39996,y=(i%17)/17*.6-.45;dummy.position.set(Math.cos(a)*.23,y,Math.sin(a)*.24);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.cos(a),.4,Math.sin(a)).normalize());dummy.updateMatrix();fur.setMatrixAt(i,dummy.matrix);}foot.add(fur);}for(let i=0;i<10+t;i++)ball(chest,[Math.sin(i*.5)*.4,.1,Math.cos(i*.5)*.25],[.12,.12,.12],cream);}
 if(d==='pig'){tube(hips,[[0,0,-.25],[0,.05,-.6],[.15,.13,-.7],[.2,.25,-.6],[.05,.25,-.55]],.055,pink);if(hood){const h=anchor('Head');ball(h,[0,.45,.02],[.68,.54,.59],main);for(const side of [-1,1]){const ear=cone(h,[side*.5,.95,0],.24,.4,pink);ear.rotation.z=side*.35;ball(h,[side*.24,.5,.57],[.08,.09,.04],dark);}ball(h,[0,.3,.64],[.29,.19,.14],pink);for(const side of [-1,1])ball(h,[side*.1,.3,.77],[.04,.06,.025],dark);}}
 if(d==='angel'){for(const side of [-1,1]){for(let i=0;i<8+t;i++){const feather=ball(chest,[side*(.35+i*.085),.3+i*.055,-.25],[.14,.55-i*.02,.065],cream);feather.rotation.z=-side*(.4+i*.07);}for(let i=0;i<t;i++)ball(chest,[side*(.6+i*.13),.2,-.3],[.055,.055,.055],trim);}if(hood){const h=anchor('Head'),ring=add(h,new T.TorusGeometry(.5,.035,8,40),[0,1.15,0],[1,1,1],trim);ring.rotation.x=Math.PI/2;}}
 if(d==='centaur'){ball(hips,[0,-.22,-.8],[.55,.42,1],main);for(const side of [-1,1])for(const z of [-.55,-1.4]){ball(hips,[side*.43,-.65,z],[.13,.4,.14],main);ball(hips,[side*.43,-1,z+.08],[.19,.13,.24],dark);}tube(hips,[[0,-.1,-1.6],[0,.1,-2],[.3,.45,-2.25],[.45,.65,-2.1]],.07,trim);for(let i=0;i<6+t;i++)ball(hips,[0,.18,-.25-i*.15],[.07,.16,.11],cream);if(hood){const h=anchor('Head');for(const side of [-1,1]){tube(h,[[side*.3,.7,0],[side*.45,1.05,0],[side*.62,1.2,.15]],.035,main);ball(h,[side*.62,1.2,.15],[.12,.12,.12],trim);}}}
 if(d==='dinosaur'){for(let i=0;i<6+t;i++)cone(chest,[0,.45-i*.13,-.4],.12,.26,i%2?cream:trim);tube(hips,[[0,0,-.2],[0,-.1,-.7],[.15,-.15,-1.2],[.35,.05,-1.65]],.16,main);if(hood){const h=anchor('Head');ball(h,[0,.5,0],[.65,.5,.58],main);ball(h,[0,.4,.6],[.5,.22,.43],main);for(const side of [-1,1]){ball(h,[side*.4,.65,.4],[.1,.1,.06],cream);ball(h,[side*.4,.65,.46],[.045,.06,.025],dark);if(t===2||t===5)cone(h,[side*.33,.9,.25],.09,.38,trim);}for(let i=0;i<5;i++)cone(h,[0,.85,-.35+i*.17],.12,.25,trim);}}
 if(d==='skater'){box(chest,[0,-.2,-.4],[.72,.75,.25],main);const board=ball(chest,[0,-.25,-.65],[.25,.95,.065],cream);board.rotation.z=.25;for(const side of [-1,1])for(const y of [-.85,.3]){const wheel=add(chest,new T.CylinderGeometry(.09,.09,.12,12),[side*.27,y,-.7],[1,1,1],trim);wheel.rotation.z=Math.PI/2;}for(const side of ['LeftLeg','RightLeg']){const knee=anchor(side);ball(knee,[0,0,.18],[.22,.22,.08],dark);}if(hood){const h=anchor('Head');ball(h,[0,.65,.02],[.64,.28,.57],main);ball(h,[0,.55,.62],[.59,.07,.34],dark);}}
 if(d==='witch'){for(const side of [-1,1]){const cape=ball(chest,[side*.25,-.65,-.36],[.45,.85,.1],main);cape.rotation.z=side*.13;}ball(chest,[0,.12,.39],[.09,.12,.05],trim);if(hood){const h=anchor('Head');ball(h,[0,.65,0],[.85,.07,.73],dark);cone(h,[0,1,0],.5,.85,main);ball(h,[0,.75,.45],[.09,.09,.025],trim);}}
 if(d==='astronaut'){box(chest,[0,-.23,-.42],[.66,.7,.28],cream);for(const side of [-1,1])ball(chest,[side*.3,-.22,-.61],[.13,.4,.13],trim);box(chest,[0,-.15,.43],[.35,.3,.08],cream);for(let i=0;i<3;i++)ball(chest,[-.1+i*.1,-.12,.49],[.025,.025,.02],dark);if(hood){const h=anchor('Head'),glass=mat('#adc7cf');glass.transparent=true;glass.opacity=.15;glass.depthWrite=false;ball(h,[0,.32,.1],[.79,.83,.75],glass);const seal=add(h,new T.TorusGeometry(.61,.06,8,36),[0,-.2,.04],[1,1,1],cream);seal.rotation.x=Math.PI/2;}}
 return record;}
export function attachOutfit(T,model,item,options){const record=buildOutfit(T,model,item,options);return record?registerWearable(record,'outfit'):null;}
export function disposeOutfit(record){return releaseWearable(record,()=>{
 // Nested headwear has its own owner, including asynchronous portrait textures.
 for(const headpiece of record.headpieces||[])disposeHeadgear(headpiece);
 const geometries=[],materials=[...record.materials];
 for(const r of record.surfaces){r.mesh.geometry=r.originalGeometry;r.mesh.material=r.originalMaterial;geometries.push(r.geometry);materials.push(...r.mats);}
 disposeWearableParts(record.parts,materials,geometries);
 record.extraTextures?.forEach(t=>{const key=record.sharedExtraTextures?.get(t);if(!key||!releaseOutfitTexture(key,t))disposeOutfitTexture(t);});
 releaseFabric(record);
});}

export function animateOutfit(record,time,movingRoot=null,frameDt=1/60){if(!record)return;if(record.plushMotion)animatePlushBear(record,time,movingRoot,frameDt);if(record.riceMotion||record.colaMotion||record.trafficLights)animateStreetOutfit(record,time,movingRoot,frameDt);if(record.extraStreetMotion)animateExtraStreet(record,time,movingRoot,frameDt,streetMotionStep);if(record.muttonLight)animateFaultyMutton(record.muttonLight,time);if(record.teaMotion&&movingRoot)animateTeaMotion(record.teaMotion,time,movingRoot,frameDt);if(record.flexPipe)for(let i=0;i<record.flexPipe.length;i++){const q=record.flexPipe[i],v=q.userData.pipeBend||0;q.position.x=.48*v*v+Math.sin(time*3.2-i*.42)*v*.035;q.position.z=Math.cos(time*2.7-i*.35)*v*.025;q.rotation.z=-.43*v+Math.cos(time*3.2-i*.42)*v*.05;}if(record.blinkLight){const t=(time%5.6+5.6)%5.6;record.blinkLight.emissiveIntensity=t<.12||t>.31&&t<.43||t>2.8&&t<3.05?.04:t<.65?.35:1.35;}}

// Damped spring driven by acceleration, with bounded fixed-step particle pool.
export function teaSloshStep(tilt,velocity,accelX,accelZ,dt){
 dt=Math.max(0,Math.min(.05,dt));const targetX=Math.max(-.42,Math.min(.42,-accelX*.028)),targetZ=Math.max(-.42,Math.min(.42,-accelZ*.028));
 velocity.x+=(38*(targetX-tilt.x)-8*velocity.x)*dt;velocity.y+=(38*(targetZ-tilt.y)-8*velocity.y)*dt;
 tilt.x=Math.max(-.52,Math.min(.52,tilt.x+velocity.x*dt));tilt.y=Math.max(-.52,Math.min(.52,tilt.y+velocity.y*dt));
 return tilt;
}
function animateTeaMotion(d,time,root,dt){
 dt=Math.min(.05,Math.max(.001,dt));root.getWorldPosition(d.worldPos);
 if(!d.last){d.last=d.worldPos.clone();return;}
 d.delta.copy(d.worldPos).sub(d.last);d.last.copy(d.worldPos);
 if(d.delta.length()>3){d.velocity.set(0,0,0);d.accel.set(0,0,0);return;}
 d.localVelocity.copy(d.delta).divideScalar(dt);d.accel.copy(d.localVelocity).sub(d.velocity).multiplyScalar(1/dt);d.velocity.lerp(d.localVelocity,1-Math.exp(-dt*9));
 d.group.getWorldQuaternion(d.q).invert();d.localAccel.copy(d.accel).applyQuaternion(d.q);d.localVelocity.copy(d.velocity).applyQuaternion(d.q);
 teaSloshStep(d.tilt,d.tiltVelocity,d.localAccel.x,d.localAccel.z,dt);
 const attr=d.milk.geometry.attributes.position,tx=d.tilt.x,tz=d.tilt.y,speed=Math.hypot(d.localVelocity.x,d.localVelocity.z),vertical=d.localVelocity.y;
 for(let i=0;i<attr.count;i++){const x=d.vertices[i*3],y=d.vertices[i*3+1],z=d.vertices[i*3+2];const w=Math.max(0,(y+.66)/1.32),wave=(tx*x+tz*z+.017*Math.sin(time*7+x*9+z*5)*Math.min(1,speed/3))*w;
  const ny=Math.min(.81,y+wave);const shrink=1+Math.min(0,wave)*.15*w;attr.setXYZ(i,x*shrink,ny,z*shrink);}
 attr.needsUpdate=true;d.milk.geometry.computeVertexNormals();
 for(let i=0;i<d.rest.length;i++){const [x,y,z,size,a]=d.rest[i],j=Math.min(1,speed*.12+Math.abs(vertical)*.12+Math.hypot(tx,tz)*2),px=x+tx*.18+Math.sin(time*7+a)*.025*j,pz=z+tz*.18+Math.cos(time*6+a)*.025*j,r=Math.hypot(px,pz),limit=.32+y*.11-size,k=r>limit?limit/r:1;
  d.dummy.position.set(px*k,Math.max(size+.06,y+Math.sin(time*9+a)*.045*j),pz*k);d.dummy.rotation.set(0,-a+time*j*.3,0);d.dummy.scale.setScalar(size);d.dummy.updateMatrix();d.pearls.setMatrixAt(i,d.dummy.matrix);}
 d.pearls.instanceMatrix.needsUpdate=true;
 for(const {mesh,x,z,a} of d.cubes){mesh.position.set(x+tx*.07,Math.min(1.49,1.31+tx*x+tz*z),z+tz*.07);mesh.rotation.x=tx*.8+Math.sin(time*4+a)*.08;mesh.rotation.z=-tz*.8;}
 // Launch at the high rim during running or flight, then integrate in world
 // space. A reused pool prevents new objects or geometries on each spill.
 const effort=Math.max(0,(speed-4.5)*1.1,Math.abs(vertical)-1.8,Math.hypot(tx,tz)*13-3);
 d.credit=Math.min(4,d.credit+effort*dt*9);
 d.group.updateWorldMatrix(true,false);d.inverse.copy(d.group.matrixWorld).invert();
 while(d.credit>=1){d.credit--;const part=d.particles[d.next];d.next=(d.next+1)%d.particles.length;const a=Math.atan2(tz,tx)+(Math.sin(d.next*8.2+time)*.8);part.age=0;part.p.set(Math.cos(a)*.55,1.51,Math.sin(a)*.55).applyMatrix4(d.group.matrixWorld);part.v.set(Math.cos(a)*1.8,1.3+Math.abs(vertical)*.12,Math.sin(a)*1.8).applyQuaternion(d.q.clone().invert()).addScaledVector(d.velocity,.45);}
 for(let i=0;i<d.particles.length;i++){const part=d.particles[i];part.age+=dt;if(part.age<1){part.v.y-=8.4*dt;part.v.multiplyScalar(Math.exp(-.6*dt));part.p.addScaledVector(part.v,dt);d.dummy.position.copy(part.p).applyMatrix4(d.inverse);const size=.035*(1-part.age*.5);d.dummy.scale.set(size,size*(1+Math.abs(part.v.y)*.13),size);}else{d.dummy.position.set(0,1.45,0);d.dummy.scale.setScalar(0);}d.dummy.rotation.set(0,0,0);d.dummy.updateMatrix();d.drops.setMatrixAt(i,d.dummy.matrix);}d.drops.instanceMatrix.needsUpdate=true;
}
