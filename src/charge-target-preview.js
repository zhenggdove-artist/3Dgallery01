import * as THREE from 'three';
import {attackStats} from './shared/catalog.js';
import {chargedArea,spellGroundHeight} from './shared/charge-area.js';
import {weaponQuality,isChannelStaff} from './shared/weapon-abilities.js';

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
  this.outer=circle(.96,.075,'#24aaff');this.inner=circle(.58,.055,'#24aaff');
  this.middle=circle(.77,.045,'#24aaff');this.symbols=runes('#24aaff');
  this.glows=[circle(.96,.25,'#1486ff'),circle(.58,.17,'#25bbff')];
  for(const glow of this.glows){glow.material.opacity=.32;glow.material.depthWrite=false;glow.renderOrder=17;}
  this.group.add(...this.glows,this.outer,this.inner,this.middle,this.symbols);
  for(const part of [this.outer,this.inner,this.middle,this.symbols]){part.material.toneMapped=false;part.renderOrder=18;}
  scene.add(this.group);this.group.visible=false;
  this.guides=Array.from({length:6},(_,i)=>{
   const g=new THREE.Group();g.name='Forward magic rune '+i;
   const ring=circle(.9,.09,'#24aaff'),glyph=runes('#24aaff');
   g.add(ring,glyph);scene.add(g);g.visible=false;return g;
  });
  this.t=0;
 }
 update(root,item,charge,direction,arena,fusion=null){
  if(!root||!item||charge<.1||!Array.isArray(direction)){this.hide();return;}
  // Reproduce equippedItem() before estimating the server impact area:
  // fusion original.stats may override the catalogue range/radius directly.
  const equipped=fusion?.original?.stats?{...item,...fusion.original.stats}:item;
  const stats=attackStats(equipped,1),quality=weaponQuality(equipped,fusion);
  // Authoritative channel attacks extend minimum casting reach before quality.
  if(isChannelStaff(equipped))stats.range=Math.max(stats.range,equipped.id==='clam'?10:Math.min(18,equipped.range));
  stats.range=+(stats.range*quality.range).toFixed(2);
  stats.radius=+(stats.radius*quality.radius).toFixed(2);
  const origin=[root.position.x,root.position.y+1,root.position.z];
  // Use the identical ground and numeric range/radius as the authoritative
  // chargedArea() calculation in temple-rules.js.
  const area=chargedArea(item,origin,direction,stats,(x,z,y)=>spellGroundHeight(arena.world,x,z,y));
  const [x,y,z]=area.visualCenter;
  const radius=Math.max(1.7,area.radius);
  const tint=new THREE.Color('#24aaff');
  const parts=[this.outer,this.inner,this.middle,this.symbols];
  for(const p of parts)p.material.color.copy(tint);
  this.group.visible=true;this.group.position.set(x,y,z);
  this.group.scale.setScalar(radius);
  this.t+=.033;
  this.group.rotation.y+=.005;
  for(const glow of this.glows){glow.material.color.copy(tint);glow.material.opacity=.24+.16*charge+.06*Math.sin(this.t*3);}
  this.outer.material.opacity=.85+.1*charge+.045*Math.sin(this.t*3);
  this.inner.material.opacity=.84+.14*charge;
  this.middle.material.opacity=.78+.16*charge;
  this.symbols.material.opacity=.85+.14*charge;
  // Exactly one target circle: secondary circles previously predicted
  // different positions from the actual attack and were misleading.
  for(const guide of this.guides)guide.visible=false;
 }
 hide(){this.group.visible=false;for(const g of this.guides)g.visible=false;}
 dispose(){
  this.hide();
  for(const group of [this.group,...this.guides]){
   group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
 }
}
