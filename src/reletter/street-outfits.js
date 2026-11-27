import {staticPaintTexture} from '../paint-texture-source.js';
import {createColaStream,updateColaStream} from './street-outfit-motion.js';
// Procedural Taiwanese street objects, shared by gameplay and actual 3D portraits.
const TAU=Math.PI*2;
export function softPorkGeometry(T,seed=0){
 const g=new T.SphereGeometry(1,12,8),a=g.attributes.position;
 for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
  const n=1+.13*Math.sin(x*7+y*4+seed)+.09*Math.cos(z*8-y*6+seed*2)+.06*Math.sin((x+z)*11);
  const soft=v=>Math.sign(v)*Math.pow(Math.abs(v),.75);
  a.setXYZ(i,soft(x)*n,soft(y)*n,soft(z)*n);}
 a.needsUpdate=true;g.computeVertexNormals();return g;
}
function random(seed){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
function texture(T,record,w,h,paint){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);const tex=staticPaintTexture(T,canvas);tex.colorSpace=T.SRGBColorSpace;record.extraTextures??=[];record.extraTextures.push(tex);return tex;}
function mesh(T,g,geo,mat,p=[0,0,0],s=[1,1,1]){const m=new T.Mesh(geo,mat);m.position.set(...p);m.scale.set(...s);g.add(m);return m;}
const STREET_KINDS=new Set(['ggcola-disguise','bei7-road-disguise','traffic-light-disguise','taipower-box-disguise']);
export function buildStreetOutfit(T,g,kind,record,mat){
 if(!STREET_KINDS.has(kind))return null;
 const b=(p,s,m)=>mesh(T,g,new T.BoxGeometry(1,1,1),m,p,s);
 const c=(p,r1,r2,h,m,n=28)=>mesh(T,g,new T.CylinderGeometry(r1,r2,h,n),m,p);
 const ring=(p,r,t,m)=>mesh(T,g,new T.TorusGeometry(r,t,8,40),m,p);
 const lathe=(profile,m)=>mesh(T,g,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),48),m);
 const rng=random(7823),steel=mat('#a6ada9',.65),black=mat('#262b29');
 if(kind==='ggcola-disguise'){
  const cola=mat('#6c240f'),pet=mat('#a95a2f'),red=mat('#d91622'),foam=mat('#e7ba79');cola.roughness=.22;pet.roughness=.2;red.roughness=.38;
  const profile=[[.10,.02],[.31,.02],[.39,.10],[.41,.25],[.36,.49],[.33,.69],[.39,.86],[.40,1.20],[.34,1.42],[.25,1.60],[.14,1.77],[.12,1.88],[.12,1.95]];
  lathe(profile,cola);
  // PET lobes and highlights, rather than a cylindrical can.
  for(let i=0;i<5;i++){const a=i*TAU/5;mesh(T,g,new T.SphereGeometry(1,12,8),cola,[Math.sin(a)*.23,.11,Math.cos(a)*.23],[.18,.12,.18]);}
  const label=mat('#ffffff');label.map=texture(T,record,1024,256,(x,w,h)=>{
   x.fillStyle='#d61324';x.fillRect(0,0,w,h);x.fillStyle='#fff5eb';x.fillRect(0,0,w,7);x.fillRect(0,h-7,w,7);
   for(const at of [256,768]){x.textAlign='center';x.font='italic bold 106px Georgia,serif';x.fillText('GGcola',at,137);x.beginPath();x.moveTo(at-192,167);x.bezierCurveTo(at-50,224,at+80,124,at+187,179);x.bezierCurveTo(at+20,151,at-65,246,at-192,167);x.fill();x.font='bold 18px sans-serif';x.fillText('ORIGINAL TASTE',at,232);}
  });
  const band=c([0,1.025,0],.408,.408,.37,label,48);band.rotation.y=Math.PI/2;
  c([0,1.92,0],.135,.135,.10,pet);const neck=ring([0,1.96,0],.13,.016,steel);neck.rotation.x=Math.PI/2;
  for(let i=0;i<4;i++){const q=ring([0,1.84+i*.024,0],.127,.008,pet);q.rotation.x=Math.PI/2;}
  const cap=new T.Group();cap.position.set(0,1.97,-.14);g.add(cap);
  mesh(T,cap,new T.CylinderGeometry(.155,.155,.105,36),red,[0,.05,.14]);
  const ridges=new T.InstancedMesh(new T.BoxGeometry(.016,.085,.018),red,30),capDummy=new T.Object3D();for(let i=0;i<30;i++){const a=i*TAU/30;capDummy.position.set(Math.sin(a)*.151,.05,.14+Math.cos(a)*.151);capDummy.rotation.y=a;capDummy.updateMatrix();ridges.setMatrixAt(i,capDummy.matrix);}cap.add(ridges);
  const bubbles=new T.InstancedMesh(new T.SphereGeometry(1,7,5),foam,80),dummy=new T.Object3D();
  for(let i=0;i<80;i++){const a=rng()*TAU,y=.18+rng()*1.48,r=y>1.40?.25:.345;dummy.position.set(Math.sin(a)*r,y,Math.cos(a)*r);dummy.scale.setScalar(.005+rng()*.012);dummy.updateMatrix();bubbles.setMatrixAt(i,dummy.matrix);}g.add(bubbles);
  const droplets=new T.InstancedMesh(new T.SphereGeometry(1,10,7),cola,36),froth=new T.InstancedMesh(new T.SphereGeometry(1,6,4),foam,24);
  for(const inst of [droplets,froth]){inst.frustumCulled=false;inst.visible=false;for(let i=0;i<inst.count;i++){dummy.position.set(0,1.96,0);dummy.scale.setScalar(0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}g.add(inst);}
  record.colaMotion={cap,droplets,froth,dummy,run:0,air:0,grace:0,open:0,elapsed:0,last:null,pos:new T.Vector3(),delta:new T.Vector3()};
  createColaStream(T,g,record,mat);
  return {openingY:.81,frontZ:.39};
 }
 if(kind==='bei7-road-disguise'){
  const pole=mat('#929791',.55),yellow=mat('#d6ad26');c([0,1.50,0],.13,.19,3,pole);
  c([0,.09,0],.23,.24,.18,steel);for(let i=0;i<8;i++){const q=b([0,.21+i*.09,.18],[.22,.048,.026],i%2?black:yellow);q.rotation.z=-.45;}
  for(const y of [2.08,2.77]){c([0,y,0],.16,.16,.065,steel);b([0,y,.17],[.25,.07,.10],steel);}
  const sign=mat('#ffffff');sign.map=texture(T,record,768,320,(x,w,h)=>{
   x.fillStyle='#138b69';x.fillRect(0,0,w,h);x.strokeStyle='#e5e9db';x.lineWidth=14;x.strokeRect(9,9,w-18,h-18);
   x.fillStyle='#f6f5ed';x.beginPath();x.moveTo(29,160);x.lineTo(103,88);x.lineTo(103,232);x.closePath();x.fill();
   x.textAlign='center';x.font='bold 112px "Noto Sans TC",sans-serif';x.fillText('北 七 路',435,139);x.font='bold 79px Arial,sans-serif';x.fillText('Bei 7th Rd.',435,251);
  });
  b([0,2.52,.13],[1.62,.69,.065],steel);b([0,2.52,.17],[1.57,.64,.022],sign);const rear=b([0,2.52,.09],[1.57,.64,.022],sign);rear.rotation.y=Math.PI;
  return {frontZ:.19};
 }
 if(kind==='traffic-light-disguise'){
  const housing=mat('#216253',.35),rim=mat('#143f39',.25),colors=['#ff2417','#ffbd18','#00e9ad'],lights=[];
  const ys=[2.06,1.20,.34];
  for(let i=0;i<3;i++){
   const y=ys[i],m=mat(colors[i]);m.emissive.set(colors[i]);m.emissiveIntensity=1.4;m.roughness=.3;lights.push(m);
   b([0,y,0],[.88,.83,.60],housing);
   const outer=ring([0,y,.32],.31,.037,rim),inner=ring([0,y,.36],.274,.025,m);
   // Open-ended semicircular sun visor, extending out from the lamp.
   const hood=new T.CylinderGeometry(.32,.32,.24,36,1,true,Math.PI/2,Math.PI);
   const visor=mesh(T,g,hood,housing,[0,y,.47]);visor.name='signal-visor';visor.rotation.x=Math.PI/2;housing.side=T.DoubleSide;
   if(i!==1){
    const lens=mesh(T,g,new T.CircleGeometry(.267,40),m,[0,y,.345]);
    const leds=new T.InstancedMesh(new T.SphereGeometry(1,6,4),m,81),dummy=new T.Object3D();let k=0;
    for(let row=-5;row<=5;row++)for(let col=-5;col<=5;col++)if(row*row+col*col<=25){dummy.position.set(col*.048,y+row*.048,.358);dummy.scale.set(.012,.012,.01);dummy.updateMatrix();leds.setMatrixAt(k++,dummy.matrix);}leds.count=k;g.add(leds);
   }
   for(const sx of [-1,1])for(const sy of [-1,1])b([sx*.38,y+sy*.35,.315],[.045,.045,.025],steel);
  }
  record.trafficLights=lights;return {openingY:1.20,frontZ:.35};
 }
 if(kind==='taipower-box-disguise'){
  const cabinet=mat('#488da9',.38),edge=mat('#34748c',.45),paint=mat('#ffffff');
  paint.map=texture(T,record,768,768,(x,w,h)=>{
   x.fillStyle='#59a8cf';x.fillRect(0,0,w,h);
   const path=(pts,color)=>{x.fillStyle=color;x.beginPath();pts.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();};
   path([[0,350],[100,180],[260,320],[400,136],[640,310],[768,220],[768,580],[0,580]],'#285d98');
   path([[0,390],[170,260],[285,420],[470,255],[700,380],[768,330],[768,640],[0,640]],'#245a79');
   path([[0,510],[768,460],[768,768],[0,768]],'#557849');
   path([[390,470],[505,525],[332,605],[550,680],[700,768],[120,768],[250,660],[196,600],[385,550]],'#7ec7d5');
   for(let i=0;i<450;i++){const a=rng()*w,b=365+rng()*400;x.globalAlpha=.23;x.fillStyle=['#24553d','#c4d4a0','#155b7b','#e7e0ba','#337d4c'][i%5];x.fillRect(a,b,3+rng()*45,2+rng()*9);}x.globalAlpha=1;
   for(let i=0;i<32;i++){const a=rng()*w,b=490+rng()*180;path([[a-8,b],[a,b-40-rng()*58],[a+10,b]],i%2?'#244c39':'#395e39');}
   const stickers=['NO SIGNAL','????','GG','不要按','電力設施','404','北七路','FREE WIFI','禁止睡覺','咕咕','⚡','好運'];for(let i=0;i<stickers.length;i++){const a=32+rng()*650,b=45+rng()*680;x.save();x.translate(a,b);x.rotate((rng()-.5)*.65);x.fillStyle='#f4eee0';x.fillRect(-4,-6,110,43);x.fillStyle=['#c92b44','#122b53','#e3ad22','#32744e'][i%4];x.fillRect(0,0,102,31);x.fillStyle='#fff';x.font='bold 17px sans-serif';x.fillText(stickers[i],5,22,92);x.restore();}
   for(let i=0;i<120;i++){x.fillStyle=i%2?'#9b5434':'#b4c5bc';const a=rng()*w,b=rng()*h;x.globalAlpha=.6;x.fillRect(a,b,2+rng()*16,1+rng()*5);}x.globalAlpha=1;
  });
  b([0,1.02,0],[1.31,2.04,.89],cabinet);
  b([0,1.02,.45],[1.26,1.98,.025],paint);const back=b([0,1.02,-.45],[1.26,1.98,.025],paint);back.rotation.y=Math.PI;
  for(const side of [-1,1]){const face=b([side*.66,1.02,0],[.018,1.98,.85],paint);for(let i=0;i<7;i++)b([side*.677,1.62+i*.044,0],[.025,.018,.39],edge);}
  b([0,1.02,.472],[.018,1.94,.016],edge);b([0,.22,.473],[1.27,.027,.02],edge);b([.10,.66,.49],[.10,.21,.055],steel);b([.10,.56,.535],[.07,.075,.044],black);
  for(const sx of [-1,1]){const eye=ring([sx*.39,2.08,0],.09,.027,steel);eye.rotation.y=Math.PI/2;for(const y of [.30,1.70])b([sx*.61,y,.48],[.067,.09,.036],steel);}
  return {openingY:.99,frontZ:.47};
 }
 return null;
}
export function streetMotionStep(state,dt,moving,airborne,teleport=false){
 dt=Math.max(0,Math.min(.1,dt));if(teleport){state.run=state.air=state.grace=0;return false;}
 state.run=moving?state.run+dt:0;
 if(airborne){state.air+=dt;state.grace=.25;}else if(state.grace>0){state.grace-=dt;if(state.grace<=0)state.air=0;}else state.air=0;
 return state.run>=3||state.air>=3;
}
export function animateStreetOutfit(record,time,root,dt){
 if(record.trafficLights){for(let i=0;i<3;i++){const phase=(time+i*.53)%2.4;const off=phase<.48||phase>.70&&phase<.80;const lamp=record.trafficLights[i];lamp.emissiveIntensity=off?0:2.8;lamp.color.copy(lamp.emissive).multiplyScalar(off?.025:1);}}
 if(!root)return;const d=record.colaMotion||record.riceMotion;if(!d)return;
 dt=Math.max(.001,Math.min(.1,dt));root.getWorldPosition(d.pos);
 if(!d.last){d.last=d.pos.clone();return;}d.delta.copy(d.pos).sub(d.last);d.last.copy(d.pos);
 const teleport=d.delta.length()>3,mode=root.userData?.current,airborne=['jump','fall','fly'].includes(mode)||Math.abs(d.delta.y/dt)>.5;
 const moving=!teleport&&Math.hypot(d.delta.x,d.delta.z)/dt>.18;
 if(record.riceMotion){const strength=teleport?0:moving||airborne?1:0;d.energy+=(strength-d.energy)*(1-Math.exp(-dt*12));if(d.energy<.001&&d.resting)return;d.resting=d.energy<.001;for(const group of d.groups){for(let i=0;i<group.rest.length;i++){const [x,y,z,sx,sy,sz,a]=group.rest[i],phase=time*10+a;d.dummy.position.set(x+Math.sin(phase)*.019*d.energy,y+Math.abs(Math.sin(phase))* .085*d.energy,z+Math.cos(phase)*.016*d.energy);d.dummy.rotation.set(.15*Math.sin(phase)*d.energy,a,.20*Math.cos(phase)*d.energy);d.dummy.scale.set(sx*(1+.08*Math.sin(phase)*d.energy),sy*(1-.12*Math.sin(phase)*d.energy),sz);d.dummy.updateMatrix();group.mesh.setMatrixAt(i,d.dummy.matrix);}group.mesh.instanceMatrix.needsUpdate=true;}return;}
 const active=streetMotionStep(d,dt,moving,airborne,teleport);d.open+=(Number(active)-d.open)*(1-Math.exp(-dt*10));d.cap.rotation.x=-1.95*d.open;d.elapsed+=dt;updateColaStream(d,time);
 for(const [inst,phase,sz] of [[d.droplets,0,.017],[d.froth,.35,.013]]){inst.visible=d.open>.03;if(!inst.visible)continue;for(let i=0;i<inst.count;i++){const u=(d.elapsed* .85+i/inst.count+phase)%1,a=i*2.39996+time*.4,spread=(.035+.56*u*u)*d.open;const y=1.98+(2.9*u-2.3*u*u)*d.open;d.dummy.position.set(Math.cos(a)*spread,y,Math.sin(a)*spread);d.dummy.rotation.set(.2*Math.sin(a),a,.2*Math.cos(a));d.dummy.scale.set(sz*(1-u*.45),sz*(1.3+2*Math.abs(.5-u)),sz*(1-u*.45));d.dummy.updateMatrix();inst.setMatrixAt(i,d.dummy.matrix);}inst.instanceMatrix.needsUpdate=true;}
}
