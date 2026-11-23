import {createHeadgear} from './headgear-model.js';
// Clothing uses the original skinned surface, preserving animation and exposed face/hands.
function fabric(T,item){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle=item.color;x.fillRect(0,0,512,512);
 // The Collector's suit uses a restrained pinstripe rather than the ordinary
 // playful outfit print. This texture is applied to the original skinned body.
 if(item.design==='suit'){
  x.fillStyle='#c6c9dc';x.globalAlpha=.10;
  for(let px=15;px<512;px+=27)x.fillRect(px,0,1,512);
  x.globalAlpha=1;
  const texture=new T.CanvasTexture(c);
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
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=2;return texture;
 }
 x.strokeStyle='#f6eee2';x.fillStyle='#f3eadb';x.lineWidth=5;const p=item.pattern;
 if(p===0){for(let i=-512;i<1024;i+=48){x.beginPath();x.moveTo(i,0);x.lineTo(i+512,512);x.stroke();}}
 if(p===2){x.globalAlpha=.3;for(let i=0;i<512;i+=64){x.fillRect(i,0,22,512);x.fillRect(0,i,512,22);}x.globalAlpha=1;}
 for(let y=32;y<512;y+=96)for(let xx=32;xx<512;xx+=96){x.save();x.translate(xx+(y%192?20:0),y);x.fillStyle=(xx+y)%192?'#eee4d8':'#756b85';x.globalAlpha=.7;if(p===1||p===4){x.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,r=k%2?6:15;x.lineTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();x.fill();}else if(p===3){for(const [a,b,r]of [[0,0,12],[-9,-11,6],[9,-11,6]]){x.beginPath();x.arc(a,b,r,0,Math.PI*2);x.fill();}}else{x.beginPath();x.ellipse(0,0,11,7,-.4,0,Math.PI*2);x.fill();}x.restore();}
 // Fine woven threads remain subtle, with no additional draw calls.
 x.globalAlpha=.08;x.fillStyle='#ffffff';for(let i=0;i<512;i+=4){x.fillRect(i,0,1,512);x.fillRect(0,i,512,1);}const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=2;return texture;}
export function attachOutfit(T,model,item,{hood=true}={}){if(!item)return null;model.updateMatrixWorld(true);const bones=new Map();model.traverse(o=>{if(o.isBone)bones.set(o.name.replace(/^mixamorig/,''),o);});const head=bones.get('Head');if(!head)return null;const top=bones.get('HeadTop_End'),height=top?head.getWorldPosition(new T.Vector3()).distanceTo(top.getWorldPosition(new T.Vector3())):.28,forward=head.getWorldQuaternion(new T.Quaternion()),texture=fabric(T,item),record={id:item.id,parts:[],surfaces:[],texture};
 const meshes=[];model.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.skinIndex)meshes.push(o);});
 for(const mesh of meshes){const originalGeometry=mesh.geometry,originalMaterial=mesh.material,geometry=originalGeometry.clone(),si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight,mask=new Float32Array(si.count);for(let i=0;i<si.count;i++)for(let k=0;k<4;k++){const idx=si.array[i*si.itemSize+k],name=mesh.skeleton.bones[idx]?.name||'';if(/Hips|Spine|Arm|Leg|Foot|Toe/.test(name))mask[i]+=sw.array[i*sw.itemSize+k];}geometry.setAttribute('outfitMask',new T.BufferAttribute(mask,1));const mats=(Array.isArray(originalMaterial)?originalMaterial:[originalMaterial]).map(source=>{const m=source.clone(),before=source.onBeforeCompile,key=source.customProgramCacheKey();m.onBeforeCompile=function(shader){before.call(m,shader);shader.uniforms.outfitFabric={value:texture};shader.vertexShader='attribute float outfitMask;varying float vOutfitMask;varying vec2 vOutfitUV;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOutfitMask=outfitMask;vOutfitUV=uv*3.;');shader.fragmentShader='uniform sampler2D outfitFabric;varying float vOutfitMask;varying vec2 vOutfitUV;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 cloth=texture2D(outfitFabric,vOutfitUV).rgb;float shade=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.4,1.);diffuseColor.rgb=mix(diffuseColor.rgb,cloth*(.82+.18*shade),smoothstep(.35,.8,vOutfitMask));`);};m.customProgramCacheKey=()=>key+'-outfit-'+item.id;m.needsUpdate=true;return m;});mesh.geometry=geometry;mesh.material=Array.isArray(originalMaterial)?mats:mats[0];record.surfaces.push({mesh,originalGeometry,originalMaterial,geometry,mats});}
 const materials=[],mat=(color,metal=0)=>{const m=new T.MeshStandardMaterial({color,roughness:.72,metalness:metal});materials.push(m);return m;},main=mat(item.color),cream=mat('#e8dfcf'),dark=mat('#514b62'),trim=mat('#c9b58b',.3),pink=mat('#c597a2');record.materials=materials;
 function anchor(name){const bone=bones.get(name)||head,g=new T.Group(),scale=bone.getWorldScale(new T.Vector3());g.name=item.id;g.userData.outfit=item.id;bone.add(g);g.quaternion.copy(bone.getWorldQuaternion(new T.Quaternion()).invert().multiply(forward));g.scale.set(height/scale.x,height/scale.y,height/scale.z);record.parts.push(g);return g;}
 const add=(g,geo,p,scale,m=main)=>{const o=new T.Mesh(geo,m);o.position.set(...p);o.scale.set(...scale);g.add(o);return o;},ball=(g,p,s,m=main)=>add(g,new T.SphereGeometry(1,16,12),p,s,m),box=(g,p,s,m=main)=>add(g,new T.BoxGeometry(1,1,1),p,s,m),cone=(g,p,r,h,m=main)=>add(g,new T.ConeGeometry(r,h,12),p,[1,1,1],m),tube=(g,pts,r,m=main)=>add(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),18,r,6,false),[0,0,0],[1,1,1],m);
 const chest=anchor('Spine2'),hips=anchor('Hips'),d=item.design,t=item.tier;
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
  if(hood){
   // The original headgear sculptor also provides the matching outfit hood.
   // A separate HEAD-slot item suppresses this hood, never the whole suit.
   const h=anchor('Head'),headpiece=createHeadgear(T,{...item,design:kind});
   h.add(headpiece);headpiece.position.set(0,.20,.04);
   record.materials.push(...(headpiece.userData.materials||[]));
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
export function disposeOutfit(record){if(!record)return;for(const r of record.surfaces){r.mesh.geometry=r.originalGeometry;r.mesh.material=r.originalMaterial;r.geometry.dispose();r.mats.forEach(m=>m.dispose());}const geometries=new Set();for(const root of record.parts){root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});root.removeFromParent();}geometries.forEach(g=>g.dispose());record.materials.forEach(m=>m.dispose());record.texture.dispose();}
