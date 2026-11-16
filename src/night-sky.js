import * as THREE from 'three';

// Entire celestial composition is point geometry: moon, crater rims, stars,
// and thin drifting clouds. No opaque sky spheres or textured moon billboards.
const golden='#ffe683';
const cloudTint='#a3c6fb';
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function points(name,positions,colors,size,opacity){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const m=new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity,depthWrite:false,depthTest:false,sizeAttenuation:false,toneMapped:false});
  const p=new THREE.Points(g,m);p.name=name;p.frustumCulled=false;p.renderOrder=-190;return p;
}
function colorTriplet(color,brightness,output){
  const c=new THREE.Color(color);
  output.push(Math.min(1,c.r*brightness),Math.min(1,c.g*brightness),Math.min(1,c.b*brightness));
}
function diskStars(rnd,count,radius,craters){
  const positions=[],colors=[];
  for(let i=0;i<count;i++){
    const r=Math.sqrt(rnd())*radius,a=rnd()*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r;
    let shade=.67+rnd()*.33;
    for(const crater of craters){
      const distance=Math.hypot(x-crater[0],y-crater[1])/crater[2];
      const inside=distance<.78,edge=distance>=.82&&distance<=1.14;
      if(inside)shade*=.46+.13*rnd();
      if(edge)shade*=1.25;
    }
    const sphericalDepth=Math.sqrt(Math.max(0,1-r*r/(radius*radius)))*1.6;
    positions.push(x,y,sphericalDepth);
    colorTriplet(golden,shade,colors);
  }
  return {positions,colors};
}
function craterDetail(rnd,craters){
  const positions=[],colors=[];
  for(const [cx,cy,r] of craters){
    for(let k=0;k<1050;k++){
      const a=rnd()*Math.PI*2,ring=.86+rnd()*.22,rr=r*ring;
      positions.push(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,2.1);
      colorTriplet(k%4===0?'#f8c85f':'#fff2af',.55+rnd()*.38,colors);
    }
    for(let k=0;k<440;k++){
      const a=rnd()*Math.PI*2,rr=Math.sqrt(rnd())*r*.8;
      positions.push(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,2.15);
      colorTriplet('#ab873d',.6+rnd()*.3,colors);
    }
  }
  return {positions,colors};
}
function makeMoon(root,touch,rnd){
  const moon=new THREE.Group();
  moon.name='Giant cratered yellow particle moon';
  moon.position.set(-93,90,-136);
  moon.lookAt(0,0,0);
  root.add(moon);
  const craters=[[-12,10,7],[11,14,4.7],[6,-9,8],[-19,-11,3.7],[19,-2,5.4],[0,21,3.1]];
  const body=diskStars(rnd,touch?13000:33000,36,craters);
  moon.add(points('Moon golden particulate surface',body.positions,body.colors,touch?1.9:2.2,.94));
  const rings=craterDetail(rnd,craters);
  moon.add(points('Moon visible crater outlines',rings.positions,rings.colors,touch?1.5:1.85,.72));
  const haloPositions=[],haloColors=[];
  for(let i=0;i<(touch?1800:4500);i++){
    const a=rnd()*Math.PI*2,r=36+rnd()*9;
    haloPositions.push(Math.cos(a)*r,Math.sin(a)*r,-1.8);
    colorTriplet('#e2dca6',.5+rnd()*.5,haloColors);
  }
  moon.add(points('Diffuse moonlight dust',haloPositions,haloColors,2.5,.19));
}
function makeCloud(root,index,rnd,touch){
  const cloud=new THREE.Group();cloud.name='Transparent drifting point cloud '+index;
  const centers=[[-80,95,-120],[28,89,-140],[115,77,-85],[-145,62,25],[100,109,75],[-22,120,140],[-125,109,100],[70,83,145]];
  const c=centers[index%centers.length];cloud.position.set(...c);
  cloud.lookAt(0,0,0);
  const positions=[],colors=[],count=touch?1400:3200;
  for(let i=0;i<count;i++){
    const lobe=i%6,angle=(lobe-2.5)*.55,spread=8+(lobe%3)*3;
    const u=(rnd()+rnd()+rnd()-1.5)*spread,v=(rnd()+rnd()+rnd()-1.5)*(2.5+lobe%3);
    const x=angle*15+u,y=Math.sin(lobe*2.8)*2.3+v;
    if(rnd()<.14)continue;
    positions.push(x,y,(rnd()-.5)*5);
    colorTriplet(index%3===0?'#c9d9fa':cloudTint,.55+rnd()*.42,colors);
  }
  cloud.add(points('Cloud made of fine transparent particles',positions,colors,1.75,.19));
  root.add(cloud);
  return {cloud,baseX:c[0],phase:index*1.8};
}
export function createMoonlitSky(scene){
  const touch=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const rnd=random(173331),root=new THREE.Group();root.name='Moonlit particle sky';scene.add(root);
  makeMoon(root,touch,rnd);
  const clouds=Array.from({length:8},(_,i)=>makeCloud(root,i,rnd,touch));
  const stars=[],colors=[];
  for(let i=0;i<(touch?1100:2400);i++){
    const a=rnd()*Math.PI*2,el=.16+rnd()*1.06,rad=220;
    stars.push(rad*Math.cos(a)*Math.cos(el),rad*Math.sin(el),rad*Math.sin(a)*Math.cos(el));
    colorTriplet(rnd()<.15?'#ffe4ac':'#9fbfff',.3+rnd()*.55,colors);
  }
  root.add(points('Sparse far star points',stars,colors,1.25,.55));
  return {root,clouds,update(camera,time){
    if(camera)root.position.copy(camera.position);
    for(const {cloud,baseX,phase} of clouds)cloud.position.x=baseX+Math.sin(time*.034+phase)*6+Math.cos(time*.012+phase)*3;
  }};
}
