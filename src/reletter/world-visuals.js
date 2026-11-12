// Verbatim original crop, aquarium, fish, fishing pose/rod and loot builders.
import * as THREE from 'three';
import {seedById} from './garden-catalog.js';
import {botanicalCanvas} from './garden-art.js';
import {fishById,fishDimensions,fishPrice} from './fishing-catalog.js';
import {fishDataURL} from './fish-art.js';
import {createFishModel,createWorldFishModel,animateFishModel,disposeFishModel} from './fish-model.js';
import {rightHand} from './held-weapons.js';
import {itemIcon} from './item-art.js';
export function originalWorldVisuals(scene,onCatch=()=>{}){
let globalTime=0,charModel=null,charRoot=new THREE.Group(),selectedCharacter='',reelHeld=false;
const remotePlayers=new Map(),cropTextures=new Map(),fishTextures=new Map(),fishingRods=new Map();
let fishing={holes:[],ponds:[],sessions:{}};
const fstate=()=>fishing,openCatchViewer=onCatch;
const itemRarity=item=>({id:item.rarity||'common',color:item.color||'#ddc5f0'});
function disposeAdventure(g){g.removeFromParent();const mats=new Set(),geos=new Set();g.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])mats.add(m);});geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());}
function makeCropModel(species,stage){const s=seedById(species),root=new THREE.Group(),artStage=stage<=1?0:stage===2?1:stage<5?2:3,textureKey=species+':'+artStage;let texture=cropTextures.get(textureKey);if(!texture){texture=new THREE.CanvasTexture(botanicalCanvas(species,s.color,artStage));texture.colorSpace=THREE.SRGBColorSpace;texture.userData.sharedGarden=true;cropTextures.set(textureKey,texture);}const mat=new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.18,side:THREE.DoubleSide,roughness:1}),growth=(stage-1)/19,height=(species===20||species===26?9:species>20?4.5:6)*growth,spread=3.2*growth,n=stage<5?1:Math.min(18,stage-2),cards=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5,2.25),mat,n*2),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),scale=new THREE.Vector3();const branchMat=new THREE.MeshStandardMaterial({color:species>20?'#77936d':'#73916a',roughness:1}),branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.018,.032,1,6),branchMat,Math.max(1,n));
for(let i=0;i<n;i++){const angle=i*2.39996+species*.37,r=i===0?0:spread*Math.sqrt(i/n),y=i===0?height*.8:height*(.2+.6*(1-i/n)),x=Math.cos(angle)*r,z=Math.sin(angle)*r,cardScale=stage<5?.45+stage*.12:.6+growth*.28;for(let side=0;side<2;side++){q.setFromAxisAngle(new THREE.Vector3(0,1,0),side*Math.PI/2+angle);matrix.compose(v.set(x,y+cardScale,z),q,scale.setScalar(cardScale));cards.setMatrixAt(i*2+side,matrix);}const start=new THREE.Vector3(0,i===0?0:Math.max(0,y*.45),0),end=new THREE.Vector3(x,y+.2,z),direction=end.clone().sub(start),length=direction.length();q.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());matrix.compose(start.add(end).multiplyScalar(.5),q,scale.set(1+growth*2,Math.max(.1,length),1+growth*2));branches.setMatrixAt(i,matrix);}
root.add(cards);if(stage>=5)root.add(branches);else{branches.geometry.dispose();branchMat.dispose();}cards.computeBoundingSphere();if(stage>=5)branches.computeBoundingSphere();return root;}

function waterFeature(data,pond){
 if(pond)return aquariumFeature(data);
 const group=new THREE.Group();group.position.fromArray(data.position);group.name=pond?'Moonstone pond':'Excavated fishing hole';
 const radius=data.radius,depth=pond?.5:(data.depth||1),darkness=Math.min(1,Math.log2(depth+1)/Math.log2(29)),crimson=data.water==='crimson';group.userData.depth=depth;group.userData.crimson=crimson;
 if(pond){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.16,8,64),new THREE.MeshStandardMaterial({color:'#d0cdc9',roughness:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.22;group.add(ring);}
 const basin=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*.72,depth,48,1,true),new THREE.MeshStandardMaterial({color:crimson?'#251522':'#172c31',roughness:.92,side:THREE.DoubleSide}));basin.position.y=pond?0:-depth/2;group.add(basin);
 const water=new THREE.Mesh(new THREE.CircleGeometry(radius-.025,64),new THREE.ShaderMaterial({uniforms:{time:{value:0},depthShade:{value:pond?.15:darkness},crimson:{value:crimson?1:0}},vertexShader:'varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 uvp;uniform float time;uniform float depthShade;uniform float crimson;void main(){vec2 p=uvp*2.-1.;float r=length(p);float waves=sin(r*36.-time*2.)*.5+.5;float caustic=pow(.5+.5*sin(p.x*27.+sin(p.y*19.+time)),10.);vec3 shallow=mix(vec3(.055,.29,.3),vec3(.22,.65,.57),1.-r*.6);vec3 deep=mix(vec3(.006,.012,.028),vec3(.022,.052,.1),1.-r*.6);vec3 red=mix(vec3(.065,.003,.026),vec3(.43,.018,.09),1.-r*.7);vec3 c=mix(mix(shallow,deep,depthShade),red,crimson);c+=mix(vec3(.12,.2,.18),vec3(.5,.06,.13),crimson)*(waves*.06+caustic*.13)*(1.-depthShade*.65);gl_FragColor=vec4(c,1.);}`,side:THREE.DoubleSide}));water.rotation.x=-Math.PI/2;water.position.y=pond?.2:-.24;group.add(water);group.userData.water=water;
 if(pond)for(let i=0;i<12;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.19,0),new THREE.MeshStandardMaterial({color:i%2?'#b8b9ae':'#839a8e',roughness:.9}));const a=i*Math.PI*2/12;rock.position.set(Math.cos(a)*radius,.28,Math.sin(a)*radius);rock.scale.set(1.5,.7,1);group.add(rock);}scene.add(group);return group;
}
function fishTexture(species){if(!fishTextures.has(species.id)){const texture=new THREE.TextureLoader().load(fishDataURL(species));texture.colorSpace=THREE.SRGBColorSpace;fishTextures.set(species.id,texture);}return fishTextures.get(species.id);}
function swimmingFish(fish){const spec=fishById(fish.species);if(spec.eldritch){const group=createWorldFishModel(THREE,spec);group.userData.seed=spec.index*.61;group.userData.giant=true;scene.add(group);return group;}const group=new THREE.Group(),geo=new THREE.PlaneGeometry(1.3,1,16,4);const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:fishTexture(spec),transparent:true,alphaTest:.03,side:THREE.DoubleSide,depthWrite:false}));group.add(mesh);group.userData.mesh=mesh;group.userData.seed=spec.index*.61;group.userData.base=geo.attributes.position.array.slice();scene.add(group);return group;}

function aquariumFeature(data){
 const group=new THREE.Group();group.name='Raised glass aquarium';group.position.fromArray(data.position);
 const [w,h,d]=data.size||[6,2.1,4];group.userData.dimensions=[w,h,d];
 const frameMat=new THREE.MeshStandardMaterial({color:'#b9b8c9',metalness:.7,roughness:.3});
 const baseMat=new THREE.MeshStandardMaterial({color:'#354655',roughness:.65,metalness:.3});
 const glassMat=new THREE.MeshPhongMaterial({color:'#bde9e5',transparent:true,opacity:.14,shininess:100,side:THREE.DoubleSide,depthWrite:false});
 const box=(width,height,depth,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);m.position.set(x,y,z);group.add(m);return m;};
 box(w+.12,.2,d+.12,0,.1,0,baseMat);
 for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])box(.065,h,.065,x,h/2,z,frameMat);
 for(const y of [.22,h]){for(const z of [-d/2,d/2])box(w,.045,.045,0,y,z,frameMat);for(const x of [-w/2,w/2])box(.045,.045,d,x,y,0,frameMat);}
 for(const z of [-d/2,d/2])box(w,h-.2,.012,0,(h+.2)/2,z,glassMat).renderOrder=3;
 for(const x of [-w/2,w/2])box(.012,h-.2,d,x,(h+.2)/2,0,glassMat).renderOrder=3;
 box(w-.1,.04,d-.1,0,.23,0,new THREE.MeshStandardMaterial({color:'#b2bab2',roughness:1}));
 const water=new THREE.Mesh(new THREE.PlaneGeometry(w-.08,d-.08),new THREE.ShaderMaterial({
  uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 v;uniform float time;void main(){float lines=pow(.5+.5*sin(v.x*38.+sin(v.y*24.+time)*2.),12.);gl_FragColor=vec4(vec3(.28,.65,.67)+lines*.2,.15+lines*.13);}'
 }));water.rotation.x=-Math.PI/2;water.position.y=h*.88;water.renderOrder=2;group.add(water);group.userData.water=water;
 // Sparse substrate plants keep the glass clear and draw calls bounded on phones.
 const greenery=new THREE.MeshStandardMaterial({color:'#427a69',roughness:.8,side:THREE.DoubleSide});
 for(let i=0;i<6;i++){const stem=new THREE.Mesh(new THREE.ConeGeometry(.06,h*.32,5),greenery);stem.position.set((i%3-1)*w*.3,.25+h*.16,(i<3?-1:1)*d*.32);stem.rotation.z=Math.sin(i*2)*.15;group.add(stem);}
 scene.add(group);return group;
}


// Animation is derived from the shared fishing session, so both players see the same stage.
const fishPoseStates=new Map(),fishingPoseRestore=[],fishBoneCache=new WeakMap();
function syncFishingPoses(f){
 for(const [name,s] of Object.entries(f.sessions||{})){
  let p=fishPoseStates.get(name);
  if(!p||p.id!==s.id){p={id:s.id,stage:s.stage,age:0,session:s,presented:s.stage==='caught'};fishPoseStates.set(name,p);}
  if(p.stage!==s.stage){p.stage=s.stage;p.age=0;p.presented=false;}
  p.session=s;
 }
 for(const [name,p] of fishPoseStates)if(!f.sessions?.[name]||f.sessions[name].id!==p.id){if(p.landingFish){scene.remove(p.landingFish);disposeFishModel(p.landingFish);}fishPoseStates.delete(name);}
}
function fishingPoseFor(name){
 const p=fishPoseStates.get(name);return p&&(['waiting','fight'].includes(p.stage)||(p.stage==='caught'&&!p.presented&&p.age<1.7))?p:null;
}
function restoreFishingPoses(){
 for(const saved of fishingPoseRestore){if(saved.quaternion)saved.object.quaternion.copy(saved.quaternion);if(saved.position)saved.object.position.copy(saved.position);}
 fishingPoseRestore.length=0;
}
function fishingBones(model){
 if(!fishBoneCache.has(model)){const bones={};model.traverse(b=>{if(b.isBone)bones[b.name.replace(/[^a-z0-9]/gi,'').replace(/^mixamorig\d*/,'')]=b;});fishBoneCache.set(model,bones);}
 return fishBoneCache.get(model);
}
function applyFishingPoses(){
 const players=[{character:selectedCharacter,model:charModel,root:charRoot},...[...remotePlayers.values()]];
 for(const player of players){
  const p=fishingPoseFor(player.character);if(!p||!player.model)continue;
  const hole=fstate().holes.find(h=>h.id===p.session.hole);if(!hole)continue;
  const model=player.model,bones=fishingBones(model),fight=p.stage==='fight',landing=p.stage==='caught';
  const bite=p.stage==='waiting'&&Date.now()>=p.session.biteAt,shake=bite||fight;
  const wave=Math.sin(globalTime*(bite?24:13)),pull=fight?(.5+.5*Math.sin(globalTime*4)):0,lift=landing?Math.sin(Math.min(1,p.age/1.6)*Math.PI):0;
  fishingPoseRestore.push({object:model,position:model.position.clone(),quaternion:model.quaternion.clone()});
  const root=player.root||model.parent;model.rotation.set(0,Math.atan2(hole.position[0]-root.position.x,hole.position[2]-root.position.z),0);
  model.position.y+=(shake?wave*.045:Math.sin(globalTime*2)*.008)+lift*.12;
  const rotates={
   RightArm:[-.85-pull*.35-lift*1.1,0,-.65+(shake?wave*.07:0)],
   RightForeArm:[-.65-pull*.4-lift*.35,.12,.18],
   LeftArm:[-.75-pull*.2-lift*.5,.25,.65],
   LeftForeArm:[-1.2,-.2,-.3+(fight&&p.session.reeling?Math.sin(globalTime*14)*.2:0)],
   Spine2:[.1-pull*.2-lift*.2,0,shake?wave*.025:0],
   Head:[.1-lift*.2,Math.sin(globalTime*1.5)*.04,0]
  };
  for(const [key,angles] of Object.entries(rotates)){const bone=bones[key];if(!bone)continue;fishingPoseRestore.push({object:bone,quaternion:bone.quaternion.clone()});bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)));}
  model.updateMatrixWorld(true);
 }
}
function updateFishingPresentation(dt){
 for(const [name,p] of fishPoseStates){
  p.age+=dt;
  if(p.stage!=='caught'||p.presented)continue;
  const species=fishById(p.session.result?.species),hole=fstate().holes.find(h=>h.id===p.session.hole);
  if(!species||!hole){p.presented=true;continue;}
  const player=name===selectedCharacter?{model:charModel,root:charRoot}:[...remotePlayers.values()].find(r=>r.character===name);
  if(!player?.model)continue;
  if(!p.landingFish){p.landingFish=species.eldritch?createWorldFishModel(THREE,species):createFishModel(THREE,species);if(!species.eldritch)p.landingFish.scale.setScalar(.24);scene.add(p.landingFish);}
  const end=player.root.position.clone().add(new THREE.Vector3(0,1.7,0)),start=new THREE.Vector3(...hole.position);start.y=species.eldritch?fishDimensions(species)[1]*.5:-.24;if(species.eldritch){end.copy(start);end.y+=2;}
  const t=Math.min(1,p.age/1.3);p.landingFish.position.lerpVectors(start,end,t);p.landingFish.position.y+=Math.sin(t*Math.PI)*1.5;
  p.landingFish.rotation.set(.15,globalTime*3,.25*Math.sin(globalTime*10));animateFishModel(p.landingFish,globalTime);
  if(p.age>=1.65){scene.remove(p.landingFish);disposeFishModel(p.landingFish);delete p.landingFish;p.presented=true;
   if(name===selectedCharacter){reelHeld=false;openCatchViewer(p.session.result);}
  }
 }
}


function updateFishingRods(f){
 const players=[{character:selectedCharacter,model:charModel},...[...remotePlayers.values()]],active=new Set();
 for(const p of players){const pose=fishingPoseFor(p.character),session=pose?.session,hole=f.holes.find(h=>h.id===session?.hole);if(!p.model||!hole||!pose)continue;const hand=rightHand(p.model);if(!hand)continue;active.add(p.character);let g=fishingRods.get(p.character);
  if(!g){g=new THREE.Group();const rod=new THREE.Mesh(new THREE.CylinderGeometry(.008,.025,2.4,10,24),new THREE.MeshStandardMaterial({color:'#6d7697',metalness:.6,roughness:.3}));rod.position.y=1.1;g.add(rod);g.userData.rod=rod;g.userData.base=rod.geometry.attributes.position.array.slice();
   const grip=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.35,12),new THREE.MeshStandardMaterial({color:'#342b3d',roughness:.8}));g.add(grip);
   const reel=new THREE.Mesh(new THREE.TorusGeometry(.09,.025,8,20),new THREE.MeshStandardMaterial({color:'#d4c4a0',metalness:.7,roughness:.3}));reel.position.y=.12;g.add(reel);g.userData.reel=reel;
   const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(25*3),3));const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:'#e6f5ee',transparent:true,opacity:.7}));line.frustumCulled=false;scene.add(g,line);const bobber=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),new THREE.MeshStandardMaterial({color:'#ffad9a',emissive:'#8d3930',emissiveIntensity:.2}));scene.add(bobber);g.userData.bobber=bobber;g.userData.line=line;fishingRods.set(p.character,g);}
  const fight=session.stage==='fight',landing=session.stage==='caught',bite=session.stage==='waiting'&&Date.now()>=session.biteAt,shake=bite||fight,osc=Math.sin(globalTime*(bite?24:13)),lift=landing?Math.sin(Math.min(1,pose.age/1.6)*Math.PI):0,bend=fight?.16+(session.tension||0)*.5:bite?.2:.04;
  p.model.updateMatrixWorld(true);hand.getWorldPosition(g.position);const end=new THREE.Vector3(...hole.position);end.y=-.15+(bite?osc*.13:Math.sin(globalTime*3)*.02);if(fight){end.x+=Math.sin(globalTime*5)*.28;end.z+=Math.cos(globalTime*4)*.22;}
  if(landing){const from=end.clone(),t=Math.min(1,pose.age/1.3);end.lerpVectors(from,g.position.clone().add(new THREE.Vector3(0,.5,0)),t);end.y+=Math.sin(t*Math.PI)*1.5;}
  g.userData.bobber.position.copy(end);g.userData.bobber.visible=!landing;
  const toward=new THREE.Vector3(hole.position[0]-g.position.x,1.6+(shake?osc*.32:0)+lift*5,hole.position[2]-g.position.z).normalize();g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),toward);
  const rodAttr=g.userData.rod.geometry.attributes.position,base=g.userData.base;for(let i=0;i<rodAttr.count;i++){const t=(base[i*3+1]+1.2)/2.4;rodAttr.setZ(i,base[i*3+2]+t*t*bend);}rodAttr.needsUpdate=true;g.userData.reel.rotation.y=fight&&session.reeling?globalTime*14:0;
  g.updateMatrixWorld(true);const tip=g.localToWorld(new THREE.Vector3(0,2.3,bend)),attr=g.userData.line.geometry.attributes.position;for(let i=0;i<25;i++){const t=i/24;attr.setXYZ(i,THREE.MathUtils.lerp(tip.x,end.x,t),THREE.MathUtils.lerp(tip.y,end.y,t)-Math.sin(t*Math.PI)*(fight?.035:.18),THREE.MathUtils.lerp(tip.z,end.z,t));}attr.needsUpdate=true;
 }
 for(const [id,g] of fishingRods)if(!active.has(id)){disposeAdventure(g.userData.line);disposeAdventure(g.userData.bobber);disposeAdventure(g);fishingRods.delete(id);}
}


const lootTextures=new Map();let lootHalo;
function lootGlow(color){if(!lootHalo){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#ffffffaa');g.addColorStop(.35,'#ffffff55');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,128,128);lootHalo=new THREE.CanvasTexture(c);lootHalo.userData.sharedGarden=true;}return new THREE.Sprite(new THREE.SpriteMaterial({map:lootHalo,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));}
function createItemDrop(item,affixed=false){const g=new THREE.Group(),rarity=itemRarity(affixed?{...item,affixId:'dread'}:item);g.name='Loot: '+item.name;g.userData.itemId=item.id;g.userData.rarity=rarity.id;const glow=lootGlow(rarity.color);glow.scale.set(3.5,3.5,1);g.add(glow);let texture=lootTextures.get(item.id);if(!texture){texture=new THREE.TextureLoader().load(itemIcon(item));texture.colorSpace=THREE.SRGBColorSpace;texture.userData.sharedGarden=true;lootTextures.set(item.id,texture);}const icon=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));icon.scale.set(1.65,1.65,1);g.add(icon);return g;}

return {makeCropModel,waterFeature,swimmingFish,createItemDrop,disposeAdventure,
 beforeAnimation:restoreFishingPoses,
 sync(f,roots){fishing=f||{holes:[],ponds:[],sessions:{}};remotePlayers.clear();for(const [key,root] of roots)remotePlayers.set(key,{character:key,model:root.userData.model,root});syncFishingPoses(fishing);},
 update(dt,time){globalTime=time;applyFishingPoses();updateFishingPresentation(dt);updateFishingRods(fishing);}};
}
