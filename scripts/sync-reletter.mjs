// Mechanical, reproducible extraction from the owner's RELETTER checkout.
// No RELETTER database, Worker or account code is copied or contacted.
import {readFile,writeFile,mkdir,copyFile,cp} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Pass the local RELETTER checkout path');
const dest=resolve('src/reletter');await mkdir(dest,{recursive:true});
const names=['equipment-catalog.js','weapon-effects.js','ultimate-effects.js','ultimate-art.js','melee-motion.js','novel-melee.js','headgear-model.js','outfit-model.js','garden-art.js','item-art.js','combat-traits.js','build-surfaces.js','build-shapes.js','fish-model.js','fish-art.js','fishing-presentation.js','fusion-effects.js','token-model.js','milk-model.js','milk-presentation.js','server/garden-rules.js','server/fishing-rules.js','server/combat-effects.js'];
const revision=await readFile(resolve(source,'.git/refs/heads/main'),'utf8').catch(()=>'working-tree');
const copied=new Set(),manifest={source:'zhenggdove-artist/RELETTER (owner local checkout)',revision:revision.trim(),files:{},fonts:{}};
async function vendor(name){if(copied.has(name))return;copied.add(name);const data=await readFile(resolve(source,name));await mkdir(dirname(resolve(dest,name)),{recursive:true});await copyFile(resolve(source,name),resolve(dest,name));manifest.files[name]=createHash('sha256').update(data).digest('hex');for(const match of data.toString().matchAll(/from\s+['"](\.{1,2}\/.*?\.js)['"]/g))await vendor(relative(source,resolve(source,dirname(name),match[1])).replaceAll('\\','/'));}
for(const name of [...names,'odd-weapon-art.js','odd-weapon-effects.js','fusion-catalog.js','server/fusion-rules.js'])await vendor(name);
await cp(resolve(source,'art'),resolve('art'),{recursive:true});
await mkdir(resolve(dest,'art'),{recursive:true});
for(const name of ['guardian-points.json','guardian-run.bin','guardian-body.jpg','guardian-face-reference.png','foreman-rig.glb','foreman-reference.png'])await copyFile(resolve(source,'art',name),resolve(dest,'art',name));
const html=(await readFile(resolve(source,'index.html'),'utf8')).replaceAll('\r\n','\n');
const fonts=[...html.matchAll(/@font-face\s*\{[^}]+\}/g)].map(m=>m[0]);
await writeFile(resolve(dest,'fonts.css'),fonts.join('\n'));
await mkdir(resolve(dest,'FONTS'),{recursive:true});
for(const match of fonts.join('\n').matchAll(/url\(["'](FONTS\/[^"']+)["']\)/g)){const name=match[1];const data=await readFile(resolve(source,name));await copyFile(resolve(source,name),resolve(dest,name));manifest.fonts[name]=createHash('sha256').update(data).digest('hex');}
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);if(start<0||end<0)throw Error('Source markers changed: '+a);return html.slice(start,end);}
const plants=section('const PASTEL_PINK','// ===== Independent RELETTER persistence')+section('// ===== Seeded Random =====','// ===== THREE.js Scene =====');
await writeFile(resolve(dest,'plants.js'),"// Extracted verbatim from RELETTER index.html; only module boundary added.\nimport * as THREE from 'three';\nlet groundClip=null;\n"+plants+'\nexport {makePlant};\n');
const held=section('const boneCache=new WeakMap()','let fishingHUDActive=false;');
const novel=section('function makeNovelWeapon(item)','\n}\n')+'\n}\n';
await writeFile(resolve(dest,'held-weapons.js'),`// Extracted from RELETTER index.html. Host supplies time/fishing adapter only.
import * as THREE from 'three';
import {createToken} from './token-model.js';
import {createOddWeapon,animateOddWeapon} from './odd-weapon-art.js';
let globalTime=0;
const fstate=()=>({sessions:{}}),fishingPoseFor=()=>false;
function glowMaterial(color,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});}
export function setHeldTime(time){globalTime=time;}
${held}\n${novel}\nexport {makeHeldWeapon,makeNovelWeapon,attachHeldWeapon,rightHand};\n`);
const additions=(await readFile(resolve(source,'game-additions.js'),'utf8')).replaceAll('\r\n','\n');
const melee=additions.slice(additions.indexOf('const meleeEffects=[]'),additions.indexOf('const meleePositionRestore=[]'));
const projectile=section('function showEquipmentAttack(data)','function updateEquipmentEffects(dt)');
const projectileUpdate=section(' for(let j=equipmentFX.length-1;'," const players=[{character:selectedCharacter,root:charRoot,model:charModel}");
const glow=section("const glowCanvas=document.createElement('canvas')",'function showEquipmentAttack(data)');
await writeFile(resolve(dest,'combat-visuals.js'),`// Original RELETTER projectile shaders, particles and melee ribbons; scoped host adapter.
import * as THREE from 'three';
import {equipmentById} from './equipment-catalog.js';
import {meleeDuration,meleeTrailPattern,meleeMoveNames} from './melee-motion.js';
export function createOriginalCombatVisuals(scene,showSignatureBurst){
const equipmentFX=[],gameView={},selectedCharacter='',remotePlayers=new Map(),charRoot=new THREE.Group();
${glow}\n${projectile}\n${melee}
function update(dt){${projectileUpdate}\nupdateMeleeEffects(dt);}
function trim(list,max){while(list.length>max){const f=list.shift();f.group.removeFromParent();f.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}}
return {show(data){showEquipmentAttack({...data,hit:null});trim(equipmentFX,8);trim(meleeEffects,8);},update,meleeEffects,equipmentFX};
}\n`);
const fishing=(await readFile(resolve(source,'fishing-presentation.js'),'utf8')).replaceAll('\r\n','\n');
await writeFile(resolve(dest,'world-visuals.js'),`// Verbatim original crop, aquarium, fish, fishing pose/rod and loot builders.
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
${section('function makeCropModel(species,stage)','function waterCropVisual(position)')}
${section('function waterFeature(data,pond)','function syncAdventure()')}
${section('function aquariumFeature(data)','// Four hand-held garden weapons;')}
${fishing.slice(0,fishing.indexOf('const catchStyle='))}
${section('function updateFishingRods(f)','// Shared structural damage:')}
${section('const lootTextures=new Map();','let coinBagShared;')}
return {makeCropModel,waterFeature,swimmingFish,createItemDrop,disposeAdventure,
 beforeAnimation:restoreFishingPoses,
 sync(f,roots){fishing=f||{holes:[],ponds:[],sessions:{}};remotePlayers.clear();for(const [key,root] of roots)remotePlayers.set(key,{character:key,model:root.userData.model,root});syncFishingPoses(fishing);},
 update(dt,time){globalTime=time;applyFishingPoses();updateFishingPresentation(dt);updateFishingRods(fishing);}};
}\n`);
await writeFile(resolve(dest,'SOURCE.json'),JSON.stringify(manifest,null,2)+'\n');
await copyFile(resolve('node_modules/three/examples/jsm/controls/TransformControls.js'),resolve('vendor/three/examples/jsm/controls/TransformControls.js')).catch(async error=>{if(error.code!=='ENOENT')throw error;await mkdir(resolve('vendor/three/examples/jsm/controls'),{recursive:true});await copyFile(resolve('node_modules/three/examples/jsm/controls/TransformControls.js'),resolve('vendor/three/examples/jsm/controls/TransformControls.js'));});
console.log(`Vendored ${copied.size} original modules, ${fonts.length} fonts, plant generator and hand-held weapon functions.`);
