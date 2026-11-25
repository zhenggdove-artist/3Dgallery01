import * as THREE from 'three';
import {CITY_MAX_HP,citySignSpecs,cityShopSignSpec} from './shared/city-layout.js';
import {houseTileTexture} from './build-style.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const random=seed=>{let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);};
const surface=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.92,metalness});
// Rubble uses the original house colour but receives native shader weathering.
// The cracks are evaluated in each fragment's object-space surface, so they
// cannot float away when a wall fragment spins, drops or bounces.
function scarredSurface(color,seed=0){
 const material=surface(color);
 material.userData.cityScarSeed=seed%997;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uPieceScarSeed={value:seed%997};
  shader.vertexShader='varying vec3 vPieceSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvPieceSurface=position;');
  shader.fragmentShader='varying vec3 vPieceSurface;\nuniform float uPieceScarSeed;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec2 p=vPieceSurface.xy+vec2(uPieceScarSeed*.013,uPieceScarSeed*.037);
  float warp=sin(p.y*2.1+sin(p.x*3.7)*.9);
  float crackA=1.-smoothstep(.017,.105,abs(sin(p.x*3.35+warp*1.6)));
  float crackB=1.-smoothstep(.016,.09,abs(sin(p.y*4.6+sin(p.x*2.8)*1.3)));
  float hairline=1.-smoothstep(.018,.065,abs(sin(p.x*14.3+p.y*6.2+warp)));
  float grit=fract(sin(dot(floor(p*11.),vec2(127.1,311.7)))*43758.5453);
  float flake=smoothstep(.67,.83,grit);
  float weather=clamp(max(crackA*crackB,hairline*.23)+flake*.27,0.,.78);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.055,.041,.033),weather);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.28,.24),flake*.12);
`);
 };
 material.customProgramCacheKey=()=> 'city-rubble-surface-cracks-v1';
 return material;
}

// Bake the intact mesh details, object-space scar inputs and material
// properties into one vertex stream; independent rubble pieces still move.
export function packedRubbleMaterial(){
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92});
 m.onBeforeCompile=shader=>{
  const varyings='varying vec3 vRubbleLocal;\nvarying vec2 vRubbleSurface;\n';
  shader.vertexShader='attribute vec3 rubbleLocal;\nattribute vec2 rubbleSurface;\n'+varyings+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRubbleLocal=rubbleLocal;vRubbleSurface=rubbleSurface;');
  shader.fragmentShader=varyings+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vRubbleSurface.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  if(vRubbleSurface.x>=0.){
   vec2 p=vRubbleLocal.xy+vRubbleSurface.x*vec2(.013,.037);
   float warp=sin(p.y*2.1+sin(p.x*3.7)*.9);
   float a=1.-smoothstep(.017,.105,abs(sin(p.x*3.35+warp*1.6)));
   float b=1.-smoothstep(.016,.09,abs(sin(p.y*4.6+sin(p.x*2.8)*1.3)));
   float h=1.-smoothstep(.018,.065,abs(sin(p.x*14.3+p.y*6.2+warp)));
   float grit=fract(sin(dot(floor(p*11.),vec2(127.1,311.7)))*43758.5453),flake=smoothstep(.67,.83,grit);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.055,.041,.033),clamp(max(a*b,h*.23)+flake*.27,0.,.78));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.28,.24),flake*.12);
  }`);
 };m.customProgramCacheKey=()=> 'city-packed-rubble';return m;
}

export function packRubble(root,material){
 root.updateMatrixWorld(true);
 const inv=root.matrixWorld.clone().invert(),positions=[],normals=[],colors=[],local=[],surface=[],m=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),p=new THREE.Vector3(),n=new THREE.Vector3(),original=[];
 root.traverse(o=>{
  if(!o.isMesh||o.material.map||o.material.transparent)return;
  const g=o.geometry,mat=o.material,position=g.attributes.position,normal=g.attributes.normal,index=g.index;
  m.multiplyMatrices(inv,o.matrixWorld);normalMatrix.getNormalMatrix(m);
  for(let v=0;v<(index?.count||position.count);v++){
   const i=index?index.getX(v):v;
   p.fromBufferAttribute(position,i);local.push(p.x,p.y,p.z);p.applyMatrix4(m);positions.push(p.x,p.y,p.z);
   n.fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix);normals.push(n.x,n.y,n.z);
   colors.push(mat.color.r,mat.color.g,mat.color.b);surface.push(mat.userData.cityScarSeed??-1,mat.metalness||0);
  }
  original.push(o);
 });
 if(!positions.length)return null;
 for(const o of original){o.removeFromParent();o.geometry.dispose();if(o.material!==material)o.material.dispose();}
 const g=new THREE.BufferGeometry();for(const [key,data,size] of [['position',positions,3],['normal',normals,3],['color',colors,3],['rubbleLocal',local,3],['rubbleSurface',surface,2]])g.setAttribute(key,new THREE.Float32BufferAttribute(data,size));
 const mesh=new THREE.Mesh(g,material);root.add(mesh);return mesh;
}
const FRAME='#454b4b',GLASS='#71858b',STEEL='#5d615d';
function box(group,x,y,z,w,h,d,color,metal=0){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),surface(color,metal));
 mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
function tube(group,points,radius=.06,color=STEEL){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(4,points.length*4),radius,5,false),surface(color,.35));
 group.add(mesh);return mesh;
}
function brokenPlate(group,w,h,depth,color,seed=1){
 const r=random(seed),shape=new THREE.Shape();
 shape.moveTo(-w*.5,-h*.44);
 shape.lineTo(-w*.35,h*(.24+r()*.22));
 shape.lineTo(-w*.05,h*.49);
 shape.lineTo(w*(.12+r()*.31),h*.26);
 shape.lineTo(w*.5,h*.14);
 shape.lineTo(w*(.32+r()*.13),-h*.32);
 shape.lineTo(w*.1,-h*.47);
 shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1,steps:1});
 const mesh=new THREE.Mesh(geometry,scarredSurface(color,seed));group.add(mesh);return mesh;
}
function windowAssembly(group,w,h,seed,frameColor=FRAME){
 const thickness=.09;
 box(group,0,h*.5,0,w,thickness,.11,frameColor,.15);
 box(group,0,-h*.5,0,w,thickness,.11,frameColor,.15);
 box(group,-w*.5,0,0,thickness,h,.12,frameColor,.15);
 box(group,w*.5,0,0,thickness,h,.12,frameColor,.15);
 box(group,0,0,.03,.06,h,.09,frameColor,.16);
 box(group,0,0,-.045,w*.96,h*.93,.036,GLASS,.08);
 // Broken glazing is actual cut glass, attached to the window's frame.
 const r=random(seed);
 for(let i=0;i<4;i++){
  const shard=brokenPlate(group,w*(.16+r()*.16),h*(.19+r()*.17),.015,
   i%2?'#9bb2b4':'#526b74',seed+i*103);
  shard.position.set((i%2?1:-1)*w*.2,(i<2?1:-1)*h*.2,.1);
  shard.rotation.z=(r()-.5)*.5;
 }
}
// Detachable assemblies carry recognizable weathered architectural surfaces.
function signAssembly(group,lot){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle=lot.style[3];ctx.fillRect(0,0,512,192);
 ctx.fillStyle='#24272a';ctx.fillRect(11,13,490,166);
 ctx.strokeStyle='#dbcead';ctx.lineWidth=7;ctx.strokeRect(17,20,478,152);
 ctx.textAlign='center';ctx.fillStyle='#f6edd9';
 ctx.font='bold 48px sans-serif';ctx.fillText(lot.shopName,256,89,470);
 ctx.font='bold 26px sans-serif';ctx.fillText(lot.enName,256,139,468);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const w=Math.min(4.5,lot.width*.85);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(w,1.15),
  new THREE.MeshStandardMaterial({map,side:THREE.DoubleSide,roughness:.72,metalness:.1}));
 face.position.z=.12;group.add(face);
 for(const y of [-.61,.61])box(group,0,y,0,w+.15,.12,.17,'#5b5a54',.65);
 for(const x of [-w*.51,w*.51])box(group,x,0,0,.12,1.3,.2,'#464c4c',.65);
 for(const x of [-w*.3,w*.3])tube(group,[[x,-.62,0],[x,-.95,-.13]],.045,'#67645c');
}
function pipeAssembly(group){
 tube(group,[[-.32,-.93,.06],[-.30,-.25,.1],[-.26,.45,.1],[.21,.47,.13],[.22,.82,.13]],.08,'#737f7a');
 tube(group,[[-.29,-.72,.06],[-.11,-.57,.09],[.1,-.6,.14]],.04,'#725343');
 for(let i=0;i<4;i++){
  const clip=box(group,-.30,-.69+i*.46,.1,.28,.07,.19,'#3d4544',.7);
  clip.rotation.z=i%2?.04:-.06;
 }
 box(group,.2,.42,.13,.26,.2,.27,'#575e5c',.7);
}
function timberAssembly(group,lot,seed){
 const rand=random(seed);
 for(let i=0;i<5;i++){
  const plank=brokenPlate(group,.12+rand()*.11,.6+rand()*.62,.04,
   i%2?lot.color:lot.detail,seed+i*17);
  plank.position.set((i-2)*.16,(rand()-.5)*.15,(rand()-.5)*.055);
  plank.rotation.z=(rand()-.5)*.21;
  for(let n=0;n<2;n++)box(group,plank.position.x,plank.position.y+(n?-.25:.25),.1,.025,.027,.018,'#3d3935',.5);
 }
}
function tileAssembly(group,lot,seed){
 const rand=random(seed);
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const tile=brokenPlate(group,.27,.27,.018,row%2?'#c5b8a0':lot.detail,seed+row*29+col*13);
  tile.position.set((col-1)*.32,(row-1)*.32,(rand()-.5)*.04);
  tile.rotation.z=(rand()-.5)*.19;
 }
}
function awningAssembly(group,w,d,seed){
 const r=random(seed),n=8;
 box(group,0,0,0,w,.065,d,'#9b7154',.35);
 for(let i=0;i<n;i++){
  const x=-w/2+(i+.5)*w/n;
  const strip=box(group,x,.055,0,w/n*.65,.07,d, i%2?'#8e8170':'#706b60',.45);
  strip.rotation.z=(r()-.5)*.065;
 }
 box(group,0,-.16,-d*.43,w*.94,.08,.09,FRAME,.7);
 box(group,0,-.16,d*.43,w*.94,.08,.09,FRAME,.7);
 for(const x of [-w*.45,w*.45]){
  tube(group,[[x,-.15,-d*.42],[x,-.65,-d*.42],[x,-.7,d*.33]],.04,STEEL);
 }
}
export function buildDetachableFixture(lot,part,seed=1){
 const group=new THREE.Group();group.name='Detached actual facade fixture: '+part;
 const floor=lot.height/lot.floors,front=lot.depth/2;
 const r=random(seed),bits=String(part).split('-');
 if(part.startsWith('windows-')){
  const level=clamp(Number(bits[1])||0,0,lot.floors-1),k=clamp(Number(bits[2])||0,0,2);
  const x=(k-1)*lot.width/4,y=level*floor+floor*.49;
  group.position.set(x,y,front+.13);
  windowAssembly(group,lot.width/5,Math.min(1.3,floor*.53),seed,lot.trim);
  box(group,0,-Math.min(.42,floor*.13),.23,lot.width/5+.16,.08,.13,lot.trim);
 }else if(part.startsWith('sign-')){
  const s=citySignSpecs(lot).find(v=>v.id===part);
  if(s){group.position.set(s.x,s.y,s.z);for(let i=0;i<3;i++)for(let j=0;j<2;j++){
    if(s.blade)box(group,0,(i-1)*s.height/3,(j-.5)*s.depth/2,s.width,s.height/3*.94,s.depth/2*.94,s.color);
    else box(group,(j-.5)*s.width/2,(i-1)*s.height/3,0,s.width/2*.94,s.height/3*.94,s.depth,s.color);
   }for(const side of [-1,1])box(group,0,side*s.height*.32,-s.depth*.45,.12,.10,.24,'#6b6961',.6);}
 }else if(part==='sign'){
  const sign=cityShopSignSpec(lot);if(sign){group.position.set(sign.x,sign.y,sign.z);signAssembly(group,lot);group.scale.set(sign.width/Math.min(4.5,lot.width*.85),sign.height/1.15,1);}
 }else if(part==='pipes'){
  group.position.set(lot.width*.39,lot.height*.55,front+.22);
  pipeAssembly(group);
 }else if(part==='timber'){
  group.position.set((r()-.5)*lot.width*.45,lot.height*.55,front+.18);
  timberAssembly(group,lot,seed);
 }else if(part==='tiles'){
  group.position.set((r()-.5)*lot.width*.55,lot.height*.45,front+.19);
  tileAssembly(group,lot,seed);
 }else if(part==='stone'){
  group.position.set((r()-.5)*lot.width*.55,lot.height*.6,front+.15);
  for(let i=0;i<5;i++){
   const piece=brokenPlate(group,.32+r()*.28,.2+r()*.25,.13,i%2?lot.color:lot.trim,seed+i*29);
   piece.position.set((r()-.5)*.65,(r()-.5)*.65,(r()-.5)*.12);
   piece.rotation.z=(r()-.5)*.55;
  }
 }else if(part.startsWith('pillars-')){
  const side=bits[1]==='0'?-1:1;
  group.position.set(side*(lot.width/2-.18),lot.height*.5,front+.1);
  box(group,0,0,0,.27,lot.height,.3,lot.trim);
  for(const x of [-.075,.075])tube(group,[[x,-lot.height*.45,.16],[x,lot.height*.42,.16]],.023,'#725d48');
  for(let i=0;i<5;i++)box(group,.0,-lot.height*.38+i*lot.height*.19,.18,.24,.042,.08,'#413d36',.6);
 }else if(part==='sheets-roof'){
  group.position.set(0,lot.height+.1,0);
  awningAssembly(group,Math.min(4,lot.width*.64),Math.min(2.6,lot.depth*.45),seed);
 }else if(part==='sheets-awning'){
  group.position.set(0,2.58,front+.58);
  awningAssembly(group,lot.width*1.03,1.1,seed);
 }else{
  // Wall-mounted water / drainage pipe, exposed rebar, bricks, plaster and
  // concrete fragments are detached together, not unrelated colored cubes.
  const x=(r()-.5)*lot.width*.6,y=.8+r()*Math.max(1,lot.height-.9);
  group.position.set(x,y,front+.19);
  tube(group,[[-.33,-.9,.05],[-.28,-.3,.07],[-.28,.4,.08],[.12,.49,.08],[.12,.79,.08]],.08,'#616a68');
  for(let i=0;i<4;i++){
   const b=brokenPlate(group,.33+r()*.48,.2+r()*.36,.07,i%2?lot.detail:lot.trim,seed+i*41);
   b.position.set((r()-.5)*.85,(r()-.5)*1.6,.07+r()*.06);
   b.rotation.z=(r()-.5)*.4;
  }
  for(let i=0;i<3;i++)box(group,(r()-.5)*.6,(r()-.5)*1.1,.11,.38,.1,.22,lot.color);
 }
 return group;
}
export function buildBrokenStructure(lot,index,w,h,d,color){
 const group=new THREE.Group(),r=random(lot.index*4109+index*37);
 const plate=brokenPlate(group,w*(.55+r()*.3),h*(.72+r()*.2),
   Math.max(.13,d*.54),color,lot.index*999+index*31);
 plate.position.z=-d*.37;
 // A ripped brick / timber / concrete cross section with actual jagged silhouette.
 for(let i=0;i<4;i++){
  const piece=brokenPlate(group,w*(.1+r()*.15),h*(.08+r()*.18),.12,
    i%2?lot.detail:lot.trim,lot.index*107+i*101+index*47);
  piece.position.set((r()-.5)*w*.7,(r()-.5)*h*.55,d*.12);
  piece.rotation.z=(r()-.5)*1.6;
 }
 // Exposed metal reinforcement, window framing and torn corrugated sheet.
 tube(group,[[-w*.35,-h*.3,.03],[-w*.16,h*.24,.06],[-w*.07,h*.44,.14]],.025,'#564f43');
 tube(group,[[w*.13,-h*.45,.02],[w*.09,h*.22,.07],[w*.27,h*.35,.1]],.022,'#615a4e');
 if(index%2===0){
  const framed=buildDetachableFixture(lot,'windows-'+Math.min(lot.floors-1,index%lot.floors)+'-1',index+lot.index);
  // Keep the glazing, mullions and sill as ONE assembly attached to a
  // fractured wall. Reparenting each child previously scattered the frame.
  framed.position.set(w*.1,-h*.08,d*.24);
  framed.scale.setScalar(Math.min(.7,Math.max(.18,w/lot.width)));
  group.add(framed);
 }
 if(index%3===0){
  const sheet=box(group,(r()-.5)*w*.3,h*.3,.18,w*.38,.045,d*.28,'#77685e',.4);
  sheet.rotation.z=.23+r()*.16;
 }
 return group;
}
export function installFacadeCracks(mesh,tileMap=houseTileTexture()){
 const width=512,bytes=new Uint8Array(width*4);
 const map=new THREE.DataTexture(bytes,width,1,THREE.RGBAFormat,THREE.UnsignedByteType);
 map.minFilter=map.magFilter=THREE.NearestFilter;map.wrapS=THREE.ClampToEdgeWrapping;
 map.generateMipmaps=false;map.needsUpdate=true;
 mesh.material.onBeforeCompile=shader=>{
  shader.uniforms.uCityDamage={value:map};shader.uniforms.uHouseTile={value:tileMap};
  shader.vertexShader='attribute float cityLotId;\nattribute vec3 cityLocal;\nattribute vec3 cityTile;\nvarying vec3 vCityTile;\nvarying float vCityLot;\nvarying vec3 vCitySurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCityLot=cityLotId;vCitySurface=cityLocal;vCityTile=cityTile;');
  const header=`uniform sampler2D uCityDamage;
uniform sampler2D uHouseTile;
varying vec3 vCityTile;
varying float vCityLot;
varying vec3 vCitySurface;
float cityHash(vec2 x){return fract(sin(dot(x,vec2(127.1,311.7)))*43758.5453123);}
float cityNoise(vec2 x){
 vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(cityHash(i),cityHash(i+vec2(1.,0.)),f.x),
 mix(cityHash(i+vec2(0.,1.)),cityHash(i+vec2(1.,1.)),f.x),f.y);
}
`;
  shader.fragmentShader=header+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
if(vCityLot>=0.){
 // Texture modulates luminance; never replace the lot's original vertex color.
 if(vCityTile.z>.5){float tile=texture2D(uHouseTile,vCityTile.xy).r;diffuseColor.rgb*=mix(1.,tile,.85);}
 float damage=texture2D(uCityDamage,vec2((floor(vCityLot+.5)+.5)/512.,.5)).r;
 if(damage>.001){
  vec2 p=abs(vCitySurface.z)>abs(vCitySurface.x)?vCitySurface.xy:vCitySurface.zy;
  float warp=cityNoise(p*1.91+vCityLot*.037);
  vec2 q=p+vec2(warp-.5,cityNoise(p*2.7+vCityLot*.07)-.5)*.47;
  // Multiscale branching cracks are evaluated ON the material surface.
  float mainA=abs(sin(q.x*2.7+sin(q.y*1.29+vCityLot)*.8));
  float mainB=abs(sin(q.y*2.13+sin(q.x*1.67+vCityLot*.11)*1.2));
  float micro=abs(sin(q.x*8.9+q.y*4.3+warp*3.));
  float crack=(1.-smoothstep(.015,.105,min(mainA,mainB)))*.89;
  crack+=.35*(1.-smoothstep(.01,.09,micro))*clamp(damage*2.,0.,1.);
  float soot=cityNoise(p*.55+vCityLot*.21)*cityNoise(p*3.1+vCityLot*.17);
  float spall=1.-smoothstep(.2,.46,cityNoise(q*7.3+vCityLot));
  float wear=clamp(damage*2.2,0.,1.);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.057,.047,.040),clamp(crack*wear+soot*damage*.69+spall*damage*.4,0.,.94));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.29,.21),spall*damage*.14);
 }
 float hitTint=texture2D(uCityDamage,vec2((floor(vCityLot+.5)+.5)/512.,.5)).g;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.014,.025),hitTint*.93);
}`);
 };
 mesh.material.customProgramCacheKey=()=> 'city-facade-cracks-tiles-v072';
 mesh.material.needsUpdate=true;
 return {texture:map,set(index,hp,maxHp=CITY_MAX_HP){
  if(index<0||index>=width)return;
  const value=Math.round(clamp(1-hp/maxHp,0,1)*255);
  if(bytes[index*4]!==value){bytes[index*4]=value;map.needsUpdate=true;}
 },pulse(index,intensity){
  if(index<0||index>=width)return;
  const value=Math.round(clamp(intensity,0,1)*255);
  if(bytes[index*4+1]!==value){bytes[index*4+1]=value;map.needsUpdate=true;}
 },reset(){bytes.fill(0);map.needsUpdate=true;}};
}
export function installAttachedFlash(mesh,texture){
 const material=mesh.material;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uCityDamage={value:texture};
  shader.vertexShader='attribute float cityLotId;\nvarying float vCityFlashLot;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvCityFlashLot=cityLotId;');
  shader.fragmentShader='uniform sampler2D uCityDamage;\nvarying float vCityFlashLot;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
   `#include <color_fragment>
    float cityFlash=texture2D(uCityDamage,vec2((floor(vCityFlashLot+.5)+.5)/512.,.5)).g;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.014,.025),cityFlash*.93);`);
 };
 material.customProgramCacheKey=()=> 'city-attached-material-flash-v1';
 material.needsUpdate=true;
}
function plumeTexture(mode){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const g=canvas.getContext('2d'),grad=g.createRadialGradient(32,32,0,32,32,31);
 if(mode==='flame'){grad.addColorStop(0,'rgba(255,251,191,1)');grad.addColorStop(.23,'rgba(255,161,21,.95)');grad.addColorStop(.52,'rgba(225,50,5,.55)');grad.addColorStop(1,'rgba(215,28,0,0)');}
 else{grad.addColorStop(0,'rgba(57,55,49,.58)');grad.addColorStop(.45,'rgba(69,65,59,.35)');grad.addColorStop(1,'rgba(82,79,73,0)');}
 g.fillStyle=grad;g.fillRect(0,0,64,64);
 return new THREE.CanvasTexture(canvas);
}
export function createPlumeResources(){
 return {flame:plumeTexture('flame'),smoke:plumeTexture('smoke')};
}
// Geometry, material, and texture storage is recycled after a plume expires.
// Re-seeding every individual particle preserves the original visual variety
// and counts, without reallocating WebGL buffers when attacks hit repeatedly.
export function emitFireSmoke(root,position,resources,mobile,seed=1,recycled=null){
 const r=random(seed),count=mobile?18:35;
 if(recycled){
  recycled.age=0;
  recycled.root.position.fromArray(position);
  root.add(recycled.root);
  for(const {pts,data,type} of recycled.clouds){
   const arr=pts.geometry.attributes.position.array;
   for(let i=0;i<data.length;i++){
    const x=(r()-.5)*.8,y=(r()-.5)*.45,z=(r()-.5)*.8;
    arr.set([x,y,z],i*3);
    data[i]={x,y,z,vx:(r()-.5)*.7,vz:(r()-.5)*.7,
     speed:(type==='flame'?1.1:1.65)+r()*.9,phase:r()*6.283};
   }
   pts.geometry.attributes.position.needsUpdate=true;
   pts.material.opacity=type==='flame'?.95:.6;
   pts.material.size=type==='flame'?.65:1.6;
  }
  return recycled;
 }
 const group=new THREE.Group();group.position.fromArray(position);root.add(group);
 const clouds=[];
 for(const type of ['flame','smoke']){
  const n=type==='flame'?Math.ceil(count*.63):count,arr=new Float32Array(n*3),data=[];
  for(let i=0;i<n;i++){
   arr.set([(r()-.5)*.8,(r()-.5)*.45,(r()-.5)*.8],i*3);
   data.push({x:arr[i*3],y:arr[i*3+1],z:arr[i*3+2],vx:(r()-.5)*.7,
    vz:(r()-.5)*.7,speed:(type==='flame'?1.1:1.65)+r()*.9,phase:r()*6.283});
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  const mat=new THREE.PointsMaterial({map:resources[type],color:'#ffffff',size:type==='flame'?.65:1.6,
   transparent:true,depthWrite:false,opacity:type==='flame'?.95:.6,sizeAttenuation:true});
  const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;pts.name='Fire and rolling smoke from fractured facade';
  group.add(pts);clouds.push({pts,data,type});
 }
 return {root:group,clouds,age:0,duration:4.4};
}
export function updateFireSmoke(effect,dt){
 effect.age+=dt;
 for(const {pts,data,type} of effect.clouds){
  const arr=pts.geometry.attributes.position.array;
  for(let i=0;i<data.length;i++){
   const p=data[i],t=effect.age;
   arr[i*3]=p.x+p.vx*t+Math.sin(t*2+p.phase)*.16;
   arr[i*3+1]=p.y+p.speed*t*(type==='flame'?.75:1.1);
   arr[i*3+2]=p.z+p.vz*t+Math.cos(t*1.3+p.phase)*.14;
  }
  pts.geometry.attributes.position.needsUpdate=true;
  pts.material.opacity=(type==='flame'?.95:.54)*Math.max(0,1-effect.age/effect.duration);
  pts.material.size=(type==='flame'?.65:1.5)*(1+effect.age*(type==='flame'?.06:.23));
 }
 return effect.age>=effect.duration;
}
export function disposePlume(effect){
 effect.root.traverse(o=>{if(o.isPoints){o.geometry.dispose();o.material.dispose();}});
 effect.root.removeFromParent();
}

// Reuse the original flame and smoke sprites, opacity/size curves and
// trajectories, but batch every impact into two GPU point clouds.
export class CityImpactPlumes{
 constructor(root,textures,mobile=false){
  this.time={value:0};this.capacity=mobile?15:24;this.cursor=0;
  this.slots=[];this.lastSpawn=-Infinity;
  this.layers=['flame','smoke'].map(type=>{
   const flame=type==='flame',count=flame?Math.ceil((mobile?18:35)*.63):(mobile?18:35);
   const geo=new THREE.BufferGeometry();
   const attribute=(name,size)=>{
    const attr=new THREE.BufferAttribute(new Float32Array(this.capacity*count*size),size);
    geo.setAttribute(name,attr.setUsage(THREE.DynamicDrawUsage));return attr;
   };
   const initial=attribute('position',3),motion=attribute('plumeMotion',4),birth=attribute('plumeBirth',1);
   birth.array.fill(-100);
   const material=new THREE.PointsMaterial({map:textures[type],size:flame?.65:1.5,
    transparent:true,opacity:flame?.95:.54,depthWrite:false});
   material.customProgramCacheKey=()=>type+'-impact-plume-batch';
   material.onBeforeCompile=shader=>{
    shader.uniforms.plumeTime=this.time;
    shader.vertexShader=shader.vertexShader.replace('void main() {',`
     attribute vec4 plumeMotion;
     attribute float plumeBirth;
     uniform float plumeTime;
     varying float vPlumeOpacity;
     void main() {
    `).replace('#include <begin_vertex>',`
     #include <begin_vertex>
     float age = plumeTime - plumeBirth;
     vPlumeOpacity = max(0.0,1.0-age/4.4);
     if (vPlumeOpacity <= 0.0) {
      gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;return;
     }
     transformed += vec3(
      plumeMotion.x*age+sin(age*2.0+plumeMotion.w)*0.16,
      plumeMotion.y*age,
      plumeMotion.z*age+cos(age*1.3+plumeMotion.w)*0.14
     );
    `).replace('gl_PointSize = size;',`gl_PointSize = size * (1.0 + age * ${flame?'0.06':'0.23'});`);
    shader.fragmentShader='varying float vPlumeOpacity;\n'+shader.fragmentShader
     .replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4(diffuse,opacity*vPlumeOpacity);');
   };
   const points=new THREE.Points(geo,material);
   points.name=type+' · shared city impact particles';points.frustumCulled=false;
   points.visible=false;root.add(points);
   return {flame,count,initial,motion,birth,points};
  });
 }
 setVisible(visible){for(const {points} of this.layers)points.visible=visible;}
 spawn(position,seed=1,limit=this.capacity){
  const slot=this.cursor++%this.capacity,now=this.time.value,r=random(seed);
  const prior=this.slots.indexOf(slot);if(prior>=0)this.slots.splice(prior,1);
  this.slots.push(slot);
  while(this.slots.length>Math.min(limit,this.capacity)){
   const expired=this.slots.shift();
   for(const {birth,count} of this.layers){
    birth.array.fill(-100,expired*count,(expired+1)*count);
    birth.addUpdateRange(expired*count,count);birth.needsUpdate=true;
   }
  }
  this.lastSpawn=now;this.setVisible(true);
  for(const {flame,count,initial,motion,birth} of this.layers){
   const start=slot*count;
   for(let i=start;i<start+count;i++){
    initial.setXYZ(i,position[0]+(r()-.5)*.8,position[1]+(r()-.5)*.45,position[2]+(r()-.5)*.8);
    const vx=(r()-.5)*.7,vz=(r()-.5)*.7,s=(flame?1.1:1.65)+r()*.9;
    motion.setXYZW(i,vx,s*(flame?.75:1.1),vz,r()*6.283);
    birth.setX(i,now);
   }
   initial.addUpdateRange(start*3,count*3);initial.needsUpdate=true;
   motion.addUpdateRange(start*4,count*4);motion.needsUpdate=true;
   birth.addUpdateRange(start,count);birth.needsUpdate=true;
  }
 }
 update(dt){
  this.time.value+=dt;
  if(this.time.value-this.lastSpawn>=4.4)this.setVisible(false);
 }
 reset(){
  this.slots.length=0;this.lastSpawn=-Infinity;this.setVisible(false);
  for(const {birth} of this.layers){birth.array.fill(-100);birth.clearUpdateRanges();birth.needsUpdate=true;}
 }
 dispose(){
  for(const {points} of this.layers){points.removeFromParent();points.geometry.dispose();points.material.dispose();}
 }
}
