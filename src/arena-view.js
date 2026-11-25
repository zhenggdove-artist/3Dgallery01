import * as THREE from 'three';
import {GrassField} from './grass-field.js';
import {OuterCity} from './outer-city.js';
import {cityGroundHeight,cityBlocked} from './shared/city-layout.js';
import {DisplayPlatforms} from './display-platforms.js';
import {artworkPosition,artworkLanding,artworkRenderFlight} from './shared/artwork-flight.js';
import {artworkDefinitions,artworkPickupReach} from './shared/artwork-library.js';
import {addArtworkDepth,applyArtworkAppearance,loadCustomArtwork,updateArtworkTitleVisibility,releaseArtworkAnimation} from './artwork-surface.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {PLATFORMS,SAFE_ZONE,distance2d} from './shared/arena.js';
import {itemById,groundDropVisualKind} from './shared/catalog.js';
import {createCashDropGeometry,cashDropMaterial} from './comfort-cash-art.js';
import {buildReletterEnvironment,reletterPlatformMaterial,ReletterPresentation,disposeVisual} from './reletter-presentation.js';
import {AdventureView} from './adventure-view.js';
import {IslandEnemies} from './island-enemies.js';
import {createHeart} from './heart-model.js';
import {createPlantInsects} from './reletter/plant-insects.js';
import artworkDelivery from '../artwork-delivery.json' with {type:'json'};
import {ARTWORK_DISCS,discGroundHeight} from './shared/artwork-discs.js';
import {samplePanBlastPosition} from './shared/pan-blast-flight.js';
import {originalBuildSizes,buildGeometry,buildMaterial} from './build-style.js';
import {inPlaceLocomotion} from './locomotion-clips.js';

const touch=matchMedia('(pointer:coarse)').matches;
const tempMatrix=new THREE.Matrix4(),tempPosition=new THREE.Vector3(),tempQuaternion=new THREE.Quaternion(),tempScale=new THREE.Vector3(),tempEuler=new THREE.Euler();
const EMPTY_CITY_DAMAGE=Object.freeze({}),EMPTY_PLANTS=Object.freeze([]);

export class TempleArena{
  constructor(scene,renderer){
    this.scene=scene;this.renderer=renderer;this.dracoLoader=new DRACOLoader();this.dracoLoader.setDecoderPath('./vendor/three/examples/jsm/libs/draco/');this.loader=new GLTFLoader().setDRACOLoader(this.dracoLoader);this.clock=0;this.world=null;this.players=[];this.dropMeshes=[];
    this.heartDrops=new Map();this.artworks=new Map();this.localArtworkFlights=new Map();this.coinMesh=null;this.dropMesh=null;this.dropIds=[];this.dropCoinFlights=[];this.coinFlights=new Map();this.structureGroup=new THREE.Group();this.structureGroup.name='Persistent structures';scene.add(this.structureGroup);this.plantGroup=new THREE.Group();this.plantGroup.name='Permanent message plants';scene.add(this.plantGroup);
    this.mixers=[];this.lightPool=[];this.lastLightUpdate=0;this.stairs=[];this.shared={};this.monster=null;this.monsterMixer=null;this.throwClones=[];this.buildPreview=null;this.debrisBursts=[];this.collapsingShells=[];this.destroyedEffects=new Set();this.structureHitTimes=new Map();this.seenStructureHits=new Set();this.presentation=new ReletterPresentation(scene);this.grass=null;this.defaultLayout={};this.adventure=new AdventureView(scene);this.islandEnemies=new IslandEnemies(scene);
  }
  async load(progress=()=>{}){
    progress(.08,'Building arena');this.buildEnvironment();
    const artTask=fetch('./state.min.json').then(r=>{if(!r.ok)throw Error('Artwork state missing');return r.json();}).then(state=>this.loadArtworks(state.artworks||[],value=>progress(.1+value*.65,'Loading 13 artworks')));
    const [character,coin]=await Promise.all([
      this.loader.loadAsync('./temple-assets/character.temple.glb'),this.loader.loadAsync('./temple-assets/coin_small.temple.glb'),this.islandEnemies.load(),artTask
    ]);
    character.animations=character.animations.map(inPlaceLocomotion);
    this.characterAsset=character;this.coinAsset=coin;this.createCoinInstances();progress(.85,'All models loaded');
  }
  buildEnvironment(){
    this.insects=createPlantInsects(this.scene);
    buildReletterEnvironment(this.scene,this.renderer);
    const rings=new THREE.Mesh(new THREE.RingGeometry(SAFE_ZONE.radius-1,SAFE_ZONE.radius,64),new THREE.MeshBasicMaterial({color:'#b9ac70',transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false}));rings.rotation.x=-Math.PI/2;rings.position.y=.025;this.scene.add(rings);
    this.buildPlatforms();this.buildDust();this.grass=new GrassField(this.scene,{mobile:touch});this.outerCity=new OuterCity(this.scene,{mobile:touch});
    for(let i=0;i<(touch?3:5);i++){const light=new THREE.PointLight('#e6d49a',0,18,2);this.scene.add(light);this.lightPool.push(light);}
  }
  buildCentralPlant(){
    const root=new THREE.Group();root.name='Message plant';const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.5,3.8,9),new THREE.MeshStandardMaterial({color:'#3b3425',roughness:1}));trunk.position.y=1.9;root.add(trunk);
    const leafGeo=new THREE.IcosahedronGeometry(.58,1),leafMat=new THREE.MeshStandardMaterial({color:'#708661',roughness:.85});const leaves=new THREE.InstancedMesh(leafGeo,leafMat,28);for(let i=0;i<28;i++){const a=i*2.39996,r=.7+(i%7)*.19,y=1.2+(i%6)*.58;tempPosition.set(Math.cos(a)*r,y,Math.sin(a)*r);tempQuaternion.setFromEuler(new THREE.Euler(a*.2,a,0));tempScale.setScalar(.55+(i%4)*.12);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);leaves.setMatrixAt(i,tempMatrix);}root.add(leaves);this.scene.add(root);
  }
  buildPlatforms(){this.displayPlatforms=new DisplayPlatforms(this);this.displayPlatforms.sync();}
  buildDust(){const count=touch?500:1200,positions=new Float32Array(count*3),seed=new Float32Array(count);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*100;positions[i*3+1]=Math.random()*22;positions[i*3+2]=(Math.random()-.5)*100;seed[i]=Math.random();}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seed,1));const material=new THREE.PointsMaterial({color:'#d8cfac',size:touch?.025:.035,transparent:true,opacity:.42,depthWrite:false});this.dust=new THREE.Points(geometry,material);this.dust.frustumCulled=false;this.scene.add(this.dust);}
  createCoinInstances(){let mesh;this.coinAsset.scene.traverse(node=>{if(!mesh&&node.isMesh)mesh=node;});if(!mesh)throw Error('Original RELETTER coin mesh missing');this.coinAsset.scene.updateMatrixWorld(true);const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),material=mesh.material.clone();material.side=THREE.DoubleSide;material.metalness=.8;material.roughness=.2;material.emissive.set('#FFD700');material.emissiveIntensity=.3;this.coinMesh=new THREE.InstancedMesh(geometry,material,PLATFORMS.length);this.coinMesh.name='Original RELETTER platform coins';this.coinMesh.frustumCulled=false;this.scene.add(this.coinMesh);}
  async loadArtworks(records,onProgress){
    const selected=records.slice(0,PLATFORMS.length);if(selected.length!==13)throw Error(`Expected 13 artworks, found ${selected.length}`);let complete=0;
    const loadOne=async(record,index)=>{const platform=PLATFORMS[index],root=new THREE.Group();root.name=`Artwork ${record.title}`;root.userData={platformId:platform.id,record,base:platform.artPosition};
      if(record.type==='model'){const gltf=await this.loader.loadAsync('./models/model_0004.temple.glb'),model=gltf.scene;fitObject(model,Math.min(5.2,Math.max(3.2,record.size?.h*.7||4)));root.add(model);root.userData.model=true;}
      else{const displaySource=artworkDelivery[record.src]||record.src,texture=await new THREE.TextureLoader().loadAsync(displaySource);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());const aspect=record.naturalAspect||texture.image.width/texture.image.height,height=Math.min(4.8,Math.max(2.2,(record.size?.h||3)*.68)),width=height*aspect,geometry=new THREE.PlaneGeometry(width,height),material=new THREE.MeshStandardMaterial({map:texture,transparent:!!record.transparent,alphaTest:record.transparent?.035:0,side:THREE.DoubleSide,roughness:.72,metalness:0,emissive:'#ffffff',emissiveMap:texture,emissiveIntensity:.16});const art=new THREE.Mesh(geometry,material);art.name=record.title;root.add(art);root.userData.displaySize=[width,height];addArtworkDepth(root,texture,width,height);}
      root.position.fromArray(platform.artPosition);root.rotation.y=platform.artYaw;this.scene.add(root);this.artworks.set(platform.id,root);complete++;onProgress(complete/selected.length);
    };
    // Avoid simultaneous decode of all large artwork images on mobile WebKit.
    if(touch){for(let i=0;i<selected.length;i+=2)await Promise.all(selected.slice(i,i+2).map((record,j)=>loadOne(record,i+j)));}
    else await Promise.all(selected.map(loadOne));
  }
  createPlayer(color='#43b59a',admin=false,name='Pilgrim'){
    const root=new THREE.Group(),model=cloneSkeleton(this.characterAsset.scene);model.scale.setScalar(100);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);model.position.y=-bounds.min.y;tintCharacter(model,color,admin);root.add(model);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.46,.53,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;root.add(ring);const label=makeNameSprite(name,admin);label.position.y=-.25;root.add(label);const weaponMount=new THREE.Group();weaponMount.position.set(.48,1.05,.1);weaponMount.rotation.set(0,0,-.55);root.add(weaponMount);const mixer=new THREE.AnimationMixer(model),actions={};for(const clip of this.characterAsset.animations)actions[clip.name]=mixer.clipAction(clip);actions.idle?.play();mixer.update(.001);model.updateMatrixWorld(true);model.position.y-=new THREE.Box3().setFromObject(model,true).min.y;model.updateMatrixWorld(true);const chatHeadY=new THREE.Box3().setFromObject(model,true).max.y+.4;root.userData={model,mixer,actions,current:'idle',ring,label,displayName:name,weaponMount,weaponId:null,chatHeadY,portraitBase:{position:model.position.clone(),quaternion:model.quaternion.clone(),scale:model.scale.clone()}};this.mixers.push(mixer);return root;
  }
  setPlayerName(root,name,admin){if(!root||root.userData.displayName===name)return;const old=root.userData.label;if(old){const label=makeNameSprite(name,admin);label.position.copy(old.position);root.add(label);old.removeFromParent();old.material.map?.dispose();old.material.dispose();root.userData.label=label;}root.userData.displayName=name;}
  setPlayerEquipment(root,equipment){if(root)this.presentation.equipment(root,equipment);}
  removePlayer(root){
   const {model,mixer,ring,label}=root.userData;
   this.setPlayerEquipment(root,{});
   this.presentation.players.delete(root);
   const index=this.mixers.indexOf(mixer);if(index>=0)this.mixers.splice(index,1);
   mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);
   const skeletons=new Set();
   model?.traverse(o=>{
    if(o.isSkinnedMesh)skeletons.add(o.skeleton);
    if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
   });
   skeletons.forEach(s=>s.dispose());
   ring?.geometry.dispose();ring?.material.dispose();
   label?.material.map?.dispose();label?.material.dispose();
   root.removeFromParent();
  }
  setBuildPreview(kind,position,rotation=0,valid=true,size=1,previewFile=null){if(!this.buildPreview||this.buildPreview.userData.kind!==kind){this.clearBuildPreview();const group=new THREE.Group();group.userData.kind=kind;const material=new THREE.MeshStandardMaterial({color:'#85d9bd',transparent:true,opacity:.34,depthWrite:false,roughness:.5,emissive:'#2c705c',emissiveIntensity:.3});for(const mesh of previewMeshes(kind,material))group.add(mesh);
   if(kind==='art-bomb'&&previewFile?.type?.startsWith('image/')){
    const url=URL.createObjectURL(previewFile);
    new THREE.TextureLoader().load(url,texture=>{
     URL.revokeObjectURL(url);
     if(!group.parent){texture.dispose();return;}
     texture.colorSpace=THREE.SRGBColorSpace;
     const face=group.children[0];
     face.material.map=texture;
     face.material.needsUpdate=true;
     const aspect=texture.image?.width&&texture.image?.height?texture.image.width/texture.image.height:1;
     face.scale.x=Math.max(.33,Math.min(3,aspect));
     group.userData.previewTexture=texture;
    },undefined,()=>URL.revokeObjectURL(url));
   }
   group.name='Build placement preview';this.scene.add(group);this.buildPreview=group;}this.buildPreview.position.fromArray(position);this.buildPreview.rotation.y=rotation;this.buildPreview.scale.setScalar(kind==='art-bomb'?Math.max(1,Math.min(3,size)):1);for(const child of this.buildPreview.children){if(this.buildPreview.userData.actualArtwork)break;child.material?.color?.set(valid?'#85d9bd':'#e7776d');child.material?.emissive?.set(valid?'#2c705c':'#702b28');}this.buildPreview.userData.valid=valid;}
  clearBuildPreview(){if(!this.buildPreview)return;this.buildPreview.userData.previewTexture?.dispose();disposeChildren(this.buildPreview);this.buildPreview.removeFromParent();this.buildPreview=null;}
  async previewUploadedArtwork(upload,base){
   // Read the player's actual PNG/video/GLB from the Temple Worker before PLACE.
   if(!this.buildPreview||this.buildPreview.userData.kind!=='art-bomb')return;
   const group=this.buildPreview,record={id:'pending-upload-'+crypto.randomUUID(),title:upload.title||'Uploaded artwork',mediaId:upload.mediaId,
    type:upload.mediaType?.startsWith('image/')?'image':upload.mediaType?.startsWith('video/')?'video':'model',mime:upload.mediaType,position:[0,0,0],appearance:{labelBackground:upload.labelBackground||'#000000'}};
   const root=await loadCustomArtwork(this,record,base);
   if(this.buildPreview!==group){disposeArtworkRoot(root);return;}
   group.userData.previewTexture?.dispose();delete group.userData.previewTexture;
   disposeChildren(group);
   root.position.set(0,1.5,0);root.rotation.set(0,0,0);
   group.add(root);group.userData.actualArtwork=true;
   root.userData.video?.play().catch(()=>{});
  }
  showStructureHit(event){
    if(event?.cityLotIndex!==undefined){this.outerCity?.applyDamageEvent(event);return;}
   if(!event?.structureId||!Array.isArray(event.position)||this.seenStructureHits.has(event.id))return;
   this.seenStructureHits.add(event.id);
   if(this.seenStructureHits.size>128)this.seenStructureHits.delete(this.seenStructureHits.values().next().value);
   const now=performance.now();
   this.structureHitTimes.set(event.structureId,{start:now,until:now+550});
   // Every hit sheds small chips; a final hit triggers a much larger breakdown.
   this.showStructureBreak({...event,id:'chips-'+event.id,minor:true});
  }
  animateStructureHits(){
   const now=performance.now();
   for(const [id,h] of [...this.structureHitTimes])if(now>=h.until)this.structureHitTimes.delete(id);
   for(const mesh of this.structureGroup.children){
    const records=mesh.userData?.records,bases=mesh.userData?.baseMatrices;
    if(!records||!bases)continue;
    let changed=false;
    mesh.userData.lastHitIndices??=new Set();
    for(let i=0;i<records.length;i++){
     const hit=this.structureHitTimes.get(records[i].id),wasHit=mesh.userData.lastHitIndices.has(i);
     if(!hit&&!wasHit)continue;
     const age=hit?Math.min(1,(now-hit.start)/550):1;
     tempMatrix.copy(bases[i]);
     if(hit){
      const jitter=Math.sin(age*26)*(1-age)*.23;
      tempMatrix.elements[12]+=jitter;
      tempMatrix.elements[14]+=Math.cos(age*32)*(1-age)*.13;
      mesh.userData.lastHitIndices.add(i);
     }else mesh.userData.lastHitIndices.delete(i);
     mesh.setMatrixAt(i,tempMatrix);
     const baseColor=mesh.userData.baseColors?.[i]||new THREE.Color('#ffffff');mesh.setColorAt(i,hit?new THREE.Color('#ff253d').lerp(baseColor,age):baseColor);
     changed=true;
    }
    if(changed){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
   }
  }
  showStructureBreak(event){
    if(event?.cityLotIndex!==undefined)return; // The city uses volumetric custom chunks.
    if(!event?.position||this.destroyedEffects.has(event.id))return;
    this.destroyedEffects.add(event.id);
    if(this.destroyedEffects.size>80)this.destroyedEffects.delete(this.destroyedEffects.values().next().value);
    const count=event.minor?(touch?3:6):(touch?12:24),geometry=new THREE.BoxGeometry(.34,.28,.32);
    const material=new THREE.MeshStandardMaterial({color:event.kind==='tree'?'#536344':'#777064',roughness:.9,transparent:true});
    const mesh=new THREE.InstancedMesh(geometry,material,count),random=seededRandom(hashText(event.id)),pieces=[];
    for(let i=0;i<count;i++)pieces.push({
      position:new THREE.Vector3(event.position[0]+(random()-.5)*1.2,event.position[1]+.5+random()*2,event.position[2]+(random()-.5)*1.2),
      velocity:new THREE.Vector3((random()-.5)*4,2.5+random()*4,(random()-.5)*4),
      spin:new THREE.Vector3(random()*4,random()*4,random()*4)
    });
    mesh.userData={pieces,age:0};this.scene.add(mesh);this.debrisBursts.push(mesh);
    if(!event.minor)this.startStructureCollapse(event);
  }
  startStructureCollapse(event){
    // Keep a transient shell after the authoritative structure disappears.
    if(this.collapsingShells.length>=12)disposeVisual(this.collapsingShells.shift());
    const shell=new THREE.Group(),base=buildMaterial(event.surface||null);
    shell.name='Collapsing '+(event.kind||'structure');
    for(const part of previewMeshes(event.kind,base)){
      part.material.transparent=true;
      part.material.depthWrite=false;
      shell.add(part);
    }
    base.dispose();
    shell.position.fromArray(event.position);
    shell.rotation.y=event.rotation||0;
    shell.userData.age=0;
    shell.userData.direction=hashText(event.id)%2?1:-1;
    this.scene.add(shell);this.collapsingShells.push(shell);
  }
  async loadCustomArtworks(records,base){
   this.customLoads??=new Map();
   const live=new Set((records||[]).map(record=>record.id));
   this.expectedCustomIds=live;
   const defaults=new Set(PLATFORMS.map(p=>p.id));
   // RESET must remove deleted artwork immediately, including cached assets.
   for(const [id,root] of this.artworks){
    if(defaults.has(id)||live.has(id))continue;
    disposeArtworkRoot(root);this.artworks.delete(id);this.customLoads.delete(id);this.localArtworkFlights.delete(id);
   }
   await Promise.all((records||[]).map(record=>{
    if(this.artworks.has(record.id)){
     const root=this.artworks.get(record.id);
     if(!root.userData.editing){
      // The media stays mounted. Rename/recolour its nameplate in place on
      // every confirmed room snapshot, including edits from other players.
      root.userData.record=record;
      applyArtworkAppearance(root,this.world?.artworkLayout?.[record.id]?.appearance);
     }
     return;
    }
    if(!this.customLoads.has(record.id)){
     const load=()=>this.expectedCustomIds?.has(record.id)?loadCustomArtwork(this,record,base):null;
     const lanes=this.customLoadLanes??=Array.from({length:touch?2:4},()=>Promise.resolve());const lane=(this.customLoadIndex=(this.customLoadIndex||0)+1)%lanes.length;
     const pending=lanes[lane].then(load);lanes[lane]=pending.catch(()=>{});
     const task=pending.then(root=>{
      if(!root)return;
      if(!this.expectedCustomIds?.has(record.id)){disposeArtworkRoot(root);return;}
      this.scene.add(root);this.artworks.set(record.id,root);
     }).finally(()=>{if(this.customLoads.get(record.id)===task)this.customLoads.delete(record.id);});
     this.customLoads.set(record.id,task);
    }
    return this.customLoads.get(record.id);
   }));
  }
  setPlayerAnimation(root,name){const data=root?.userData;if(!data?.actions||data.current===name)return;const next=data.actions[name]||data.actions.idle,current=data.actions[data.current];current?.fadeOut(.1);if(next){next.setLoop(name==='jump'?THREE.LoopOnce:THREE.LoopRepeat);next.clampWhenFinished=name==='jump';next.reset().fadeIn(.1).play();}data.current=name;}
  sync(world,players=[]){
  const previous=this.syncedWorld;
  this.syncedWorld=world;this.world=world;this.players=players;
  // RELETTER coin collection: *every* disappearing coin, whether on a disc
  // or dropped by a monster/player, spins upward and diminishes for .8 sec.
  if(previous?.coins!==world.coins)for(const p of PLATFORMS){
   if(previous?.coins?.[p.id]?.available&&!world.coins?.[p.id]?.available&&!this.coinFlights.has(p.id))
    this.coinFlights.set(p.id,{age:0,y:p.coinPosition[1]+Math.sin(this.clock*1.7+p.index)*.18});
  }
  if(!previous||previous.groundDrops!==world.groundDrops){
   const active=new Set((world.groundDrops||[]).map(d=>d.id));
   for(const prior of previous?.groundDrops||[]){
    if(prior.kind==='coin'&&!active.has(prior.id))this.spawnDropCoinFlight(prior);
   }
   this.syncHearts();this.syncDrops();
  }
  if(!previous||previous.wallPaintRevision!==world.wallPaintRevision)
   this.outerCity?.wallPaint?.sync(world.wallPaint||{},world.wallPaintRevision||0);
  if(!previous||previous.floatingPlatforms!==world.floatingPlatforms||
    previous.customPedestals!==world.customPedestals||previous.platformOverrides!==world.platformOverrides||
    previous.artworkLayout!==world.artworkLayout||previous.customArtworks!==world.customArtworks||
    previous.removedPlatformIds!==world.removedPlatformIds)this.displayPlatforms.sync();
  if(!previous||previous.structures!==world.structures)this.syncStructures();
  this.adventure.sync(world);this.syncMonster();
  }
  spawnDropCoinFlight(drop){
   if(!this.coinMesh||!Array.isArray(drop.position))return;
   if(this.dropCoinFlights.length>=40){const old=this.dropCoinFlights.shift();old.mesh.removeFromParent();}
   // The coin geometry and material are shared, so do not dispose them.
   const mesh=new THREE.Mesh(this.coinMesh.geometry,this.coinMesh.material);
   mesh.name='Collected coin ascension';
   mesh.position.fromArray(drop.position);mesh.position.y+=.55;
   mesh.scale.setScalar(1.6);
   this.scene.add(mesh);
   this.dropCoinFlights.push({mesh,age:0,startY:mesh.position.y,spin:Math.random()*Math.PI*2});
  }
  syncHearts(){
    const live=new Set();
    for(const drop of this.world?.groundDrops||[]){
     if(groundDropVisualKind(drop)!=='heart')continue;
     live.add(drop.id);
     if(this.heartDrops.has(drop.id))continue;
     const mesh=createHeart();mesh.name='Floating rotating healing heart '+drop.id;
     mesh.position.fromArray(drop.position);mesh.userData.baseY=mesh.position.y+.90;
     mesh.position.y=mesh.userData.baseY;mesh.userData.seed=this.heartDrops.size*.83;
     this.scene.add(mesh);this.heartDrops.set(drop.id,mesh);
    }
    for(const [id,mesh] of this.heartDrops)if(!live.has(id)){
     mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();this.heartDrops.delete(id);
    }
   }
  syncDrops(){
   const drops=(this.world?.groundDrops||[]).filter(d=>['coin','cash'].includes(groundDropVisualKind(d))),signature=drops.map(d=>d.id+':'+d.kind+':'+(d.itemId||'')+':'+d.position.join(',')).join('|');
   if(signature===this.dropSignature)return;this.dropSignature=signature;
   for(const mesh of this.dropMeshes){mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}this.dropMeshes=[];
   const groups=new Map();
   for(const drop of drops){const kind=groundDropVisualKind(drop),key=kind==='cash'?drop.itemId:'coin';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(drop);}
   for(const [key,records] of groups){
    const cash=key!=='coin',item=cash?itemById(key):null,shape=cash?'cash':'coin';
    const geometry=cash?createCashDropGeometry(THREE):this.coinMesh.geometry.clone(),material=cash?cashDropMaterial(THREE,item):this.coinMesh.material.clone();
    const mesh=new THREE.InstancedMesh(geometry,material,records.length);mesh.userData.records=records;mesh.userData.dropShape=shape;mesh.frustumCulled=false;
    records.forEach((drop,i)=>{setDropMatrix(mesh,drop,i,shape,this.clock);if(!cash)mesh.setColorAt(i,new THREE.Color('#f2cf55'));});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.name=cash?'Ground loot · cash '+item.denomination:'Ground loot · coin';this.scene.add(mesh);this.dropMeshes.push(mesh);
   }
  }
  syncStructures(){const structures=this.world?.structures||[],
   // Geometry/placement identity is independent of HP. Previous code
   // disposed EVERY structure mesh/material and recreated its GL resources
   // after a single damage tick, forcing shader rebuilds and long GPU stalls.
   signature=JSON.stringify(structures.map(s=>[s.id,s.kind,s.surface,s.variant,s.position,s.rotation])),
   health=JSON.stringify(structures.map(s=>[s.id,s.hp,s.maxHp]));
   if(signature===this.structureSignature){
    if(health===this.structureHealthSignature)return;
    this.structureHealthSignature=health;
    const byId=new Map(structures.map(record=>[record.id,record]));
    for(const mesh of this.structureGroup.children){
     if(mesh.userData?.records)mesh.userData.records=
      mesh.userData.records.map(record=>byId.get(record.id)||record);
    }
    this.registerStructureMeshes(); // in-place GPU instance updates only
    return;
   }
   this.structureSignature=signature;this.structureHealthSignature=health;while(this.structureGroup.children.length){const child=this.structureGroup.children[0];child.removeFromParent();if(child.isInstancedMesh)child.dispose();child.geometry?.dispose();child.material?.dispose();}const kinds=new Map();for(const structure of structures){const key=structure.kind+'|'+(structure.surface||'');if(!kinds.has(key))kinds.set(key,[]);kinds.get(key).push(structure);}for(const [key,list] of kinds){const kind=list[0].kind;if(kind==='tree'){this.addTreeInstances(list);continue;}if(kind==='house'){this.addHouseInstances(list);continue;}const dimensions=originalBuildSizes[kind]||[2,2,2],mesh=new THREE.InstancedMesh(buildGeometry(kind),buildMaterial(list[0].surface),list.length);list.forEach((structure,index)=>{const variant=structure.variant||0,temp=1+(variant%3)*.08;tempPosition.set(structure.position[0],structure.position[1]+dimensions[1]*temp/2,structure.position[2]);tempQuaternion.setFromEuler(new THREE.Euler(0,structure.rotation||0,0));tempScale.set(dimensions[0]*temp,dimensions[1]*temp,dimensions[2]);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);mesh.setMatrixAt(index,tempMatrix);});mesh.instanceMatrix.needsUpdate=true;mesh.userData.records=list;mesh.userData.baseMatrices=list.map((_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;});list.forEach((_,i)=>mesh.setColorAt(i,new THREE.Color('#ffffff')));mesh.instanceColor.needsUpdate=true;mesh.name=`${kind} structures`;this.structureGroup.add(mesh);}this.registerStructureMeshes();}
  registerStructureMeshes(){
    for(const mesh of this.structureGroup.children){
     if(!mesh.isInstancedMesh||!Array.isArray(mesh.userData.records))continue;
     const records=mesh.userData.records;
     // Preserve UNWORN reference transforms/material colors for future HP
     // updates; never compound permanent damage scale onto old transforms.
     mesh.userData.pristineMatrices??=records.map((_,i)=>{
      const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);return matrix;
     });
     mesh.userData.pristineColors??=records.map((_,i)=>{
      const color=new THREE.Color('#ffffff');
      if(mesh.instanceColor)mesh.getColorAt(i,color);
      return color;
     });
     mesh.userData.baseMatrices=records.map((record,i)=>{
      const matrix=mesh.userData.pristineMatrices[i].clone();
      const maxHp=record.maxHp|| (record.kind==='house'?220:record.kind==='tree'?90:140);
      const wear=THREE.MathUtils.clamp(1-(record.hp??maxHp)/maxHp,0,1);
      if(wear){
       matrix.decompose(tempPosition,tempQuaternion,tempScale);
       const direction=hashText(record.id)%2?1:-1;
       tempQuaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(wear*.11,0,wear*.28*direction)));
       tempPosition.y-=wear*tempScale.y*.09;
       tempScale.multiply(new THREE.Vector3(1-wear*.12,1-wear*.32,1-wear*.14));
       matrix.compose(tempPosition,tempQuaternion,tempScale);
       mesh.setMatrixAt(i,matrix);
      }
      return matrix;
     });
     mesh.userData.baseColors=records.map((record,i)=>{
      const color=mesh.userData.pristineColors[i].clone();
      const maxHp=record.maxHp|| (record.kind==='house'?220:record.kind==='tree'?90:140);
      const wear=THREE.MathUtils.clamp(1-(record.hp??maxHp)/maxHp,0,1);
      // Scarred surfaces darken persistently while each hit also shakes
      // the object and throws chips. Damage is reconstructed from world HP.
      color.lerp(new THREE.Color('#332328'),wear*.68);
      mesh.setColorAt(i,color);
      return color.clone();
     });
     mesh.instanceMatrix.needsUpdate=true;
     mesh.instanceColor.needsUpdate=true;
    }
   }
  addTreeInstances(list){const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.28,.42,3.2,7),new THREE.MeshStandardMaterial({color:'#43382b',roughness:1}),list.length),crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4,1),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95,vertexColors:false}),list.length),color=new THREE.Color();list.forEach((structure,index)=>{const variant=structure.variant||0,height=1+(variant%4)*.12;tempPosition.set(structure.position[0],structure.position[1]+1.6*height,structure.position[2]);tempQuaternion.setFromEuler(new THREE.Euler(0,structure.rotation||0,0));tempScale.set(1,height,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);trunks.setMatrixAt(index,tempMatrix);tempPosition.y=structure.position[1]+3.65*height;tempScale.set(1+(variant%2)*.22,1.25+(variant%3)*.18,1+(variant%2)*.22);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);crowns.setMatrixAt(index,tempMatrix);crowns.setColorAt(index,color.set(['#465b3d','#596a3b','#3f6249','#66704a'][variant%4]));});trunks.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate=true;if(crowns.instanceColor)crowns.instanceColor.needsUpdate=true;trunks.userData.records=list;crowns.userData.records=list;this.structureGroup.add(trunks,crowns);}
  addHouseInstances(list){const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.96,vertexColors:false}),list.length),roofs=new THREE.InstancedMesh(new THREE.ConeGeometry(3.45,1.7,4),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9,vertexColors:false}),list.length),doors=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#211e19',roughness:.88}),list.length),color=new THREE.Color();list.forEach((structure,index)=>{const variant=structure.variant||0,width=4.7+(variant%2)*.65,depth=3.8+(variant%3)*.3,height=3.4+(variant%2)*.45,yaw=structure.rotation||0;tempQuaternion.setFromEuler(new THREE.Euler(0,yaw,0));tempPosition.set(structure.position[0],structure.position[1]+height/2,structure.position[2]);tempScale.set(width,height,depth);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);walls.setMatrixAt(index,tempMatrix);walls.setColorAt(index,color.set(['#c6a5dc','#edc2d6','#b5d8d1','#dcc6eb'][variant%4]));tempPosition.y=structure.position[1]+height+.8;tempQuaternion.setFromEuler(new THREE.Euler(0,yaw+Math.PI/4,0));tempScale.set(width/5.4,1,depth/5.4);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);roofs.setMatrixAt(index,tempMatrix);roofs.setColorAt(index,color.set(['#9773ad','#b87e9a','#6b9fa5','#a088ba'][variant%4]));tempQuaternion.setFromEuler(new THREE.Euler(0,yaw,0));const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));tempPosition.set(structure.position[0]+forward.x*(depth/2+.03),structure.position[1]+1.05,structure.position[2]+forward.z*(depth/2+.03));tempScale.set(.85,2.1,.12);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);doors.setMatrixAt(index,tempMatrix);});for(const mesh of [walls,roofs,doors])mesh.instanceMatrix.needsUpdate=true;if(walls.instanceColor)walls.instanceColor.needsUpdate=true;if(roofs.instanceColor)roofs.instanceColor.needsUpdate=true;for(const mesh of [walls,roofs,doors])mesh.userData.records=list;this.structureGroup.add(walls,roofs,doors);}
  syncPlants(){const plants=this.world?.plants||[],signature=plants.map(plant=>plant.id).join('|');if(signature===this.plantSignature)return;this.plantSignature=signature;while(this.plantGroup.children.length){const child=this.plantGroup.children[0];child.removeFromParent();if(child.isInstancedMesh)child.dispose();child.geometry?.dispose();child.material?.dispose();}if(!plants.length)return;const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.025,.05,1,6),new THREE.MeshStandardMaterial({color:'#41573a',roughness:1}),plants.length),blooms=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.18,1),new THREE.MeshStandardMaterial({roughness:.72,vertexColors:false,emissive:'#15140b'}),plants.length),color=new THREE.Color(),branches=[];plants.forEach((plant,index)=>{const seed=hashText(plant.id),height=.65+(seed%7)*.08,x=plant.position[0],z=plant.position[2];tempQuaternion.setFromEuler(new THREE.Euler(0,seed*.01,0));tempPosition.set(x,height/2,z);tempScale.set(1,height,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);stems.setMatrixAt(index,tempMatrix);tempPosition.set(x,height+.13,z);tempScale.setScalar(.8+(seed%4)*.09);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);blooms.setMatrixAt(index,tempMatrix);blooms.setColorAt(index,color.set(['#d1b76c','#86b88a','#b08bc0','#d38f82'][seed%4]));const parent=plant.parentId&&plants.find(entry=>entry.id===plant.parentId);if(parent)branches.push(parent.position[0],.18,parent.position[2],x,.18,z);});stems.instanceMatrix.needsUpdate=blooms.instanceMatrix.needsUpdate=true;if(blooms.instanceColor)blooms.instanceColor.needsUpdate=true;stems.userData.records=plants;blooms.userData.records=plants;this.plantGroup.add(stems,blooms);if(branches.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(branches,3));this.plantGroup.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#647854',transparent:true,opacity:.55})));}}
  syncMonster(){this.islandEnemies.cityDamage=this.world?.cityDamage||{};this.islandEnemies.sync(this.world?.monster,this.world?.monsters||[]);this.monster=this.islandEnemies.current;}
  update(dt,time,camera,playerRoots=new Map(),viewerRoot=null){
    this.presentation.beforeAnimation();const frameNow=performance.now(),wallNow=Date.now();for(const root of playerRoots.values())updateHitFlash(root,frameNow);
    this.clock=time;this.displayPlatforms?.update(time);this.scene.userData.moonlitSky?.update(camera,time);this.grass?.update(time,playerRoots);this.outerCity?.syncDamage(this.world?.cityDamage||EMPTY_CITY_DAMAGE);this.outerCity?.update(time,dt,camera);for(const mixer of this.mixers)mixer.update(dt);if(this.dust){this.dust.rotation.y=time*.004;const positions=this.dust.geometry.attributes.position.array;for(let i=1;i<positions.length;i+=3){positions[i]+=dt*.025;if(positions[i]>22)positions[i]=0;}this.dust.geometry.attributes.position.needsUpdate=true;}if(this.water)this.water.material.opacity=.72+Math.sin(time*1.4)*.05;
    if(this.coinMesh&&this.world){PLATFORMS.forEach((p,i)=>{const available=this.world.coins?.[p.id]?.available;tempPosition.fromArray(p.coinPosition);const fly=this.coinFlights?.get(p.id);if(fly)fly.age+=dt;const t=fly?fly.age/.8:1;if(fly&&t>=1)this.coinFlights.delete(p.id);tempPosition.y=fly?fly.y+Math.min(1,t)*5:tempPosition.y+Math.sin(time*1.8+i)*.4;tempQuaternion.setFromEuler(tempEuler.set(0,time*(fly?6:2)+i,0));tempScale.setScalar(fly?1.6*Math.max(0,1-t):available?1.6:0);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);this.coinMesh.setMatrixAt(i,tempMatrix);});this.coinMesh.instanceMatrix.needsUpdate=true;}
    for(const mesh of this.heartDrops.values()){
      const seed=mesh.userData.seed;mesh.position.y=mesh.userData.baseY+.32*Math.sin(time*2.1+seed);
      mesh.rotation.set(.09*Math.sin(time*.9+seed),time*1.55+seed,.10*Math.sin(time*1.1+seed));
     }
     for(const mesh of this.dropMeshes){const shape=mesh.userData.dropShape;mesh.userData.records.forEach((drop,i)=>setDropMatrix(mesh,drop,i,shape,time));mesh.instanceMatrix.needsUpdate=true;}
    for(let i=this.dropCoinFlights.length-1;i>=0;i--){
     const fly=this.dropCoinFlights[i];fly.age+=dt;
     const t=Math.min(1,fly.age/.8),ease=1-(1-t)*(1-t);
     fly.mesh.position.y=fly.startY+5*ease;
     fly.mesh.rotation.set(0,fly.spin+fly.age*13,fly.age*2.5);
     fly.mesh.scale.setScalar(1.6*(1-t)**1.25);
     if(t>=1){fly.mesh.removeFromParent();this.dropCoinFlights.splice(i,1);}
    }
    for(const id of this.world?.removedArtworkIds||[]){const gone=this.artworks.get(id);if(gone)gone.visible=false;}
    for(const p of this.artworkRenderDefinitions()){const root=this.artworks.get(p.id),state=this.world?.artworks?.[p.id];if(!root||!state||root.userData.editing)continue;const layout=this.world?.artworkLayout?.[p.id]||this.defaultLayout[p.id]||{position:p.artPosition,rotation:[0,p.artYaw,0],scale:[1,1,1]};root.userData.titleOverride=layout.title;root.userData.authorOverride=layout.author;const d=root.userData,prior=d.frameAppearanceInputs;if(!prior||prior.appearance!==layout.appearance||prior.preview!==d.previewAppearance||prior.title!==layout.title||prior.author!==layout.author||prior.record!==d.record||prior.recordTitle!==d.record?.title||prior.draft!==d.editTitleDraft||prior.applied!==d.appearanceSignature||prior.plate!==d.titlePlateSignature){applyArtworkAppearance(root,layout.appearance);d.frameAppearanceInputs={appearance:layout.appearance,preview:d.previewAppearance,title:layout.title,author:layout.author,record:d.record,recordTitle:d.record?.title,draft:d.editTitleDraft,applied:d.appearanceSignature,plate:d.titlePlateSignature};}const now=wallNow,visual=artworkRenderFlight(state,this.localArtworkFlights.get(p.id),now);if(!visual.local)this.localArtworkFlights.delete(p.id);if(visual.waiting){root.visible=false;continue;}const holder=state.holder&&playerRoots.get(state.holder);if(holder&&!visual.local){root.visible=true;root.position.copy(holder.position);root.position.y+=1.6;root.rotation.set(0,holder.rotation.y+Math.PI,Math.sin(time*2)*.05);root.scale.fromArray(layout.scale).multiplyScalar(.48);continue;}root.scale.fromArray(layout.scale);const flight=visual.event;if(flight&&root.userData.flightId!==flight.id){root.userData.flightId=flight.id;root.userData.flightLanding=artworkLanding(flight,(x,z,y)=>this.groundHeight(x,z,y));}if(flight&&now-flight.time<root.userData.flightLanding.time*1000){const age=Math.max(0,(now-flight.time)/1000);root.visible=true;root.position.fromArray(artworkPosition(flight,age));root.rotation.set(...layout.rotation);continue;}const available=Date.now()>=(state.availableAt||0);root.visible=available;if(available){root.position.fromArray(layout.position);root.position.y+=Math.sin(time*.72+p.index)*(this.artFloat??.17);root.rotation.set(...layout.rotation);}}
    // Use the physical local avatar as the distance origin, NOT the zoomable
    // camera. Held / airborne artworks still use their current world position.
    // No textures are regenerated and no shared player styling is changed.
    for(const root of this.artworks.values()){
     if(root.userData.titlePlate)updateArtworkTitleVisibility(root,viewerRoot?.position);
     const d=root.userData,v=d.video;if(!v)continue;
     const wanted=root.visible&&!document.hidden&&camera.position.distanceToSquared(root.position)<900;
     if(!wanted){if(d.videoPlaying||!v.paused)v.pause();d.videoPlaying=false;continue;}
     if(!d.videoPlaying&&performance.now()>=(d.videoRetryAt||0)){
      d.videoPlaying=true;v.play().catch(()=>{d.videoPlaying=false;d.videoRetryAt=performance.now()+1000;});
     }
    }
    if(this.monster?.visible&&this.world?.monster?.position){
      const before=this.monster.position.clone();
      // Durable Object snapshots arrive much slower than the render loop.
      // Sample the server-authored flight analytically every frame so all
      // three decreasing rebounds remain visible instead of being skipped.
      const flight=this.world.monster.panBlastFlight;
      const position=flight?samplePanBlastPosition(flight,Date.now()).position:this.world.monster.position;
      if(flight)this.monster.position.fromArray(position);
      else{
       tempPosition.fromArray(position);
       // Main boss position is also smoothed by arena-view, so use the
       // same physical building constraint as its island-enemies replicas.
       const proposed=this.monster.position.clone().lerp(tempPosition,1-Math.exp(-dt*8));
       if(!cityBlocked(proposed.x,proposed.z,proposed.y,this.world?.cityDamage||{},.58))
        this.monster.position.copy(proposed);
      }
      const change=this.monster.position.clone().sub(before);
      let near=null,nearestDistance=18*18;for(const actor of playerRoots.values()){const distance=actor.position.distanceToSquared(this.monster.position);if(distance<nearestDistance){nearestDistance=distance;near=actor;}}
      if(near)this.monster.rotation.y=Math.atan2(near.position.x-this.monster.position.x,near.position.z-this.monster.position.z);
      else if(change.lengthSq()>.00005)this.monster.rotation.y=Math.atan2(change.x,change.z);
     }
    for(let burstIndex=this.debrisBursts.length-1;burstIndex>=0;burstIndex--){const burst=this.debrisBursts[burstIndex];burst.userData.age+=dt;burst.userData.pieces.forEach((piece,index)=>{piece.velocity.y-=12*dt;piece.position.addScaledVector(piece.velocity,dt);if(piece.position.y<.12){piece.position.y=.12;piece.velocity.y*=-.28;piece.velocity.x*=.72;piece.velocity.z*=.72;}tempPosition.copy(piece.position);tempQuaternion.setFromEuler(tempEuler.set(piece.spin.x*burst.userData.age,piece.spin.y*burst.userData.age,piece.spin.z*burst.userData.age));tempScale.setScalar(Math.max(.05,1-burst.userData.age/2.6));tempMatrix.compose(tempPosition,tempQuaternion,tempScale);burst.setMatrixAt(index,tempMatrix);});burst.instanceMatrix.needsUpdate=true;burst.material.opacity=Math.max(0,1-burst.userData.age/2.6);if(burst.userData.age>=2.6){burst.removeFromParent();burst.dispose();burst.geometry.dispose();burst.material.dispose();this.debrisBursts.splice(burstIndex,1);}}
    for(let i=this.collapsingShells.length-1;i>=0;i--){
      const shell=this.collapsingShells[i],age=shell.userData.age+=dt,t=Math.min(1,age/1.6);
      const ease=t*t*(3-2*t);
      shell.rotation.z=shell.userData.direction*ease*.85;
      shell.rotation.x=ease*.18;
      shell.position.y-=dt*2.2*ease;
      shell.scale.set(1-.18*ease,Math.max(.04,1-.92*ease),1-.18*ease);
      shell.traverse(part=>{if(part.isMesh&&part.material)part.material.opacity=Math.max(0,1-t*t);});
      if(t>=1){disposeVisual(shell);this.collapsingShells.splice(i,1);}
    }
    this.animateStructureHits();
    this.islandEnemies.update(dt,Date.now(),this.renderer.domElement.height,camera);
    const plants=this.world?.plants||EMPTY_PLANTS;
    if(this.insectPlantSource!==plants){this.insectPlantSource=plants;this.insects?.sync(plants);}
    this.insects?.update(time);
    // Monster bodies spin independent of the normal AI-facing direction.
     const spinNow=Date.now();
     for(const [mob,root] of [[this.world?.monster,this.monster],...
       (this.islandEnemies.extraLive||[]).map(e=>[e.state,e.root])]){
      const spin=mob?.vortexSpin;
      if(root&&spin&&spinNow<spin.time+2000)
       root.rotation.y=(spinNow-spin.time)/2000*Math.PI*4;
     }
     this.presentation.update(dt,time,camera,this.world);this.adventure.update(dt,time,playerRoots,camera);if(time-this.lastLightUpdate>.35){this.lastLightUpdate=time;this.updateArtLights(camera);}
  }
  updateArtLights(camera){const visible=[...this.artworks.values()].filter(o=>o.visible).sort((a,b)=>a.position.distanceToSquared(camera.position)-b.position.distanceToSquared(camera.position));this.lightPool.forEach((light,i)=>{const art=visible[i];light.intensity=art?(i?18:24):0;if(art){light.position.copy(art.position).add(new THREE.Vector3(0,2,2.5));light.color.set(i%2?'#d6dfff':'#ffe1b8');}});}
  pauseArtworkVideos(){for(const root of this.artworks.values()){const d=root.userData;if(d.video){d.video.pause();d.videoPlaying=false;}}}
  artworkRenderDefinitions(){
   // Only custom artwork definitions and layout affect this render cache.
   // HP, combat, coin and other world revisions do not invalidate it.
   const custom=this.world?.customArtworks,layout=this.world?.artworkLayout,removed=this.world?.removedArtworkIds;
   if(this.artworkRenderCustom!==custom||this.artworkRenderRemoved!==removed||!this.artworkRenderList){
    this.artworkRenderRemoved=removed;
    this.artworkRenderCustom=custom;this.artworkRenderList=artworkDefinitions(this.world);
    this.artworkRenderRevision=(this.artworkRenderRevision||0)+1;
   }
   if(this.artworkRenderLayout!==layout){
    this.artworkRenderLayout=layout;this.artworkRenderRevision=(this.artworkRenderRevision||0)+1;
   }
   return this.artworkRenderList;
  }
  nearest(position){
    if(!this.world)return null;
    let artwork=null,candidate=null;
    const consider=(type,id,distance)=>{if(distance<4.4&&(!candidate||distance<candidate.distance))candidate={type,id,distance};};
    const now=Date.now();
    for(const p of this.artworkRenderDefinitions()){
      const art=this.world.artworks?.[p.id],coin=this.world.coins?.[p.id];
      const layout=this.world.artworkLayout?.[p.id];
      const artPosition=layout?.position||p.artPosition;
      const reach=artworkPickupReach(layout);
      // A large displayed work must remain reachable at its visible edge,
      // and decorative structures cannot mask an available artwork.
      if(art&&!art.holder&&now>=(art.availableAt||0)&&
         Math.abs((position[1]||0)-artPosition[1])<=reach.vertical){
        const distance=distance2d(position,artPosition);
        if(distance<=reach.horizontal&&(!artwork||distance<artwork.distance))artwork={type:'artwork',id:p.id,distance};
      }
      if(coin?.available)consider('coin',p.id,distance2d(position,p.coinPosition));
    }
    if(artwork)return artwork;
    for(const drop of this.world.groundDrops||[])consider('drop',drop.id,distance2d(position,drop.position));
    for(const structure of this.world.structures||[])consider('structure',structure.id,distance2d(position,structure.position));
    for(const plant of this.world.plants||[])consider('plant',plant.id,distance2d(position,plant.position));
    return candidate;
  }
  groundHeight(x,z,y=0){
    const platforms=this.displayPlatforms?.ground(x,z,y)||0;
    const city=cityGroundHeight(x,z,y,this.world?.cityDamage||this.outerCity?.damage||{});
    return Math.max(platforms,city);
  }
  blocked(x,z,y=0){if(cityBlocked(x,z,y,this.world?.cityDamage||this.outerCity?.damage||{}))return true;for(const s of this.world?.structures||[]){const dims={cube:[2,2,2],bar:[6,2,2],cylinder:[2,2,2],wall:[5,2.5,.45],column:[1.4,4,1.4],platform:[4,.7,4],house:[5,3.8,4],tree:[1.2,4,1.2]}[s.kind]||[2,2,2];if(y<dims[1]&&Math.abs(x-s.position[0])<dims[0]/2+.35&&Math.abs(z-s.position[2])<dims[2]/2+.35)return true;}return false;}
}

function direction(name){return {east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]}[name]||[1,0];}
function hashText(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}
function setDropMatrix(mesh,drop,index,shape,time){tempPosition.set(...drop.position);tempPosition.y+=(shape==='cash'?.85:.55)+Math.sin(time*2+index)*.12;if(shape==='cash')tempQuaternion.setFromEuler(tempEuler.set(.20+Math.sin(time*1.1+index)*.13,time*.7+index,.15));else tempQuaternion.setFromEuler(tempEuler.set(time*.25,time*.85+index,0));tempScale.setScalar(shape==='coin'?1.6:shape==='weapon'?.9:1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);mesh.setMatrixAt(index,tempMatrix);}
function previewMeshes(kind,material){const mesh=(geometry,x=0,y=0,z=0)=>{const value=new THREE.Mesh(geometry,material.clone());value.position.set(x,y,z);return value;};if(kind==='art-bomb')return [mesh(new THREE.BoxGeometry(3,3,.16),0,1.5,0)];if(kind==='tree')return [mesh(new THREE.CylinderGeometry(.28,.42,3.2,7),0,1.6,0),mesh(new THREE.IcosahedronGeometry(1.4,1),0,3.7,0)];if(kind==='house')return [mesh(new THREE.BoxGeometry(4.8,3.4,3.8),0,1.7,0),mesh(new THREE.ConeGeometry(3.45,1.7,4),0,4.25,0)];const dimensions=originalBuildSizes[kind]||[2,2,2];return [mesh(kind==='cylinder'?new THREE.CylinderGeometry(dimensions[0]/2,dimensions[0]/2,dimensions[1],24):new THREE.BoxGeometry(...dimensions),0,dimensions[1]/2,0)];}
function disposeArtworkRoot(root){
 if(!root)return;
 const video=root.userData.video;
 if(video){video.pause();video.removeAttribute('src');video.load();}
 releaseArtworkAnimation(root);
 const geometries=new Set(),materials=new Set(),textures=new Set();
 root.traverse(obj=>{
  if(obj.isInstancedMesh)obj.dispose();
  if(obj.isSkinnedMesh)obj.skeleton?.dispose?.();
  if(obj.geometry)geometries.add(obj.geometry);
  for(const mat of Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[]){
   materials.add(mat);
   for(const val of Object.values(mat))if(val?.isTexture)textures.add(val);
  }
 });
 root.removeFromParent();
 for(const g of geometries)g.dispose();
 for(const m of materials)m.dispose();
 for(const tex of textures)tex.dispose();
}
function disposeChildren(group){for(const child of [...group.children]){group.remove(child);disposeArtworkRoot(child);}}
function seededRandom(seed){let state=seed||1;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
function fitObject(object,height){const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),scale=height/Math.max(.001,size.y);object.scale.multiplyScalar(scale);box.setFromObject(object);const center=box.getCenter(new THREE.Vector3());object.position.x-=center.x;object.position.z-=center.z;object.position.y-=box.min.y;return object;}
function tintCharacter(model,color,admin){
  const tint=new THREE.Color(color);model.traverse(node=>{if(!node.isMesh)return;node.frustumCulled=false;const sources=Array.isArray(node.material)?node.material:[node.material];const materials=sources.map(source=>{const material=source.clone();material.color?.set('#ffffff');material.envMapIntensity=.6;material.onBeforeCompile=shader=>{shader.uniforms.templeTint={value:tint};shader.fragmentShader='uniform vec3 templeTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec3 templeSource = diffuseColor.rgb;
        float templeCool = smoothstep(0.02, 0.12, min(templeSource.g, templeSource.b) - templeSource.r);
        templeCool *= smoothstep(0.2, 0.5, templeSource.b / max(templeSource.g, 0.0001));
        float templeShade = clamp(dot(templeSource, vec3(0.2126, 0.7152, 0.0722)) / 0.65, 0.58, 1.3);
        diffuseColor.rgb = mix(templeSource, templeTint * templeShade, templeCool);
      `);};material.customProgramCacheKey=()=>'temple-player-tint-v2';if(material.emissive){material.emissive.set(0);material.emissiveIntensity=0;}material.needsUpdate=true;return material;});node.material=Array.isArray(node.material)?materials:materials[0];});
}
function makeNameSprite(name,admin){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const context=canvas.getContext('2d');context.font='700 46px Arial, sans-serif';context.textAlign='center';context.textBaseline='middle';context.shadowColor='#000';context.shadowBlur=14;context.fillStyle=admin?'#f0cd65':'#f5eed8';context.fillText(String(name||'Pilgrim').slice(0,24),256,58);context.font='600 22px system-ui';context.fillStyle=admin?'#f0cd65':'#9cc9bd';context.fillText(admin?'GM':'',256,101);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));sprite.scale.set(2.5,.63,1);sprite.renderOrder=8;return sprite;}
import {updateHitFlash} from './hit-flash.js';
