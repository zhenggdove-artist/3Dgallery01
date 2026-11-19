import * as THREE from 'three';
import {CITY_MAX_HP,cityRoofHeightAtHp} from './shared/city-layout.js';

// Exactly TWO GPU draws regardless of whether 1 or 432 houses burn.
// All motion, density gating and death fade are shader-based; CPU position
// attributes change only when an authoritative HP value changes.
const vertexShader=`
attribute vec4 aFlow;
attribute vec3 aBurn;
uniform float uTime;
uniform float uSmoke;
varying float vOpacity;
void main(){
 float power=aBurn.x;
 float present=step(aFlow.z,power)*step(.001,power);
 float age=max(0.,uTime-aBurn.y);
 float lifetime=mix(4.6,8.,uSmoke);
 float ending=mix(1.,clamp(1.-age/lifetime,0.,1.),step(.5,aBurn.z));
 float t=fract(uTime*aFlow.y+aFlow.x);
 float seed=aFlow.x*37.7;
 vec3 p=position;
 p.x+=sin(t*5.6+seed)*t*(.15+power*.68);
 p.z+=cos(t*6.3+seed)*t*(.13+power*.54);
 p.y+=t*mix(1.35+power*.9,2.2+power*3.8,uSmoke);
 vec4 view=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*view;
 float size=mix(aFlow.w,.99+aFlow.w*1.25,uSmoke)*(1.+power*.42);
 gl_PointSize=clamp(size*260./max(1.,-view.z),0.,83.);
 vOpacity=present*ending*mix(.89,.82,uSmoke)
  *max(0.,power)*(1.-smoothstep(.72,1.,t))*smoothstep(0.,.10,t);
}`;
const fragmentShader=`
uniform sampler2D uMap;
uniform float uSmoke;
varying float vOpacity;
void main(){
 vec4 texel=texture2D(uMap,gl_PointCoord);
 float alpha=texel.a*vOpacity;
 if(alpha<.012)discard;
 vec3 tint=mix(vec3(1.,.94,.81),vec3(.53,.50,.49),uSmoke);
 gl_FragColor=vec4(texel.rgb*tint,alpha);
}`;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function seeded(seed){let v=seed>>>0;return ()=>((v=(Math.imul(v,1664525)+1013904223)>>>0)/4294967296);}
function layer(root,lots,texture,mobile,smoke){
 const count=smoke?(mobile?14:26):(mobile?11:18);
 const positions=new Float32Array(lots.length*count*3);
 const flow=new Float32Array(lots.length*count*4);
 const burn=new Float32Array(lots.length*count*3);
 const baseHeight=new Float32Array(lots.length*count);
 for(const lot of lots){
  const random=seeded(77891+lot.index*7919+(smoke?127:31));
  for(let i=0;i<count;i++){
   const at=lot.index*count+i,s=at*3,f=at*4;
   const wall=i%4,u=(random()-.5)*.88;
   const x=(wall===0||wall===2)?u*lot.width:(wall===1?1:-1)*lot.width*.49;
   const z=(wall===1||wall===3)?u*lot.depth:(wall===0?1:-1)*lot.depth*.49;
   const cs=Math.cos(lot.yaw),sn=Math.sin(lot.yaw);
   positions[s]=lot.x+cs*x+sn*z;
   positions[s+2]=lot.z-sn*x+cs*z;
   const y=.5+random()*Math.max(.2,lot.height-.8);
   positions[s+1]=y;baseHeight[at]=y;
   const ember=!smoke&&i%4===0;
   flow[f]=random();flow[f+1]=.14+random()*.35;
   flow[f+2]=i===0?0:random()*.9; // Density grows continuously with HP damage.
   flow[f+3]=smoke?1.2+random()*.95:ember?.13+random()*.16:.55+random()*.36;
  }
 }
 const geometry=new THREE.BufferGeometry();
 const pos=new THREE.BufferAttribute(positions,3);pos.setUsage(THREE.DynamicDrawUsage);
 const state=new THREE.BufferAttribute(burn,3);state.setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('position',pos);
 geometry.setAttribute('aFlow',new THREE.BufferAttribute(flow,4));
 geometry.setAttribute('aBurn',state);
 const uniforms={uTime:{value:0},uSmoke:{value:smoke?1:0},uMap:{value:texture}};
 const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,
  depthWrite:false,transparent:true,
  blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending});
 const points=new THREE.Points(geometry,material);
 points.name=smoke?'Citywide continuous thickening smoke':'Citywide continuous flames and embers';
 points.frustumCulled=false;
 root.add(points);
 return {count,geometry,material,points,positions,baseHeight,burn,state,pos,uniforms};
}
export function cityFirePower(hp,maxHp=CITY_MAX_HP){
 if(!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0||hp>=maxHp)return 0;
 // 10% HP = maximum smoke, flame and sparks; 0 HP is handled separately.
 return clamp((maxHp-hp)/(maxHp*.9),0,1);
}
export class CityFireField{
 constructor(root,lots,textures,mobile=false){
  this.root=root;this.lots=lots;this.current=new Map();this.time=0;
  this.layers=[layer(root,lots,textures.flame,mobile,false),
   layer(root,lots,textures.smoke,mobile,true)];
 }
 setLot(lot,hp,maxHp=CITY_MAX_HP,{snapshot=false}={}){
  if(!lot||!Number.isFinite(hp))return;
  const previous=this.current.get(lot.index);
  if(previous&&previous.hp===hp&&previous.maxHp===maxHp)return;
  const dead=hp<=0;
  const previouslyLiving=!previous||previous.hp>0;
  const dying=dead&&!snapshot&&!!previouslyLiving;
  const power=dead?(dying?1:0):cityFirePower(hp,maxHp);
  const deathStart=dying?this.time:0;
  const roof=cityRoofHeightAtHp(lot,Math.max(0,hp),maxHp);
  // Never restart an extinction timer when repeated world state arrives.
  this.current.set(lot.index,{hp,maxHp,dying});
  for(const cloud of this.layers){
   const {count,burn,positions,baseHeight,state,pos}=cloud;
   const first=lot.index*count,after=first+count;
   for(let i=first;i<after;i++){
    burn[i*3]=power;burn[i*3+1]=deathStart;burn[i*3+2]=dying?1:0;
    // Combustion emerges from remaining masonry, not from the old roof's
    // former height as the ruin descends.
    positions[i*3+1]=Math.max(.22,Math.min(baseHeight[i],roof-.12));
   }
   state.addUpdateRange(first*3,count*3);state.needsUpdate=true;
   pos.addUpdateRange(first*3,count*3);pos.needsUpdate=true;
  }
 }
 update(time){
  this.time=time;
  for(const cloud of this.layers)cloud.uniforms.uTime.value=time;
 }
 reset(){
  this.current.clear();
  for(const cloud of this.layers){
   cloud.burn.fill(0);cloud.state.clearUpdateRanges();cloud.state.needsUpdate=true;
   // Restore full base positions only on rare GM world resets.
   for(let i=0;i<cloud.baseHeight.length;i++)cloud.positions[i*3+1]=cloud.baseHeight[i];
   cloud.pos.clearUpdateRanges();cloud.pos.needsUpdate=true;
  }
 }
 dispose(){
  for(const cloud of this.layers){
   cloud.points.removeFromParent();
   cloud.geometry.dispose();
   cloud.material.dispose();
  }
  this.layers=[];
 }
}
