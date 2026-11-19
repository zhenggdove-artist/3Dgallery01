import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createFlexibleGiraffe,animateFlexibleGiraffe} from '../src/reletter/flexible-giraffe.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {artworkPosition} from '../src/shared/artwork-flight.js';
import {itemById} from '../src/shared/catalog.js';
import {pvpShotDamage} from '../src/shared/combat-balance.js';
import {cityCollisionCandidates,CITY_LOTS} from '../src/shared/city-layout.js';
import {meleeDuration} from '../src/reletter/melee-motion.js';

const T=15_230_000;
const fighter=(key,position)=>({key,name:key,color:'#aaaaaa',position,role:'fighter',admin:false});
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('giraffe is a real GPU-skinned rubber rod and joints continue bending in mid-air',()=>{
 const held=createFlexibleGiraffe(THREE);
 const mesh=held.children.find(child=>child.isSkinnedMesh);
 assert.ok(mesh,'entire long body must deform, not rotate as one rigid object');
 assert.ok(mesh.skeleton.bones.length>=8);
 assert.ok(mesh.geometry.attributes.skinWeight&&mesh.geometry.attributes.skinIndex);
 for(let i=1;i<=16;i++)animateFlexibleGiraffe(held,i/60,1,false);
 assert.ok(held.userData.flexBones.some(b=>Math.abs(b.rotation.z)>.015),'held rod bends');
 const airborne=createFlexibleGiraffe(THREE);
 for(let i=1;i<=18;i++)animateFlexibleGiraffe(airborne,i/60,1,true);
 assert.ok(airborne.userData.flexBones.some(b=>Math.abs(b.rotation.x)>.015),'airborne rod has elastic lag');
 const signature=source('src/weapon-signature-effects.js');
 assert.match(signature,/animateFlexibleGiraffe\(giraffe,age,1,true\)/);
 assert.match(signature,/flexBones\[5\]\.add\(nativeElectric\.group\)/);
});

test('giraffe charged collision is wider than the visible revolving rod and deals 3x power',()=>{
 const item=itemById('giraffe');
 assert.equal(item.cooldown,310);
 const baseline=pvpShotDamage({...item,id:'legacy-giraffe'}, {ultimate:true,radius:12}, {tier:3});
 const triple=pvpShotDamage(item,{ultimate:true,radius:12},{tier:3});
 assert.equal(triple,+(baseline*3).toFixed(3));
 const world=createInitialWorld(T),attacker=fighter('thrower',[45,0,0]),
  defender=fighter('defender',[45,0,25]);
 const user=ensureProfile(world,'thrower','thrower','#aaaaaa',T);
 const victim=ensureProfile(world,'defender','defender','#aaaaaa',T);
 user.inventory.push('giraffe');user.equipment.weapon='giraffe';
 victim.spawnProtectedUntil=0;
 assert.equal(applyAction(world,attacker,{action:'attack',phase:'charge'},{now:T+3000}).charging,true);
 const attack=applyAction(world,attacker,{action:'attack',direction:[0,0,1],charge:1},
  {now:T+6000,actors:[attacker,defender],rng:()=>.7});
 assert.ok(attack.attackEvent.ultimate,JSON.stringify(attack));
 const fx=world.persistentAttacks.find(v=>v.kind==='giraffe');
 assert.ok(fx.radius>=5.9*1.85,'server collision uses actual revolving rod width');
 assert.ok(fx.damage>0);
 assert.equal(victim.hp,100,'ultimate hit is not applied before the rod touches');
 tickWorld(world,{now:T+6650,actors:[attacker,defender],activeFighters:0,rng:()=>.7});
 assert.ok(victim.hp<100,'outbound sweep touches defender');
});

test('artwork does not damage fighters or collapse buildings until actual ballistic collision',()=>{
 const world=createInitialWorld(T),caster=fighter('caster',[45,0,0]),
  victim=fighter('victim',[45,0,30]);
 const from=ensureProfile(world,'caster','caster','#aaaaaa',T),
  to=ensureProfile(world,'victim','victim','#aaaaaa',T);
 to.spawnProtectedUntil=0;
 const id=Object.keys(world.artworks)[0];world.artworks[id].holder='caster';
 world.structures=[{id:'nearby-house',kind:'house',position:[45,0,30],
  rotation:0,owner:'player',hp:120,maxHp:120}];
 const fired=applyAction(world,caster,{action:'throw-artwork',direction:[0,0,1],power:1},
  {now:T+4000,actors:[caster,victim],rng:()=>.8});
 assert.ok(fired.throwEvent);
 assert.equal(fired.hit,undefined);
 assert.equal(to.hp,100);
 assert.equal(world.structures[0].hp,120);
 assert.equal(world.pendingArtworkFlights.length,1);
 assert.equal(Math.round(artworkPosition(fired.throwEvent,.6)[2]),30);
 tickWorld(world,{now:T+4250,actors:[caster,victim],activeFighters:0,rng:()=>.8});
 assert.equal(to.hp,100,'victim must not react to a distant thrown artwork');
 assert.equal(world.structures[0].hp,120,'house must not collapse before contact');
 tickWorld(world,{now:T+4700,actors:[caster,victim],activeFighters:0,rng:()=>.8});
 assert.ok(to.hp<100,'fighter damage begins after actual flight crosses target');
 assert.ok(world.structures[0].hp<120,'building damage begins at impact, not launch');
 assert.ok(world.pendingArtworkVisualEvents.some(e=>e.kind==='structure-hit'));
});

test('all non-saber melee swings recover rapidly and music note particles are visibly enlarged',()=>{
 for(const family of ['whip','swatter','pan','planter','palm']){
  const item=itemById(family+'-1');
  assert.ok(item.cooldown<=265,family+' should not have a long gap between hits');
  assert.ok(meleeDuration(family,0)<=.28,family+' animation supports quick successive hits');
 }
 for(const id of ['giraffe','accordion','clam'])assert.ok(itemById(id).cooldown<=310);
 const shader=source('src/reletter/odd-weapon-effects.js');
 assert.match(shader,/pattern>4\.5&&pattern<5\.5\?12\.:5\./);
 const main=source('src/main.js');
 assert.match(main,/if\(weapon\?\.id==='goldfish'\)\{/);
 assert.match(main,/if\(charge>=1\)await performAttack\(1\)/);
 const css=source('fidelity-ui.css');
 assert.match(css,/#hud #chat-hud\{bottom:max\(160px/);
 assert.match(css,/bottom:max\(130px,env\(safe-area-inset-bottom\) \+ 116px\)/);
});

test('wide city sweep still uses spatial candidates, without losing distant houses',()=>{
 const lot=CITY_LOTS[0];
 const candidates=cityCollisionCandidates(lot.x+lot.width*.5+7,lot.z,9);
 assert.ok(candidates.includes(lot),'nearby house is not excluded by small-cell broadphase');
 assert.ok(candidates.length<CITY_LOTS.length/2,'large boomerang does not linearly scan every house');
});
