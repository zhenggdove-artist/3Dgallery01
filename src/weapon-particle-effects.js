import * as THREE from 'three';

// Additive, fine-grained GPU particles supplement the verified MIT 00GameDevs
// assets. Every object produced here is a Points cloud, never a solid summon.
export const PARTICLE_RECIPES=Object.freeze({
  'white-cat':'rainbow','black-cat':'rainbow','calico-cat':'rainbow-falls',
  'accordion':'music','giraffe':'boomerang','goldfish':'jet',
  'clam':'shells','fan':'gust','telephone':'echo','jellybrella':'jelly',
  'chiang-token':'ghost',
  water:'tidal',ice:'glacier',fire:'inferno',lightning:'storm',beam:'prism',
  petal:'petals',wave:'singularity',saber:'fissure',whip:'thorn',
  swatter:'flies',pan:'food',planter:'worldtree',palm:'monsoon'
});
export const recipeFor=item=>PARTICLE_RECIPES[item?.id]||PARTICLE_RECIPES[item?.family]||'prism';
const MAX_PARTICLES_DESKTOP=4600,MAX_PARTICLES_TOUCH=1900;
function rand(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function recipePalette(recipe,item){
 const palettes={
 rainbow:['#ff414a','#ffb44e','#f9ff60','#58ff9f','#48deff','#7e71ff','#fb70f9'],
 'rainbow-falls':['#ff394e','#ffc04b','#eaff70','#45f7a2','#55bbff','#a66cff','#ff7cd1'],
 flies:['#05070a','#0c0f17','#202333','#55566a','#9a9ab0'],
 food:['#ffd37a','#ff764c','#fff5db','#f8bc87','#d3e678','#e7a3f0'],
 music:['#ffa6dc','#ffc861','#adf9ff','#e6afff','#86ffd5'],
 fissure:['#070e19','#142642','#80c9ff','#d6f5ff','#6a81de'],
 tidal:['#41d5f4','#8ff1ff','#2065dc','#d3fbff'],
 glacier:['#d8feff','#8bc6ff','#a4a9f8','#ffffff'],
 inferno:['#ffd062','#ff573c','#ffb06e','#fff3be'],
 storm:['#d3d0ff','#7e91ff','#eaffff','#eeb9ff'],
 prism:['#f7f8ff','#fce0a1','#61cfff','#bda5fd'],
 petals:['#ff83cb','#fff6e7','#ffc3e4','#dc80fa'],
 singularity:['#6184ff','#d0a5ff','#73faff','#312663'],
 thorn:['#81f1bd','#2f9e85','#eaffae','#c9a2e1'],
 worldtree:['#8dffba','#dcff99','#68deb6','#fcf8b4'],
 monsoon:['#64edbb','#6bb9fb','#f1fdad','#e2fff8'],
 gust:['#9afde3','#f5fff6','#61dcb4','#b7e5ff'],
 echo:['#ffe1fa','#d686ff','#a3dcff','#fffafa'],
 jelly:['#a3eaff','#c2acff','#eaffff','#f6a3ff'],
 ghost:['#cfdafa','#ffdd87','#afa5ff','#f1f6ff'],
 boomerang:['#ffe4ab','#db954b','#f0f6ad','#ecb27b'],
 jet:['#94eaff','#f7c85f','#eaf9ff','#45a9f9'],
 shells:['#ffd6ed','#f3bfe1','#a7d7ff','#f7f1d7']
 };
 return (palettes[recipe]||[item?.color||'#b1e9ff','#ffffff','#a9d1ff']).map(v=>new THREE.Color(v));
}
function modeFor(recipe){
 if(recipe==='rainbow')return 1;
 if(recipe==='flies')return 2;
 if(recipe==='food')return 3;
 if(recipe==='music')return 4;
 if(recipe==='fissure')return 5;
 if(recipe==='rainbow-falls')return 6;
 return 7;
}
const styleIds=['tidal','glacier','inferno','storm','prism','petals','singularity','thorn','worldtree','monsoon','gust','echo','jelly','ghost','boomerang','jet','shells'];
function styleFor(recipe){const index=styleIds.indexOf(recipe);return index<0?4:index;}
const vertex=`
attribute vec3 seed;
attribute vec3 pigment;
uniform float uAge,uDuration,uReach,uMode,uRadius,uCharge,uStyle;
varying vec3 vColor;
varying float vAlpha;
const float TAU=6.283185307;
void main(){
 float t=clamp(uAge/uDuration,0.,1.);
 float u=seed.x,v=seed.y,w=seed.z;
 float phase=u*TAU,spin=uAge*(2.+v*3.);
 vec3 p=position;
 vec3 color=pigment;
 float alpha=smoothstep(0.,.07,t)*(1.-smoothstep(.72,1.,t));
 if(uMode<1.5){
   // Seven colour bands and a dense luminous bullet trail, visible on normal shots.
   float lane=floor(v*7.);
   p=vec3(cos(phase+spin*3.)*(.08+w*.24),sin(phase+spin*3.)*(.08+w*.24),uReach*min(1.,t*2.15)-u*2.1);
   alpha*=smoothstep(-1.5,.15,p.z)*.97;
 }else if(uMode<2.5){
   // Pursuing black fly cloud, smaller than the player but visibly volumetric.
   float distance=uReach*min(1.,t*1.45);
   p=vec3(position.x+sin(spin*6.+w*50.)*.48,position.y+sin(spin*4.+u*20.)*.32,position.z+distance);
   p.x*=.8+.25*sin(uAge*7.);
   alpha*=.92;
 }else if(uMode<3.5){
   // Individual food items roll and tumble, rather than a solid food mesh.
   float angle=spin*1.8+floor(w*5.)*2.1;
   p=vec3(position.x*cos(angle)-position.y*sin(angle),
     position.x*sin(angle)+position.y*cos(angle)+2.4+abs(sin(uAge*7.+w*6.))*.7,
     position.z+uReach*min(1.,t*1.5));
   alpha*=.85;
 }else if(uMode<4.5){
   // Spiral column with readable coloured note silhouettes.
   float angle=atan(position.z,position.x)+spin*1.15+position.y*.5;
   float r=length(position.xz)+.18*t;
   p=vec3(cos(angle)*r,position.y+sin(spin+u*14.)*.25,
     sin(angle)*r+uReach*min(.9,t*1.12));
   alpha*=.92;
 }else if(uMode<5.5){
   // Complex floor fissures plus exploding point-rocks and a towering sword arc.
   if(w<.58){
     float front=uReach*smoothstep(.09,.62,t);
     p=position;p.y=.10+sin(uAge*18.+u*50.)*.025;
     alpha*=1.-smoothstep(front-.7,front+.12,p.z);
     alpha*=smoothstep(-.15,.5,front-p.z);
   }else if(w<.83){
     p=position;
     p.y=max(.1,position.y+max(0.,t-.2)*7.5*(.55+u)-pow(max(0.,t-.23),2.)*7.5);
     p.x+=sin(spin*2.+v*11.)*t*2.7;
     alpha*=smoothstep(.22,.4,t);
   }else{
     // A 25-metre vertical crescent sweeps forward above the cracks.
     p=position;
     p.z+=uReach*smoothstep(.2,.64,t)*.2;
     alpha*=smoothstep(.1,.3,t)*(1.-smoothstep(.6,.88,t));
   }
 }else if(uMode<6.5){
   // Calico cat: wide but short forward rainbow particle waterfall.
   float front=uReach*min(1.,t*1.3);
   p=position;
   p.z=position.z+front*.35;
   p.y=max(.35,position.y-uAge*(7.+v*6.)+sin(phase)*.36);
   p.x+=sin(spin*2.)*.5;
   alpha*=.92;
 }else{
   // Individual weapon families have different silhouette, path and movement,
   // all formed from small independent points rather than solid summoned meshes.
   float a=atan(position.y,position.x)+spin*1.8+position.z*.27;
   float radius=length(position.xy),advance=uReach*smoothstep(.06,.78,t)*.35;
   if(uStyle<.5){ // water: a travelling translucent tidal crest
     p=vec3(position.x*1.8+sin(spin+v*12.)*.9,
       1.1+abs(sin(position.x*.37+spin*1.6))*4.+v*3.,
       position.z+advance); 
   }else if(uStyle<1.5){ // ice: tall swirls of icy shatter
     p=vec3(position.x*.8+sin(spin*.9)*.4,
       1.3+abs(position.y)*1.9+u*5.*t,
       position.z+advance+sin(v*TAU)*1.2);
   }else if(uStyle<2.5){ // fire: ascending braided flame plumes
     p=vec3(cos(a)*radius*.95,1.4+abs(position.y)*1.5+t*7.,
       position.z+advance+sin(uAge*9.+u*23.)*.4);
   }else if(uStyle<3.5){ // lightning: branching irregular bolts
     float zig=floor(position.z*3.+t*14.);
     p=vec3(position.x*.65+sin(zig*5.5+v*11.)*1.7,
       2.5+abs(position.y)*.75+sin(zig*4.1)*2.2,
       position.z+advance);
   }else if(uStyle<4.5){ // prismatic helix beam
     p=vec3(cos(a)*radius*.35+cos(position.z*.75+spin)*1.1,
       2.5+sin(a)*radius*.35+sin(position.z*.75+spin)*1.1,
       position.z+advance);
   }else if(uStyle<5.5){ // rose petals in a moving flowering spiral
     p=vec3(cos(a)*radius*1.9,2.1+sin(a)*radius*.52+abs(sin(spin))*1.2,
       position.z+advance);
   }else if(uStyle<6.5){ // singularity: expanding rings and cosmic orbit trails
     float r=1.+radius*(1.+t*.6);
     p=vec3(cos(a)*r,3.3+sin(a)*r*.8,position.z*.6+advance);
   }else if(uStyle<7.5){ // thorn: several snapping, coiling whips
     p=vec3(sin(position.z*.76+spin)*2.8+position.x*.32,
       2.1+cos(position.z*.65+spin)*1.4+abs(position.y)*.24,
       position.z+advance);
   }else if(uStyle<8.5){ // world tree: giant rising branching particles
     float branch=floor(u*7.);
     p=vec3(position.x+sin(branch*2.7)*t*3.,.4+abs(position.y)*2.+t*5.,
       position.z*.55+advance);
   }else if(uStyle<9.5){ // tropical leaf and monsoon cyclone
     p=vec3(cos(a)*radius*1.5,2.+abs(position.y)*.6+t*2.+sin(spin)*.8,
       position.z*.8+advance);
   }else if(uStyle<10.5){ // wind: four strands of gusting filaments
     float strand=floor(u*4.);
     p=vec3(cos(a+strand*1.571)*radius*1.3,
       2.+sin(a+strand*1.571)*radius*.5,
       position.z+advance*1.6);
   }else if(uStyle<11.5){ // telephone: broad expanding resonant wave rings
     float wavefront=fract(t*2.4+u*.7)*4.;
     p=vec3(cos(a)*radius*wavefront,
       2.8+sin(a)*radius*wavefront*.9,
       position.z*.55+advance);
   }else if(uStyle<12.5){ // glowing floating jellyfish strands
     p=vec3(cos(a)*radius*.75,2.4+abs(sin(spin+u*7.))*2.+position.y*.24,
       position.z*.65+advance);
   }else if(uStyle<13.5){ // haunted spectral procession
     p=vec3(position.x*.8+sin(spin+v*15.)*.4,
       2.2+abs(position.y)*.75+sin(uAge*4.+w*10.)*.8,
       position.z*.8+advance);
   }else if(uStyle<14.5){ // giraffe-shaped boomerang in a wide return arc
     float travel=sin(t*3.141593)*uReach;
     p=vec3(sin(t*6.283+position.z*.25)*4.+position.x*.4,
       3.+position.y*.45+abs(sin(spin))*2.,travel+position.z*.22);
   }else if(uStyle<15.5){ // goldfish: dense streaming water nozzle
     p=vec3(position.x*.48+sin(spin*2.)*.45,
       2.6+position.y*.32+sin(spin+position.z)*.3,
       position.z+advance*1.8);
   }else{ // rotating giant clam shells, released in rippling groups
     float shell=floor(u*6.);
     p=vec3(cos(a+shell*1.047)*radius*1.5,
       2.4+sin(a+shell*1.047)*radius*.9,
       position.z*.65+advance*1.4);
   }
   p.y=max(.35,p.y);
   alpha*=.95;
 }
 // All point sprites stay fine; bright density comes from many particles.
 vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp((1.1+w*1.65)*30./max(2.,-mv.z),1.25,4.6);
 vColor=color*(.85+.23*sin(uAge*16.+v*31.));
 vAlpha=alpha*(.65+.3*uCharge);
}
`;
const fragment=`
varying vec3 vColor;
varying float vAlpha;
void main(){
 vec2 uv=gl_PointCoord*2.-1.;
 float r=dot(uv,uv);
 if(r>1.)discard;
 float alpha=exp(-r*3.2)*(1.-smoothstep(.62,1.,r))*vAlpha;
 if(alpha<.012)discard;
 gl_FragColor=vec4(vColor,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
function populate(recipe,amount,range,palette){
 const random=rand(0x421eab+recipe.length*1931),mode=modeFor(recipe);
 const positions=new Float32Array(amount*3),seed=new Float32Array(amount*3),colors=new Float32Array(amount*3);
 const set=(i,x,y,z,c,u,v,w)=>{positions.set([x,y,z],i*3);seed.set([u,v,w],i*3);colors.set(palette[c%palette.length].toArray(),i*3);};
 for(let i=0;i<amount;i++){
   const u=random(),v=random(),w=random(),a=v*Math.PI*2;
   let x=0,y=0,z=0,ci=Math.floor(u*palette.length);
   if(mode===1){
     const ring=Math.floor(u*7);
     x=Math.cos(a)*(.04+w*.12);y=Math.sin(a)*(.04+w*.12);z=-u*3;
     ci=ring;
   }else if(mode===2){
     const r=Math.cbrt(w)*(.75+v*.45);
     x=Math.cos(a)*r;y=1.5+Math.sin(a*2.)*r;z=(u-.5)*2;
     ci=Math.floor(w*palette.length);
   }else if(mode===3){
     // Distinguishable egg / dumpling / shrimp / vegetables from specks.
     const shape=Math.floor(u*5),q=random(),angle=q*Math.PI*2;
     if(shape===0){const rad=Math.sqrt(v)*.85;x=Math.cos(angle)*rad;y=Math.sin(angle)*rad*.58;ci=w>.25?2:0;}
     if(shape===1){x=(v-.5)*1.4;y=Math.sin(v*Math.PI)*.65*(w-.5);ci=2;}
     if(shape===2){const curl=v*Math.PI*1.7;x=Math.cos(curl)*(.5+w*.15);y=Math.sin(curl)*(.5+w*.15);ci=1;}
     if(shape===3){x=(v-.5)*1.2;y=(w-.5)*.6;ci=4;}
     if(shape===4){x=Math.cos(angle)*.55*Math.sqrt(v);y=Math.sin(angle)*.32;ci=3;}
     z=(shape-2)*.55;
   }else if(mode===4){
     const glyph=Math.floor(u*26),k=v,angle=(glyph*2.399+w*.4),radius=.4+(glyph%4)*.7;
     // Note heads are ellipses; stems are thin vertical strokes; the remainder
     // curves around as staffs. 100+ points per note, no geometry silhouettes.
     const head=k<.45;
     x=Math.cos(angle)*radius+(head?Math.cos(w*6.28)*.23:.22);
     y=1+glyph%8*.78+(head?Math.sin(w*6.28)*.13:(k-.45)*1.7);
     z=Math.sin(angle)*radius;
     ci=glyph;
   }else if(mode===5){
     if(w<.58){
       const branch=Math.floor(u*13),along=v*range,side=(branch%2?1:-1);
       z=along;x=branch===0?Math.sin(along*1.3)*.22:side*(.22+v*(1.5+branch*.27)+Math.sin(along*2.1+branch)*.15);
       y=.1;
       ci=w<.18?2:w<.32?3:0;
     }else if(w<.83){
       x=(v-.5)*7;z=u*range;y=.1;ci=Math.floor(v*palette.length);
     }else{
       const t=u*Math.PI*.85;
       z=2+Math.sin(t)*range*.85;x=(v-.5)*8*(1-u);
       y=Math.cos(t)*24+7;ci=w>.94?3:2;
     }
   }else if(mode===6){
     const lane=Math.floor(u*7);
     z=2+v*range*.65;x=(w-.5)*(1+v*range*.75)*1.6;y=1.5+random()*7;
     ci=lane;
   }else{
     const swirl=recipe==='storm'?5:recipe==='inferno'?3:recipe==='glacier'?8:recipe==='tidal'?3:6;
     const segment=Math.floor(u*swirl);
     const radius=(.6+Math.sqrt(w)*4)*(recipe==='singularity'?1.5:1);
     x=Math.cos(a+segment*2.399)*radius;y=Math.sin(a+segment*2.399)*radius;
     z=v*range*.9;ci=segment+Math.floor(random()*2);
     if(recipe==='worldtree'){y=Math.max(0,y)+v*10; x*=.8;}
     if(recipe==='petals'){x*=1.6;y*=.55;}
     if(recipe==='gust'||recipe==='monsoon'){x*=1.6;y*=1.1;}
     if(recipe==='ghost'){y=Math.abs(y)+v*5;}
   }
   set(i,x,y,z,ci,u,v,w);
 }
 return {positions,seed,colors};
}
export class WeaponParticleEffects{
 constructor(scene){this.scene=scene;this.active=[];this.charger=null;this.maxActive=14;}
 make(recipe,item,{duration=2.1,range=20,amount=2300,charge=1}={}){
  const touch=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const count=Math.min(amount,touch?MAX_PARTICLES_TOUCH:MAX_PARTICLES_DESKTOP);
  const palette=recipePalette(recipe,item),data=populate(recipe,count,range,palette);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('seed',new THREE.BufferAttribute(data.seed,3));
  geometry.setAttribute('pigment',new THREE.BufferAttribute(data.colors,3));
  const material=new THREE.ShaderMaterial({
    uniforms:{uAge:{value:0},uDuration:{value:duration},uReach:{value:range},uMode:{value:modeFor(recipe)},uRadius:{value:2},uCharge:{value:charge},uStyle:{value:styleFor(recipe)}},
    vertexShader:vertex,fragmentShader:fragment,
    transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending
  });
  const root=new THREE.Points(geometry,material);
  root.name='Fine particle '+recipe+' skill';root.frustumCulled=false;root.renderOrder=24;
  return {root,age:0,duration,recipe,material,geometry};
 }
 add(entry){
  if(this.active.length>=this.maxActive)this.remove(this.active[0]);
  this.active.push(entry);this.scene.add(entry.root);return entry;
 }
 play(data,item,source,end){
  if(!data||!item)return;
  const charged=!!data.ultimate,recipe=recipeFor(item);
  // Ordinary shots for all three cats are always rainbow and shotgun charged
  // produces a nearby, very wide waterfall instead of a distant beam.
  if(!charged&&!['white-cat','black-cat','calico-cat'].includes(item.id))return;
  const chosen=item.id==='calico-cat'&&charged?'rainbow-falls':item.id?.includes('cat')?'rainbow':recipe;
  const range=Math.max(3,Math.min(charged?48:160,source.distanceTo(end)));
  const amount=charged?chosen==='fissure'?4500:chosen==='rainbow-falls'?4500:chosen==='music'||chosen==='flies'||chosen==='food'?3900:3200:1200;
  const duration=charged?chosen==='fissure'?3:chosen==='rainbow-falls'?1.65:2.45:.65;
  const entry=this.make(chosen,item,{range,duration,amount,charge:charged?1:.75});
  entry.root.position.copy(source);
  const direction=end.clone().sub(source);
  if(chosen==='fissure'){
    entry.root.position.y=Math.max(.12,source.y-1);
    direction.y=0;direction.normalize();
    entry.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(direction.x,direction.z));
  }else if(chosen==='rainbow-falls'){
    entry.root.position.y=Math.max(.25,source.y);
    direction.y=0;direction.normalize();
    entry.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(direction.x,direction.z));
    // A shower ahead of the player, not one hidden below the floor.
  }else{
    entry.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
    if(chosen!=='rainbow')entry.root.position.y=Math.max(.7,entry.root.position.y);
  }
  this.add(entry);
 }
 charging(root,progress,item){
  if(!root||!item||progress<=.02){if(this.charger){this.remove(this.charger);this.charger=null;}return;}
  const recipe=recipeFor(item);
  if(this.charger&&this.charger.recipe!==recipe){this.remove(this.charger);this.charger=null;}
  if(!this.charger){
    const fx=this.make(recipe==='fissure'?'prism':recipe,item,{range:8,duration:2.6,amount:1600,charge:1});
    fx.charging=true;this.charger=this.add(fx);
  }
  this.charger.root.position.copy(root.position).add(new THREE.Vector3(0,1.2,0));
  this.charger.root.scale.setScalar(.4+progress*.9);
  this.charger.material.uniforms.uCharge.value=progress;
  this.charger.material.uniforms.uAge.value=.22+progress*.78;
 }
 update(dt){
  for(const entry of [...this.active]){
    if(entry.charging)continue;
    entry.age+=dt;entry.material.uniforms.uAge.value=entry.age;
    if(entry.age>=entry.duration)this.remove(entry);
  }
 }
 remove(entry){const i=this.active.indexOf(entry);if(i>=0)this.active.splice(i,1);entry.root.removeFromParent();entry.geometry.dispose();entry.material.dispose();if(this.charger===entry)this.charger=null;}
 dispose(){for(const entry of [...this.active])this.remove(entry);}
}
