import {epicSpecimenCanvas,addEpicDust} from './epic-specimens.js';
import {paintedWingCanvas} from './painted-wing-art.js';
// Premium Papilio atlas: 20 individual, deterministic, transparent 2D
// silhouettes applied to skinned 3D-character wing planes. Only create
// canvases for actually visible wings; high detail is paint, not draw calls.
const atlases=new Map();
export function swallowtailCanvas(item){
 if(item.design==='painted-wing')return paintedWingCanvas(item);
 if(atlases.has(item.id))return atlases.get(item.id);
 if(item.tier===4&&item.specimen){const art=epicSpecimenCanvas(item);atlases.set(item.id,art);return art;}
 const canvas=document.createElement('canvas');
 canvas.width=768;canvas.height=640;
 const c=canvas.getContext('2d');
 const variant=item.patternVariant||0,tier=item.tier||1;
 const purple=tier===4,complexity=item.visualComplexity||1;
 let seed=0x9e3779b9^(variant*0x45d9f3b);
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const ink=tier===1?'#817c8d':tier===2?'#185d53':purple?'#44215f':'#4c476d';
 const pearl=tier===1?'#ffffff':tier===2?'#e7ffd0':purple?'#fff2fa':'#fff4d2';
 const baseX=64,baseY=388;
 const heightShift=(variant%4-1.5)*21;
 const wingTop=[555+((variant*17)%100),48+heightShift];
 const wingOuter=[660+(variant%3)*17,246+(variant%4)*11];
 const wingTail=[595+(variant%4)*25,605-(variant%3)*32];
 // Upper sail, scalloped fore-edge, and the very long tail characteristic
 // of swallowtail butterflies, all drawn in a single alpha silhouette.
 const wingPath=()=>{
  c.beginPath();c.moveTo(baseX,baseY);
  c.bezierCurveTo(118,207,284,63,wingTop[0],wingTop[1]);
  c.bezierCurveTo(645,12+heightShift,724,116,wingOuter[0],wingOuter[1]);
  c.bezierCurveTo(700,268,691,306,676,326);
  c.bezierCurveTo(693,352,704,369,681,389);
  c.bezierCurveTo(665,401,657,424,664,446);
  c.bezierCurveTo(665,472,wingTail[0]+39,wingTail[1]-75,wingTail[0],wingTail[1]);
  c.bezierCurveTo(wingTail[0]-35,wingTail[1]-72,532,456,499,422);
  c.bezierCurveTo(458,461,423,472,386,441);
  c.bezierCurveTo(315,484,285,463,254,434);
  c.bezierCurveTo(174,459,94,426,baseX,baseY);c.closePath();
 };
 c.save();wingPath();c.clip();
 const gradient=c.createLinearGradient(104,103,649,545);
 gradient.addColorStop(0,ink);
 gradient.addColorStop(.18,item.color);
 gradient.addColorStop(.52,item.accent||item.color);
 gradient.addColorStop(.76,item.color);
 gradient.addColorStop(1,ink);
 c.fillStyle=gradient;c.fillRect(0,0,768,640);
 // Butterfly cells: veins radiate from the thorax and branch into arcs.
 const veinCount=5+complexity*5;
 c.lineCap='round';
 for(let j=0;j<veinCount;j++){
  const u=(j+.2)/veinCount;
  const px=220+460*Math.pow(u,.74);
  const py=49+480*Math.pow(u,1.5)+Math.sin(j*1.8+variant)*19;
  c.strokeStyle=j%3===0?pearl:ink;c.globalAlpha=.38+(purple?.23:0);
  c.lineWidth=purple?(j%3===0?3:1.3):tier===1?.85:1.4;
  c.beginPath();c.moveTo(baseX+12,baseY);
  c.bezierCurveTo(220,baseY-245*u,310+150*u,30+440*u,px,py);c.stroke();
  if(j<veinCount-2&&complexity>1){
   c.globalAlpha=.24;c.lineWidth=.7;
   c.beginPath();c.moveTo(270+u*230,250+u*120);
   c.quadraticCurveTo(390+u*180,218+u*140,426+u*155,125+u*300);c.stroke();
  }
 }
 c.globalAlpha=1;
 // Species-specific translucent mosaics and upper-wing stripes.
 for(let k=0;k<complexity+1;k++){
  c.strokeStyle=k%2?pearl:item.accent;
  c.lineWidth=purple?3.6:1.1;
  c.globalAlpha=.12+(purple?.1:.03);
  c.beginPath();c.ellipse(400+variant%4*13,222+k*27,190-k*14,75-k*4,-.35,0,Math.PI*2);c.stroke();
 }
 c.globalAlpha=1;
 // Eye-spots characteristic of Papilio wings, 2–18 depending on rarity.
 const ocelli=2+complexity*(purple?4:2);
 for(let k=0;k<ocelli;k++){
  const a=k*2.39996+variant*.7;
  const px=460+Math.cos(a)*(36+(k%5)*35),py=268+Math.sin(a)*(26+(k%4)*38);
  const radius=4+(k%3)*2+(purple?3:0);
  c.beginPath();c.ellipse(px,py,radius*1.6,radius,variant*.11,0,Math.PI*2);
  c.fillStyle=k%3===0?ink:pearl;c.globalAlpha=.5;c.fill();
  if(complexity>=3){
   c.beginPath();c.ellipse(px,py,radius*.7,radius*.5,0,0,Math.PI*2);
   c.fillStyle=item.color;c.globalAlpha=.9;c.fill();
  }
 }
 // A constellation of iridescent pearls. Purple is deliberately more
 // elaborate than the gold tier, with an intricate nested filigree lattice.
 const gems=purple?95:tier===5?54:tier===3?24:tier===2?11:2;
 for(let k=0;k<gems;k++){
  const px=250+rnd()*392,py=72+rnd()*380,size=purple?1.7+rnd()*4:1.1+rnd()*2;
  c.fillStyle=k%3===0?pearl:k%3===1?item.accent:item.color;
  c.globalAlpha=.35+rnd()*.55;
  c.beginPath();c.arc(px,py,size,0,Math.PI*2);c.fill();
  if(purple&&k%6===0){
   c.strokeStyle='#fff9ef';c.lineWidth=.7;c.beginPath();
   c.moveTo(px-size*2,py);c.lineTo(px+size*2,py);
   c.moveTo(px,py-size*2);c.lineTo(px,py+size*2);c.stroke();
  }
 }
 c.globalAlpha=1;c.restore();
 wingPath();c.lineWidth=tier===1?5:purple?13:7;
 c.strokeStyle=ink;c.stroke();
 if(complexity>=2){
  wingPath();c.lineWidth=purple?5:2.2;c.strokeStyle=item.accent||pearl;c.stroke();
 }
 if(purple){
  // Extra violet rococo border, 72 micro-scallops following the outer hem.
  for(let j=0;j<72;j++){
   const t=j/72,ang=-1.2+t*2.5;
   const px=472+220*Math.cos(ang),py=300+225*Math.sin(ang);
   c.beginPath();c.arc(px,py,1.4+(j%5===0?3:0),0,Math.PI*2);
   c.fillStyle=j%3===0?'#fff5ff':item.accent;c.globalAlpha=.77;c.fill();
  }
 }
 c.globalAlpha=1;
 atlases.set(item.id,canvas);
 return canvas;
}

// The editor is a LEFT-wing canvas viewed from behind the avatar.
// The previous side mapping (-1 mirrored, +1 original) reversed the
// painted design. Only custom painted wings invert that mapping; legacy
// Papilio/specimen textures retain their historical orientation.
export function wingTextureScaleX(side,item){
 if(side!==-1&&side!==1)throw new RangeError('Invalid wing side');
 return item?.design==='painted-wing'?-side:side;
}
// A single texture per species; add a light-reflective second sail only for
// purple and gold so simple white/green wings remain visibly austere.
export function swallowtailModel(T,item){
 const root=new T.Group();root.userData.wingId=item.id;
 const texture=new T.CanvasTexture(swallowtailCanvas(item));
 texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;
 const material=new T.MeshPhysicalMaterial({
  map:texture,transparent:true,alphaTest:.075,side:T.DoubleSide,
  metalness:item.tier===4?.28:.06,roughness:item.tier===4?.26:.52,
  clearcoat:item.tier>=3?.75:.15,clearcoatRoughness:.16,
  iridescence:item.tier>=3?1:0,iridescenceIOR:1.28,
  emissive:item.color,emissiveIntensity:item.tier===4?.28:.055,
  depthWrite:true
 });
 for(const side of [-1,1]){
  const hinge=new T.Group();hinge.position.x=side*.09;
  const face=new T.Mesh(new T.PlaneGeometry(1.7+item.tier*.09,1.5+item.tier*.06),material);
  face.position.set(side*.70,.21,-.025);
  face.scale.x=wingTextureScaleX(side,item);
  face.userData.wingSide=side<0?'left':'right';
  // Fan the two wings slightly back so the silhouette is legible in profile.
  hinge.rotation.y=side*.11;hinge.add(face);root.add(hinge);
  if(item.tier===4&&!item.specimen&&item.design!=='painted-wing'){
   const inner=new T.Mesh(new T.PlaneGeometry(1.08,1.22),material);
   inner.position.set(side*.38,-.24,-.13);inner.scale.x=side*.72;
   inner.rotation.z=side*.15;hinge.add(inner);
  }
 }
 if(item.tier===4||item.ability==='sparkle')addEpicDust(T,root);
 root.userData.texture=texture;
 return root;
}
