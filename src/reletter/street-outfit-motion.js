import {staticPaintTexture} from '../paint-texture-source.js';
import {acquireOutfitTexture} from '../shared-render-resources.js';
const TAU=Math.PI*2;
function part(T,g,geo,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o;}
function sphere(T,g,mat,x,y,z,sx,sy,sz){return part(T,g,new T.SphereGeometry(1,16,10),mat,x,y,z,sx,sy,sz);}
function tex(T,record,w,h,paint,key=null){
 const create=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=staticPaintTexture(T,c);t.colorSpace=T.SRGBColorSpace;return t;};
 const t=key?acquireOutfitTexture(key,create):create();
 if(key)(record.sharedExtraTextures??=new Map()).set(t,key);
 record.extraTextures??=[];record.extraTextures.push(t);return t;
}
function flexible(record,mesh,amp,kind){record.softMeshes??=[];record.softMeshes.push({mesh,base:mesh.geometry.attributes.position.array.slice(),amp,kind});}
export function buildSoftGarbage(T,g,record,mat){
 const plastic=mat('#111315',.06);plastic.roughness=.29;plastic.side=T.DoubleSide;
 const profile=[[.04,.025],[.29,.035],[.42,.11],[.48,.25],[.49,.44],[.43,.63],[.32,.78],[.18,.85],[.12,.91],[.15,.97]];
 const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),48),a=geo.attributes.position;
 for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),ang=Math.atan2(z,x),r=1+.07*Math.sin(ang*11+y*8)+.035*Math.sin(ang*23-y*21);a.setXYZ(i,x*r,y+.018*Math.sin(ang*8)*Math.sin(y*Math.PI),z*r);}
 geo.computeVertexNormals();const shell=part(T,g,geo,plastic);flexible(record,shell,.065,'garbage');
 const dark=mat('#08090a');const hole=part(T,g,new T.CircleGeometry(.108,32),dark,0,.89,0);hole.rotation.x=-Math.PI/2;
 const rim=part(T,g,new T.TorusGeometry(.135,.018,7,32),plastic,0,.94,0);rim.rotation.x=Math.PI/2;
 const flap=part(T,g,new T.PlaneGeometry(.27,.19,8,5),plastic,-.13,.91,0);flap.rotation.z=.6;flexible(record,flap,.035,'flap');
}

function paintCardboard(x,w,h,printed){
 let seed=92831;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 x.fillStyle='#b99a69';x.fillRect(0,0,w,h);
 for(let i=0;i<2400;i++){const a=rand()*w,b=rand()*h;x.fillStyle=i%3?'rgba(79,52,26,.075)':'rgba(247,224,172,.16)';x.fillRect(a,b,1+rand()*5,.6+rand()*2);}
 if(printed){
  const red='#aa332e',green='#38664a';x.fillStyle=red;
  for(const y of [38,51,77,90])x.fillRect(0,y,w,4);
  // Traditional fruit carton: ribbon, vertical red lettering, Taiwan mark and paired yellow fruit.
  x.save();x.translate(256,65);x.strokeStyle=red;x.lineWidth=9;x.lineJoin='round';
  for(const sign of [-1,1]){x.save();x.scale(sign,1);x.beginPath();x.moveTo(4,0);x.bezierCurveTo(20,-37,75,-47,77,-12);x.bezierCurveTo(80,18,30,18,4,0);x.moveTo(9,6);x.quadraticCurveTo(32,36,69,47);x.moveTo(15,3);x.quadraticCurveTo(36,23,76,27);x.stroke();x.restore();}
  x.beginPath();x.ellipse(0,0,9,15,0,0,TAU);x.stroke();x.restore();
  x.textAlign='center';x.font='bold 67px "Noto Serif TC","PingFang TC","Microsoft JhengHei",serif';x.fillStyle=red;
  x.fillText('高',452,195);x.fillText('級',452,274);x.fillText('水',60,333);x.fillText('果',60,414);
  x.fillStyle=green;x.fillRect(22,136,155,22);x.fillStyle='#e1c79a';x.font='bold 17px sans-serif';x.fillText('台灣鮮果',95,152);
  x.fillStyle=green;x.beginPath();x.moveTo(123,105);x.lineTo(136,91);x.lineTo(145,97);x.lineTo(143,114);x.lineTo(136,129);x.lineTo(128,151);x.lineTo(118,170);x.lineTo(111,159);x.lineTo(115,141);x.lineTo(111,126);x.closePath();x.fill();
  x.save();x.translate(263,356);x.strokeStyle=green;x.lineWidth=9;x.beginPath();x.moveTo(4,3);x.quadraticCurveTo(3,-63,57,-98);x.moveTo(6,-35);x.quadraticCurveTo(-32,-73,-77,-62);x.stroke();
  for(const [a,b,rot,rx,ry] of [[-63,-77,-.3,50,20],[-24,-112,.37,44,22],[51,-80,-.6,38,17],[-78,-30,-.7,37,17],[19,88,-.9,36,16]]){
   x.save();x.translate(a,b);x.rotate(rot);x.fillStyle=green;x.beginPath();x.moveTo(-rx,0);x.quadraticCurveTo(0,-ry*1.7,rx,0);x.quadraticCurveTo(0,ry*1.7,-rx,0);x.fill();x.strokeStyle='#9a9c57';x.lineWidth=1.6;x.beginPath();x.moveTo(-rx*.83,0);x.quadraticCurveTo(0,-4,rx*.83,0);x.stroke();x.restore();
  }
  for(const [a,b,rot,rx,ry] of [[-34,13,-.35,52,64],[45,-3,.16,55,62]]){
   x.save();x.translate(a,b);x.rotate(rot);x.fillStyle='#d4b848';x.strokeStyle=green;x.lineWidth=4;x.beginPath();x.moveTo(0,-ry*.86);x.bezierCurveTo(-rx,-ry*1.1,-rx*1.25,-ry*.13,-rx*.82,ry*.55);x.bezierCurveTo(-rx*.44,ry*1.15,rx*.48,ry*1.15,rx*.85,ry*.48);x.bezierCurveTo(rx*1.19,-ry*.28,rx*.82,-ry*1.05,0,-ry*.86);x.fill();x.stroke();
   x.strokeStyle='#8c9146';x.lineWidth=2;x.beginPath();x.ellipse(-3,3,rx*.82,ry*.82,0,.3,Math.PI*1.8);x.stroke();
   x.fillStyle='rgba(78,102,50,.32)';for(let j=0;j<115;j++){const px=(rand()-.5)*rx*1.6,py=(rand()-.5)*ry*1.6;if(px*px/(rx*rx)+py*py/(ry*ry)<.7)x.fillRect(px,py,1.1+rand()*1.2,1.2);}
   x.restore();
  }x.restore();
  x.fillStyle='#745731';x.font='bold 17px sans-serif';x.fillText('產地：台灣　　嚴禁重壓',256,486);
 }else{
  x.strokeStyle='#63744d';x.lineWidth=3;x.strokeRect(32,50,w-64,135);x.beginPath();x.moveTo(32,100);x.lineTo(w-32,100);x.moveTo(32,145);x.lineTo(w-32,145);x.stroke();
  x.fillStyle='#63744d';x.font='bold 22px sans-serif';x.fillText('品名：水果',45,84);x.fillText('產地：台灣',45,133);x.fillText('重量：________',45,175);
 }
 // Creases and grime are printed into the same UV surface, not floating decals.
 for(let i=0;i<27;i++){const a=rand()*w,b=rand()*h,len=25+rand()*145,dx=(rand()-.5)*len,dy=10+rand()*len;
  x.strokeStyle='rgba(75,46,25,.20)';x.lineWidth=1+rand()*4;x.beginPath();x.moveTo(a,b);x.lineTo(a+dx*.36,b+dy*.44);x.lineTo(a+dx,b+dy);x.stroke();
  x.strokeStyle='rgba(240,216,167,.35)';x.lineWidth=1.3;x.beginPath();x.moveTo(a+2,b);x.lineTo(a+dx*.36+2,b+dy*.44);x.lineTo(a+dx+2,b+dy);x.stroke();}
 for(let i=0;i<160;i++){const edge=i%4,a=edge===0?rand()*45:edge===1?w-rand()*45:rand()*w,b=edge===2?rand()*55:edge===3?h-rand()*80:rand()*h;x.fillStyle='rgba(62,42,23,.09)';x.beginPath();x.ellipse(a,b,2+rand()*17,1+rand()*8,rand()*TAU,0,TAU);x.fill();}
}
export function buildSoftCardboard(T,g,record,mat){
 const card=mat('#ffffff'),printed=mat('#ffffff'),inner=mat('#795b39');
 for(const m of [card,printed,inner]){m.side=T.DoubleSide;m.roughness=.96;}
 card.map=tex(T,record,512,512,(x,w,h)=>paintCardboard(x,w,h,false),'street:cardboard-plain-v143');
 printed.map=tex(T,record,512,512,(x,w,h)=>paintCardboard(x,w,h,true),'street:cardboard-fruit-v143');
 record.cardboard={walls:[],flaps:[]};
 for(let side=0;side<4;side++){
  const width=side%2?.65:.78,geo=new T.PlaneGeometry(width,.96,18,22),a=geo.attributes.position;
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),y=a.getY(i),e=Math.max(0,1-4*x*x/(width*width))*Math.max(0,1-4*y*y/(.96*.96));
   const fold=Math.exp(-((x+y*.35-.09*Math.sin(side+1))**2)/.0025),fold2=Math.exp(-((y-x*.63+.19)**2)/.0035);
   const dent=.065*Math.exp(-((x+.14*Math.cos(side))**2+(y-.17)**2)/.025);
   a.setZ(i,e*(-dent-.033*fold-.022*fold2+.012*Math.sin(x*37+y*19+side)));
  }geo.computeVertexNormals();
  const wall=part(T,g,geo,side%2?card:printed,0,.53,0);
  wall.rotation.y=side*Math.PI/2;wall.position.x=Math.sin(wall.rotation.y)*.39;wall.position.z=Math.cos(wall.rotation.y)*.325;
  record.cardboard.walls.push({mesh:wall,base:a.array.slice(),side,width});
  const hinge=new T.Group();hinge.position.copy(wall.position);hinge.position.y=1.01;hinge.rotation.order='YXZ';hinge.rotation.y=wall.rotation.y;g.add(hinge);
  const flap=part(T,hinge,new T.PlaneGeometry(width,.32,14,8),card,0,0,-.16);flap.rotation.x=-Math.PI/2;
  const fa=flap.geometry.attributes.position;for(let i=0;i<fa.count;i++){const x=fa.getX(i),y=fa.getY(i),weight=(y+.16)/.32;fa.setZ(i,weight*(.015*Math.sin(x*19+side)-.018*Math.exp(-((x-y*.8)**2)/.008)));}flap.geometry.computeVertexNormals();
  record.cardboard.flaps.push({hinge,flap,side,base:fa.array.slice()});
 }
 part(T,g,new T.BoxGeometry(.78,.025,.65),inner,0,.05,0);
}
function animateCardboard(record,d,time){
 const box=record.cardboard;if(!box)return;
 for(const {mesh,base,side,width} of box.walls){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){
  const x=base[i*3],y=base[i*3+1],envelope=Math.max(0,1-4*x*x/(width*width))*Math.max(0,1-4*y*y/(.96*.96)),dent=(.05+.085*(.5+.5*Math.sin(time*9+side*1.8+y*10)))*d.energy*envelope;
  a.setXYZ(i,x,y,base[i*3+2]-dent+.015*d.energy*Math.sin(x*25+y*14+time*7)*envelope);
 }a.needsUpdate=true;mesh.geometry.computeVertexNormals();}
 for(const {hinge,flap,side,base} of box.flaps){flap.rotation.x=-Math.PI/2;hinge.rotation.x=d.energy*(1.50+.22*Math.sin(time*8+side));const a=flap.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=base[i*3],y=base[i*3+1],weight=(y+.16)/.32;a.setXYZ(i,x,y,base[i*3+2]+.055*d.energy*weight*Math.sin(time*10+x*11+side));}a.needsUpdate=true;flap.geometry.computeVertexNormals();}
}
export function addSwayingPoleWires(T,g,record,mat,wire){
 const cables=[];for(const y of [2.56,2.88])for(const x of [-.49,0,.49]){
  const curve=new T.CatmullRomCurve3([new T.Vector3(x,y,-.33),new T.Vector3(x,y-.12,0),new T.Vector3(x,y,.33)]);
  const geo=new T.TubeGeometry(curve,24,.014,7,false),mesh=part(T,g,geo,wire);cables.push({mesh,base:geo.attributes.position.array.slice(),phase:x*5+y});
 }
 const sparkMat=new T.LineBasicMaterial({color:'#b9edff',transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false});record.materials.push(sparkMat);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(6*9*2*3),3).setUsage(T.DynamicDrawUsage));geo.setDrawRange(0,0);
 const sparks=new T.LineSegments(geo,sparkMat);sparks.frustumCulled=false;sparks.visible=false;g.add(sparks);record.poleWires={cables,sparks};
}
function animatePole(record,d,time){
 const pole=record.poleWires;if(!pole)return;
 for(const {mesh,base,phase} of pole.cables){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=base[i*3],y=base[i*3+1],z=base[i*3+2],w=Math.max(0,1-(z/.35)**2)*d.energy;a.setXYZ(i,x+.19*w*Math.sin(time*11+phase+z*6),y-.10*w*Math.cos(time*9+phase),z+.05*w*Math.sin(time*8+phase));}a.needsUpdate=true;mesh.geometry.computeVertexNormals();}
 const {sparks}=pole;const flash=d.energy>.15&&(Math.sin(time*31)+Math.sin(time*17+1)>.15);sparks.visible=flash;if(!flash)return;
 const a=sparks.geometry.attributes.position;let n=0;for(let k=0;k<6;k++){const x=(k%3-1)*.49,y=k<3?2.56:2.88;let px=x,py=y,pz=0;for(let j=1;j<=9;j++){const t=j/9,nx=x+(k%2?1:-1)*.29*t+.045*Math.sin(time*90+j*7+k),ny=y-.22*t+.065*Math.cos(time*77+j*4+k),nz=.20*Math.sin(t*2.2+k)+.045*Math.sin(time*81+j*5);a.setXYZ(n++,px,py,pz);a.setXYZ(n++,nx,ny,nz);px=nx;py=ny;pz=nz;}}a.needsUpdate=true;sparks.geometry.setDrawRange(0,n);
}
// Finely sculpted trunk, roots and branch network, with actual individual
// leaves rather than solid green spheres. The crown sways on the GPU.
export function buildTreeDisguise(T,g,record,mat){
 const bark=mat('#ffffff');bark.vertexColors=true;bark.roughness=1;
 const pos=[],nor=[],col=[],idx=[],color=new T.Color(),dummy=new T.Object3D();
 let seed=9715;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 function branch(points,r0,r1,segments=24,sides=18){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(segments,false),offset=pos.length/3,geo=new T.BufferGeometry(),v=new T.Vector3();
  const verts=[],colors=[],faces=[];
  for(let j=0;j<=segments;j++){const t=j/segments,p=curve.getPointAt(t),r=r0+(r1-r0)*t;
   for(let i=0;i<=sides;i++){const a=i/sides*TAU,ridge=.16*Math.sin(a*9+t*5)+.10*Math.cos(a*17-t*8)+.055*Math.sin(a*29+t*19),radius=r*(1+ridge);
    v.copy(p).addScaledVector(frames.normals[j],Math.cos(a)*radius).addScaledVector(frames.binormals[j],Math.sin(a)*radius);verts.push(v.x,v.y,v.z);
    const tone=.23+.085*Math.sin(a*9+t*5)+.04*Math.sin(a*29+t*23)+rand()*.045;color.setRGB(tone*.90,tone*.66,tone*.45);colors.push(color.r,color.g,color.b);
    if(j<segments&&i<sides){const z=j*(sides+1)+i;faces.push(z,z+1,z+sides+1,z+1,z+sides+2,z+sides+1);}
   }
  }geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(faces);geo.computeVertexNormals();pos.push(...verts);nor.push(...geo.attributes.normal.array);col.push(...colors);for(const n of faces)idx.push(n+offset);geo.dispose();
 }
 branch([[0,.02,0],[-.05,.5,.02],[.035,1.0,-.02],[0,1.55,0],[.03,2.05,0]],.37,.14,44,38);
 for(let i=0;i<9;i++){const a=i*TAU/9;branch([[Math.cos(a)*.76,.025,Math.sin(a)*.76],[Math.cos(a)*.40,.13,Math.sin(a)*.40],[Math.cos(a)*.19,.56,Math.sin(a)*.19]],.065,.12,14,14);}
 const clusters=[];
 for(let k=0;k<11;k++){const a=k*2.39996,outer=.87+.35*rand(),y=1.57+rand()*.42,endY=2.15+rand()*.48,x=Math.cos(a)*outer,z=Math.sin(a)*outer;
  branch([[0,y,0],[x*.43,y+.10,z*.43],[x*.72,endY-.11,z*.72],[x,endY,z]],.115,.026,24,14);
  for(let j=0;j<4;j++){const angle=a+(j-1.5)*.61,xx=x*.66+Math.cos(angle)*(.31+rand()*.26),zz=z*.66+Math.sin(angle)*(.31+rand()*.26),yy=endY+.12+rand()*.28;branch([[x*.55,y+.25,z*.55],[x*.86,endY-.04,z*.86],[xx,yy,zz]],.047,.009,12,8);clusters.push([xx,yy,zz,.39+rand()*.16]);}
 }clusters.push([0,2.95,0,.48],[.36,2.75,.28,.49],[-.4,2.77,-.21,.48]);
 const trunk=new T.BufferGeometry();trunk.setAttribute('position',new T.Float32BufferAttribute(pos,3));trunk.setAttribute('normal',new T.Float32BufferAttribute(nor,3));trunk.setAttribute('color',new T.Float32BufferAttribute(col,3));trunk.setIndex(idx);part(T,g,trunk,bark);
 const crown=new T.Group();g.add(crown);
 const leafGeo=new T.BufferGeometry();leafGeo.setAttribute('position',new T.Float32BufferAttribute([0,-.08,0,-.035,-.025,.007,-.034,.025,.01,0,.09,0,.034,.025,.01,.035,-.025,.007,0,0,.021],3));leafGeo.setIndex([0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0,6]);leafGeo.computeVertexNormals();
 const leafMat=mat('#ffffff');leafMat.side=T.DoubleSide;leafMat.roughness=.76;
 const motion={time:{value:0},energy:{value:0}};leafMat.onBeforeCompile=shader=>{shader.uniforms.treeTime=motion.time;shader.uniforms.treeEnergy=motion.energy;shader.vertexShader='uniform float treeTime; uniform float treeEnergy;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\n float phase=dot(instanceMatrix[3].xyz,vec3(5.2,3.1,7.8)); transformed.x+=sin(treeTime*7.0+phase)*treeEnergy*0.085; transformed.z+=cos(treeTime*9.0+phase)*treeEnergy*0.055; transformed.y+=sin(treeTime*5.0+phase)*treeEnergy*0.025;\n#endif');};leafMat.customProgramCacheKey=()=> 'tree-crown-sway-v132';
 const count=clusters.length*94,leaves=new T.InstancedMesh(leafGeo,leafMat,count);let n=0;
 for(const [x,y,z,r] of clusters)for(let j=0;j<94;j++){const a=rand()*TAU,b=rand()*2-1,rr=Math.cbrt(rand())*r,s=Math.sqrt(1-b*b);dummy.position.set(x+Math.cos(a)*s*rr,y+b*rr*.82,z+Math.sin(a)*s*rr);dummy.rotation.set(rand()*TAU,rand()*TAU,rand()*TAU);const size=.51+rand()*.68;dummy.scale.set(size,size,1);dummy.updateMatrix();leaves.setMatrixAt(n,dummy.matrix);color.setHSL(.23+rand()*.09,.29+rand()*.35,.16+rand()*.22);leaves.setColorAt(n++,color);}
 leaves.computeBoundingBox();crown.add(leaves);record.treeMotion={motion,clusters,leafGeo};return {crown,trunkRadius:y=>.37+(.14-.37)*Math.max(0,Math.min(1,y/2.05))};
}

export function buildNewStreetProp(T,g,kind,record,mat){
 const packageProp=buildPackageProp(T,g,kind,record,mat);if(packageProp)return packageProp;
 const newProp=buildMobilityStreetProp(T,g,kind,record,mat);if(newProp)return newProp;
 if(kind==='pharmacy-bag-disguise'){
  const white=mat('#ffffff');white.roughness=.35;white.side=T.DoubleSide;white.alphaTest=.5;
  white.map=tex(T,record,512,1024,(x,w,h)=>{x.scale(1,1024/800);h=800;
   x.fillStyle='#e6e7e1';x.fillRect(0,0,w,h);
   const shades=x.createLinearGradient(0,0,w,0);shades.addColorStop(0,'rgba(100,110,105,.25)');shades.addColorStop(.16,'rgba(255,255,255,.55)');shades.addColorStop(.47,'rgba(255,255,255,0)');shades.addColorStop(.83,'rgba(130,145,135,.12)');shades.addColorStop(1,'rgba(100,110,105,.25)');x.fillStyle=shades;x.fillRect(0,0,w,h);
   x.fillStyle='#126343';x.textAlign='center';x.font='bold 39px sans-serif';x.fillText('健保特約藥局',w/2,188);x.font='bold 28px sans-serif';x.fillText('ⓗ  社區藥局',w/2,238);x.font='18px sans-serif';x.fillText('全民健康保險特約藥局',w/2,270);
   x.strokeStyle='#216745';x.lineWidth=2;x.strokeRect(27,300,458,390);x.beginPath();x.moveTo(27,354);x.lineTo(485,354);x.moveTo(27,525);x.lineTo(485,525);x.moveTo(91,354);x.lineTo(91,690);x.stroke();
   x.textAlign='left';x.font='19px sans-serif';x.fillText('姓名：____________　日期：________',41,333);
   x.fillText('內',47,399);x.fillText('服',47,430);x.fillText('藥',47,461);x.fillText('外',47,563);x.fillText('用',47,594);x.fillText('藥',47,625);
   for(const [i,line] of ['每日 ____ 次，每次 ____ 粒','飯前　飯後　睡前','早　午　晚　睡前服用','用藥方式依藥師指示','每日 ____ 次，適量使用','患部清潔後使用'].entries()){const yy=386+i*48+(i>3?9:0);x.strokeRect(105,yy-15,15,15);x.fillText(line,130,yy);}
   x.fillStyle='#17694a';x.fillRect(0,711,w,89);x.fillStyle='#f3f3e9';x.textAlign='center';x.font='21px sans-serif';x.fillText('用藥安全　請依藥師指示',w/2,751);x.font='15px sans-serif';x.fillText('請將藥品放置於兒童不易取得之處',w/2,780);
   x.globalCompositeOperation='destination-out';x.beginPath();x.moveTo(172,43);x.lineTo(340,43);x.quadraticCurveTo(368,43,368,71);x.lineTo(368,77);x.quadraticCurveTo(368,105,340,105);x.lineTo(172,105);x.quadraticCurveTo(144,105,144,77);x.lineTo(144,71);x.quadraticCurveTo(144,43,172,43);x.closePath();x.fill();x.globalCompositeOperation='source-over';
  });
  for(const side of [1,-1]){const geo=new T.PlaneGeometry(1.05,2,24,36),a=geo.attributes.position;
   for(let i=0;i<a.count;i++){const xx=a.getX(i),yy=a.getY(i)+1,bulge=Math.max(0,Math.sin(Math.PI*(xx/1.05+.5)))*Math.max(0,Math.sin(Math.PI*yy/2));a.setXYZ(i,xx*(.93+.07*Math.sin(yy*2.1)),yy,side*(.018+.23*bulge+.016*Math.sin(xx*39+yy*7)*bulge));}
   if(side<0){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
   geo.computeVertexNormals();const sheet=part(T,g,geo,white);flexible(record,sheet,.085,'pharmacy');
  }
  return {openingY:.87,frontZ:.25};
 }
 if(kind==='goldfish-bowl-disguise'){
  const glass=mat('#d5f2f7');glass.transparent=true;glass.opacity=.27;glass.roughness=.12;glass.depthWrite=false;glass.side=T.DoubleSide;
  const water=mat('#73c8e3');water.transparent=true;water.opacity=.29;water.roughness=.16;water.depthWrite=false;water.side=T.DoubleSide;
  const profile=[[.26,.025],[.46,.07],[.64,.21],[.76,.45],[.78,.68],[.72,.88],[.62,1.04],[.51,1.14],[.51,1.18]];
  const shell=part(T,g,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),56),glass);shell.renderOrder=4;
  const rim=part(T,g,new T.TorusGeometry(.51,.025,10,56),glass,0,1.17,0);rim.rotation.x=Math.PI/2;rim.renderOrder=5;
  const volume=part(T,g,new T.LatheGeometry(profile.filter(p=>p[1]<=1.04).map(p=>new T.Vector2(...p)),48),water);volume.renderOrder=1;
  const surface=part(T,g,new T.CircleGeometry(.62,48),water,0,1.04,0);surface.rotation.x=-Math.PI/2;surface.renderOrder=3;
  const gold=mat('#f47b19'),fin=mat('#ffb84b'),eye=mat('#160f0b'),white=mat('#fff1ce');fin.side=T.DoubleSide;
  const fish=[];
  for(let i=0;i<2;i++){const f=new T.Group();g.add(f);sphere(T,f,gold,0,0,0,.14,.085,.071);
   sphere(T,f,white,.079,.01,.057,.026,.024,.012);sphere(T,f,white,.079,.01,-.057,.026,.024,.012);sphere(T,f,eye,.085,.01,.066,.012,.013,.008);sphere(T,f,eye,.085,.01,-.066,.012,.013,.008);
   const tail=new T.Group();tail.position.x=-.12;f.add(tail);
   const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(-.12,.11,-.23,.11);shape.lineTo(-.17,0);shape.lineTo(-.23,-.11);shape.quadraticCurveTo(-.10,-.09,0,0);const t=part(T,tail,new T.ShapeGeometry(shape),fin);t.rotation.y=.10;
   const dorsal=new T.Shape();dorsal.moveTo(-.08,.045);dorsal.quadraticCurveTo(-.03,.17,.07,.06);dorsal.lineTo(-.08,.045);part(T,f,new T.ShapeGeometry(dorsal),fin);
   f.position.set(i?-.31:.31,.63,0);fish.push({f,tail});
  }
  record.fishBowl={surface,fish,slosh:0,jumpAge:99,wasAir:false};
  return {openingY:1.04,frontZ:0,waterHead:true};
 }
 return null;
}
function batch(T,g,geo,mat,count){
 const mesh=new T.InstancedMesh(geo,mat,count);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;g.add(mesh);
 return {mesh,particles:Array.from({length:count},()=>({age:99,life:0,p:new T.Vector3(),v:new T.Vector3(),angle:0,size:1,floor:0})),next:0};
}
const CHIMNEY_DENSITY=5;
function smokeBatch(T,g,record){
 const texture=tex(T,record,64,64,(x)=>{const radial=x.createRadialGradient(32,32,1,32,32,31);radial.addColorStop(0,'rgba(17,16,18,.78)');radial.addColorStop(.4,'rgba(22,20,22,.55)');radial.addColorStop(1,'rgba(25,24,25,0)');x.fillStyle=radial;x.fillRect(0,0,64,64);},'street:chimney-smoke-v143');
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});record.materials.push(material);
 // One camera-facing instanced batch replaces individual sprite draws.
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
  mat4 puffMV=modelViewMatrix*instanceMatrix;
  vec4 mvPosition=puffMV*vec4(0.0,0.0,0.0,1.0);
  mvPosition.xy+=position.xy*vec2(length(puffMV[0].xyz),length(puffMV[1].xyz));
  gl_Position=projectionMatrix*mvPosition;
 `);};
 material.customProgramCacheKey=()=> 'chimney-billboard-v143';
 const count=24*CHIMNEY_DENSITY,mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,count);
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;g.add(mesh);
 return {mesh,particles:Array.from({length:count},()=>({p:new T.Vector3(),v:new T.Vector3(),age:99,life:0,size:1})),next:0};
}
function envelopeGeometry(T){const shape=new T.Shape();shape.moveTo(-.11,-.07);shape.lineTo(.11,-.07);shape.lineTo(.11,.07);shape.lineTo(-.11,.07);shape.closePath();const geo=new T.ShapeGeometry(shape),uv=geo.attributes.uv,a=geo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,a.getX(i)/.22+.5,a.getY(i)/.14+.5);return geo;}
export function attachStreetMotion(T,g,kind,record,mat){
 if(!['chimney-disguise','trash-can-disguise','garbage-bag-disguise','fried-chicken-disguise','postbox-disguise','pharmacy-bag-disguise','goldfish-bowl-disguise','cardboard-disguise','utility-pole-disguise','tree-disguise','gg-noodle-disguise','wheelchair-disguise','joss-burner-disguise','naughty-snack-disguise','taiwan-beer-disguise'].includes(kind))return;
 const d={T,g,kind,pos:new T.Vector3(),last:null,delta:new T.Vector3(),inverse:new T.Matrix4(),dummy:new T.Object3D(),origin:new T.Vector3(),local:new T.Vector3(),worldScale:new T.Vector3(),run:0,air:0,grace:0,elapsed:0,credit:0,energy:0,floor:null,batches:[],seed:7823};
 record.extraStreetMotion=d;
 if(record.noodleProp||record.chairProp||record.burnerProp){attachMobilityMotion(T,g,record,mat,d);return;}
 const twoSided=color=>{const m=mat(color);m.side=T.DoubleSide;return m;};
 const add=(geo,m,n)=>{const b=batch(T,g,geo,m,n);d.batches.push(b);return b;};
 if(record.cardboard||record.snackProp||record.beerProp){attachFoodSpill(T,g,record,mat,d);}
 if(kind==='chimney-disguise')d.smoke=smokeBatch(T,g,record);
 if(kind==='tree-disguise'){const leaf=mat('#62813c');leaf.side=T.DoubleSide;leaf.roughness=.85;add(record.treeMotion.leafGeo.clone(),leaf,220);}
 if(kind==='fried-chicken-disguise')add(new T.IcosahedronGeometry(1,0),mat('#d69a4a'),32);
 if(kind==='pharmacy-bag-disguise'){for(const color of ['#d92332','#2867d9']){const cap=mat(color);cap.roughness=.29;add(new T.CapsuleGeometry(.028,.068,5,12),cap,14);}}
 if(kind==='garbage-bag-disguise'){
  const can=mat('#bfc3c6',.6);can.map=tex(T,record,128,64,(x,w,h)=>{x.fillStyle='#a4a9a8';x.fillRect(0,0,w,h);x.fillStyle='#d3542c';x.fillRect(0,12,w,39);x.fillStyle='#eee0bb';x.font='bold 20px sans-serif';x.fillText('FOOD',11,37);});add(new T.CylinderGeometry(.065,.065,.145,16),can,7);
  add(new T.IcosahedronGeometry(.1,1),mat('#e8e3d5'),8);
  const carton=mat('#e7f0da');carton.map=tex(T,record,128,128,(x,w,h)=>{x.fillStyle='#eff0d7';x.fillRect(0,0,w,h);x.fillStyle='#269a75';x.fillRect(0,18,w,65);x.fillStyle='#fff';x.font='bold 27px sans-serif';x.fillText('DRINK',9,60);});add(new T.BoxGeometry(.11,.18,.075),carton,7);
 }
 if(kind==='postbox-disguise'){const mail=twoSided('#f4ead5');mail.map=tex(T,record,128,80,(x,w,h)=>{x.fillStyle='#f5ecd9';x.fillRect(0,0,w,h);x.strokeStyle='#a49880';x.beginPath();x.moveTo(0,0);x.lineTo(w/2,h*.64);x.lineTo(w,0);x.stroke();x.fillStyle='#a74438';x.fillRect(w-24,5,18,19);});add(envelopeGeometry(T),mail,22);}
 if(kind==='goldfish-bowl-disguise'){const water=mat('#9bdcf5');water.transparent=true;water.opacity=.7;water.roughness=.13;add(new T.SphereGeometry(1,8,6),water,28);}
 if(kind==='trash-can-disguise'){
  const fur=mat('#77706b'),pink=mat('#cf9a94'),black=mat('#151515');
  const rat=new T.Group();g.add(rat);rat.visible=false;d.rat=rat;d.ratAge=99;d.ratPos=new T.Vector3();d.ratVelocity=new T.Vector3();d.ratDirection=new T.Vector3();d.ratLegs=[];
  sphere(T,rat,fur,0,0,0,.13,.085,.075);sphere(T,rat,fur,.10,.015,0,.075,.06,.054);
  for(const z of [-.045,.045]){sphere(T,rat,pink,.065,.065,z,.036,.036,.015);sphere(T,rat,black,.13,.035,z,.012,.012,.012);}
  sphere(T,rat,pink,.169,.01,0,.019,.015,.018);for(const x of [-.08,.075])for(const z of [-.055,.055])d.ratLegs.push(sphere(T,rat,fur,x,-.065,z,.031,.055,.023));
  const curve=new T.CatmullRomCurve3([new T.Vector3(-.1,0,0),new T.Vector3(-.2,-.01,.025),new T.Vector3(-.29,.025,.06),new T.Vector3(-.36,.025,.01)]);part(T,rat,new T.TubeGeometry(curve,12,.013,5,false),pink);
  d.flies=[];const wing=twoSided('#d6e2df');wing.transparent=true;wing.opacity=.55;
  for(let i=0;i<9;i++){const f=new T.Group();g.add(f);f.visible=false;sphere(T,f,black,0,0,0,.023,.017,.033);const w1=sphere(T,f,wing,-.029,.012,0,.035,.005,.018),w2=sphere(T,f,wing,.029,.012,0,.035,.005,.018);d.flies.push({f,w1,w2});}
 }
}
function rng(d){d.seed=(Math.imul(d.seed,1664525)+1013904223)>>>0;return d.seed/4294967296;}
function emit(d,b,x,y,z,speed,up,size,life){
 const p=b.particles[b.next++%b.particles.length],a=rng(d)*TAU;
 p.age=0;p.life=life;p.size=size;p.angle=rng(d)*TAU;p.floor=d.floor??d.pos.y;
 p.p.copy(d.origin.set(x,y,z)).applyMatrix4(d.g.matrixWorld);p.v.set(Math.cos(a)*speed,up,Math.sin(a)*speed);if(d.kind==='postbox-disguise'){p.v.set((rng(d)-.5)*.8,0,1).transformDirection(d.g.matrixWorld).multiplyScalar(speed);p.v.y=up;}
}
function updateBatch(d,b,dt){
 let n=0;const dummy=d.dummy;
 for(const p of b.particles){if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life)continue;
  if(d.kind==='tree-disguise'||d.kind==='joss-burner-disguise'){p.v.y=Math.max(-1.9,p.v.y-2.3*dt);p.v.x+=Math.sin(p.age*8+p.angle)*.9*dt;p.v.z+=Math.cos(p.age*7+p.angle)*.9*dt;}else p.v.y-=9.8*dt;p.p.addScaledVector(p.v,dt);if(p.p.y<p.floor+.035){p.p.y=p.floor+.035;p.v.y=0;p.v.x*=.65;p.v.z*=.65;}
  dummy.position.copy(d.local.copy(p.p).applyMatrix4(d.inverse));dummy.rotation.set(p.angle+p.age*4,p.angle+p.age*3,p.angle*.5+p.age*2);dummy.scale.setScalar(p.size*Math.min(1,(p.life-p.age)*5));dummy.updateMatrix();b.mesh.setMatrixAt(n++,dummy.matrix);
 }
 b.mesh.count=n;b.mesh.visible=n>0;if(n)b.mesh.instanceMatrix.needsUpdate=true;
}
export function animateExtraStreet(record,time,root,dt,streetMotionStep){
 const d=record.extraStreetMotion;if(!d||!root)return;dt=Math.max(.001,Math.min(.1,dt));root.getWorldPosition(d.pos);
 if(!d.last){d.last=d.pos.clone();d.floor=d.pos.y;return;}
 d.delta.copy(d.pos).sub(d.last);d.last.copy(d.pos);
 const speed=Math.hypot(d.delta.x,d.delta.z)/dt,mode=root.userData?.current,teleport=d.delta.length()>3;
 const airborne=['jump','fall','fly'].includes(mode)||Math.abs(d.delta.y/dt)>.5,moving=!teleport&&speed>.18;
 if(!airborne||teleport)d.floor=d.pos.y;
 const active=streetMotionStep(d,dt,moving,airborne,teleport);
 d.energy+=((moving||airborne?1:0)-d.energy)*(1-Math.exp(-dt*10));d.elapsed+=dt;
 let scale=1;
 if(d.batches.length||d.smoke||d.rat){d.g.updateWorldMatrix(true,false);d.inverse.copy(d.g.matrixWorld).invert();if(d.rat){d.g.matrixWorld.decompose(d.origin,d.dummy.quaternion,d.worldScale);scale=Math.max(.001,d.worldScale.y);}}
 if(teleport){d.credit=0;for(const b of d.batches)for(const p of b.particles)p.age=p.life;if(d.smoke){for(const p of d.smoke.particles)p.age=p.life;d.smoke.mesh.count=0;d.smoke.mesh.visible=false;}d.energy=0;if(d.rat){d.ratAge=99;d.rat.visible=false;}}
 for(const soft of record.softMeshes||[]){const a=soft.mesh.geometry.attributes.position,b=soft.base;if(d.energy<.002&&soft.resting)continue;soft.resting=d.energy<.002;
  for(let i=0;i<a.count;i++){const x=b[i*3],y=b[i*3+1],z=b[i*3+2],weight=soft.kind==='pharmacy'?Math.min(1,Math.abs(y-.87)*2.4):1,phase=time*9+y*6+x*5;const w=soft.amp*d.energy*weight;a.setXYZ(i,x+w*Math.sin(phase),y+w*.37*Math.sin(phase*1.4+z*6),z+w*Math.cos(phase+x*7));}a.needsUpdate=true;soft.mesh.geometry.computeVertexNormals();
 }
 if(record.cardboard&&(!d.resting||d.energy>.002))animateCardboard(record,d,time);
 if(record.poleWires&&(!d.resting||d.energy>.002))animatePole(record,d,time);
 if(record.treeMotion){record.treeMotion.motion.time.value=time;record.treeMotion.motion.energy.value=d.energy;}
 d.resting=d.energy<.002;
 const fish=record.fishBowl;
 if(fish){
  fish.slosh+=((moving||airborne?Math.min(1,speed*.15+.25):0)-fish.slosh)*(1-Math.exp(-dt*6));
  fish.surface.rotation.x=-Math.PI/2+Math.sin(time*7)*.14*fish.slosh;fish.surface.rotation.y=Math.cos(time*6)*.14*fish.slosh;
  if(airborne&&!fish.wasAir&&!teleport&&d.delta.y>0)fish.jumpAge=0;fish.wasAir=airborne;fish.jumpAge+=dt;
  for(let i=0;i<fish.fish.length;i++){const {f,tail}=fish.fish[i],a=time*(i?-.8:1)+i*Math.PI,r=.35+.05*Math.sin(time*1.4+i),u=Math.max(0,Math.min(1,(fish.jumpAge-i*.11)/.75)),leap=fish.jumpAge>=i*.11&&fish.jumpAge<i*.11+.75?Math.sin(u*Math.PI)*.71:0;f.position.set(Math.cos(a)*r,.65+.045*Math.sin(time*3+i)+leap,Math.sin(a)*r);f.rotation.y=-a+(i?Math.PI:0);f.rotation.z=leap>0?Math.cos(u*Math.PI)*.55:0;tail.rotation.y=Math.sin(time*15+i)*.65;}
 }
 if(d.rat){const open=active?1:0;d.lidOpen=(d.lidOpen||0)+(open-(d.lidOpen||0))*(1-Math.exp(-dt*9));if(record.trashLid)record.trashLid.rotation.x=-1.6*d.lidOpen;
  d.ratAge+=dt;if(active&&d.lidOpen>.65&&d.ratAge>2.8){d.ratAge=0;d.ratPos.copy(d.origin.set(0,1.04,.12)).applyMatrix4(d.g.matrixWorld);d.ratDirection.set((rng(d)-.5)*.65,0,1).transformDirection(d.g.matrixWorld);d.ratVelocity.copy(d.ratDirection).multiplyScalar(1.65);d.ratVelocity.y=1.5;d.ratFloor=d.floor??d.pos.y;}
  d.rat.visible=d.ratAge<2.6;if(d.rat.visible){d.ratVelocity.y-=9.8*dt;d.ratPos.addScaledVector(d.ratVelocity,dt);if(d.ratPos.y<d.ratFloor+.11*scale){d.ratPos.y=d.ratFloor+.11*scale;d.ratVelocity.y=0;}d.rat.position.copy(d.local.copy(d.ratPos).applyMatrix4(d.inverse));d.local.copy(d.ratDirection).transformDirection(d.inverse);d.rat.rotation.y=Math.atan2(-d.local.z,d.local.x);for(let j=0;j<d.ratLegs.length;j++)d.ratLegs[j].rotation.z=Math.sin(time*22+j*Math.PI*.75)*.5;}
  for(let i=0;i<d.flies.length;i++){const {f,w1,w2}=d.flies[i],a=time*(2.1+i*.07)+i*2.4;f.visible=d.lidOpen>.2;const approach=.5+(1-d.lidOpen)*1.6;f.position.set(Math.cos(a)*(approach+.11*Math.sin(a*2)),1.15+.25*Math.sin(a*1.7+i),Math.sin(a)*approach);f.rotation.y=-a;w1.rotation.z=Math.sin(time*70+i)*.7;w2.rotation.z=-w1.rotation.z;}
 }
 if(record.noodleProp||record.chairProp||record.burnerProp){animateMobilityMotion(record,d,time,dt,speed,moving,active,teleport);return;}
 const smoke=d.smoke;
 if(smoke){const rate=teleport?0:CHIMNEY_DENSITY*(5+Math.min(9,speed*.75)+(airborne?6:0));d.credit+=rate*dt;
  while(d.credit>=1){d.credit--;const p=smoke.particles[smoke.next++%smoke.particles.length];p.age=0;p.life=2.1;p.size=.22;p.p.copy(d.origin.set((rng(d)-.5)*.16,3.02,(rng(d)-.5)*.16)).applyMatrix4(d.g.matrixWorld);p.v.set((rng(d)-.5)*.35,.55+speed*.035,(rng(d)-.5)*.35);}
  let n=0;const dummy=d.dummy;dummy.rotation.set(0,0,0);
   for(const p of smoke.particles){p.age+=dt;if(p.age>=p.life)continue;p.p.addScaledVector(p.v,dt);dummy.position.copy(d.local.copy(p.p).applyMatrix4(d.inverse));const u=p.age/p.life;dummy.scale.setScalar((p.size+u*.58)*Math.min(1,(1-u)*3));dummy.updateMatrix();smoke.mesh.setMatrixAt(n++,dummy.matrix);}
   smoke.mesh.count=n;smoke.mesh.visible=n>0;if(n)smoke.mesh.instanceMatrix.needsUpdate=true;
  return;
 }
 if(record.cardboard||record.snackProp||record.beerProp){animateFoodSpill(record,d,time,dt,speed,moving,teleport);return;}
 const producing=!teleport&&(d.kind==='fried-chicken-disguise'?moving:active);
 if(producing&&d.batches.length){d.credit+=dt*(d.kind==='tree-disguise'?65:d.kind==='fried-chicken-disguise'?12:9);while(d.credit>=1){d.credit--;const b=d.batches[Math.floor(rng(d)*d.batches.length)],a=rng(d)*TAU;
  switch(d.kind){
   case 'tree-disguise':{const [x,y,z,r]=record.treeMotion.clusters[Math.floor(rng(d)*record.treeMotion.clusters.length)];emit(d,b,x+Math.cos(a)*r*.6,y,z+Math.sin(a)*r*.6,1.1,.15,.7+rng(d)*.45,3.2);break;}
   case 'fried-chicken-disguise':emit(d,b,Math.cos(a)*.62,.8+rng(d)*.7,Math.sin(a)*.18,.6,.2,.023+rng(d)*.034,1.4);break;
   case 'garbage-bag-disguise':emit(d,b,0,.95,0,1.25,1.7,.8+rng(d)*.4,2.2);break;
   case 'pharmacy-bag-disguise':emit(d,b,0,1.85,.08,1.1,1.4,1,2);break;
   case 'postbox-disguise':emit(d,b,rng(d)<.5?-.245:.245,.75,.39,1.45,1.3,.9,2.2);break;
   case 'goldfish-bowl-disguise':emit(d,b,Math.cos(a)*.52,1.12,Math.sin(a)*.52,1.3,1.6,.022+rng(d)*.021,1.2);break;
  }
 }}else d.credit=0;
 for(const b of d.batches)updateBatch(d,b,dt);
}
// Each stream has a moving breakup length, a curved liquid body and a rounded closed end.
// Droplets leave the actual tip at their own emission time, following its tangent.
function colaEnd(k,t){return k===0?1+.035*Math.sin(t*8.1)+.018*Math.sin(t*15.3):.68+.045*Math.sin(t*5.7+k*2.17)+.025*Math.sin(t*11.4+k*.91);}
function colaPath(k,u,t,ca,sa,out){
 const arm=k>0,p=t*10-u*15+k*1.7,breakup=arm?Math.max(0,Math.min(1,(u-.45)/.30)):Math.max(0,(u-.60)/.40),w=breakup*breakup;
 if(arm){
  const r=.03+.72*u+.035*w*Math.sin(p*1.3),side=.025*Math.sin(p)*u+.060*w*Math.sin(p*1.7+k);
  out[0]=ca*r-sa*side;out[1]=1.98+1.02+3.8*u-4.5*u*u+.055*w*Math.sin(p*1.2+k);out[2]=sa*r+ca*side;
 }else{
  out[0]=.075*Math.sin(p)*u+.045*w*Math.sin(p*1.7);
  out[1]=1.98+1.84*u+.045*w*Math.sin(p*1.2);out[2]=.07*Math.cos(p)*u+.045*w*Math.cos(p*1.3);
 }
}
function colaRadius(k,u,t){
 const p=t*10-u*15+k*1.7;
 // The tail pulses but never tapers into a needle. A short rounded cap closes it.
 return k>0?(.037+.012*Math.sin(p))*(.96-.52*Math.min(1,u)**2)+.004:
  (.069+.037*Math.sin(Math.PI*Math.min(1,u))+.011*Math.sin(p))*(1-.52*Math.min(1,u)**6)+.005;
}
export function createColaStream(T,g,record,mat){
 const n=40,sides=12,streams=9,positions=new Float32Array(streams*n*sides*3),indices=[];
 const ring=Array.from({length:sides},(_,i)=>{const a=i*TAU/sides;return [Math.cos(a),Math.sin(a),Math.sin(3*a),Math.cos(3*a),Math.cos(5*a),Math.sin(5*a)];});
 for(let k=0;k<streams;k++){
  for(let j=0;j<n;j++)for(let i=0;i<sides;i++){
   const a=(k*n+j)*sides+i,b=(k*n+j)*sides+(i+1)%sides;positions[a*3+1]=1.96;
   if(j<n-1)indices.push(a,a+sides,b,b,a+sides,b+sides);
  }
  // The final small ring is closed, not an open sharp-edged tube or a zero-radius apex.
  const tip=(k*n+n-1)*sides;for(let i=1;i<sides-1;i++)indices.push(tip,tip+i+1,tip+i);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geo.setIndex(indices);geo.computeVertexNormals();
 geo.attributes.normal.setUsage(T.DynamicDrawUsage);
 // Slightly translucent volumetric tubes; standard lighting retains liquid highlights
 // without a costly full-scene transmission framebuffer or layered alpha sheets.
 const liquid=mat('#884326');liquid.roughness=.11;liquid.metalness=0;liquid.transparent=true;liquid.opacity=.72;liquid.depthWrite=false;liquid.side=T.FrontSide;
 const mesh=part(T,g,geo,liquid);mesh.visible=false;mesh.frustumCulled=false;
 const splash=mat('#ae633a');splash.roughness=.10;splash.metalness=0;splash.transparent=true;splash.opacity=.78;splash.depthWrite=false;splash.side=T.FrontSide;
 const dropCount=64,drops=new T.InstancedMesh(new T.SphereGeometry(1,8,6),splash,dropCount);
 drops.instanceMatrix.setUsage(T.DynamicDrawUsage);drops.count=0;drops.visible=false;drops.frustumCulled=false;g.add(drops);
 record.colaMotion.jet={mesh,n,sides,streams,drops,dropCount,ring,dummy:new T.Object3D(),up:new T.Vector3(0,1,0),direction:new T.Vector3(),tangent:new T.Vector3(),normal:new T.Vector3(),binormal:new T.Vector3(),p:new Float64Array(3),q:new Float64Array(3)};
}
export function updateColaStream(d,time){
 if(!d.jet)return;const {mesh,n,sides,streams,drops,dropCount,ring,dummy,up,direction,tangent,normal,binormal,p,q}=d.jet;
 const open=d.open;mesh.visible=drops.visible=open>.03;if(!mesh.visible){drops.count=0;return;}
 const a=mesh.geometry.attributes.position,body=n-4;
 for(let k=0;k<streams;k++){
  const end=colaEnd(k,time),angle=(k-1)*TAU/(streams-1)+.11*Math.sin(time*2+k),ca=Math.cos(angle),sa=Math.sin(angle),arm=k>0;
  for(let j=0;j<n;j++){
   const cap=j>=body,u=end*Math.min(1,j/(body-1)),phase=time*10-u*15+k*1.7;
   colaPath(k,u,time,ca,sa,p);colaPath(k,u+.002,time,ca,sa,q);
   tangent.set(q[0]-p[0],q[1]-p[1],q[2]-p[2]).normalize();
   binormal.set(arm?-sa:0,0,arm?ca:1);normal.crossVectors(tangent,binormal).normalize();binormal.crossVectors(normal,tangent).normalize();
   const radius=colaRadius(k,u,time),capAngle=cap?(j-body+1)/4*1.32:0,axial=radius*.48*Math.sin(capAngle),round=Math.cos(capAngle);
   const cx=p[0]+tangent.x*axial,cy=p[1]+tangent.y*axial,cz=p[2]+tangent.z*axial;
   const s1=Math.sin(phase),c1=Math.cos(phase);
   for(let i=0;i<sides;i++){
    const [ct,st,s3,c3,c5,s5]=ring[i];
    const w=radius*round*(1+.14*(s3*c1+c3*s1)+.08*(c5*c1+s5*s1));
    const c=ct*w,ss=st*w;
    a.setXYZ((k*n+j)*sides+i,(cx+normal.x*c+binormal.x*ss)*open,1.98+(cy-1.98+normal.y*c+binormal.y*ss)*open,(cz+normal.z*c+binormal.z*ss)*open);
   }
  }
 }
 a.needsUpdate=true;mesh.geometry.computeVertexNormals();
 for(let i=0;i<dropCount;i++){
  const k=i%streams,lifetime=.30+(i%7)*.025,phase=((time/lifetime+i*.61803398875)%1+1)%1,age=phase*lifetime,emitTime=time-age;
  const u=colaEnd(k,emitTime),angle=(k-1)*TAU/(streams-1)+.11*Math.sin(emitTime*2+k),ca=Math.cos(angle),sa=Math.sin(angle);
  colaPath(k,u,emitTime,ca,sa,p);colaPath(k,u+.002,emitTime,ca,sa,q);
  tangent.set(q[0]-p[0],q[1]-p[1],q[2]-p[2]).normalize();
  const speed=.74+(i%5)*.16,spread=i*2.39996323,vx=tangent.x*speed+Math.cos(spread)*.38,vy=tangent.y*speed+.28*Math.sin(spread),vz=tangent.z*speed+Math.sin(spread)*.38;
  dummy.position.set((p[0]+vx*age)*open,1.98+(p[1]-1.98+vy*age-3.9*age*age)*open,(p[2]+vz*age)*open);
  direction.set(vx,vy-7.8*age,vz).normalize();dummy.quaternion.setFromUnitVectors(up,direction);
  const size=(.006+(i%11)*.0014)*open*Math.min(1,(1-phase)*9,phase*15+.1);
  dummy.scale.set(size,size*Math.min(1.85,1.12+Math.hypot(vx,vy-7.8*age,vz)*.22),size);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);
 }
 drops.count=dropCount;drops.instanceMatrix.needsUpdate=true;
}
export function animateFaultyMutton(mat,time){const t=((time%8.1)+8.1)%8.1;const off=(t>.12&&t<.24)||(t>.36&&t<.57)||(t>1.64&&t<1.71)||(t>3.18&&t<3.92)||(t>4.03&&t<4.10)||(t>4.18&&t<4.39)||(t>6.8&&t<7.4);mat.emissiveIntensity=off?.22:2.2;mat.color.setScalar(off?.58:1);}


// V151: reference-based Taiwanese street props. Geometry, texture leases and
// fixed-capacity motion batches belong to the same outfit record as all others.
function buildMobilityStreetProp(T,g,kind,record,mat){
 if(!['gg-noodle-disguise','wheelchair-disguise','joss-burner-disguise'].includes(kind))return null;
 const b=(p,s,m,parent=g)=>part(T,parent,new T.BoxGeometry(1,1,1),m,...p,...s);
 const c=(p,r1,r2,h,m,n=40,parent=g)=>part(T,parent,new T.CylinderGeometry(r1,r2,h,n),m,...p);
 const ring=(p,r,t,m,parent=g)=>{const o=part(T,parent,new T.TorusGeometry(r,t,8,48),m,...p);o.rotation.x=Math.PI/2;return o;};
 const rod=(a,b,r,m,parent=g)=>{const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from);const o=c(from.clone().add(to).multiplyScalar(.5).toArray(),r,r,delta.length(),m,12,parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;};
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let seed=151;
 if(kind==='gg-noodle-disguise'){
  const print=(x,w,h)=>{x.fillStyle='#192586';x.fillRect(0,0,w,h);x.fillStyle='#f8f2df';x.fillRect(0,h*.49,w,h*.25);x.fillStyle='#e91b26';x.fillRect(0,h*.74,w,h*.26);x.fillStyle='#e3b73d';x.fillRect(0,h*.48,w,4);x.fillRect(0,h*.73,w,4);
   for(const cx of [w*.25,w*.75]){x.textAlign='center';x.fillStyle='#fff8e9';x.font='bold '+Math.round(h*.24)+'px sans-serif';x.fillText('GG炸醬麵',cx,h*.29);x.font='italic bold '+Math.round(h*.085)+'px sans-serif';x.fillText('GG FRIED SAUCE NOODLES',cx,h*.43);x.fillStyle='#173080';x.font='bold '+Math.round(h*.14)+'px sans-serif';x.fillText('重量碗',cx,h*.64);x.fillStyle='#fff3b9';x.font='bold '+Math.round(h*.12)+'px sans-serif';x.fillText('110克 大份量',cx,h*.9);}
   x.globalAlpha=.12;for(let i=0;i<180;i++){x.fillStyle=i%2?'#ffffff':'#715334';x.fillRect(rand()*w,rand()*h,1+rand()*8,1+rand()*2);}x.globalAlpha=1;};
  const label=mat('#ffffff'),cream=mat('#e9e0c9'),noodle=mat('#c99443'),sauce=mat('#6b361d'),green=mat('#6b8c31'),foil=mat('#b9b8b4',.55);
  label.map=tex(T,record,1024,256,print,'street:gg-noodle-wrap-v151');label.roughness=.48;
  const points=[[.40,.08],[.43,.10],[.48,.25],[.54,.45],[.60,.65],[.66,.86],[.70,1.02]];
  const bowl=part(T,g,new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),64),label);bowl.rotation.y=Math.PI/2;label.side=T.DoubleSide;
  c([0,.09,0],.43,.40,.055,cream);ring([0,1.025,0],.70,.031,cream);ring([0,.10,0],.42,.018,cream);
  // A closed, opaque, bowl-shaped food mass reaches the rim; actual 3D
  // strands sit on the textured surface instead of hovering above an empty bowl.
  const fill=buildNoodleFill(T,g,record,mat);
  const pts=[];for(let i=0;i<=20;i++){const u=i/20;pts.push(new T.Vector3((u-.5)*.31,Math.sin(u*TAU*2)*.018,Math.sin(u*TAU*2)*.045));}
  const strand=new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.013,6,false);
  const strands=new T.InstancedMesh(strand,noodle,192),dummy=new T.Object3D();strands.name='gg-noodle-packed-strands';
  for(let i=0;i<104;i++){const a=rand()*TAU,rr=.30+rand()*.29;dummy.position.set(Math.sin(a)*rr,.97+rand()*.065,Math.cos(a)*rr);dummy.rotation.set((rand()-.5)*.4,a+Math.PI/2,(rand()-.5)*.35);dummy.scale.setScalar(.75+rand()*.5);dummy.updateMatrix();strands.setMatrixAt(i,dummy.matrix);}
  // Keep the original outer strands and fill the middle with overlapping curls.
  // Deterministic coverage, independent of whether the shared texture was cached.
  for(let i=104;i<192;i++){const j=i-104,a=j*2.39996323,rr=.45*Math.sqrt((j+.5)/88),phase=j*1.73;dummy.position.set(Math.sin(a)*rr,.978+.020*Math.sin(phase)**2,Math.cos(a)*rr);dummy.rotation.set(.19*Math.sin(phase),a+.7*Math.sin(j*2.4),.16*Math.cos(phase));dummy.scale.setScalar(.84+.18*Math.sin(j*3.1)**2);dummy.updateMatrix();strands.setMatrixAt(i,dummy.matrix);}g.add(strands);
  const topping=new T.InstancedMesh(new T.IcosahedronGeometry(.026,1),sauce,32),scallion=new T.InstancedMesh(new T.TorusGeometry(.025,.007,5,10),green,20);
  for(const m of [topping,scallion]){for(let i=0;i<m.count;i++){const a=rand()*TAU,rr=.34+rand()*.28;dummy.position.set(Math.sin(a)*rr,1.02+rand()*.035,Math.cos(a)*rr);dummy.rotation.set(rand(),rand()*TAU,rand());dummy.scale.setScalar(.7+rand()*.7);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}g.add(m);}
  const lid=new T.Group();lid.position.set(0,1.045,-.70);g.add(lid);
  const top=mat('#ffffff');top.map=tex(T,record,512,512,(x,w,h)=>{x.fillStyle='#192586';x.fillRect(0,0,w,h);x.fillStyle='#f8f2df';x.fillRect(0,h*.52,w,h*.25);x.fillStyle='#e91b26';x.fillRect(0,h*.77,w,h*.23);x.fillStyle='#173080';x.textAlign='center';x.font='bold 52px sans-serif';x.fillText('重量碗',w/2,h*.68);x.fillStyle='#fff5d8';x.font='bold 34px sans-serif';x.fillText('110克 大份量',w/2,h*.89);x.fillStyle='#e3b73d';x.fillRect(0,h*.51,w,5);x.fillRect(0,h*.76,w,5);x.textAlign='center';x.fillStyle='#fff8e9';x.font='bold 82px sans-serif';x.fillText('GG炸醬麵',w/2,h*.25);x.font='italic bold 25px sans-serif';x.fillText('GG FRIED SAUCE NOODLES',w/2,h*.36);},'street:gg-noodle-lid-v151');
  const lidMesh=part(T,lid,new T.CircleGeometry(.724,64),top,0,.016,.70);lidMesh.rotation.x=-Math.PI/2;top.side=T.DoubleSide;
  c([0,0,.70],.724,.724,.018,foil,64,lid);ring([0,.012,.70],.716,.012,foil,lid);
  record.noodleProp={lid,strand,noodle,fill};
  return {openingY:.79,frontZ:.63};
 }
 if(kind==='wheelchair-disguise'){
  const chrome=mat('#b9c7ce',.82);chrome.roughness=.23;const blue=mat('#244e91'),edge=mat('#183660'),rubber=mat('#272b32'),pad=mat('#202c43'),hub=mat('#8d969e',.8);
  blue.roughness=.49;pad.roughness=.63;
  // Tubular folding frame, stitched vinyl, footrests, push rims and spoked wheels.
  b([0,.78,-.06],[.71,.075,.72],blue);b([0,1.08,-.42],[.72,.59,.055],blue);
  const footrests=[];
  for(const sx of [-1,1]){const x=sx*.37;
   rod([x,.20,-.38],[x,.80,-.38],.023,chrome);rod([x,.20,-.38],[x,.20,.52],.023,chrome);
   rod([x,.20,.52],[x,.77,.27],.023,chrome);rod([x,.77,.27],[x,.77,-.40],.023,chrome);
   rod([x,.77,-.43],[x,1.45,-.43],.023,chrome);rod([x,1.45,-.43],[x,1.45,-.61],.028,rubber);
   rod([x,.78,.23],[x,1.04,.23],.021,chrome);rod([x,1.04,.23],[x,1.04,-.34],.021,chrome);
   b([x,1.07,-.06],[.105,.075,.55],pad);b([x,.87,-.03],[.035,.23,.58],edge);
   const footrest=new T.Group();footrest.position.set(sx*.25,.38,.43);g.add(footrest);
   const rail=rod([x,.72,.25],footrest.position.toArray(),.022,chrome);b([0,0,0],[.26,.045,.32],hub,footrest);
   for(let j=0;j<9;j++)b([0,.025,-.12+j*.029],[.23,.009,.008],chrome,footrest);
   footrests.push({side:sx,group:footrest,rail,start:new T.Vector3(x,.72,.25)});
   for(let j=0;j<5;j++)b([sx*.30+j*.035*sx,1.10,-.389],[.004,.46,.004],edge);
  }
  rod([-.35,.25,-.25],[.35,.72,.23],.018,chrome);rod([.35,.25,-.25],[-.35,.72,.23],.018,chrome);
  const wheels=[];
  for(const sx of [-1,1])for(const rear of [true,false]){
   const radius=rear?.47:.14,group=new T.Group();group.position.set(sx*(rear?.46:.39),radius,rear?-.25:.52);g.add(group);
   const tire=part(T,group,new T.TorusGeometry(radius-.035,.036,12,rear?56:32),rubber);tire.rotation.y=Math.PI/2;
   const rim=part(T,group,new T.TorusGeometry(radius-.078,.014,8,48),chrome);rim.rotation.y=Math.PI/2;
   if(rear){const push=part(T,group,new T.TorusGeometry(radius-.13,.016,8,48),chrome,sx*.052,0,0);push.rotation.y=Math.PI/2;}
   const axle=c([0,0,0],rear?.048:.038,rear?.048:.038,.12,hub,20,group);axle.rotation.z=Math.PI/2;
   const spokes=new T.InstancedMesh(new T.CylinderGeometry(rear?.003:.013,rear?.003:.013,radius-.085,8),chrome,rear?32:5),dummy=new T.Object3D();
   for(let i=0;i<spokes.count;i++){const a=i*TAU/spokes.count;dummy.position.set(0,Math.cos(a)*(radius-.085)/2,Math.sin(a)*(radius-.085)/2);dummy.rotation.set(a,0,0);dummy.updateMatrix();spokes.setMatrixAt(i,dummy.matrix);}group.add(spokes);
   const glow=mat('#ff6911');glow.emissive.set('#ff4b02');glow.emissiveIntensity=2;const hot=part(T,group,new T.TorusGeometry(radius-.032,.04,8,48),glow);hot.rotation.y=Math.PI/2;hot.visible=false;
   wheels.push({group,radius,hot});
  }
  record.chairProp={g,wheels,footrests};return {seated:true};
 }
 const metal=mat('#ffffff',.58),rim=mat('#77706a',.65),stand=mat('#a9a399',.54),dark=mat('#382721'),glow=mat('#e36b15');
 metal.roughness=.76;glow.emissive.set('#ff5109');glow.emissiveIntensity=.9;metal.side=T.DoubleSide;
 metal.map=tex(T,record,512,512,(x,w,h)=>{x.fillStyle='#655e58';x.fillRect(0,0,w,h);for(let i=0;i<2700;i++){x.globalAlpha=.10+rand()*.22;x.fillStyle=['#1f1c19','#a19a8c','#a44d22','#524337'][i%4];x.fillRect(rand()*w,rand()*h,1+rand()*6,2+rand()*24);}x.globalAlpha=1;},'street:joss-burner-rust-v151');
 // Actual perforated cylinder: omit cells in the mouth, ash door and vent holes.
 const N=96,H=72,verts=[],uv=[],idx=[],radius=.61,lo=.44,hi=1.93;
 for(let j=0;j<=H;j++)for(let i=0;i<=N;i++){const a=i/N*TAU,y=lo+(hi-lo)*j/H;verts.push(Math.sin(a)*radius,y,Math.cos(a)*radius);uv.push(i/N,j/H);}
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 for(let j=0;j<H;j++)for(let i=0;i<N;i++){const a=(i+.5)/N*TAU,y=lo+(hi-lo)*(j+.5)/H,front=Math.abs(wrap(a));
  let hole=front<.46&&y>.76&&y<1.29||Math.abs(wrap(a-.75))<.18&&y<.65;
  for(let row=0;row<4&&!hole;row++)for(let k=0;k<8&&!hole;k++){const dx=wrap(a-(k+(row%2)*.5)*TAU/8)*radius,dy=y-(.73+row*.27);if(dx*dx+dy*dy<.047*.047)hole=true;}
  if(hole)continue;const p=j*(N+1)+i;idx.push(p,p+1,p+N+1,p+1,p+N+2,p+N+1);}
 const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(verts,3));shell.setAttribute('uv',new T.Float32BufferAttribute(uv,2));shell.setIndex(idx);shell.computeVertexNormals();part(T,g,shell,metal);
 for(const y of [.46,.82,.86,1.15,1.19,1.92])ring([0,y,0],.615,.021,rim);
 const dome=[[.61,1.92],[.61,1.98],[.55,2.05],[.43,2.12],[.29,2.15],[.24,2.15]];part(T,g,new T.LatheGeometry(dome.map(p=>new T.Vector2(...p)),64),metal);ring([0,2.15,0],.25,.025,rim);
 c([0,.43,0],.60,.49,.12,dark);c([0,.49,0],.46,.46,.025,glow);
 for(let i=0;i<4;i++){const a=i*TAU/4+Math.PI/4,xx=Math.sin(a),zz=Math.cos(a);rod([xx*.45,.43,zz*.45],[xx*.62,.04,zz*.62],.027,stand);b([xx*.62,.025,zz*.62],[.12,.05,.12],rim);const a2=a+TAU/4;rod([xx*.55,.20,zz*.55],[Math.sin(a2)*.55,.20,Math.cos(a2)*.55],.018,stand);}
 record.burnerProp=true;return {groundAligned:true,frontZ:.60};
}

function createPropPuffBatch(T,g,record,kind,count){
 const steam=kind==='steam',fire=kind==='fire';
 const texture=tex(T,record,64,64,x=>{const radial=x.createRadialGradient(32,32,1,32,32,31);radial.addColorStop(0,fire?'rgba(255,249,170,1)':steam?'rgba(255,255,255,.58)':'rgba(25,22,21,.82)');radial.addColorStop(.38,fire?'rgba(255,127,14,.92)':steam?'rgba(236,240,242,.36)':'rgba(47,42,39,.62)');radial.addColorStop(1,fire?'rgba(255,44,0,0)':steam?'rgba(235,238,240,0)':'rgba(28,25,25,0)');x.fillStyle=radial;x.fillRect(0,0,64,64);},'street:prop-puff-v151:'+kind);
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,blending:fire?T.AdditiveBlending:T.NormalBlending});record.materials.push(material);
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>', 'mat4 puffMV=modelViewMatrix*instanceMatrix; vec4 mvPosition=puffMV*vec4(0.,0.,0.,1.); mvPosition.xy+=position.xy*vec2(length(puffMV[0].xyz),length(puffMV[1].xyz)); gl_Position=projectionMatrix*mvPosition;');};
 material.customProgramCacheKey=()=> 'street-prop-billboard-v151';
 const result=batch(T,g,new T.PlaneGeometry(1,1),material,count);result.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);return result;
}
function attachMobilityMotion(T,g,record,mat,d){
 if(record.noodleProp){d.smoke=createPropPuffBatch(T,g,record,'steam',48);d.batches.push(batch(T,g,record.noodleProp.strand.clone(),mat('#c99443'),28));}
 if(record.chairProp){d.smoke=createPropPuffBatch(T,g,record,'smoke',64);d.fire=createPropPuffBatch(T,g,record,'fire',80);}
 if(record.burnerProp){d.smoke=createPropPuffBatch(T,g,record,'smoke',120);
  const paper=mat('#ffffff');paper.side=T.DoubleSide;paper.map=tex(T,record,128,128,(x,w,h)=>{x.fillStyle='#efce6c';x.fillRect(0,0,w,h);x.fillStyle='#db9c35';x.fillRect(17,20,94,88);x.strokeStyle='#a12b20';x.lineWidth=3;x.strokeRect(8,8,112,112);x.strokeRect(20,20,88,88);x.fillStyle='#a12b20';x.textAlign='center';x.font='bold 30px serif';x.fillText('金紙',64,51);x.font='bold 23px serif';x.fillText('福',64,87);},'street:joss-paper-v151');
  const geo=new T.PlaneGeometry(.22,.28,4,3),pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,.025*Math.sin(pos.getX(i)*19));geo.computeVertexNormals();d.batches.push(batch(T,g,geo,paper,40));}
 d.puffCredit=0;d.fireCredit=0;
}
function updatePropPuffs(d,b,dt,fire=false){
 let n=0;const dummy=d.dummy;dummy.rotation.set(0,0,0);
 for(const p of b.particles){if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life)continue;
  p.p.addScaledVector(p.v,dt);const u=p.age/p.life;dummy.position.copy(d.local.copy(p.p).applyMatrix4(d.inverse));const size=(p.size+u*(fire?.12:.60))*Math.min(1,(1-u)*4);dummy.scale.set(size,size*(fire?1.6:1.25),size);dummy.updateMatrix();b.mesh.setMatrixAt(n++,dummy.matrix);}
 b.mesh.count=n;b.mesh.visible=n>0;if(n)b.mesh.instanceMatrix.needsUpdate=true;
}
function animateMobilityMotion(record,d,time,dt,speed,moving,active,teleport){
 const noodle=record.noodleProp,chair=record.chairProp,burner=record.burnerProp;
 if(teleport){d.puffCredit=d.fireCredit=0;if(d.fire){for(const p of d.fire.particles)p.age=p.life;d.fire.mesh.count=0;d.fire.mesh.visible=false;}}
 const fast=Math.min(1,Math.max(0,(speed-2.5)/4));
 if(noodle){d.open=(d.open||0)+((moving?1:0)-(d.open||0))*(1-Math.exp(-dt*10));noodle.lid.rotation.x=-1.55*d.open;}
 if(chair){d.g.getWorldScale(d.worldScale);const unit=Math.max(.001,Math.abs(d.worldScale.y));
  for(const w of chair.wheels){if(!teleport)w.group.rotation.x-=speed*dt/(w.radius*unit);w.hot.visible=active&&!teleport;}}
 const rate=teleport?0:noodle?(moving?14+fast*20:0):chair?(active?32:0):burner?40+Math.min(15,speed*2):0;
 d.puffCredit+=rate*dt;
 while(d.puffCredit>=1){d.puffCredit--;let x=(rng(d)-.5)*.35,y=noodle?1.05:2.16,z=(rng(d)-.5)*.30;
  if(chair){const w=chair.wheels[Math.floor(rng(d)*chair.wheels.length)],a=rng(d)*TAU;x=w.group.position.x;y=w.radius+Math.cos(a)*w.radius;z=w.group.position.z+Math.sin(a)*w.radius;}
  emit(d,d.smoke,x,y,z,.2,noodle?.65+fast*2.5:chair?.9:.9+speed*.05,noodle?.18:chair?.24:.31,noodle?1.3:chair?1.6:2.3);}
 updatePropPuffs(d,d.smoke,dt);
 if(chair){d.fireCredit+=active&&!teleport?dt*100:0;while(d.fireCredit>=1){d.fireCredit--;const w=chair.wheels[Math.floor(rng(d)*chair.wheels.length)],a=rng(d)*TAU;emit(d,d.fire,w.group.position.x,w.radius+Math.cos(a)*w.radius,w.group.position.z+Math.sin(a)*w.radius,.15,1.25,.13,.42);}updatePropPuffs(d,d.fire,dt,true);}
 if(!teleport&&(noodle?moving&&fast>.12:burner&&active)){d.credit+=dt*(noodle?5+fast*15:15);while(d.credit>=1){d.credit--;const a=rng(d)*TAU;emit(d,d.batches[0],Math.sin(a)*.48,noodle?1.05:1.72,Math.cos(a)*.48,noodle?1+fast*1.8:1.6,noodle?1.1+fast*1.6:2,.75+rng(d)*.6,noodle?1.1:2.5);}}
 for(const b of d.batches)updateBatch(d,b,dt);
}


// The entire serving is a contiguous solid, with a gently uneven top and
// a lossless shared noodle-surface texture. No new runtime animation or pool.
function buildNoodleFill(T,g,record,mat){
 const N=64,vertices=[],uv=[],indices=[];
 const profile=[[.418,.105],[.474,.25],[.534,.45],[.594,.65],[.654,.86],[.685,.967]];
 for(let k=1;k<=10;k++)profile.push([.685*(1-k/11),.978]);
 for(let j=0;j<profile.length;j++){const [r,y]=profile[j];
  for(let i=0;i<=N;i++){const a=TAU*i/N,x=Math.cos(a)*r,z=Math.sin(a)*r;
   const relief=j>=5?.011*Math.sin(x*29+z*19)*Math.cos(z*23-x*11)*Math.min(1,(.685-r)*12):0;
   vertices.push(x,y+relief,z);uv.push(.5+x/1.37,.5+z/1.37);}
 }
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+N+1;indices.push(a,b,a+1,a+1,b,b+1);}
 const top=vertices.length/3;vertices.push(0,.978,0);uv.push(.5,.5);
 const last=(profile.length-1)*(N+1);for(let i=0;i<N;i++)indices.push(last+i,top,last+i+1);
 const bottom=vertices.length/3;vertices.push(0,.105,0);uv.push(.5,.5);
 for(let i=0;i<N;i++)indices.push(i,i+1,bottom);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
 const mass=mat('#ffffff');mass.roughness=.62;
 mass.map=tex(T,record,512,512,(x,w,h)=>{
  x.fillStyle='#91602c';x.fillRect(0,0,w,h);x.lineCap='round';x.lineJoin='round';
  let seed=152;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Interwoven sauce-coated noodle curves; each dark edge and golden highlight
  // follows the same path. The base stays opaque even between individual curls.
  for(let i=0;i<980;i++){const cx=rand()*w,cy=rand()*h,a=rand()*TAU,L=23+rand()*55,ca=Math.cos(a),sa=Math.sin(a),wave=5+rand()*10;
   const point=(u,v)=>[cx+u*ca-v*sa,cy+u*sa+v*ca];
   x.beginPath();x.moveTo(...point(-L/2,0));x.bezierCurveTo(...point(-L/3,wave),...point(-L/6,-wave),...point(0,0));x.bezierCurveTo(...point(L/6,wave),...point(L/3,-wave),...point(L/2,0));
   x.strokeStyle='#80502a';x.lineWidth=8;x.stroke();x.strokeStyle=['#c3934b','#d5ad65','#cfa05b','#dfb973'][i%4];x.lineWidth=5.6;x.stroke();
  }
 },'street:gg-noodle-full-serving-v152');
 const fill=part(T,g,geo,mass);fill.name='gg-noodle-solid-serving';return fill;
}


// V154: packaging props share the original disguise frame, aperture shader,
// immutable texture leases and fixed-capacity outfit particle lifecycle.
function buildPackageProp(T,g,kind,record,mat){
 if(kind==='naughty-snack-disguise'){
  const film=mat('#ffffff'),green=mat('#43a620'),inside=mat('#555b35');film.roughness=.33;film.side=T.DoubleSide;green.side=T.DoubleSide;
  film.map=tex(T,record,512,1024,paintNaughtyPackage,'street:naughty-package-v154');
  // A rounded inflated pillow with creased edges and crimped sealed ends.
  const W=36,H=44,vertices=[],uv=[],indices=[];
  for(let j=0;j<=H;j++)for(let i=0;i<=W;i++){
   const y=j/H,a=i/W*TAU-Math.PI/2,full=Math.pow(Math.max(.025,Math.sin(Math.PI*y)),.36),ca=Math.cos(a),sa=Math.sin(a);
   const x=Math.sign(sa)*Math.pow(Math.abs(sa),.55)*(.54+.105*full);
   const z=Math.sign(ca)*Math.pow(Math.abs(ca),.55)*(.055+.23*full)+.012*Math.sin(a*13+y*39)*Math.sin(Math.PI*y);
   vertices.push(x,.05+1.78*y,z);uv.push(i/W,y);
  }
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const a=j*(W+1)+i,b=a+W+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  // The front panel is centered at u=.25, facing the player aperture.
  part(T,g,geo,film);
  part(T,g,new T.BoxGeometry(1.10,.07,.105),green,0,.035,0);
  const mouth=part(T,g,new T.BoxGeometry(1.08,.025,.13),inside,0,1.80,0);
  const lips=[];
  for(const sign of [-1,1]){
   const hinge=new T.Group();hinge.position.set(0,1.79,sign*.045);g.add(hinge);
   const lip=part(T,hinge,new T.BoxGeometry(1.10,.19,.045),green,0,.095,0);
   for(let i=0;i<2;i++)part(T,hinge,new T.BoxGeometry(1.10,.011,.049),inside,0,.13+i*.026,0);
   lips.push({hinge,sign});
  }
  record.snackProp={lips,mouth};return {openingY:.71,frontZ:.28};
 }
 if(kind!=='taiwan-beer-disguise')return null;
 const label=mat('#ffffff',.45),metal=mat('#c0c4c5',.78),dark=mat('#313735',.45);label.roughness=.35;metal.roughness=.26;
 label.map=tex(T,record,1024,512,paintBeerPackage,'street:taiwan-beer-v154');
 const profile=[[.38,.04],[.43,.08],[.46,.19],[.47,.30],[.47,1.67],[.45,1.81],[.39,1.94],[.38,1.99]];
 const body=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),64),uv=body.attributes.uv,pos=body.attributes.position;
 for(let i=0;i<uv.count;i++)uv.setY(i,pos.getY(i)/2);
 const shell=part(T,g,body,label);shell.rotation.y=-Math.PI/2;
 const torus=(r,t,y)=>{const mesh=part(T,g,new T.TorusGeometry(r,t,10,64),metal,0,y,0);mesh.rotation.x=Math.PI/2;return mesh;};torus(.39,.025,1.99);torus(.39,.025,.04);
 part(T,g,new T.CylinderGeometry(.39,.40,.04,64),metal,0,.045,0);
 const disc=new T.Shape();disc.absarc(0,0,.382,0,TAU,false);const hole=new T.Path();hole.absellipse(0,-.16,.125,.087,0,TAU,true);disc.holes.push(hole);
 const top=part(T,g,new T.ShapeGeometry(disc,48),metal,0,1.975,0);top.rotation.x=-Math.PI/2;
 const cavity=part(T,g,new T.CylinderGeometry(.365,.365,.02,48),dark,0,1.91,0);
 const flap=new T.Group();flap.position.set(0,1.982,.255);g.add(flap);
 const cover=part(T,flap,new T.CircleGeometry(1,32),metal,0,0,-.095,.125,.087,1);cover.rotation.x=-Math.PI/2;metal.side=T.DoubleSide;
 const tab=new T.Group();tab.position.set(0,2.00,-.025);g.add(tab);
 const tabRing=part(T,tab,new T.TorusGeometry(.085,.024,10,32),metal,0,.012,-.11,1,.72,1);tabRing.rotation.x=Math.PI/2;
 part(T,tab,new T.BoxGeometry(.10,.025,.11),metal,0,.007,.005);
 record.beerProp={flap,tab,cavity};return {openingY:1.06,frontZ:.47};
}
function paintNaughtyPackage(x,w,h){
 const half=w/2;
 for(let side=0;side<2;side++){
  x.save();x.translate(side*half,0);x.scale(half/256,h/1024);
  const gradient=x.createLinearGradient(0,0,256,0);gradient.addColorStop(0,'#168c25');gradient.addColorStop(.22,'#b9e634');gradient.addColorStop(.62,'#d0eb44');gradient.addColorStop(1,'#159e32');x.fillStyle=gradient;x.fillRect(0,0,256,1024);
  const ellipse=(cx,cy,rx,ry,fill,stroke=null,width=2)=>{x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,TAU);x.fillStyle=fill;x.fill();if(stroke){x.strokeStyle=stroke;x.lineWidth=width;x.stroke();}};
  x.fillStyle='#009638';x.fillRect(0,0,256,28);x.fillRect(0,996,256,28);for(let i=0;i<5;i++){x.fillStyle=i%2?'#6ebc27':'#c7df43';x.fillRect(0,4+i*4,256,2);x.fillRect(0,999+i*4,256,2);}
  x.fillStyle='#fff';x.strokeStyle='#2b261b';x.lineWidth=9;x.beginPath();x.roundRect(16,104,224,418,80);x.fill();x.stroke();
  ellipse(62,105,39,51,'#dc1520','#195bb5',4);x.font='bold 30px sans-serif';x.textAlign='center';x.fillStyle='#fff';x.fillText('不乖',62,115);x.font='bold 30px sans-serif';x.lineWidth=5;x.strokeStyle='#292511';x.strokeText('造句包',158,100);x.fillStyle='#ffdc31';x.fillText('造句包',158,100);
  x.fillStyle='#d91d21';x.font='bold 33px sans-serif';x.fillText('不乖',169,239);x.strokeStyle='#3b332b';x.lineWidth=2;x.setLineDash([2,3]);for(const y of [288,403]){x.beginPath();x.moveTo(40,y);x.lineTo(218,y-27);x.stroke();}x.setLineDash([]);
  x.font='bold 12px sans-serif';x.fillStyle='#184c96';x.fillText('做你的不乖　請用不乖造句',128,485);
  // Mint-green mascot with magenta outline; the aperture passes through its face.
  x.save();x.translate(-45,0);
  for(let i=0;i<5;i++)ellipse(134-i*5,568+i*28,11,20,'#ffe694','#eb1d73',3);
  x.fillStyle='#83efd6';x.strokeStyle='#e71e73';x.lineWidth=4;
  x.beginPath();x.moveTo(129,849);x.bezierCurveTo(108,788,122,676,145,608);x.bezierCurveTo(165,542,201,535,205,587);x.bezierCurveTo(206,627,171,696,182,756);x.lineTo(187,857);x.quadraticCurveTo(165,890,153,831);x.quadraticCurveTo(132,899,117,868);x.closePath();x.fill();x.stroke();
  x.beginPath();x.moveTo(135,715);x.lineTo(88,666);x.quadraticCurveTo(71,647,74,669);x.lineTo(133,752);x.closePath();x.fill();x.stroke();
  ellipse(174,646,25,46,'#af1753','#e71e73',4);ellipse(173,645,19,29,'#fff4df','#ec176b',3);
  ellipse(151,604,7,13,'#e62173');ellipse(155,775,21,38,'#ffe2aa','#ed2474',3);x.restore();
  ellipse(60,794,41,55,'#fff','#187c42',4);ellipse(53,772,19,24,'#6fbb38');ellipse(68,766,18,12,'#fff5da','#bd9947',2);x.font='bold 18px sans-serif';x.fillStyle='#3b261c';x.fillText('奶油椰子',60,827);x.fillStyle='#fff';x.font='bold 23px sans-serif';x.fillText('綠 色 金 順',128,957);x.restore();
 }
}
function paintBeerPackage(x,w,h){
 const gradient=x.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#b8bdbb');gradient.addColorStop(.15,'#f4f4ed');gradient.addColorStop(.55,'#e8ece6');gradient.addColorStop(.9,'#f8f8ef');gradient.addColorStop(1,'#aab0ae');x.fillStyle=gradient;x.fillRect(0,0,w,h);
 for(const cx of [w*.25,w*.75]){
  x.save();x.translate(cx,h*.50);x.beginPath();x.ellipse(0,0,w*.205,h*.35,0,0,TAU);x.fillStyle='#176b38';x.fill();x.strokeStyle='#e5f2d1';x.lineWidth=5;x.stroke();x.beginPath();x.ellipse(0,0,w*.18,h*.305,0,0,TAU);x.strokeStyle='#b7d57a';x.lineWidth=3;x.stroke();
  x.fillStyle='#e6efe0';x.beginPath();x.ellipse(0,-h*.12,w*.15,h*.085,0,0,TAU);x.fill();x.textAlign='center';x.fillStyle='#c62527';x.font='bold 25px sans-serif';x.fillText('金 牌',0,-h*.135);x.font='bold 13px sans-serif';x.fillText('Gold Medal',0,-h*.085);
  x.fillStyle='#f6f9e8';x.font='bold 58px sans-serif';x.fillText('台灣 啤酒',0,h*.035);
  x.fillStyle='#f1f2dd';x.fillRect(-w*.145,h*.085,w*.29,h*.125);x.fillStyle='#176b38';x.font='bold 29px serif';x.fillText('TAIWAN',0,h*.139);x.fillText('BEER',0,h*.195);x.fillStyle='#e5f2d1';x.font='bold 12px sans-serif';x.fillText('DISTINCTIVE FLAVOR LAGER BEER',0,-h*.235);x.restore();
 }
 let seed=154;for(let i=0;i<500;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=seed/4294967296;seed=(Math.imul(seed,1664525)+1013904223)>>>0;x.fillStyle=i%2?'#ffffff16':'#363c3811';x.fillRect(a*w,seed/4294967296*h,2,2);}
}
function attachFoodSpill(T,g,record,mat,d){
 const add=(geo,m,n)=>{const b=batch(T,g,geo,m,n);d.batches.push(b);return b;};
 if(record.snackProp){
  const geo=new T.CylinderGeometry(.055,.058,.145,14,5),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),w=1+.09*Math.sin(x*217+y*91+z*137);p.setXYZ(i,x*w,y+.004*Math.sin(x*185+z*141),z*w);}geo.computeVertexNormals();
  const cookie=mat('#edcb62');cookie.roughness=.97;add(geo,cookie,96);
 }
 if(record.beerProp){
  const liquid=mat('#dca53c');liquid.transparent=true;liquid.opacity=.75;liquid.roughness=.13;liquid.depthWrite=false;add(new T.SphereGeometry(1,10,8),liquid,76);
  const bubble=mat('#fff2ca');bubble.transparent=true;bubble.opacity=.75;bubble.roughness=.18;bubble.depthWrite=false;add(new T.SphereGeometry(1,8,6),bubble,112);
  // Reuse the rounded liquid stream; translate its nozzle to the pull-tab aperture.
  const jetRoot=new T.Group();jetRoot.position.z=.16;g.add(jetRoot);
  const streamRecord={colaMotion:{}};const goldMat=color=>{const m=mat(color==='#884326'?'#e0a238':'#e9be60');return m;};
  createColaStream(T,jetRoot,streamRecord,goldMat);record.beerProp.stream=streamRecord.colaMotion;jetRoot.scale.set(.65,.65,.65);jetRoot.position.y=1.98*(1-.65);
 }
 if(record.cardboard){
  const water=mat('#ffffff'),melon=mat('#ffffff'),banana=mat('#e8c646'),apple=mat('#c93c31');
  water.map=tex(T,record,256,128,(x,w,h)=>{x.fillStyle='#75a444';x.fillRect(0,0,w,h);for(let j=0;j<12;j++){x.fillStyle='#1c6132';x.beginPath();for(let i=0;i<=32;i++){const y=i*h/32,xx=j*w/12+3*Math.sin(i*.7+j);if(i===0)x.moveTo(xx,y);else x.lineTo(xx,y);}for(let i=32;i>=0;i--)x.lineTo(j*w/12+6+3*Math.sin(i*.7+j),i*h/32);x.fill();}},'street:fruit-watermelon-v154');
  melon.map=tex(T,record,256,128,(x,w,h)=>{x.fillStyle='#b5b48a';x.fillRect(0,0,w,h);x.strokeStyle='#ede0b0';x.lineWidth=1.3;for(let j=0;j<16;j++){x.beginPath();for(let i=0;i<24;i++){const xx=i*w/23,yy=j*h/16+3*Math.sin(i*1.4+j);if(i===0)x.moveTo(xx,yy);else x.lineTo(xx,yy);}x.stroke();}for(let j=0;j<26;j++){x.beginPath();for(let i=0;i<18;i++){const yy=i*h/17,xx=j*w/26+3*Math.sin(i*1.6+j);if(i===0)x.moveTo(xx,yy);else x.lineTo(xx,yy);}x.stroke();}},'street:fruit-melon-v154');
  add(new T.SphereGeometry(1,18,12),water,20);add(new T.SphereGeometry(1,18,12),melon,20);
  const curve=new T.CatmullRomCurve3([new T.Vector3(-.72,.43,0),new T.Vector3(-.48,-.15,0),new T.Vector3(0,-.39,0),new T.Vector3(.48,-.12,0),new T.Vector3(.65,.46,0)]);
  add(new T.TubeGeometry(curve,18,.19,9,false),banana,24);
  const profile=[[0,-.82],[.45,-.80],[.76,-.55],[.93,-.08],[.95,.38],[.75,.73],[.46,.82],[.18,.67],[.095,.70],[.07,.98],[0,1.02]];
  const appleGeo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),24),a=appleGeo.attributes.position,colors=[];
  for(let i=0;i<a.count;i++){const stem=a.getY(i)>.69&&Math.hypot(a.getX(i),a.getZ(i))<.12;const c=new T.Color(stem?'#654222':'#c93c31');colors.push(c.r,c.g,c.b);}appleGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));apple.color.set('#ffffff');apple.vertexColors=true;add(appleGeo,apple,24);
 }
}
function animateFoodSpill(record,d,time,dt,speed,moving,teleport){
 const snack=record.snackProp,beer=record.beerProp,box=record.cardboard;
 // Walking remains unchanged; fast movement opens new packages. Cardboard
 // uses precisely the existing flap energy, so fruit starts as the flaps lift.
 const running=moving&&speed>2.5&&!teleport;if(teleport)d.foodOpen=0;
 const open=box?d.energy:(d.foodOpen=(d.foodOpen||0)+((running?1:0)-(d.foodOpen||0))*(1-Math.exp(-dt*12)));
 if(snack){for(const {hinge,sign} of snack.lips)hinge.rotation.x=-sign*open*1.25;snack.mouth.scale.z=1+open*2.4;}
 if(beer){beer.flap.rotation.x=open*1.40;beer.tab.rotation.x=-open*.75;beer.stream.open=open;updateColaStream(beer.stream,time);}
 const emitting=!teleport&&(box?moving&&open>.25:running&&open>.25);
 if(emitting){
  d.credit+=dt*(snack?58:beer?100:38);while(d.credit>=1){d.credit--;const i=Math.floor(rng(d)*d.batches.length),b=d.batches[i],angle=rng(d)*TAU;
   if(snack)emit(d,b,Math.cos(angle)*.22,1.87,Math.sin(angle)*.08,1.2+speed*.18,1.8+rng(d)*1.3,.8+rng(d)*.55,1.7);
   else if(beer)emit(d,b,0,2,.16,.7+speed*.12,1.2+rng(d)*2.2,(i===0?.022:.032)+rng(d)*.028,1.05+rng(d)*.5);
   else emit(d,b,(rng(d)-.5)*.35,1.02,(rng(d)-.5)*.26,1.3+speed*.10,1.35+rng(d)*1.7,.075+rng(d)*.075,2.6);
  }
 }else d.credit=0;
 for(const b of d.batches){if(b.mesh.count||emitting||teleport)updateBatch(d,b,dt);}
}
