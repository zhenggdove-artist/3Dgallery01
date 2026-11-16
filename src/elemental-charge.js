import * as THREE from 'three';

// Charge is deliberately tight around the player's hands; no free-flying
// projectile is spawned while the button is held.
export function chargePalette(item){
 const family=item?.family;
 if(family==='fire')return ['#ff451b','#ffbd48','#ffe9a0'];
 if(family==='ice')return ['#8ad4ff','#e6fbff','#66acff'];
 if(family==='water'||family==='wave')return ['#26b9f5','#a3f5ff','#2078e8'];
 if(family==='lightning')return ['#c5a6ff','#f6ebff','#8474ff'];
 if(family==='saber')return ['#ffd37e','#fff1c8','#d7a5ff'];
 if(family==='petal'||family==='planter')return ['#ff82b5','#ffe2ed','#adffbe'];
 if(family==='swatter')return ['#667789','#c4cbd6','#28313d'];
 if(family==='pan')return ['#ffd17e','#f3aa78','#fbf0c8'];
 return ['#82d7dc','#edfbfa','#9bb7ff'];
}
export class ElementalCharge{
 constructor(scene){
  this.scene=scene;this.active=false;this.kind='';
  const n=160,this.position=new Float32Array(n*3),colors=new Float32Array(n*3);
  this.geometry=new THREE.BufferGeometry();
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.position,3).setUsage(THREE.DynamicDrawUsage));
  this.color=this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  this.material=new THREE.PointsMaterial({vertexColors:true,size:.095,sizeAttenuation:true,transparent:true,
   opacity:.83,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending});
  this.root=new THREE.Points(this.geometry,this.material);
  this.root.name='Weapon-centred elemental charge aura';
  this.root.frustumCulled=false;this.root.visible=false;scene.add(this.root);
 }
 charging(root,progress,item){
  if(!root||!item||progress<=.055){this.root.visible=false;this.active=false;return;}
  this.active=true;this.root.visible=true;
  this.root.position.copy(root.position);
  const colors=chargePalette(item);
  const kind=item.family||'';
  if(kind!==this.kind){
   this.kind=kind;
   const a=this.color.array;
   for(let i=0;i<160;i++){
    const c=new THREE.Color(colors[i%3]);
    a.set([c.r,c.g,c.b],i*3);
   }
   this.color.needsUpdate=true;
  }
  const time=performance.now()*.001;
  const fire=kind==='fire',ice=kind==='ice',water=kind==='water'||kind==='wave';
  const r=.14+.22*progress;
  for(let i=0;i<160;i++){
   const u=(i+.5)/160,a=i*2.399963+time*(fire?4:ice?-1.5:2.1),h=(u*7+time*(fire?1.6:ice?-.8:.55))%1;
   const radial=r*(.3+.7*Math.sqrt(u));
   this.position.set([
    Math.cos(a)*radial,
    .94+(fire?h*.84:ice?(1-h)*.65:water?Math.sin(a*2)*.27:.26*Math.sin(a*3+h*3))+.28*progress,
    Math.sin(a)*radial
   ],i*3);
  }
  this.geometry.attributes.position.needsUpdate=true;
  this.material.opacity=.38+.54*progress;
 }
 dispose(){this.root.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
