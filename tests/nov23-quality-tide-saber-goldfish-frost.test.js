import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,tickTidalChannels,worldView} from '../src/shared/temple-rules.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {chargedArea,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {weaponQuality,forwardCastRadius,channelVisualRadius} from '../src/shared/weapon-abilities.js';
import {GOLDFISH_SCHOOL_COUNT,GOLDFISH_DAMAGE_PER_FISH,
 GOLDFISH_T1_DAMAGE_PER_FISH,GOLDFISH_T1_TOTAL_MAX} from '../src/shared/goldfish-school.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const T=93_000_000;
const actor={key:'tide-caster',name:'Tide Caster',role:'fighter',
 color:'#ffffff',position:[75,0,0],seat:0};
test('shop groups only true tier variants; selected ID remains authoritative',()=>{
 const src=read('src/ui.js');
 assert.match(src,/shopVariantChoice/);
 assert.match(src,/data-shop-variant/);
 assert.match(src,/variants\.find\(v=>v\.id===this\.shopVariantChoice\[key\]\)/);
 assert.match(src,/data-\$\{owned\?'equip':'buy'\}/);
 assert.match(src,/SHOP_ITEMS/);
});
test('only real tide staff has a triple-width ultimate channel',()=>{
 const tide=itemById('tide-2'),starter=itemById('water');
 assert.ok(Math.abs(channelVisualRadius(tide)-3*1.05*weaponQuality(tide).visual)<.001);
 assert.equal(channelVisualRadius(starter),1.05);
});
test('three separate tide targets receive server-owned sustained damage, fourth does not',()=>{
 const world=createInitialWorld(T),profile=ensureProfile(world,actor.key,actor.name,actor.color,T);
 profile.inventory.push('tide-2');profile.equipment.weapon='tide-2';
 const target=(id,x,z)=>({id,active:true,model:'uncle',variant:'uncle',
  position:[x,0,z],hp:10000,maxHp:10000,nextAttackAt:T+100000,skills:[]});
 world.monster=target('mob-a',75,5);
 world.monsters=[target('mob-b',76,6),target('mob-c',74,7),target('mob-d',77,8)];
 const attack=(now,body)=>applyAction(world,actor,{action:'attack',direction:[0,0,1],...body},
  {now,actors:[actor],rng:()=>.5});
 assert.equal(attack(T+1000,{phase:'charge'}).charging,true);
 assert.equal(attack(T+4000,{phase:'channel-start'}).channeling,true);
 const shot=attack(T+4100,{phase:'channel',charge:1});
 assert.equal(shot.error,undefined);
 assert.ok(profile.tidalChannelStats);
 assert.equal(world.persistentAttacks.some(v=>v.owner===actor.key&&v.channel),false,
  'tide lock must not also hit with the old directional tube');
 tickTidalChannels(world,[actor],T+4150,()=>.5);
 assert.equal(world.tidalLocks[actor.key].targets.length,3);
 assert.equal(worldView(world,actor.key,T+4150).tidalLocks[actor.key].targets.length,3);
 const before=[world.monster.hp,...world.monsters.map(x=>x.hp)];
 tickTidalChannels(world,[actor],T+4500,()=>.5);
 const after=[world.monster.hp,...world.monsters.map(x=>x.hp)];
 assert.ok(after[0]<before[0]);assert.ok(after[1]<before[1]);
 assert.ok(after[2]<before[2]);assert.equal(after[3],before[3]);
 assert.equal(attack(T+4600,{phase:'channel-stop'}).channeling,false);
 assert.equal(world.tidalLocks[actor.key],undefined);
});
test('frost ultimate circle is one-third the previous diameter, shifted two new diameters',()=>{
 const frost=itemById('frost-2'),quality=weaponQuality(frost),
  raw=attackStats(frost,1);
 const radius=forwardCastRadius(frost,quality,raw.radius,true);
 const stats=scaleUltimateFootprint({...raw,range:raw.range*quality.range,radius},frost,quality);
 assert.ok(Math.abs(stats.radius-radius*.6*1.5/3)<.002);
 const origin=[75,1.16,0],direction=[0,0,1];
 const area=chargedArea(frost,origin,direction,stats,()=>0,true);
 assert.equal(area.mode,'area');
 const distanceWithoutFrostOffset=area.travel-stats.radius*4;
 assert.ok(Math.abs(area.center[2]-(distanceWithoutFrostOffset+stats.radius*4))<.002);
 assert.ok(area.center[2]>stats.radius*4);
});
test('five-wave yellow saber keeps its half-size ray with all native CPU debris disabled',()=>{
 const saber=itemById('saber-3'),base=attackStats(saber,1);
 const scaled=scaleUltimateFootprint({...base},saber);
 assert.ok(Math.abs(scaled.range-base.range*.6*.25)<.002);
 const vfx=read('src/numbered-weapon-effects.js');
 assert.match(vfx,/node\.isInstancedMesh/);
 assert.match(vfx,/nativeSaberPrototype\._updateDeterministicParticles/);
 assert.match(vfx,/quantity:SABER_WAVE_COUNT/);
});
test('goldfish direct hit cap halves again; visuals remain instanced',()=>{
 assert.equal(GOLDFISH_SCHOOL_COUNT,30);
 assert.equal(GOLDFISH_DAMAGE_PER_FISH,.05);
 assert.equal(GOLDFISH_T1_DAMAGE_PER_FISH,.75);
 assert.equal(GOLDFISH_T1_TOTAL_MAX,22.5);
 const fish=read('src/weapon-signature-effects.js');
 const server=read('src/shared/temple-rules.js');
 assert.match(fish,/new THREE\.InstancedMesh/);
 assert.match(fish,/vhsLine/);
 assert.match(fish,/goldfishBubbleBursts/);
 assert.match(fish,/goldfishMotion/);
 assert.match(server,/splitGoldfishDamageNumbers/);
});
