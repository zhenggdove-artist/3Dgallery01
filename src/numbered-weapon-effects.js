import * as THREE from 'three';
import createArcRay from '../vendor/00gamedevs/arc-ray.js';
import createTidalSurge from '../vendor/00gamedevs/tidal-surge.js';

// User-requested reference numbers. Exact licensed source code is available
// locally for #08 and #33. The other ten are explicitly local
// reconstructions, NOT copies of unavailable numbered originals.
export const REQUESTED_VFX=Object.freeze({
 'clam:channel':{number:33,asset:'tidal-surge',original:true},
 'saber:ultimate':{number:38,asset:'magma-fissure',original:false},
 'petal:channel':{number:43,asset:'revival-bloom',original:false},
 'swatter:ultimate':{number:53,asset:'darkchain-detonation',original:false},
 'fire:channel':{number:73,asset:null,original:false},
 'pan:ultimate':{number:68,asset:null,original:false},
 'ice:channel':{number:70,asset:null,original:false},
 'lightning:channel':{number:8,asset:'arc-ray',original:true},
 'wave:channel':{number:20,asset:'energy-vortex',original:false},
 'saber:combo':{number:47,asset:'dimensional-rend',original:false},
 'jellybrella:ultimate':{number:26,asset:'frost-wheel',original:false},
 'whip:ultimate':{number:48,asset:'black-hole',original:false}
});
export function requestedEffect(item,event){
 if(!item||!event)return null;
 // Exotic weapons share ordinary families but have their own signature VFX:
 // never replace the giant goldfish, returning giraffe, or four fan tornadoes.
 if(item.exotic&&item.id!=='clam'&&item.id!=='jellybrella')return null;
 const key=event.channel?(item.id==='clam'?'clam':item.family)+':channel':
  event.ultimate?(item.id==='jellybrella'?'jellybrella':item.family)+':ultimate':
  item.family==='saber'&&(item.tier>=4||event.qualityTier>=4)&&event.combo===5?'saber:combo':'';
 return REQUESTED_VFX[key]||null;
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const colors={
 8:['#3b80ff','#e1e9ff','#b956ff'],20:['#3de8ff','#d5fff6','#226da9'],
 26:['#b7e9ff','#faedff','#5287ee'],33:['#29aaff','#adfffc','#d8f8ff'],
 38:['#ffac19','#ff482c','#783ae5'],43:['#ff87d1','#d7ffe7','#b26bff'],
 47:['#a58cff','#ffffff','#e14aee'],48:['#15112a','#833cff','#9ad4ff'],
 53:['#6133bd','#ef4057','#181025'],68:['#e8faff','#85b5ff','#d1bbf5'],
 70:['#66dcff','#ffffff','#4187ff'],73:['#ff3d13','#ffd333','#ff8a42']
};
function shape(material,geometry,x=0,y=0,z=0){
 const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);return m;
}
export class NumberedWeaponEffects{
 constructor(scene,muzzle=()=>null){this.scene=scene;this.muzzle=muzzle;this.active=[];}
 play(event,item,root){
  const spec=requestedEffect(item,event);
  if(!spec)return false;
  const key=event.channel?root?.uuid+':'+spec.number:null;
  const existing=key&&this.active.find(e=>e.key===key);
  if(existing){
   existing.age=0;existing.lastPulse=performance.now();
   existing.direction.fromArray(event.direction||[0,0,1]).normalize();
   existing.range=Number(event.range)||existing.range;
   existing.fx?.reset?.();
   return true;
  }
  const source=new THREE.Vector3(...(event.origin||[0,1,0])),direction=new THREE.Vector3(...(event.direction||[0,0,1])).normalize();
  if(event.channel&&root){const p=this.muzzle(root,item,source);if(p)source.copy(p);}
  const group=new THREE.Group();
  group.name='User numbered VFX #'+String(spec.number).padStart(2,'0')+(spec.original?' · licensed original':' · custom fallback');
  const shades=colors[spec.number],glow=i=>new THREE.MeshBasicMaterial({color:shades[i%3],transparent:true,opacity:.84,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthTest:true,toneMapped:false});
  const physical=i=>new THREE.MeshStandardMaterial({color:shades[i%3],emissive:shades[i%3],emissiveIntensity:.85,metalness:.18,roughness:.3,transparent:true,opacity:.93,side:THREE.DoubleSide});
  const add=(geo,index,x=0,y=0,z=0,solid=false)=>{
   const child=shape(solid?physical(index):glow(index),geo,x,y,z);group.add(child);return child;
  };
  const rank=clamp(Number(event.qualityScale)||1,.7,2.3),n=spec.number;
  if([20,26,43,48].includes(n)){
   // Volumetric ring vortex / frost wheel / blossom / black hole.
   for(let i=0;i<5;i++){const r=(.7+i*.43)*rank;
    const ring=add(new THREE.TorusGeometry(r,.055+i*.012,8,64),i);
    ring.rotation.set(.2+i*.17,i*.44,i*.23);
   }
   if(n===48){add(new THREE.SphereGeometry(1.45*rank,24,20),0,0,0,0,true).material.color.set('#050212');}
   if(n===26){
    // Giant jellyfish with a crystal ring; tentacles extend from the dome.
    const head=add(new THREE.SphereGeometry(1.8*rank,28,16),0,0,.7,0,true);head.scale.y=.62;
    for(let i=0;i<15;i++){const a=i*Math.PI*2/15;
     const ribbon=add(new THREE.CylinderGeometry(.025,.075,4.5*rank,5),i%3,Math.cos(a)*1.18*rank,-1.8*rank,Math.sin(a)*1.18*rank);
     ribbon.rotation.z=Math.sin(i)*.09;
    }
   }
   if(n===43)for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12,petal=add(new THREE.SphereGeometry(.7*rank,12,8),i%3,Math.cos(a)*1.5*rank,.2,Math.sin(a)*1.5*rank,true);
    petal.scale.set(.38,1.25,.48);petal.rotation.z=a+Math.PI/2;
   }
  }else if([38,47,53,68,70].includes(n)){
   // Floor fracture, dimensional rifts, darkchain burst, frost silence,
   // and an angular crescent of luminous ice.
   const width=n===38?.07:.09;
   for(let i=0;i<(n===38?8:11);i++){
    const a=i*.7+Math.sin(i*2.4),length=(1+i*.35)*rank;
    const rod=add(new THREE.CylinderGeometry(width,width,length,7),i%3,
     Math.sin(a)*(1+i*.2)*rank,.22+Math.cos(i*.5)*.14,
     (n===38?(i+.3)*1.15:Math.cos(a)*2)*rank);
    rod.rotation.x=Math.PI/2;rod.rotation.z=a;
   }
   for(let i=0;i<4;i++){const ring=add(new THREE.TorusGeometry((1.1+i*.7)*rank,.045+i*.016,8,50),i);
    ring.rotation.x=Math.PI/2;
    ring.position.y=.08+i*.24;
   }
  }else if(n===73){
   // Multi-layered orange/red/white fire plume; never one monochrome disc.
   for(let i=0;i<13;i++){const a=i*2.399,t=i/13;
    const plume=add(new THREE.ConeGeometry((.24+t*.22)*rank,(2.6+t*2.2)*rank,9),i%3,
     Math.cos(a)*(.3+t*.8)*rank,Math.sin(a)*(.3+t*.6)*rank,1.2+t*2,true);
    plume.rotation.x=Math.PI/2-.18;plume.rotation.z=a*.2;
   }
  }else if(n===8||n===33){
   // The real numbered original is injected below; augment only with a
   // restrained multicolour launch ring.
   for(let i=0;i<3;i++){
    const ring=add(new THREE.TorusGeometry((.35+i*.2)*rank,.06,8,48),i);
    ring.rotation.x=Math.PI/2;ring.position.z=.55+i*.27;
   }
  }
  // Spatial, independently animated luminous motes give all twelve effects
  // a distinct multicoloured depth; deterministic and mobile budget bounded.
  const mobile=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const count=mobile?110:270,xyz=new Float32Array(count*3),pigment=new Float32Array(count*3);
  let seed=(n*1103515245+12345)>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const palette=shades.map(h=>new THREE.Color(h));
  for(let i=0;i<count;i++){
   const theta=rand()*Math.PI*2,r=(.3+Math.sqrt(rand())*2.6)*rank;
   xyz.set([Math.cos(theta)*r,(rand()-.5)*3.3*rank,Math.sin(theta)*r],i*3);
   const color=palette[i%3].clone().lerp(palette[(i+1)%3],rand()*.7);
   pigment.set([color.r,color.g,color.b],i*3);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(xyz,3));
  geo.setAttribute('color',new THREE.BufferAttribute(pigment,3));
  const motes=new THREE.Points(geo,new THREE.PointsMaterial({vertexColors:true,size:.11*rank,sizeAttenuation:true,transparent:true,opacity:.78,depthWrite:false,blending:THREE.AdditiveBlending}));
  group.add(motes);group.position.copy(source);
  const duration=event.channel?Math.max(1.1,Math.min(5,Number(item.cooldown||700)/1000+1.6)):n===38||n===48?2.2:1.35;
  const entry={spec,group,root,item,age:0,duration,direction,range:Number(event.range)||15,
   source,key,lastPulse:performance.now(),motes,fx:null};
  if(n===33){entry.fx=createTidalSurge({size:rank*2,density:.75,color:'#73dbff',detail:1.1});this.scene.add(entry.fx.group);}
  if(n===8){entry.fx=createArcRay({size:rank,density:.8,quantity:8,color:'#7caaff'});this.scene.add(entry.fx.group);}
  this.scene.add(group);
  if(this.active.length>=22)this.remove(this.active[0]);
  this.active.push(entry);this.align(entry);
  return true;
 }
 align(e){
  if(e.key&&e.root){const p=this.muzzle(e.root,e.item,e.group.position.clone());if(p)e.group.position.copy(p);}
  const dir=e.direction,source=e.group.position;
  e.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
  if(e.fx){
   if(e.spec.number===8){
    e.fx.group.position.set(0,0,0);
    e.fx.setEndpoints(source,source.clone().addScaledVector(dir,e.range));
   }else{
    e.fx.group.position.copy(source);
    e.fx.group.quaternion.copy(e.group.quaternion);
   }
  }
 }
 update(dt){
  const now=performance.now();
  for(const e of [...this.active]){
   if(e.key&&now-e.lastPulse>Math.max(1150,e.item.cooldown+420)){this.remove(e);continue;}
   e.age+=dt;
   if(!e.key&&e.age>e.duration){this.remove(e);continue;}
   this.align(e);
   const t=e.age;
   e.motes.rotation.z=t*.7;
   e.motes.rotation.y=t*.5;
   e.group.children.forEach((c,i)=>{if(c.isMesh&&c.geometry?.type==='TorusGeometry'){c.rotation.z+=dt*(1+i*.06);c.rotation.x+=dt*.16;}});
   if(e.fx){e.fx.update(dt);if(e.fx.finished&&e.key)e.fx.reset();}
  }
 }
 stop(root){for(const e of [...this.active])if(e.root===root&&e.key)this.remove(e);}
 remove(e){
  const at=this.active.indexOf(e);if(at>=0)this.active.splice(at,1);
  e.group.removeFromParent();e.group.traverse(o=>{
   o.geometry?.dispose();
   if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
  });
  if(e.fx){e.fx.group.removeFromParent();e.fx.dispose();}
 }
 dispose(){for(const entry of [...this.active])this.remove(entry);}
}
