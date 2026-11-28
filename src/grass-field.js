import * as THREE from 'three';
import {CITY_INNER_RADIUS,CITY_OUTER_RADIUS} from './shared/city-layout.js';
import {TERRAIN_DEFAULTS,terrainStyle,terrainColorDelta} from './shared/terrain-style.js';

// Instanced GPU vegetation; shared wind and player positions, no per-plant objects.
// All meshes and wind/trample rules are generated in JS; no external assets.
export function grassPositions(count=97500,seed=17331,inner=11,outer=CITY_INNER_RADIUS-2){
 const points=new Float32Array(count*2),heights=new Float32Array(count),angles=new Float32Array(count),phases=new Float32Array(count),shades=new Float32Array(count);
 let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<count;i++){
  const r=Math.sqrt(inner*inner+(outer*outer-inner*inner)*rand()),a=rand()*Math.PI*2;
  points[i*2]=Math.cos(a)*r;points[i*2+1]=Math.sin(a)*r;
  const patch=.5+.5*Math.sin(points[i*2]*.19+Math.sin(points[i*2+1]*.23)*1.4);
  const h=rand();
  // Short groundcover, ordinary meadow leaves and occasional tall clumps.
  heights[i]=(.24+1.66*Math.pow(h,1.45))*(.76+.24*patch);angles[i]=rand()*Math.PI*2;
  phases[i]=rand()*100;shades[i]=rand();
 }
 return {points,heights,angles,phases,shades};
}
// Tapered, curved leaves with staggered crowns and distinct blade silhouettes.
function bladeGeometry({segments=3,blades=4}={}){
 const positions=[],indices=[],uvs=[];
 for(let j=0;j<blades;j++){
  const phi=j*2.39996,cs=Math.cos(phi),sn=Math.sin(phi);
  const lean=.19+.23*(.5+.5*Math.sin(j*4.17)),yScale=[.52,.79,1.05,.66][j%4];
  const spread=.06+.07*(j%3);
  const base=positions.length/3;
  for(let i=0;i<=segments;i++){
   const t=i/segments,w=(1-t)**1.07*(.12+.045*Math.cos(j*2.7)),drift=spread+lean*t*t;
   if(i===segments){positions.push(-drift*sn,t*yScale,drift*cs);uvs.push(.5,t);const b=base+(i-1)*2;indices.push(b,b+1,b+2);continue;}
   for(const side of [-1,1]){
    const x=side*w,z=drift;
    positions.push(x*cs-z*sn,t*yScale,x*sn+z*cs);
    uvs.push(side<0?0:1,t);
   }
   if(i>0){const b=base+(i-1)*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}
  }
 }
 const geo=new THREE.InstancedBufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geo.setIndex(indices);
 return geo;
}
// Small individual wildflowers, with crossed stems, leaves, faceted petals and a raised centre.
function flowerGeometry(){
 const positions=[],uvs=[],indices=[],vertices=new Map();
 const tri=(part,a,b,c)=>{for(const v of [a,b,c]){const key=part+':'+v.join(',');let i=vertices.get(key);if(i===undefined){i=positions.length/3;vertices.set(key,i);positions.push(...v);uvs.push(part,0);}indices.push(i);}};
 for(let j=0;j<2;j++){const a=j*Math.PI/2,x=Math.cos(a)*.012,z=Math.sin(a)*.012;
  tri(0,[-x,0,-z],[x,0,z],[-x*.45,.86,-z*.45]);tri(0,[x,0,z],[x*.45,.86,z*.45],[-x*.45,.86,-z*.45]);
 }
 for(let j=0;j<3;j++){const a=j*2.4,x=Math.cos(a),z=Math.sin(a),y=.24+j*.14;
  tri(0,[0,y,0],[x*.09-z*.035,y+.06,z*.09+x*.035],[x*.18,y+.14,z*.18]);
  tri(0,[0,y,0],[x*.18,y+.14,z*.18],[x*.09+z*.035,y+.055,z*.09-x*.035]);
 }
 for(let j=0;j<5;j++){const a=j*2*Math.PI/5,x=Math.cos(a),z=Math.sin(a);
  const b=[x*.025,.86,z*.025],l=[x*.087-z*.045,.89,z*.087+x*.045],r=[x*.087+z*.045,.89,z*.087-x*.045],tip=[x*.135,.94,z*.135],ridge=[x*.075,.925,z*.075];
  tri(1,b,l,ridge);tri(1,l,tip,ridge);tri(1,tip,r,ridge);tri(1,r,b,ridge);
  const next=a+2*Math.PI/5;tri(2,[0,.911,0],[x*.036,.884,z*.036],[Math.cos(next)*.036,.884,Math.sin(next)*.036]);
 }
 const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);return g;
}
const vertex=`
attribute vec2 aOffset;
attribute float aHeight;
attribute float aAngle;
attribute float aPhase;
attribute float aShade;
uniform float uTime;
uniform float uGrassLength;
uniform float uPlantWidth;
uniform float uWindSpeed;
uniform float uWindStrength;
uniform float uPushRadius;
uniform float uPushStrength;
uniform vec3 uPlayers[6];
uniform float uPlayerCount;
uniform vec4 uPlayerBounds;
varying float vHeight;
varying float vShade;
varying float vWind;
varying float vLeafEdge;
void main(){
 float t=position.y;
 float c=cos(aAngle),s=sin(aAngle);
 vec2 blade=vec2(position.x*c-position.z*s,position.x*s+position.z*c)*uPlantWidth;
 float clock=uTime*uWindSpeed;
 float gust=sin(clock*1.25+aOffset.x*.12+aOffset.y*.09);
 vec2 wind=vec2(.095+.13*gust,.055+.075*gust);
 wind+=vec2(sin(clock*2.1+aPhase),cos(clock*1.7+aPhase))*.035;
 wind*=uWindStrength;
 vec2 trample=vec2(0.);float pressure=0.;
 // A plant outside the union of all player influence rectangles cannot bend.
 // A small margin protects the original smoothstep at floating-point boundaries.
 if(uPlayerCount>0.&&uPushStrength>0.&&
    all(greaterThanEqual(aOffset,uPlayerBounds.xy-vec2(uPushRadius+.01)))&&
    all(lessThanEqual(aOffset,uPlayerBounds.zw+vec2(uPushRadius+.01)))){
 for(int i=0;i<6;i++){
  if(float(i)>=uPlayerCount)break;
  vec2 push=aOffset-uPlayers[i].xz;
  float d2=dot(push,push);
  if(d2>=uPushRadius*uPushRadius)continue;
  float dist=sqrt(d2);
  float press=1.-smoothstep(.12,uPushRadius,dist);
  trample+=push/max(.15,dist)*press*1.05*uPushStrength;
  pressure=max(pressure,press);
 }
 }
 vec2 bend=(wind+trample)*t*t;
 vec3 p=vec3(aOffset.x+blade.x+bend.x,.014+t*aHeight*uGrassLength*(1.-min(.48,pressure*.34*uPushStrength)*t),aOffset.y+blade.y+bend.y);
 vHeight=t;vShade=aShade;vWind=length(wind+trample);vLeafEdge=uv.x;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const fragment=`
precision mediump float;
varying float vHeight;
varying float vShade;
varying float vWind;
varying float vLeafEdge;
uniform vec3 uGrassDelta;
void main(){
 vec3 dark=vec3(.075,.19,.075),green=vec3(.32,.53,.20),straw=vec3(.65,.66,.31);
 vec3 tone=mix(dark,green,clamp(vHeight*.78+vShade*.38,0.,1.));
 tone=mix(tone,straw,smoothstep(.68,1.,vShade)*vHeight*.38);
 float rib=1.-smoothstep(.02,.19,abs(vLeafEdge-.5));
 float edge=smoothstep(.34,.5,abs(vLeafEdge-.5));
 tone+=vec3(.035,.055,.012)*rib*vHeight;
 tone-=vec3(.018,.026,.009)*edge;
 tone+=vec3(.06,.08,.02)*clamp(vWind*.3,0.,1.)*vHeight;
 gl_FragColor=vec4(clamp(tone+uGrassDelta,0.,1.),1.);
}`;
const flowerFragment=`
precision mediump float;
varying float vHeight;
varying float vShade;
varying float vLeafEdge;
uniform vec3 uGrassDelta;
uniform vec3 uFlowerYellow;
uniform vec3 uFlowerPurple;
uniform vec3 uFlowerBlue;
void main(){
 vec3 tone;
 if(vLeafEdge<.5){tone=mix(vec3(.09,.24,.08),vec3(.34,.53,.17),vHeight)+uGrassDelta;}
 else if(vLeafEdge<1.5){tone=vShade<.3333?uFlowerYellow:(vShade<.6667?uFlowerPurple:uFlowerBlue);tone*=.8+.2*vHeight;}
 else{tone=vShade<.3333?vec3(.83,.46,.08):vec3(.94,.78,.36);}
 gl_FragColor=vec4(clamp(tone,0.,1.),1.);
}`;
const GRASS_TILE=24,GRASS_BOUND_PAD=13;
export const MEADOW_COUNTS=Object.freeze({mobile:37500,desktop:97500,outerMobile:110000,outerDesktop:250000});
class GrassVisibility{
 constructor(geometry,seed,count){
  this.geometry=geometry;this.count=count;const tileOf=new Uint16Array(count);
  const position=geometry.getAttribute('position');this.maxT=0;this.maxR=0;
  for(let i=0;i<position.count;i++){this.maxT=Math.max(this.maxT,position.getY(i));this.maxR=Math.max(this.maxR,Math.hypot(position.getX(i),position.getZ(i)));}
  this.boxes=[];this.covered=count;
  const index=new Map();
  for(let i=0;i<count;i++){
   const x=Math.floor(seed.points[i*2]/GRASS_TILE),z=Math.floor(seed.points[i*2+1]/GRASS_TILE),key=x+':'+z;
   let tile=index.get(key);
   if(tile===undefined){
    tile=this.boxes.length;index.set(key,tile);
    // Bounds cover all six simultaneous maximum-strength pushes, max wind and width.
    const box=new THREE.Box3(new THREE.Vector3(x*GRASS_TILE-GRASS_BOUND_PAD,-.1,z*GRASS_TILE-GRASS_BOUND_PAD),
     new THREE.Vector3((x+1)*GRASS_TILE+GRASS_BOUND_PAD,4.3,(z+1)*GRASS_TILE+GRASS_BOUND_PAD));
    this.boxes.push({box,count:0,minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity,maxHeight:0});
   }
   tileOf[i]=tile;const b=this.boxes[tile];b.count++;
   const px=seed.points[i*2],pz=seed.points[i*2+1];b.minX=Math.min(b.minX,px);b.maxX=Math.max(b.maxX,px);b.minZ=Math.min(b.minZ,pz);b.maxZ=Math.max(b.maxZ,pz);b.maxHeight=Math.max(b.maxHeight,seed.heights[i]);
  }
  this.active=new Uint8Array(this.boxes.length);this.active.fill(1);
  this.next=new Uint8Array(this.boxes.length);
  // Group instances by spatial tile once. Within each tile the seed order is stable.
  // Repacking on camera movement copies only contiguous visible tile spans.
  this.packed=new Float32Array(count*6);
  let offset=0;for(const tile of this.boxes){tile.start=offset;tile.cursor=offset;offset+=tile.count*6;}
  for(let i=0;i<count;i++){const tile=this.boxes[tileOf[i]],j=tile.cursor;tile.cursor+=6;
   this.packed[j]=seed.points[i*2];this.packed[j+1]=seed.points[i*2+1];this.packed[j+2]=seed.heights[i];this.packed[j+3]=seed.angles[i];this.packed[j+4]=seed.phases[i];this.packed[j+5]=seed.shades[i];}
  for(const tile of this.boxes){tile.full=this.packed.subarray(tile.start,tile.cursor);tile.selected=tile.full;}
  this.buffer=new THREE.InstancedInterleavedBuffer(this.packed.slice(),6,1).setUsage(THREE.DynamicDrawUsage);
  for(const [name,size,offset] of [['aOffset',2,0],['aHeight',1,2],['aAngle',1,3],['aPhase',1,4],['aShade',1,5]])
   geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(this.buffer,size,offset));
  geometry.instanceCount=count;this.density=1;
 }
 setDensity(density){
  if(density===this.density)return;this.density=density;
  // Density changes only on GM settings, not each camera frame.
  // Keep the selection deterministic and nested as density increases.
  if(density>0&&density<1&&!this.filtered)this.filtered=new Float32Array(this.packed.length);
  for(const tile of this.boxes){
   if(density===1){tile.selected=tile.full;continue;}
   if(density===0){tile.selected=tile.full.subarray(0,0);continue;}
   let n=tile.start;
   for(let i=tile.start;i<tile.cursor;i+=6)if((Math.imul(i/6+1,0x9e3779b1)>>>0)/4294967296<density){
    for(let k=0;k<6;k++)this.filtered[n+k]=this.packed[i+k];n+=6;
   }
   tile.selected=this.filtered.subarray(tile.start,n);
  }
  this.repack();this.lastView=null;
 }
 prepare(frustum,length,pad){
  let needed=0,uncovered=false;
  for(let i=0;i<this.boxes.length;i++){
   const tile=this.boxes[i],{box,count}=tile;
   box.min.set(tile.minX-pad,-.1,tile.minZ-pad);box.max.set(tile.maxX+pad,tile.maxHeight*this.maxT*length+.10,tile.maxZ+pad);
   const visible=frustum.intersectsBox(box);this.next[i]=+visible;
   if(visible){needed+=count;uncovered||=!this.active[i];}
  }
  // A previous superset is safe when it still contains the visible tiles.
  // Don't upload new buffers for minor movement while turning or shaking.
  if(!uncovered&&needed>=this.covered*.74)return;
  this.active.set(this.next);this.covered=needed;this.repack();
 }
 repack(){
  const {geometry,buffer,active,boxes}=this,dst=buffer.array;
  let n=0;
  for(let i=0;i<boxes.length;i++)if(active[i]){const src=boxes[i].selected;dst.set(src,n);n+=src.length;}
  geometry.instanceCount=n/6;
  if(n){buffer.clearUpdateRanges();buffer.addUpdateRange(0,n);buffer.needsUpdate=true;}
 }
}
// One tileable mipmapped texture encodes soil granules, compacted earth,
// small stones, moss and dry plant fibres. Generated once, never per frame.
export function meadowGroundTexture(size=512){
 const bytes=new Uint8Array(size*size*4);
 const hash=(x,y)=>{let h=Math.imul(x+17,374761393)^Math.imul(y+91,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
 const noise=(u,v,n)=>{const x=u*n,y=v*n,ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);const m=n-1,h0=hash(ix&m,iy&m),h1=hash((ix+1)&m,iy&m),h2=hash(ix&m,(iy+1)&m),h3=hash((ix+1)&m,(iy+1)&m);return (h0+(h1-h0)*a)*(1-b)+(h2+(h3-h2)*a)*b;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,n=noise(u,v,8),clod=noise(u,v,32),grain=noise(u,v,128),speck=hash(x,y);
  const stone=grain>.68&&clod>.48?Math.min(1,(grain-.68)*4):0;
  const fibre=noise(u,v,64)>.70&&speck>.78?.16:0;
  const i=(y*size+x)*4;
  bytes[i]=Math.round(255*Math.min(1,.25+.28*n+.23*clod+.15*grain+.075*speck+.15*stone));
  bytes[i+1]=Math.round(255*Math.min(1,.18+.63*noise(u+.17,v+.31,16)+.15*grain));
  bytes[i+2]=Math.round(255*Math.min(1,stone+fibre));
  bytes[i+3]=255;
 }
 const t=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
export class GrassField{
 constructor(scene,{mobile=false,count}={}){
  this.count=count??(mobile?MEADOW_COUNTS.mobile:MEADOW_COUNTS.desktop);
  const geo=bladeGeometry(),seed=grassPositions(this.count);
  this.innerVisibility=new GrassVisibility(geo,seed,this.count);
  const positions=Array.from({length:6},()=>new THREE.Vector3(10000,0,10000));
  const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,depthWrite:true,
   uniforms:{uTime:{value:0},uPlayers:{value:positions},uPlayerCount:{value:0},uPlayerBounds:{value:new THREE.Vector4()},uGrassLength:{value:1},uPlantWidth:{value:1},uWindSpeed:{value:1},uWindStrength:{value:1},uPushRadius:{value:2.4},uPushStrength:{value:1},uGrassDelta:{value:new THREE.Vector3()}}});
  this.mesh=new THREE.Mesh(geo,material);this.mesh.name='JS procedural wind and footsteps grass';this.mesh.frustumCulled=false;
  scene.add(this.mesh);
  // Match central grass with living wind/trample blades across every street,
  // backed by an unbroken green canopy, so the sandy ground never leaks out.
  // Instanced GPU rendering keeps all 432 collision buildings intact.
  this.outerCount=mobile?MEADOW_COUNTS.outerMobile:MEADOW_COUNTS.outerDesktop;
  const cityGeo=bladeGeometry({segments:2,blades:3}),city=grassPositions(this.outerCount,73917,
   CITY_INNER_RADIUS-.5,CITY_OUTER_RADIUS+.5);
  this.outerVisibility=new GrassVisibility(cityGeo,city,this.outerCount);
  this.outerMesh=new THREE.Mesh(cityGeo,material);
  this.outerMesh.name='Dense living wind-blown city grass - full ruined district';
  this.outerMesh.frustumCulled=false;scene.add(this.outerMesh);
  // Flowers use two additional batched draws, not individual meshes. They share
  // exactly the same wind and player uniforms as the grass.
  const flowerUniforms={...material.uniforms,uGrassLength:{value:1},uPlantWidth:{value:1},
   uFlowerYellow:{value:new THREE.Vector3()},uFlowerPurple:{value:new THREE.Vector3()},uFlowerBlue:{value:new THREE.Vector3()}};
  const flowerMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:flowerFragment,side:THREE.DoubleSide,depthWrite:true,uniforms:flowerUniforms});
  const addFlowers=(count,seed,inner,outer)=>{
   const g=flowerGeometry(),samples=grassPositions(count,seed,inner,outer);
   for(let i=0;i<count;i++){const shade=samples.shades[i];samples.heights[i]=(.38+samples.heights[i]*.75)*(shade>=.3333&&shade<.6667?1.12:.82);}
   const visibility=new GrassVisibility(g,samples,count),mesh=new THREE.Mesh(g,flowerMaterial);
   mesh.name='Interactive instanced wildflowers';mesh.frustumCulled=false;scene.add(mesh);return {mesh,visibility};
  };
  const innerFlowers=addFlowers(Math.ceil(this.count*.11),48119,11,CITY_INNER_RADIUS-2);
  const outerFlowers=addFlowers(Math.ceil(this.outerCount*.11),84227,CITY_INNER_RADIUS-.5,CITY_OUTER_RADIUS+.5);
  this.flowerMesh=innerFlowers.mesh;this.flowerVisibility=innerFlowers.visibility;
  this.outerFlowerMesh=outerFlowers.mesh;this.outerFlowerVisibility=outerFlowers.visibility;
  // Continuous terrain underneath the 3D meadow, with naturally exposed soil.
  this.groundTexture=meadowGroundTexture();
  this.canopy=new THREE.Mesh(new THREE.CircleGeometry(CITY_INNER_RADIUS,128),new THREE.ShaderMaterial({
   uniforms:{uMeadowDelta:{value:new THREE.Vector3()},uFloorDelta:{value:new THREE.Vector3()},uGround:{value:this.groundTexture},uSoilExposure:{value:.4}},
   vertexShader:`varying vec2 grassPoint;void main(){grassPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`precision highp float;varying vec2 grassPoint;uniform vec3 uMeadowDelta;uniform vec3 uFloorDelta;uniform sampler2D uGround;uniform float uSoilExposure;
    void main(){
     vec3 fine=texture2D(uGround,grassPoint*.48).rgb;
     vec3 macro=texture2D(uGround,grassPoint*.047+vec2(.37,.19)).rgb;
     float cover=smoothstep(.33,.67,mix(fine.g,macro.g,.62)+( .4-uSoilExposure)*.55);
     vec3 soil=mix(vec3(.105,.074,.043),vec3(.43,.32,.20),fine.r);
     soil=mix(soil,vec3(.48,.44,.35),fine.b*.65)+uFloorDelta;
     vec3 moss=mix(vec3(.065,.12,.034),vec3(.24,.32,.10),fine.r)+uMeadowDelta;
     vec3 col=mix(soil,moss,cover);
     gl_FragColor=vec4(clamp(col,0.,1.),1.);
    }`,side:THREE.DoubleSide,depthWrite:true}));
  this.canopy.name='Continuous dense grass canopy';
  this.canopy.rotation.x=-Math.PI/2;this.canopy.position.y=.006;scene.add(this.canopy);
  this.outerCanopy=new THREE.Mesh(new THREE.RingGeometry(CITY_INNER_RADIUS-.25,CITY_OUTER_RADIUS+1,192),this.canopy.material);
  this.outerCanopy.name='Full city meadow and textured natural soil';
  this.outerCanopy.rotation.x=-Math.PI/2;this.outerCanopy.position.y=.007;scene.add(this.outerCanopy);
  // The grass edge meets the full-sphere nebula directly. No ocean or horizon mesh.
  this.visibilityPairs=[[this.mesh,this.innerVisibility],[this.outerMesh,this.outerVisibility],[this.flowerMesh,this.flowerVisibility],[this.outerFlowerMesh,this.outerFlowerVisibility]];
  this.setTerrainStyle({});
 }
 prepareVisibility(camera){
  // Called after the final camera position/screen shake and before uploading
  // attributes. It does not change the animation uniforms or grass shader.
  camera.updateWorldMatrix(true,false);
  const view=this.visibilityView??=new THREE.Matrix4(),local=this.visibilityLocal??=new THREE.Matrix4();
  const frustum=this.visibilityFrustum??=new THREE.Frustum();
  view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  for(const [mesh,data] of this.visibilityPairs){
   if(data.density===0)continue;
   const u=mesh.material.uniforms,length=u.uGrassLength.value;
   // Exact conservative displacement envelope: blade width + maximum wind +
   // six simultaneous pushes, multiplied by the highest authored bend weight.
   const pad=data.maxR*u.uPlantWidth.value+(.34*u.uWindStrength.value+6*1.05*u.uPushStrength.value)*data.maxT**2+.06;
   mesh.updateWorldMatrix(true,false);
   local.multiplyMatrices(view,mesh.matrixWorld);
   if(data.lastView?.equals(local)&&data.lastLength===length&&data.lastPad===pad)continue;
   (data.lastView??=new THREE.Matrix4()).copy(local);data.lastLength=length;data.lastPad=pad;
   frustum.setFromProjectionMatrix(local);data.prepare(frustum,length,pad);
  }
 }
 setTerrainStyle(environment){
  const s=terrainStyle(environment),key=JSON.stringify(s);if(key===this.terrainSignature)return;this.terrainSignature=key;
  const grass=this.mesh.material.uniforms,canopy=this.canopy.material.uniforms;
  grass.uGrassLength.value=s.grassLength;grass.uPlantWidth.value=s.grassWidth;
  grass.uWindSpeed.value=s.windSpeed;grass.uWindStrength.value=s.windStrength;grass.uPushRadius.value=s.grassPushRadius;grass.uPushStrength.value=s.grassPushStrength;
  this.innerVisibility.setDensity(s.grassDensity);this.outerVisibility.setDensity(s.grassDensity);
  this.flowerVisibility.setDensity(s.flowerDensity);this.outerFlowerVisibility.setDensity(s.flowerDensity);
  const flowers=this.flowerMesh.material.uniforms;flowers.uGrassLength.value=s.flowerSize;flowers.uPlantWidth.value=s.flowerSize;
  for(const [key,name] of [['flowerYellow','uFlowerYellow'],['flowerPurple','uFlowerPurple'],['flowerBlue','uFlowerBlue']])flowers[name].value.set(...s[key].slice(1).match(/../g).map(x=>parseInt(x,16)/255));
  grass.uGrassDelta.value.fromArray(terrainColorDelta(s.grassColor,TERRAIN_DEFAULTS.grassColor));
  canopy.uMeadowDelta.value.fromArray(terrainColorDelta(s.meadowColor,TERRAIN_DEFAULTS.meadowColor));
  canopy.uFloorDelta.value.fromArray(terrainColorDelta(s.floorColor,TERRAIN_DEFAULTS.floorColor));
  canopy.uSoilExposure.value=s.soilExposure;
 }
 update(time,roots){
  const uniform=this.mesh.material.uniforms;uniform.uTime.value=time;
  let i=0,minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
  for(const root of roots.values()){
   if(i>=6)break;if(!root?.visible)continue;
   const pos=root.position;uniform.uPlayers.value[i].copy(pos);i++;
   minX=Math.min(minX,pos.x);minZ=Math.min(minZ,pos.z);maxX=Math.max(maxX,pos.x);maxZ=Math.max(maxZ,pos.z);
  }
  uniform.uPlayerCount.value=i;uniform.uPlayerBounds.value.set(i?minX:0,i?minZ:0,i?maxX:0,i?maxZ:0);
 }
 dispose(){this.flowerMesh.removeFromParent();this.flowerMesh.geometry.dispose();this.outerFlowerMesh.removeFromParent();this.outerFlowerMesh.geometry.dispose();this.flowerMesh.material.dispose();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.outerMesh.removeFromParent();this.outerMesh.geometry.dispose();this.mesh.material.dispose();this.canopy.removeFromParent();this.canopy.geometry.dispose();this.outerCanopy.removeFromParent();this.outerCanopy.geometry.dispose();this.canopy.material.dispose();this.groundTexture.dispose();}
}
