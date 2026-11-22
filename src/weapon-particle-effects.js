import * as THREE from 'three';

// Additive, fine-grained GPU particles supplement the verified MIT 00GameDevs
// assets. Every object produced here is a Points cloud, never a solid summon.
export const PARTICLE_RECIPES=Object.freeze({
  'white-cat':'rainbow','black-cat':'rainbow','calico-cat':'rainbow-scatter',
  'accordion':'music','giraffe':'boomerang','goldfish':'jet',
  'clam':'shells','fan':'gust','telephone':'echo','jellybrella':'jelly',
  water:'tidal',ice:'glacier',fire:'inferno',lightning:'storm',beam:'prism',
  petal:'lotus-veil',wave:'singularity',saber:'fissure',whip:'thorn',
  swatter:'flies',pan:'food',planter:'thorn-tower',palm:'monsoon'
});
export const recipeFor=item=>PARTICLE_RECIPES[item?.id]||PARTICLE_RECIPES[item?.family]||'prism';
const MAX_PARTICLES_DESKTOP=5800,MAX_PARTICLES_TOUCH=2400;
function rand(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function recipePalette(recipe,item){
 const palettes={
 rainbow:['#ff414a','#ffb44e','#f9ff60','#58ff9f','#48deff','#7e71ff','#fb70f9'],
 'rainbow-scatter':['#ff394e','#ffc04b','#eaff70','#45f7a2','#55bbff','#a66cff','#ff7cd1'],
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
 'lotus-veil':['#ff9fd7','#ffd4ed','#f4bbff','#ffe1fa','#b8e9ff'],
 'thorn-tower':['#84ffab','#3be49b','#bdfc73','#e8fff1'],
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
 if(recipe==='rainbow-scatter')return 6;
 return 7;
}
const styleIds=['tidal','glacier','inferno','storm','prism','petals','singularity','thorn','worldtree','monsoon','gust','echo','jelly','ghost','boomerang','jet','shells','lotus-veil','thorn-tower'];
function styleFor(recipe){const index=styleIds.indexOf(recipe);return index<0?4:index;}
const vertex=`
attribute vec3 seed;
attribute vec3 pigment;
uniform float uAge,uDuration,uReach,uBakedReach,uMode,uRadius,uCharge,uStyle,uLooping;
varying vec3 vColor;
varying float vAlpha;
const float TAU=6.283185307;
void main(){
 // Damage pulses are not VFX restarts: let water/fire streams flow forever.
 float t=uLooping>.5?.52:clamp(uAge/uDuration,0.,1.);
 vec3 basePosition=vec3(position.xy,position.z*uReach/max(.001,uBakedReach));
 float u=seed.x,v=seed.y,w=seed.z;
 float phase=u*TAU,spin=uAge*(2.+v*3.);
 vec3 p=basePosition;
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
   p=vec3(position.x+sin(spin*6.+w*50.)*.48,position.y+sin(spin*4.+u*20.)*.32,basePosition.z+distance);
   p.x*=.8+.25*sin(uAge*7.);
   alpha*=.92;
 }else if(uMode<3.5){
   // Individual food items roll and tumble, rather than a solid food mesh.
   float angle=spin*1.8+floor(w*5.)*2.1;
   p=vec3(position.x*cos(angle)-position.y*sin(angle),
     position.x*sin(angle)+position.y*cos(angle)+2.4+abs(sin(uAge*7.+w*6.))*.7,
     basePosition.z+uReach*min(1.,t*1.5));
   alpha*=.85;
 }else if(uMode<4.5){
   // Large, distinct musical glyphs in one travelling tornado.
   // Triple the former 1.15 angular rotation rate.
   float glyph=floor(u*36.),initial=glyph*2.399;
   float angle=initial+spin*3.45;
   float height=clamp(position.y/10.5,0.,1.);
   float r=uRadius*(.23+.60*height);
   float localX=position.x-cos(initial)*(.55+mod(glyph,6.)*.30);
   float front=uReach*smoothstep(0.,.70,t);
   p=vec3(cos(angle)*r+localX,position.y+sin(spin+u*14.)*.16,
     front-2.1+sin(angle)*r+mod(glyph,4.)*.22);
   alpha*=.98;
 }else if(uMode<5.5){
   // Complex floor fissures plus exploding point-rocks and a towering sword arc.
   if(w<.58){
     float front=uReach*smoothstep(.09,.62,t);
     p=basePosition;p.y=.10+sin(uAge*18.+u*50.)*.025;
     alpha*=1.-smoothstep(front-.7,front+.12,p.z);
     alpha*=smoothstep(-.15,.5,front-p.z);
   }else if(w<.83){
     p=basePosition;
     p.y=max(.1,position.y+max(0.,t-.2)*7.5*(.55+u)-pow(max(0.,t-.23),2.)*7.5);
     p.x+=sin(spin*2.+v*11.)*t*2.7;
     alpha*=smoothstep(.22,.4,t);
   }else{
     // A 25-metre vertical crescent sweeps forward above the cracks.
     p=basePosition;
     p.z+=uReach*smoothstep(.2,.64,t)*.2;
     alpha*=smoothstep(.1,.3,t)*(1.-smoothstep(.6,.88,t));
   }
 }else if(uMode<6.5){
   // Exactly ten coloured bullets, arranged in the same 5x2 lanes as
   // authoritative calicoPellets(). Each is a dense, distinct glowing core.
   float charged=step(.9,uCharge);
   float pellet=floor(u*10.),col=mod(pellet,5.)-2.,row=floor(pellet/5.)*2.-1.;
   float front=uReach*min(1.,t*2.4);
   float spreadX=mix(.12,.16,charged),spreadY=mix(.055,.10,charged);
   float normalization=inversesqrt(1.+pow(col*spreadX,2.)+pow(row*spreadY,2.));
   float theta=v*TAU;
   float bulletRadius=(.055+w*.17)*mix(1.,1.9,charged);
   p=vec3((col*spreadX*front+cos(theta)*bulletRadius)*normalization,
     (row*spreadY*front+sin(theta)*bulletRadius)*normalization,
     front*normalization-w*mix(.24,.5,charged));
   alpha*=1.-smoothstep(.82,1.,t);
 }else{
   // Individual weapon families have different silhouette, path and movement,
   // all formed from small independent points rather than solid summoned meshes.
   float a=atan(position.y,position.x)+spin*1.8+basePosition.z*.27;
   float radius=length(position.xy),advance=uReach*smoothstep(.06,.78,t)*.35;
   if(uStyle<.5){ // volumetric three-tier tidal surge; sustained GPU waves
     float lane=floor(u*3.);
     float stream=fract(v+uAge*(1.64+w*.74)+lane*.29);
     float front=stream*uReach*min(1.,uAge*2.9);
     float sweep=sin(front*.72-uAge*9.6+lane*2.09);
     float chop=sin(front*1.57-uAge*14.3+v*TAU);
     float crest=pow(max(0.,.5+.32*sweep+.18*chop),2.)*(.45+stream*1.45);
     float spread=(.24+stream*(2.5+uCharge*1.8))*sqrt(w);
     float fold=cos(front*.43-uAge*5.8+lane)*(.25+crest*.36);
     p=vec3(cos(a+sin(spin)*.65)*spread+fold,
       sin(a+spin*.37)*spread*.66+crest+sin(front*.91-uAge*11.)*.31,
       front+basePosition.z*.14+sin(sweep)*crest*.13);
     alpha*=smoothstep(0.,.09,stream)*(1.-smoothstep(.78,1.,stream));
     color=mix(color,vec3(.91,.98,1.),smoothstep(.52,1.25,crest)*.67);

   }else if(uStyle<1.5){ // ice: tall swirls of icy shatter
     p=vec3(position.x*.8+sin(spin*.9)*.4,
       1.3+abs(position.y)*1.9+u*5.*t,
       basePosition.z+advance+sin(v*TAU)*1.2);
   }else if(uStyle<2.5){ // high-volume forward flamethrower
     float jet=fract(v+uAge*(1.9+w*1.2));
     float plume=(.28+jet*(2.5+uCharge*1.7))*sqrt(w);
     p=vec3(cos(a+sin(spin)*.65)*plume+sin(jet*16.+uAge*13.)*.28,
       sin(a+cos(spin)*.5)*plume*.75+sin(jet*19.+uAge*16.)*.32,
       jet*uReach*min(1.,uAge*3.6)+basePosition.z*.15);
     alpha*=smoothstep(0.,.09,jet)*(1.-smoothstep(.72,1.,jet));

   }else if(uStyle<3.5){ // lightning: branching irregular bolts
     float zig=floor(basePosition.z*3.+t*14.);
     p=vec3(position.x*.65+sin(zig*5.5+v*11.)*1.7,
       2.5+abs(position.y)*.75+sin(zig*4.1)*2.2,
       basePosition.z+advance);
   }else if(uStyle<4.5){ // prismatic helix beam
     p=vec3(cos(a)*radius*.35+cos(basePosition.z*.75+spin)*1.1,
       2.5+sin(a)*radius*.35+sin(basePosition.z*.75+spin)*1.1,
       basePosition.z+advance);
   }else if(uStyle<5.5){ // rose petals in a moving flowering spiral
     p=vec3(cos(a)*radius*1.9,2.1+sin(a)*radius*.52+abs(sin(spin))*1.2,
       basePosition.z+advance);
   }else if(uStyle<6.5){ // singularity: expanding rings and cosmic orbit trails
     float r=1.+radius*(1.+t*.6);
     p=vec3(cos(a)*r,3.3+sin(a)*r*.8,basePosition.z*.6+advance);
   }else if(uStyle<7.5){ // thorn: several snapping, coiling whips
     p=vec3(sin(basePosition.z*.76+spin)*2.8+position.x*.32,
       2.1+cos(basePosition.z*.65+spin)*1.4+abs(position.y)*.24,
       basePosition.z+advance);
   }else if(uStyle<8.5){ // world tree: giant rising branching particles
     float branch=floor(u*7.);
     p=vec3(position.x+sin(branch*2.7)*t*3.,.4+abs(position.y)*2.+t*5.,
       basePosition.z*.55+advance);
   }else if(uStyle<9.5){ // tropical leaf and monsoon cyclone
     p=vec3(cos(a)*radius*1.5,2.+abs(position.y)*.6+t*2.+sin(spin)*.8,
       basePosition.z*.8+advance);
   }else if(uStyle<10.5){ // wind: four strands of gusting filaments
     float strand=floor(u*4.);
     p=vec3(cos(a+strand*1.571)*radius*1.3,
       2.+sin(a+strand*1.571)*radius*.5,
       basePosition.z+advance*1.6);
   }else if(uStyle<11.5){ // telephone: broad expanding resonant wave rings
     float wavefront=fract(t*2.4+u*.7)*4.;
     p=vec3(cos(a)*radius*wavefront,
       2.8+sin(a)*radius*wavefront*.9,
       basePosition.z*.55+advance);
   }else if(uStyle<12.5){ // glowing floating jellyfish strands
     p=vec3(cos(a)*radius*.75,2.4+abs(sin(spin+u*7.))*2.+position.y*.24,
       basePosition.z*.65+advance);
   }else if(uStyle<13.5){ // haunted spectral procession
     p=vec3(position.x*.8+sin(spin+v*15.)*.4,
       2.2+abs(position.y)*.75+sin(uAge*4.+w*10.)*.8,
       basePosition.z*.8+advance);
   }else if(uStyle<14.5){ // giant returning V-shaped light-particle boomerang
     float travel=sin(t*3.141593)*uReach;
     float arm=u<.5?-1.:1.,along=v*7.5;
     vec2 blade=vec2(arm*along,2.2-along*.72);
     float rotation=uAge*5.7;
     vec2 spinning=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation))*blade;
     p=vec3(spinning.x+(w-.5)*.36,3.2+spinning.y+(w-.5)*.4,
       travel+along*.7+sin(v*TAU+spin)*.2);
   }else if(uStyle<15.5){ // goldfish: dense streaming water nozzle
     p=vec3(position.x*.48+sin(spin*2.)*.45,
       2.6+position.y*.32+sin(spin+basePosition.z)*.3,
       basePosition.z+advance*1.8);
   }else if(uStyle<16.5){ // giant clam shells
     float shell=floor(u*6.);
     p=vec3(cos(a+shell*1.047)*radius*1.5,
       2.4+sin(a+shell*1.047)*radius*.9,
       basePosition.z*.65+advance*1.4);
   }else if(uStyle<17.5){ // airy, slowly revolving nine-petal flower, no solid mesh
     float blade=floor(u*9.),angle=blade*(TAU/9.)+uAge*.67;
     float depth=sqrt(v),spread=(w-.5)*(1.25+1.45*sin(depth*3.141593));
     vec2 local=vec2(.35+depth*4.4,spread);
     p=vec3(cos(angle)*local.x-sin(angle)*local.y,
       sin(angle)*local.x+cos(angle)*local.y,
       uReach*.46*smoothstep(0.,.8,t)+sin(v*TAU+uAge)*.35);
     alpha*=.64*(1.-smoothstep(.85,1.,depth));
   }else{ // three rising braided thorn tiers
     float level=floor(u*3.),turn=fract(u*3.);
     float angle=turn*TAU*2.6+uAge*2.5+level*1.65;
     float r=1.8+.5*sin(turn*TAU)+w*.65;
     p=vec3(cos(angle)*r,1.1+level*3.1+turn*3.+t*2.2,
       sin(angle)*r+uReach*.1);
     alpha*=.86;
   }
   if(uStyle<16.5)p.y=max(.35,p.y);
   alpha*=.95;
 }
 // All point sprites stay fine; bright density comes from many particles.
 vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp((uMode>5.5&&uMode<6.5?3.8+w*3.7:uMode>3.5&&uMode<4.5?3.5+w*2.2:uStyle<.5||(uStyle>1.5&&uStyle<2.5)?3.7+w*3.1:1.1+w*1.65)*34./max(2.,-mv.z),1.25,12.5);
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
 // Typed-array direct writes avoid ~10k temporary arrays per skill activation.
 const set=(i,x,y,z,c,u,v,w)=>{const j=i*3,p=palette[c%palette.length];positions[j]=x;positions[j+1]=y;positions[j+2]=z;seed[j]=u;seed[j+1]=v;seed[j+2]=w;colors[j]=p.r;colors[j+1]=p.g;colors[j+2]=p.b;};
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
     const glyph=Math.floor(u*36),k=v,angle=glyph*2.399,radius=.55+(glyph%6)*.30;
     // Note heads are ellipses; stems are thin vertical strokes; the remainder
     // curves around as staffs. 100+ points per note, no geometry silhouettes.
     const head=k<.45;
     x=Math.cos(angle)*radius+(head?Math.cos(w*6.28)*.48:.45);
     y=1.1+glyph%10*.82+(head?Math.sin(w*6.28)*.27:(k-.45)*2.0);
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
     // Each pellet owns a full XYZ cloud, rather than a flat waterfall.
     x=0;y=0;z=0;ci=Math.floor(u*10)%palette.length;
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
 constructor(scene){this.scene=scene;this.active=[];this.charger=null;this.maxActive=14;this.pools=new Map();this.pooledCount=0;}
 async warm(renderer,camera){
  // Compile, GPU-upload and RETAIN every native particle silhouette and
  // normal/ultimate count variant before live play. Ranges and item IDs are
  // uniforms, not separate allocation keys, so the first spell reuses them.
  const stage=new THREE.Scene(),entries=[];
  const chargedCount=recipe=>['fissure','rainbow-scatter','boomerang','lotus-veil','thorn-tower'].includes(recipe)?5600:
    recipe==='music'?5200:['flies','food'].includes(recipe)?3900:3200;
  for(const recipe of new Set([...Object.values(PARTICLE_RECIPES),'prism','tidal','rainbow'])){
   for(const count of [1200,1600,2400,chargedCount(recipe)]){
    const entry=this.make(recipe,{id:'warm-'+recipe,family:recipe},{amount:count,range:16});
    stage.add(entry.root);entries.push(entry);
   }
  }
  try{
   await renderer.compileAsync(stage,camera);
   const target=new THREE.WebGLRenderTarget(32,32),prior=renderer.getRenderTarget();
   try{renderer.setRenderTarget(target);renderer.render(stage,camera);}
   finally{renderer.setRenderTarget(prior);target.dispose();}
  }finally{
   for(const e of entries){
    e.root.removeFromParent();e.root.visible=false;
    const pool=this.pools.get(e.poolKey)||[];
    pool.push(e);this.pools.set(e.poolKey,pool);this.pooledCount++;
   }
  }
 }
 make(recipe,item,{duration=2.1,range=20,amount=2300,charge=1}={}){
  const touch=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const count=Math.min(amount,touch?(recipe==='music'?3400:MAX_PARTICLES_TOUCH):MAX_PARTICLES_DESKTOP);
  const key=[recipe,count].join(':');
  const stored=this.pools.get(key);
  if(stored?.length){
   const e=stored.pop();this.pooledCount--;e.age=0;e.duration=duration;e.channeling=false;e.charging=false;e.homingTarget=null;
   e.root.visible=true;e.root.position.set(0,0,0);e.root.quaternion.identity();e.root.scale.setScalar(1);
   e.material.uniforms.uAge.value=0;e.material.uniforms.uDuration.value=duration;
   e.material.uniforms.uCharge.value=charge;e.material.uniforms.uReach.value=range;e.material.uniforms.uLooping.value=0;
   return e;
  }
  const palette=recipePalette(recipe,item),data=populate(recipe,count,range,palette);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('seed',new THREE.BufferAttribute(data.seed,3));
  geometry.setAttribute('pigment',new THREE.BufferAttribute(data.colors,3));
  const material=new THREE.ShaderMaterial({
    uniforms:{uAge:{value:0},uDuration:{value:duration},uReach:{value:range},uBakedReach:{value:range},uMode:{value:modeFor(recipe)},uRadius:{value:2},uCharge:{value:charge},uStyle:{value:styleFor(recipe)},uLooping:{value:0}},
    vertexShader:vertex,fragmentShader:fragment,
    transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending
  });
  const root=new THREE.Points(geometry,material);
  root.name='Fine particle '+recipe+' skill';root.frustumCulled=false;root.renderOrder=24;
  return {root,age:0,duration,recipe,material,geometry,poolKey:key};
 }
 add(entry){
  if(this.active.length>=this.maxActive)this.remove(this.active[0]);
  this.active.push(entry);this.scene.add(entry.root);return entry;
 }
 play(data,item,source,end){
  if(!data||!item)return;
  const charged=!!data.ultimate,recipe=recipeFor(item);
  // The official Energy Sword Wave fully replaces the former purple GPU
  // fissure overlay on charged saber attacks; normal slashes remain intact.
  if(charged&&item.family==='saber')return;
  // Ordinary shots for all three cats are always rainbow and shotgun charged
  // produces a nearby, very wide waterfall instead of a distant beam.
  const elementalJet=['fire','water','wave'].includes(item.family)||item.id==='goldfish';
  if(!charged&&!elementalJet&&!['white-cat','black-cat','calico-cat'].includes(item.id))return;
  const chosen=item.id==='calico-cat'?'rainbow-scatter':item.id?.includes('cat')?'rainbow':item.id==='goldfish'?'tidal':item.id==='clam'&&charged?'tidal':recipe;
  const range=chosen==='rainbow-scatter'?Math.max(2,Number(data.range)||10):Math.max(1,Math.min(charged?100:160,Number(data.range)||source.distanceTo(end)));
  const amount=charged?['fissure','rainbow-scatter','boomerang','lotus-veil','thorn-tower'].includes(chosen)?5600:chosen==='music'?5200:chosen==='flies'||chosen==='food'?3900:3200:elementalJet?2400:chosen==='rainbow-scatter'?3200:1200;
  const duration=charged?chosen==='music'?3.3:chosen==='fissure'?3:chosen==='rainbow-scatter'?1.65:2.45:elementalJet?1.05:.65;
  const entry=this.make(chosen,item,{range,duration,amount,charge:charged?1:.75});
  if(chosen==='music')entry.material.uniforms.uRadius.value=Math.max(.5,Number(data.radius)||5.5);
  entry.root.position.copy(source);
  if(data.channel){entry.channeling=true;entry.material.uniforms.uLooping.value=1;}
  // Server-approved firing direction; charged-area centres are not an aiming
  // substitute for ongoing straight sprays.
  const direction=(data.channel&&Array.isArray(data.direction))?new THREE.Vector3(...data.direction).normalize():end.clone().sub(source);
  if(chosen==='fissure'){
    entry.root.position.y=Math.max(.12,source.y-1);
    direction.y=0;direction.normalize();
    entry.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(direction.x,direction.z));
  }else if(chosen==='rainbow-scatter'){
    // Forward and elevation are EXACTLY server-owned; the visible bullets
    // cannot point at a monster the authoritative rays did not approach.
    entry.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...data.direction).normalize());
  }else if(chosen==='thorn-tower'){
    entry.root.position.copy(end);entry.root.position.y=Math.max(.15,end.y);
    entry.root.quaternion.identity();
  }else{
    entry.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
    if(chosen!=='rainbow')entry.root.position.y=Math.max(.7,entry.root.position.y);
    if(elementalJet){
     if((data.channel||charged)&&['tidal','inferno','singularity'].includes(chosen)){
      // Local authored tidal jet reaches ~4.9m to either side at full
      // charge. Scale only its lateral axes to the server's actual tube
      // radius, preserving 100% of the real forward travel distance.
      const halfWidth=Math.max(.35,Number(data.radius)||1.6);
      const lateral=halfWidth/4.9;
      entry.root.scale.set(lateral,lateral,1);
     }else entry.root.scale.setScalar(data.channel?1:charged?1.7:1.35);
    }
  }
  if(charged&&!elementalJet&&!['rainbow-scatter','rainbow','fissure','music'].includes(chosen)){
    const targetRadius=Math.max(.35,Number(data.area?.radius)||Number(data.radius)||.35);
    const localRadius=chosen==='food'||chosen==='flies'?1.5:4.9;
    const lateral=Math.max(1,Math.min(10,targetRadius/localRadius));
    entry.root.scale.set(lateral,lateral,1); // keep the exact Z flight range
   }
   if(chosen==='flies'&&Array.isArray(data.impactPoint)&&data.impactPoint.length===3){
    // Only for the first metre or so of its apparent pursuit: steer the cloud
    // toward the moving monster that the server actually reported as hit.
    const impact=new THREE.Vector3(...data.impactPoint);
    const monsters=this.scene.children.filter(o=>o.visible&&/^(Sixfold outer monster|Giant Nangan enemy)/.test(o.name));
    const target=monsters.sort((x,y)=>x.position.distanceToSquared(impact)-y.position.distanceToSquared(impact))[0];
    if(target&&target.position.distanceTo(impact)<12)entry.homingTarget=target;
  }
  this.add(entry);
  return entry;
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
   try{
    if(entry.charging)continue;
    entry.age+=dt;entry.material.uniforms.uAge.value=entry.age;
    if(entry.homingTarget&&entry.age<.9&&entry.homingTarget.visible){
      const towards=entry.homingTarget.position.clone().add(new THREE.Vector3(0,3.5,0)).sub(entry.root.position);
      if(towards.lengthSq()>.001){
        const aiming=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),towards.normalize());
        entry.root.quaternion.slerp(aiming,Math.min(1,dt*5));
      }
    }
    if(!entry.channeling&&entry.age>=entry.duration)this.remove(entry);
   }catch(error){
    const index=this.active.indexOf(entry);if(index>=0)this.active.splice(index,1);
    if(this.charger===entry)this.charger=null;
    try{entry.root.removeFromParent();entry.geometry.dispose();entry.material.dispose();}catch{}
    this.failedParticleEffects??=new Set();
    if(!this.failedParticleEffects.has(entry.recipe)){
     this.failedParticleEffects.add(entry.recipe);
     console.error('Invalid particle emitter released; render continues',entry.recipe,error);
    }
   }
  }
 }
 remove(entry){
  const i=this.active.indexOf(entry);if(i>=0)this.active.splice(i,1);
  entry.root.removeFromParent();entry.root.visible=false;if(this.charger===entry)this.charger=null;
  let list=this.pools.get(entry.poolKey);if(!list){list=[];this.pools.set(entry.poolKey,list);}
  if(list.length<3&&this.pooledCount<96){list.push(entry);this.pooledCount++;}
  else{entry.geometry.dispose();entry.material.dispose();}
 }
 dispose(){
  for(const entry of [...this.active])this.remove(entry);
  for(const list of this.pools.values())for(const entry of list){entry.geometry.dispose();entry.material.dispose();}
  this.pools.clear();this.pooledCount=0;
 }
}
