import {staticPaintTexture} from '../paint-texture-source.js';
const TAU=Math.PI*2;
function part(T,g,geo,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o;}
function sphere(T,g,mat,x,y,z,sx,sy,sz){return part(T,g,new T.SphereGeometry(1,16,10),mat,x,y,z,sx,sy,sz);}
function tex(T,record,w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=staticPaintTexture(T,c);t.colorSpace=T.SRGBColorSpace;record.extraTextures??=[];record.extraTextures.push(t);return t;}
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
export function buildNewStreetProp(T,g,kind,record,mat){
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
 const mesh=new T.InstancedMesh(geo,mat,count);mesh.count=0;mesh.frustumCulled=false;g.add(mesh);
 return {mesh,particles:Array.from({length:count},()=>({age:99,life:0,p:new T.Vector3(),v:new T.Vector3(),angle:0,size:1,floor:0})),next:0};
}
function smokeBatch(T,g,record){
 const texture=tex(T,record,64,64,(x)=>{const radial=x.createRadialGradient(32,32,1,32,32,31);radial.addColorStop(0,'rgba(17,16,18,.78)');radial.addColorStop(.4,'rgba(22,20,22,.55)');radial.addColorStop(1,'rgba(25,24,25,0)');x.fillStyle=radial;x.fillRect(0,0,64,64);});
 const material=new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false});record.materials.push(material);let geometry;
 return {particles:Array.from({length:24},()=>{const sprite=new T.Sprite(material);geometry??=sprite.geometry.clone();sprite.geometry=geometry;sprite.visible=false;sprite.scale.setScalar(0);g.add(sprite);return {sprite,p:new T.Vector3(),v:new T.Vector3(),age:99,life:0,size:1};}),next:0};
}
function envelopeGeometry(T){const shape=new T.Shape();shape.moveTo(-.11,-.07);shape.lineTo(.11,-.07);shape.lineTo(.11,.07);shape.lineTo(-.11,.07);shape.closePath();const geo=new T.ShapeGeometry(shape),uv=geo.attributes.uv,a=geo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,a.getX(i)/.22+.5,a.getY(i)/.14+.5);return geo;}
export function attachStreetMotion(T,g,kind,record,mat){
 if(!['chimney-disguise','trash-can-disguise','garbage-bag-disguise','fried-chicken-disguise','postbox-disguise','pharmacy-bag-disguise','goldfish-bowl-disguise'].includes(kind))return;
 const d={T,g,kind,pos:new T.Vector3(),last:null,delta:new T.Vector3(),inverse:new T.Matrix4(),dummy:new T.Object3D(),origin:new T.Vector3(),local:new T.Vector3(),worldScale:new T.Vector3(),run:0,air:0,grace:0,elapsed:0,credit:0,energy:0,floor:null,batches:[],seed:7823};
 record.extraStreetMotion=d;
 const twoSided=color=>{const m=mat(color);m.side=T.DoubleSide;return m;};
 const add=(geo,m,n)=>{const b=batch(T,g,geo,m,n);d.batches.push(b);return b;};
 if(kind==='chimney-disguise')d.smoke=smokeBatch(T,g,record);
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
 p.p.copy(d.g.localToWorld(d.origin.set(x,y,z)));p.v.set(Math.cos(a)*speed,up,Math.sin(a)*speed);if(d.kind==='postbox-disguise'){p.v.set((rng(d)-.5)*.8,0,1).transformDirection(d.g.matrixWorld).multiplyScalar(speed);p.v.y=up;}
}
function updateBatch(d,b,dt,scale){
 let n=0;const dummy=d.dummy;
 for(const p of b.particles){if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life)continue;
  p.v.y-=9.8*dt;p.p.addScaledVector(p.v,dt);if(p.p.y<p.floor+.035){p.p.y=p.floor+.035;p.v.y=0;p.v.x*=.65;p.v.z*=.65;}
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
 d.g.updateWorldMatrix(true,false);d.inverse.copy(d.g.matrixWorld).invert();const scale=Math.max(.001,d.g.getWorldScale(d.worldScale).y);
 if(teleport){d.credit=0;for(const b of d.batches)for(const p of b.particles)p.age=p.life;if(d.smoke)for(const p of d.smoke.particles){p.age=p.life;p.sprite.visible=false;}d.energy=0;if(d.rat){d.ratAge=99;d.rat.visible=false;}}
 for(const soft of record.softMeshes||[]){const a=soft.mesh.geometry.attributes.position,b=soft.base;if(d.energy<.002&&soft.resting)continue;soft.resting=d.energy<.002;
  for(let i=0;i<a.count;i++){const x=b[i*3],y=b[i*3+1],z=b[i*3+2],weight=soft.kind==='pharmacy'?Math.min(1,Math.abs(y-.87)*2.4):1,phase=time*9+y*6+x*5;const w=soft.amp*d.energy*weight;a.setXYZ(i,x+w*Math.sin(phase),y+w*.37*Math.sin(phase*1.4+z*6),z+w*Math.cos(phase+x*7));}a.needsUpdate=true;soft.mesh.geometry.computeVertexNormals();
 }
 const fish=record.fishBowl;
 if(fish){
  fish.slosh+=((moving||airborne?Math.min(1,speed*.15+.25):0)-fish.slosh)*(1-Math.exp(-dt*6));
  fish.surface.rotation.x=-Math.PI/2+Math.sin(time*7)*.14*fish.slosh;fish.surface.rotation.y=Math.cos(time*6)*.14*fish.slosh;
  if(airborne&&!fish.wasAir&&!teleport&&d.delta.y>0)fish.jumpAge=0;fish.wasAir=airborne;fish.jumpAge+=dt;
  for(let i=0;i<fish.fish.length;i++){const {f,tail}=fish.fish[i],a=time*(i?-.8:1)+i*Math.PI,r=.35+.05*Math.sin(time*1.4+i),u=Math.max(0,Math.min(1,(fish.jumpAge-i*.11)/.75)),leap=fish.jumpAge>=i*.11&&fish.jumpAge<i*.11+.75?Math.sin(u*Math.PI)*.71:0;f.position.set(Math.cos(a)*r,.65+.045*Math.sin(time*3+i)+leap,Math.sin(a)*r);f.rotation.y=-a+(i?Math.PI:0);f.rotation.z=leap>0?Math.cos(u*Math.PI)*.55:0;tail.rotation.y=Math.sin(time*15+i)*.65;}
 }
 if(d.rat){const open=active?1:0;d.lidOpen=(d.lidOpen||0)+(open-(d.lidOpen||0))*(1-Math.exp(-dt*9));if(record.trashLid)record.trashLid.rotation.x=-1.6*d.lidOpen;
  d.ratAge+=dt;if(active&&d.lidOpen>.65&&d.ratAge>2.8){d.ratAge=0;d.ratPos.copy(d.g.localToWorld(d.origin.set(0,1.04,.12)));d.ratDirection.set((rng(d)-.5)*.65,0,1).transformDirection(d.g.matrixWorld);d.ratVelocity.copy(d.ratDirection).multiplyScalar(1.65);d.ratVelocity.y=1.5;d.ratFloor=d.floor??d.pos.y;}
  d.rat.visible=d.ratAge<2.6;if(d.rat.visible){d.ratVelocity.y-=9.8*dt;d.ratPos.addScaledVector(d.ratVelocity,dt);if(d.ratPos.y<d.ratFloor+.11*scale){d.ratPos.y=d.ratFloor+.11*scale;d.ratVelocity.y=0;}d.rat.position.copy(d.local.copy(d.ratPos).applyMatrix4(d.inverse));d.local.copy(d.ratDirection).transformDirection(d.inverse);d.rat.rotation.y=Math.atan2(-d.local.z,d.local.x);for(let j=0;j<d.ratLegs.length;j++)d.ratLegs[j].rotation.z=Math.sin(time*22+j*Math.PI*.75)*.5;}
  for(let i=0;i<d.flies.length;i++){const {f,w1,w2}=d.flies[i],a=time*(2.1+i*.07)+i*2.4;f.visible=d.lidOpen>.2;const approach=.5+(1-d.lidOpen)*1.6;f.position.set(Math.cos(a)*(approach+.11*Math.sin(a*2)),1.15+.25*Math.sin(a*1.7+i),Math.sin(a)*approach);f.rotation.y=-a;w1.rotation.z=Math.sin(time*70+i)*.7;w2.rotation.z=-w1.rotation.z;}
 }
 const smoke=d.smoke;
 if(smoke){const rate=teleport?0:5+Math.min(9,speed*.75)+(airborne?6:0);d.credit+=rate*dt;
  while(d.credit>=1){d.credit--;const p=smoke.particles[smoke.next++%smoke.particles.length];p.age=0;p.life=2.1;p.size=.22;p.p.copy(d.g.localToWorld(d.origin.set((rng(d)-.5)*.16,3.02,(rng(d)-.5)*.16)));p.v.set((rng(d)-.5)*.35,.55+speed*.035,(rng(d)-.5)*.35);}
  for(const p of smoke.particles){p.age+=dt;p.sprite.visible=p.age<p.life;if(!p.sprite.visible)continue;p.p.addScaledVector(p.v,dt);p.sprite.position.copy(d.local.copy(p.p).applyMatrix4(d.inverse));const u=p.age/p.life;p.sprite.scale.setScalar((p.size+u*.58)*Math.min(1,(1-u)*3));}
  return;
 }
 const producing=!teleport&&(d.kind==='fried-chicken-disguise'?moving:active);
 if(producing&&d.batches.length){d.credit+=dt*(d.kind==='fried-chicken-disguise'?12:9);while(d.credit>=1){d.credit--;const b=d.batches[Math.floor(rng(d)*d.batches.length)],a=rng(d)*TAU;
  switch(d.kind){
   case 'fried-chicken-disguise':emit(d,b,Math.cos(a)*.62,.8+rng(d)*.7,Math.sin(a)*.18,.6,.2,.023+rng(d)*.034,1.4);break;
   case 'garbage-bag-disguise':emit(d,b,0,.95,0,1.25,1.7,.8+rng(d)*.4,2.2);break;
   case 'pharmacy-bag-disguise':emit(d,b,0,1.85,.08,1.1,1.4,1,2);break;
   case 'postbox-disguise':emit(d,b,rng(d)<.5?-.245:.245,.75,.39,1.45,1.3,.9,2.2);break;
   case 'goldfish-bowl-disguise':emit(d,b,Math.cos(a)*.52,1.12,Math.sin(a)*.52,1.3,1.6,.022+rng(d)*.021,1.2);break;
  }
 }}else d.credit=0;
 for(const b of d.batches)updateBatch(d,b,dt,scale);
}
export function createColaStream(T,g,record,mat){
 const cola=mat('#78321b');cola.roughness=.15;cola.transparent=true;cola.opacity=.88;cola.side=T.DoubleSide;cola.depthWrite=false;
 const geo=new T.BufferGeometry(),n=26,sides=12,positions=new Float32Array(n*sides*3),indices=[];
 for(let j=0;j<n-1;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
 for(let i=0;i<positions.length;i+=3)positions[i+1]=1.96;
 geo.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geo.setIndex(indices);geo.computeVertexNormals();
 const jet=part(T,g,geo,cola);jet.visible=false;jet.frustumCulled=false;
 record.colaMotion.jet={mesh:jet,n,sides};
}
export function updateColaStream(d,time){
 if(!d.jet)return;const {mesh,n,sides}=d.jet;mesh.visible=d.open>.03;if(!mesh.visible)return;
 const a=mesh.geometry.attributes.position;
 for(let j=0;j<n;j++){const u=j/(n-1),phase=time*6-u*5,cx=Math.sin(phase)*.14*u*d.open,cz=.28*u*u*d.open,y=1.98+(2.7*u-2.05*u*u)*d.open,rad=(.075*(1-u)+.012)*d.open*(1+.2*Math.sin(phase*2));
  for(let i=0;i<sides;i++){const theta=i*TAU/sides;a.setXYZ(j*sides+i,cx+Math.cos(theta)*rad,y+Math.sin(theta)*rad*u*.36,cz+Math.sin(theta)*rad);}
 }a.needsUpdate=true;mesh.geometry.computeVertexNormals();
}
export function animateFaultyMutton(mat,time){const t=((time%8.1)+8.1)%8.1;const off=(t>.12&&t<.24)||(t>.36&&t<.57)||(t>1.64&&t<1.71)||(t>3.18&&t<3.92)||(t>4.03&&t<4.10)||(t>4.18&&t<4.39)||(t>6.8&&t<7.4);mat.emissiveIntensity=off?0:2.2;mat.color.setScalar(off?.015:1);}
