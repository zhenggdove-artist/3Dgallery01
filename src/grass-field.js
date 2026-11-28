import * as THREE from 'three';
import {CITY_INNER_RADIUS,CITY_OUTER_RADIUS} from './shared/city-layout.js';
import {TERRAIN_DEFAULTS,terrainStyle,terrainColorDelta} from './shared/terrain-style.js';

// Instanced GPU vegetation; shared wind and player positions, no per-plant objects.
// All meshes and wind/trample rules are generated in JS; no external assets.
export function grassPositions(count=65000,seed=17331,inner=11,outer=CITY_INNER_RADIUS-2){
 const points=new Float32Array(count*2),heights=new Float32Array(count),angles=new Float32Array(count),phases=new Float32Array(count),shades=new Float32Array(count);
 let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<count;i++){
  const r=Math.sqrt(inner*inner+(outer*outer-inner*inner)*rand()),a=rand()*Math.PI*2;
  points[i*2]=Math.cos(a)*r;points[i*2+1]=Math.sin(a)*r;
  const patch=.5+.5*Math.sin(points[i*2]*.19+Math.sin(points[i*2+1]*.23)*1.4);
  heights[i]=(.48+rand()*.82)*(.78+.22*patch);angles[i]=rand()*Math.PI*2;
  phases[i]=rand()*100;shades[i]=rand();
 }
 return {points,heights,angles,phases,shades};
}
// Tapered, curved leaves with staggered crowns and distinct blade silhouettes.
function bladeGeometry({segments=3,blades=4}={}){
 const positions=[],indices=[],uvs=[];
 for(let j=0;j<blades;j++){
  const phi=j*2.39996,cs=Math.cos(phi),sn=Math.sin(phi);
  const lean=.26+.16*Math.sin(j*4.17),yScale=.73+(j%3)*.16;
  const base=positions.length/3;
  for(let i=0;i<=segments;i++){
   const t=i/segments,w=(1-t)**1.12*(.075+.025*Math.cos(j*2.7))+.001,drift=lean*t*t;
   for(const side of [-1,1]){
    const x=side*w,z=drift;
    positions.push(x*cs-z*sn,t*yScale,x*sn+z*cs);
    uvs.push(side<0?0:1,t);
   }
   if(i<segments){const b=base+i*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}
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
 const positions=[],uvs=[];
 const tri=(part,a,b,c)=>{for(const v of [a,b,c]){positions.push(...v);uvs.push(part,0);}};
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
 const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));return g;
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
 for(int i=0;i<6;i++){
  if(float(i)>=uPlayerCount)break;
  vec2 push=aOffset-uPlayers[i].xz;
  float dist=length(push);
  float press=1.-smoothstep(.12,uPushRadius,dist);
  trample+=push/max(.15,dist)*press*1.05*uPushStrength;
  pressure=max(pressure,press);
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
const GRASS_TILE=24,GRASS_BOUND_PAD=12;
class GrassVisibility{
 constructor(geometry,seed,count){
  this.geometry=geometry;this.count=count;this.tileOf=new Uint16Array(count);
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
    this.boxes.push({box,count:0});
   }
   this.tileOf[i]=tile;this.boxes[tile].count++;
  }
  this.active=new Uint8Array(this.boxes.length);this.active.fill(1);
  this.next=new Uint8Array(this.boxes.length);
  // Same six floats, same original order, one interleaved GPU upload.
  // Pack the immutable seed once, not five independent array copies on turns.
  this.packed=new Float32Array(count*6);
  for(let i=0;i<count;i++){const j=i*6;this.packed[j]=seed.points[i*2];this.packed[j+1]=seed.points[i*2+1];this.packed[j+2]=seed.heights[i];this.packed[j+3]=seed.angles[i];this.packed[j+4]=seed.phases[i];this.packed[j+5]=seed.shades[i];}
  this.buffer=new THREE.InstancedInterleavedBuffer(this.packed.slice(),6,1).setUsage(THREE.DynamicDrawUsage);
  for(const [name,size,offset] of [['aOffset',2,0],['aHeight',1,2],['aAngle',1,3],['aPhase',1,4],['aShade',1,5]])
   geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(this.buffer,size,offset));
  geometry.instanceCount=count;this.density=1;
 }
 setDensity(density){if(density===this.density)return;this.density=density;this.repack();this.lastView=null;}
 prepare(frustum,length){
  let needed=0,uncovered=false;
  for(let i=0;i<this.boxes.length;i++){
   const {box,count}=this.boxes[i];box.max.y=1.4*length+.10;
   const visible=frustum.intersectsBox(box);this.next[i]=+visible;
   if(visible){needed+=count;uncovered||=!this.active[i];}
  }
  // A previous superset is safe when it still contains the visible tiles.
  // Don't upload new buffers for minor movement while turning or shaking.
  if(!uncovered&&needed>=this.covered*.74)return;
  this.active.set(this.next);this.covered=needed;this.repack();
 }
 repack(){
  const {geometry,packed,buffer,active,tileOf,count,density}=this,dst=buffer.array;
  let n=0;
  for(let i=0;i<count;i++)if(active[tileOf[i]]&&(density===1||(Math.imul(i+1,0x9e3779b1)>>>0)/4294967296<density)){
   const j=i*6,k=n*6;
   dst[k]=packed[j];dst[k+1]=packed[j+1];dst[k+2]=packed[j+2];dst[k+3]=packed[j+3];dst[k+4]=packed[j+4];dst[k+5]=packed[j+5];n++;
  }
  geometry.instanceCount=n;
  if(n){buffer.clearUpdateRanges();buffer.addUpdateRange(0,n*6);buffer.needsUpdate=true;}
 }
}
export class GrassField{
 constructor(scene,{mobile=false,count}={}){
  this.count=count??(mobile?25000:65000);
  const geo=bladeGeometry(),seed=grassPositions(this.count);
  this.innerVisibility=new GrassVisibility(geo,seed,this.count);
  const positions=Array.from({length:6},()=>new THREE.Vector3(10000,0,10000));
  const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,depthWrite:true,
   uniforms:{uTime:{value:0},uPlayers:{value:positions},uPlayerCount:{value:0},uGrassLength:{value:1},uPlantWidth:{value:1},uWindSpeed:{value:1},uWindStrength:{value:1},uPushRadius:{value:2.4},uPushStrength:{value:1},uGrassDelta:{value:new THREE.Vector3()}}});
  this.mesh=new THREE.Mesh(geo,material);this.mesh.name='JS procedural wind and footsteps grass';this.mesh.frustumCulled=false;
  scene.add(this.mesh);
  // Match central grass with living wind/trample blades across every street,
  // backed by an unbroken green canopy, so the sandy ground never leaks out.
  // Instanced GPU rendering keeps all 432 collision buildings intact.
  this.outerCount=mobile?85000:190000;
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
   for(let i=0;i<count;i++){const shade=samples.shades[i];samples.heights[i]*=shade>=.3333&&shade<.6667?1.05:.7;}
   const visibility=new GrassVisibility(g,samples,count),mesh=new THREE.Mesh(g,flowerMaterial);
   mesh.name='Interactive instanced wildflowers';mesh.frustumCulled=false;scene.add(mesh);return {mesh,visibility};
  };
  const innerFlowers=addFlowers(Math.ceil(this.count*.055),48119,11,CITY_INNER_RADIUS-2);
  const outerFlowers=addFlowers(Math.ceil(this.outerCount*.055),84227,CITY_INNER_RADIUS-.5,CITY_OUTER_RADIUS+.5);
  this.flowerMesh=innerFlowers.mesh;this.flowerVisibility=innerFlowers.visibility;
  this.outerFlowerMesh=outerFlowers.mesh;this.outerFlowerVisibility=outerFlowers.visibility;
  // Continuous fine-blade grass canopy covers every small gap between tufts;
  // no bare underlying meadow plane is visible while walking or looking down.
  this.canopy=new THREE.Mesh(new THREE.CircleGeometry(CITY_INNER_RADIUS,128),new THREE.ShaderMaterial({
   uniforms:{uMeadowDelta:{value:new THREE.Vector3()},uFloorDelta:{value:new THREE.Vector3()}},
   vertexShader:`varying vec2 grassPoint;void main(){grassPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`precision mediump float;varying vec2 grassPoint;uniform vec3 uMeadowDelta;uniform vec3 uFloorDelta;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){vec2 p=grassPoint*28.;vec2 g=floor(p);vec2 f=fract(p);
     float n=hash(g),n2=hash(g+vec2(17.,47.));
     float stripe=sin((f.x+n*.7)*28.+sin(f.y*17.+n*6.)*1.7);
     float fine=sin((f.x*.64+f.y*.77+n2)*42.);
     float patch=.5+.5*sin(grassPoint.x*.23+sin(grassPoint.y*.21)*1.6);
     vec3 dark=vec3(.068,.15,.055),mid=vec3(.15,.29,.085),bright=vec3(.31,.45,.16);
     // The visible ground between the textured grass strokes follows the
     // floor color, independently of the grass canopy's own color.
     dark+=uFloorDelta;
     mid+=uMeadowDelta;bright+=uMeadowDelta;
     vec3 col=mix(dark,mid,.20+.46*n+.20*patch);
     col=mix(col,bright,clamp(stripe*.13+fine*.095+n2*.22,0.,.45));
     gl_FragColor=vec4(clamp(col,0.,1.),1.);
    }`,side:THREE.DoubleSide,depthWrite:true}));
  this.canopy.name='Continuous dense grass canopy';
  this.canopy.rotation.x=-Math.PI/2;this.canopy.position.y=.006;scene.add(this.canopy);
  this.outerCanopy=new THREE.Mesh(new THREE.RingGeometry(CITY_INNER_RADIUS-.25,CITY_OUTER_RADIUS+1,192),this.canopy.material);
  this.outerCanopy.name='Full city green grass canopy with no exposed earth';
  this.outerCanopy.rotation.x=-Math.PI/2;this.outerCanopy.position.y=.007;scene.add(this.outerCanopy);
  // The grass edge meets the full-sphere nebula directly. No ocean or horizon mesh.
  this.setTerrainStyle({});
 }
 prepareVisibility(camera){
  // Called after the final camera position/screen shake and before uploading
  // attributes. It does not change the animation uniforms or grass shader.
  camera.updateWorldMatrix(true,false);
  const view=this.visibilityView??=new THREE.Matrix4(),local=this.visibilityLocal??=new THREE.Matrix4();
  const frustum=this.visibilityFrustum??=new THREE.Frustum();
  view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  for(const [mesh,data] of [[this.mesh,this.innerVisibility],[this.outerMesh,this.outerVisibility],[this.flowerMesh,this.flowerVisibility],[this.outerFlowerMesh,this.outerFlowerVisibility]]){
   if(data.density===0)continue;
   const length=mesh.material.uniforms.uGrassLength.value;
   mesh.updateWorldMatrix(true,false);
   local.multiplyMatrices(view,mesh.matrixWorld);
   if(data.lastView?.equals(local)&&data.lastLength===length)continue;
   (data.lastView??=new THREE.Matrix4()).copy(local);data.lastLength=length;
   frustum.setFromProjectionMatrix(local);data.prepare(frustum,length);
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
 }
 update(time,roots){
  const uniform=this.mesh.material.uniforms;uniform.uTime.value=time;
  let i=0;for(const root of roots.values()){
   if(i>=6)break;if(!root?.visible)continue;
   uniform.uPlayers.value[i].copy(root.position);i++;
  }
  uniform.uPlayerCount.value=i;
 }
 dispose(){this.flowerMesh.removeFromParent();this.flowerMesh.geometry.dispose();this.outerFlowerMesh.removeFromParent();this.outerFlowerMesh.geometry.dispose();this.flowerMesh.material.dispose();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.outerMesh.removeFromParent();this.outerMesh.geometry.dispose();this.mesh.material.dispose();this.canopy.removeFromParent();this.canopy.geometry.dispose();this.outerCanopy.removeFromParent();this.outerCanopy.geometry.dispose();this.canopy.material.dispose();}
}
