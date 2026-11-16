import * as THREE from 'three';
import {attackStats} from './shared/catalog.js';
import {chargedArea,spellGroundHeight} from './shared/charge-area.js';

export const runeColorFor=item=>({
 fire:'#ff712b',ice:'#98eaff',water:'#48d6ff',wave:'#5aeece',
 lightning:'#b49aff',beam:'#ffd4f2',petal:'#ffa7d9',
 saber:'#ffc879',swatter:'#668d83',pan:'#ffc48a',
 whip:'#d6b7ff',planter:'#adf4a1',palm:'#a5ea8f'
}[item?.family]||'#b6ddff');

function circle(radius,width,color){
 const mesh=new THREE.Mesh(new THREE.RingGeometry(radius-width/2,radius+width/2,96),
   new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
 mesh.rotation.x=-Math.PI/2;
 return mesh;
}
function runes(color){
 const v=[],line=(a,b,c,d)=>{v.push(a,.035,b,c,.035,d);};
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,b=a+.16,r=.79;
  line(Math.cos(a)*r,Math.sin(a)*r,Math.cos(b)*r,Math.sin(b)*r);
  const ri=.67+(i%3)*.04;
  line(Math.cos(a)*ri,Math.sin(a)*ri,Math.cos(a)*(ri+.095),Math.sin(a)*(ri+.095));
  if(i%3===0){const u=(i+1)*Math.PI/12;line(Math.cos(a)*.52,Math.sin(a)*.52,Math.cos(u)*.40,Math.sin(u)*.40);}
 }
 // Eight pointed star inscribed in the casting ring.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,b=(i+3)*Math.PI/4;
  line(Math.cos(a)*.55,Math.sin(a)*.55,Math.cos(b)*.55,Math.sin(b)*.55);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
 const mesh=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
  color,transparent:true,opacity:.88,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending
 }));
 return mesh;
}
// Every targeting marker is a real MAGIC CIRCLE, never a white debug rectangle.
export class ChargeTargetPreview{
 constructor(scene){
  this.scene=scene;this.group=new THREE.Group();this.group.name='Charged magic target circle';
  this.outer=circle(.96,.022,'#ffffff');this.inner=circle(.58,.014,'#ffffff');
  this.middle=circle(.77,.011,'#ffffff');this.symbols=runes('#ffffff');
  this.group.add(this.outer,this.inner,this.middle,this.symbols);
  scene.add(this.group);this.group.visible=false;
  this.guides=Array.from({length:6},(_,i)=>{
   const g=new THREE.Group();g.name='Forward magic rune '+i;
   const ring=circle(.9,.035,'#ffffff'),glyph=runes('#ffffff');
   g.add(ring,glyph);scene.add(g);g.visible=false;return g;
  });
  this.t=0;
 }
 update(root,item,charge,direction,arena){
  if(!root||!item||charge<.1||!Array.isArray(direction)){this.hide();return;}
  const stats=attackStats(item,1),origin=[root.position.x,root.position.y+1,root.position.z];
  const area=chargedArea(item,origin,direction,stats,(x,z,y)=>spellGroundHeight(arena.world,x,z,y));
  const dir=new THREE.Vector3(direction[0],0,direction[2]);
  if(dir.lengthSq()<.001)dir.set(0,0,1);dir.normalize();
  const travel=area.mode==='area'?area.travel:stats.range;
  const x=area.mode==='area'?area.center[0]:origin[0]+dir.x*travel;
  const z=area.mode==='area'?area.center[2]:origin[2]+dir.z*travel;
  const y=Math.max(.14,spellGroundHeight(arena.world,x,z,origin[1])+.16);
  const radius=area.mode==='area'?Math.max(1.7,area.radius):Math.max(1.7,Math.min(7,stats.radius+1));
  const tint=new THREE.Color(runeColorFor(item));
  const parts=[this.outer,this.inner,this.middle,this.symbols];
  for(const p of parts)p.material.color.copy(tint);
  this.group.visible=true;this.group.position.set(x,y,z);
  this.group.scale.setScalar(radius);
  this.t+=.033;
  this.group.rotation.y+=.005;
  this.outer.material.opacity=.5+.34*charge+.12*Math.sin(this.t*3);
  this.inner.material.opacity=.45+.36*charge;
  this.middle.material.opacity=.3+.2*charge;
  this.symbols.material.opacity=.55+.42*charge;
  // Non-area attacks show forward reach with smaller symbols at intervals.
  // There are no rectangle corners/edges or screen-space geometry.
  for(let i=0;i<this.guides.length;i++){
   const g=this.guides[i],f=(i+1)/(this.guides.length+1);
   g.visible=area.mode!=='area';
   if(!g.visible)continue;
   const gx=origin[0]+dir.x*travel*f,gz=origin[2]+dir.z*travel*f;
   const gy=Math.max(.14,spellGroundHeight(arena.world,gx,gz,origin[1])+.17);
   g.position.set(gx,gy,gz);g.scale.setScalar(.62+Math.min(1.2,stats.radius*.22));
   g.rotation.y=this.t*.2+i*.37;
   for(const child of g.children){child.material.color.copy(tint);child.material.opacity=.3+.42*charge;}
  }
 }
 hide(){this.group.visible=false;for(const g of this.guides)g.visible=false;}
 dispose(){
  this.hide();
  for(const group of [this.group,...this.guides]){
   group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
 }
}
