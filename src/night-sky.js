import * as THREE from 'three';

// The sky is an infinitely distant WORLD-ORIENTED backdrop. Only its origin
// follows the camera position: it never follows the camera's rotation.
// Every cloud is a translucent object hundreds of metres away with depth
// testing enabled, so scene geometry always occludes it.
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function makeCloudTexture(seed,kind){
 const rnd=random(seed),canvas=document.createElement('canvas');
 canvas.width=640;canvas.height=256;
 const mask=document.createElement('canvas');mask.width=640;mask.height=256;
 const m=mask.getContext('2d');m.fillStyle='#fff';
 const broad=kind==='broad',wispy=kind==='wispy',broken=kind==='broken';
 const count=broad?34:wispy?14:23;
 for(let i=0;i<count;i++){
  const x=38+rnd()*560,y=(broad?158:wispy?150:157)+(rnd()-.5)*(wispy?96:broken?84:56);
  const rx=broad?37+rnd()*85:wispy?25+rnd()*90:17+rnd()*49;
  const ry=broad?21+rnd()*44:wispy?5+rnd()*14:11+rnd()*33;
  m.beginPath();m.ellipse(x,y,rx,ry,(rnd()-.5)*(wispy ? .43 : .28),0,Math.PI*2);m.fill();
 }
 if(broad){m.beginPath();m.ellipse(314,190,275,19,0,0,Math.PI*2);m.fill();}
 const ctx=canvas.getContext('2d');
 ctx.filter='blur('+(wispy?9:broken?7:5)+'px)';ctx.drawImage(mask,0,0);ctx.filter='none';
 ctx.globalCompositeOperation='source-in';
 const grad=ctx.createLinearGradient(0,67,0,252);
 grad.addColorStop(0,'rgba(208,222,245,.56)');
 grad.addColorStop(.36,'rgba(164,188,223,.60)');
 grad.addColorStop(.76,'rgba(101,132,185,.55)');
 grad.addColorStop(1,'rgba(55,76,125,.25)');
 ctx.fillStyle=grad;ctx.fillRect(0,0,640,256);
 ctx.globalCompositeOperation='source-over';
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
 return texture;
}
function cloudBank(root,index,touch){
 const kinds=['broad','wispy','broken','broad','broken','wispy','broad','wispy','broken','broad','broken','wispy'];
 const kind=kinds[index],angle=index*Math.PI*2/kinds.length+(index%2)*.12;
 const distance=256+(index%3)*25,altitude=77+(index%5)*26;
 const width=(kind==='broad'?227:kind==='wispy'?143:178)*(touch ? .77 : 1);
 const height=(kind==='broad'?78:kind==='wispy'?45:65)*(touch ? .85 : 1);
 const group=new THREE.Group();group.name='Translucent '+kind+' drifting cloud '+index;
 group.position.set(Math.cos(angle)*distance,altitude,Math.sin(angle)*distance);
 group.lookAt(0,70,0);
 const texture=makeCloudTexture(0xc0124+index*2997,kind);
 const material=new THREE.MeshBasicMaterial({
  map:texture,transparent:true,opacity:kind==='wispy' ? .55 : kind==='broken' ? .60 : .68,
  depthTest:true,depthWrite:false,side:THREE.DoubleSide,
  alphaTest:.008,blending:THREE.NormalBlending,fog:false,toneMapped:false
 });
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
 plane.renderOrder=-120;group.add(plane);root.add(group);
 return {group,base:angle,distance,altitude,phase:index*1.17,wind:.0018+(index%3)*.0006,kind};
}
export function createMoonlitSky(scene){
  const touch=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const rand=random(173331);
  const root=new THREE.Group();
  root.name='World-oriented distant cloud sky (no moon)';
  scene.add(root);
  const clouds=Array.from({length:12},(_,i)=>cloudBank(root,i,touch));
  const stars=[],colors=[];
  for(let i=0;i<(touch?900:1900);i++){
    const a=rand()*Math.PI*2,el=.24+rand()*1.17,r=345;
    stars.push(r*Math.cos(a)*Math.cos(el),r*Math.sin(el),r*Math.sin(a)*Math.cos(el));
    const c=new THREE.Color(rand()<.12?'#f3e2bd':'#adc8ff');const shade=.43+rand()*.57;
    colors.push(c.r*shade,c.g*shade,c.b*shade);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const starfield=new THREE.Points(geo,new THREE.PointsMaterial({
    size:1.15,vertexColors:true,opacity:.77,transparent:true,depthTest:true,
    depthWrite:false,sizeAttenuation:false,toneMapped:false,fog:false
  }));
  starfield.name='Distant stars';starfield.renderOrder=-150;root.add(starfield);
  return {root,clouds,update(camera,time){
    if(camera)root.position.copy(camera.position);
    // Slow wind in world-space; no camera-relative quad or screen-space dirt.
    for(const cloud of clouds){
      const theta=cloud.base+time*cloud.wind+Math.sin(time*.07+cloud.phase)*.018;
      cloud.group.position.set(Math.cos(theta)*cloud.distance,cloud.altitude+Math.sin(time*.22+cloud.phase)*1.8,Math.sin(theta)*cloud.distance);
    }
  }};
}
