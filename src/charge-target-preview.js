import * as THREE from 'three';
import {attackStats} from './shared/catalog.js';
import {SNIPER_RANGE} from './shared/combat-balance.js';
import {chargedArea,spellGroundHeight,spellFootprint,scaleUltimateFootprint} from './shared/charge-area.js';
import {weaponQuality,isChannelStaff,forwardCastRadius,channelReachMultiplier,GOLDFISH_SWIM_RADIUS} from './shared/weapon-abilities.js';
// These are the ORIGINAL source downloads from 00GameDevs; do not redraw them.
import createSector from '../vendor/00gamedevs/source/spell-indicator-sector.js';
import createRectangle from '../vendor/00gamedevs/source/spell-indicator-rectangle.js';

const BLUE='#24aaff';
export const runeColorFor=()=>BLUE;
function circle(radius,width){
 const mesh=new THREE.Mesh(new THREE.RingGeometry(radius-width/2,radius+width/2,96),
  new THREE.MeshBasicMaterial({color:BLUE,transparent:true,opacity:.84,depthTest:true,
   depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));
 mesh.rotation.x=-Math.PI/2;
 return mesh;
}
function runes(){
 const v=[],line=(a,b,c,d)=>v.push(a,.035,b,c,.035,d);
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,b=a+.16,r=.79;
  line(Math.cos(a)*r,Math.sin(a)*r,Math.cos(b)*r,Math.sin(b)*r);
  const ri=.67+(i%3)*.04;
  line(Math.cos(a)*ri,Math.sin(a)*ri,Math.cos(a)*(ri+.095),Math.sin(a)*(ri+.095));
  if(i%3===0){const u=(i+1)*Math.PI/12;line(Math.cos(a)*.52,Math.sin(a)*.52,Math.cos(u)*.40,Math.sin(u)*.40);}
 }
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,b=(i+3)*Math.PI/4;
  line(Math.cos(a)*.55,Math.sin(a)*.55,Math.cos(b)*.55,Math.sin(b)*.55);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
 return new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
  color:BLUE,transparent:true,opacity:.88,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false
 }));
}
export class ChargeTargetPreview {
 constructor(scene){
  this.scene=scene;this.group=new THREE.Group();this.group.name='Charged magic target circle';
  this.outer=circle(.96,.075);this.inner=circle(.58,.055);this.middle=circle(.77,.045);
  this.symbols=runes();
  // The halo fits INSIDE the authoritative radius, never exceeds it.
  this.glows=[circle(.91,.14),circle(.55,.14)];
  for(const glow of this.glows){glow.material.opacity=.32;glow.renderOrder=17;}
  this.group.add(...this.glows,this.outer,this.inner,this.middle,this.symbols);
  for(const part of [this.outer,this.inner,this.middle,this.symbols])part.renderOrder=18;
  scene.add(this.group);this.group.visible=false;
  this.sector=createSector({color:BLUE,size:3,angleDeg:90,progressMode:'manual',detail:1});
  this.rectangle=createRectangle({color:BLUE,length:6,width:3,fillMode:'forward',progressMode:'manual',detail:1});
  for(const [fx,num] of [[this.sector,58],[this.rectangle,59]]){
   fx.group.name='00GameDevs original blue warning #'+num;
   fx.group.userData.vfxSource='00GameDevs';
   fx.group.userData.vfxNumber=num;
   fx.group.visible=false;scene.add(fx.group);
  }
  this.guides=[];this.t=0;this.activeShape=null;this.lastParams=null;this.footprint=null;
 }
 update(root,item,charge,direction,arena,fusion=null,muzzle=null,dt=1/60){
  if(!root||!item||charge<.1||!Array.isArray(direction)){this.hide();return;}
  const equipped=fusion?.original?.stats?{...item,...fusion.original.stats}:item;
  const stats=attackStats(equipped,1),quality=weaponQuality(equipped,fusion);
  if(isChannelStaff(equipped))stats.range=Math.max(stats.range,equipped.id==='clam'?10:Math.min(18,equipped.range))*channelReachMultiplier(equipped);
  stats.range=+(stats.range*quality.range).toFixed(2);
  // Use the same thin hit tube as server-owned continuous casting, rather
  // than the giant charged blast radius.
  stats.radius=forwardCastRadius(equipped,quality,stats.radius,isChannelStaff(equipped));
   if(equipped.id==='black-cat')stats.range=SNIPER_RANGE;
   if(equipped.id==='jellybrella'&&stats.ultimate)stats.radius=Math.max(10,stats.radius*2);
   if(equipped.id==='goldfish'&&stats.ultimate)stats.radius=GOLDFISH_SWIM_RADIUS*quality.visual;
   scaleUltimateFootprint(stats);
  const ground=(x,z,y)=>spellGroundHeight(arena?.world,x,z,y);
  const origin=Array.isArray(muzzle)&&muzzle.length===3&&muzzle.every(Number.isFinite)
   ?[...muzzle]:[root.position.x,root.position.y+1,root.position.z];
  const area=chargedArea(equipped,origin,direction,stats,ground,isChannelStaff(equipped));
  const footprint=spellFootprint(equipped,origin,direction,stats,area,ground);
  const type=footprint.shape;
  if(this.activeShape!==type){
   this.hide();this.activeShape=type;this.lastParams=null;
   if(type==='sector')this.sector.reset();
   if(type==='rectangle')this.rectangle.reset();
  }
  this.footprint=footprint;
  this.group.visible=type==='circle';
  this.sector.group.visible=type==='sector';
  this.rectangle.group.visible=type==='rectangle';
  this.t+=Math.max(0,dt);
  if(type==='circle'){
   this.group.position.fromArray(footprint.position);
   this.group.scale.setScalar(footprint.radius);
   this.group.rotation.y+=dt*.22;
   for(const g of this.glows)g.material.opacity=.24+.14*charge+.06*Math.sin(this.t*3);
   this.outer.material.opacity=.85+.10*charge+.045*Math.sin(this.t*3);
   this.inner.material.opacity=.84+.14*charge;
   this.middle.material.opacity=.78+.16*charge;
   this.symbols.material.opacity=.85+.14*charge;
   return;
  }
  // Official #59 enforces a MINIMUM local width (.75m). A uniform
  // world scale for an 80m sniper beam expands that minimum to 3m and
  // silently makes the warning much wider than the *true* hit cylinder.
  // Scale X (longitudinal) and Z (lateral) INDEPENDENTLY to exact server
  // dimensions, while preserving every pixel of the original effect.
  const factor=type==='sector'?Math.max(1,footprint.radius/20):
   Math.max(1,footprint.length/20);
  const fx=type==='sector'?this.sector:this.rectangle;
  const localWidth=type==='rectangle'?Math.max(.75,footprint.width/factor):0;
  const params=type==='sector'
   ?{color:BLUE,size:footprint.radius/factor,angleDeg:footprint.angleDeg}
   :{color:BLUE,length:footprint.length/factor,width:localWidth,fillMode:'forward'};
  const key=JSON.stringify(params);
  if(this.lastParams!==key){fx.setOptions(params);this.lastParams=key;}
  fx.group.position.fromArray(footprint.position);
  fx.group.rotation.set(0,footprint.yaw,0);
  if(type==='rectangle')
   fx.group.scale.set(factor,factor,footprint.width/localWidth);
  else fx.group.scale.setScalar(factor);
  fx.setProgress(Math.max(0,Math.min(.995,charge)));
  fx.update(Math.max(0,Math.min(.05,Number(dt)||1/60)));
 }
 hide(){
  if(this.activeShape==='sector')this.sector.reset();
  if(this.activeShape==='rectangle')this.rectangle.reset();
  this.activeShape=null;this.footprint=null;this.lastParams=null;
  this.group.visible=false;this.sector.group.visible=false;this.rectangle.group.visible=false;
 }
 dispose(){
  this.hide();this.group.removeFromParent();
  this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  for(const fx of [this.sector,this.rectangle]){fx.group.removeFromParent();fx.dispose();}
 }
}
