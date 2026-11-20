import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {insideSpellFootprint,spellFootprint} from '../src/shared/charge-area.js';
import {GOLDFISH_SCHOOL_COUNT,GOLDFISH_SCHOOL_OFFSETS,GOLDFISH_DAMAGE_PER_FISH,
 GOLDFISH_FISH_SCALE,goldfishSchoolPosition} from '../src/shared/goldfish-school.js';
const NOW=7600000;
const owner={key:'fish-owner',name:'fish-owner',role:'fighter',color:'#eeeeff',position:[65,0,0],seat:0};
function cast(primary,secondary=null){
 const world=createInitialWorld(NOW),actor={...owner},profile=ensureProfile(world,actor.key,actor.name,actor.color,NOW);
 profile.inventory.push(primary);profile.equipment.weapon=primary;
 if(secondary)profile.fusion[primary]={layer:1,effects:[secondary]};
 const args={actors:[actor],now:NOW+1000,rng:()=>.4};
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},args).charging,true);
 const release=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:1},
  {...args,now:NOW+4000});
 assert.equal(release.error,undefined);
 assert.ok(release.attackEvent?.ultimate);
 return {world,actor,profile,release};
}
test('school has thirty uneven fish, narrow ends, dense center and projectile-sized originals',()=>{
 assert.equal(GOLDFISH_SCHOOL_COUNT,30);
 assert.equal(GOLDFISH_SCHOOL_OFFSETS.length,30);
 assert.equal(GOLDFISH_DAMAGE_PER_FISH,.2);
 assert.ok(GOLDFISH_FISH_SCALE<.3);
 const middle=GOLDFISH_SCHOOL_OFFSETS.filter(p=>Math.abs(p[2])<1.8).length;
 const tips=GOLDFISH_SCHOOL_OFFSETS.filter(p=>Math.abs(p[2])>2.7).length;
 assert.ok(middle>tips*2);
 assert.ok(new Set(GOLDFISH_SCHOOL_OFFSETS.map(p=>p.map(v=>v.toFixed(3)).join(':'))).size===30);
 const a=goldfishSchoolPosition([65,3,0],[0,0,1],10);
 const b=goldfishSchoolPosition([65,3,0],[1,0,0],10);
 assert.ok(Math.abs(a[0]-65)<2);
 assert.ok(Math.abs(b[2])<2);
});
test('school follows only real forward targets; the caster can never be selected or damaged',()=>{
 const {world,actor,profile,release}=cast('goldfish');
 const fx=world.persistentAttacks.find(v=>v.kind==='goldfish');
 assert.ok(fx);
 world.monster={id:'off-axis-fish-target',active:true,model:'uncle',variant:'uncle',
  position:[71,0,10],hp:100000,maxHp:100000,skills:[],nextAttackAt:NOW+100000};
 const ownHp=profile.hp;
 tickWorld(world,{now:NOW+4700,actors:[actor],rng:()=>.5,activeFighters:0});
 assert.ok(fx.position[0]>65,'off-axis monster attracts school forward');
 assert.equal(fx.targetId,'off-axis-fish-target');
 assert.equal(profile.hp,ownHp);
 assert.ok(worldView(world,actor.key,NOW+4700).goldfishFlights.some(f=>f.id===release.attackEvent.persistentAttackId));
 const visual=readFileSync(new URL('../src/weapon-signature-effects.js',import.meta.url),'utf8');
 assert.match(visual,/new THREE\.InstancedMesh\(node\.geometry,node\.material,GOLDFISH_SCHOOL_COUNT\)/);
 assert.match(visual,/schoolScratch/);
});
test('borrowed circular whip explosion exactly matches primary circle center',()=>{
 const {release,world}=cast('pan-3','whip-1');
 const primary=release.attackEvent.area;
 const echo=release.attackEvent.fusionEchoes.find(e=>e.weapon==='whip-1');
 assert.ok(primary?.mode==='area');
 assert.ok(echo?.area?.mode==='area');
 assert.deepEqual(echo.area.visualCenter,primary.visualCenter);
 assert.deepEqual(echo.area.center,primary.center);
 assert.ok(echo.area.radius<=primary.radius);
 assert.ok(world.persistentAttacks.find(v=>v.id===echo.id).parentFootprint);
});
test('borrowed circular spell is anchored at far end of main rectangular warning',()=>{
 const {release}=cast('goldfish','whip-1');
 const echo=release.attackEvent.fusionEchoes.find(e=>e.weapon==='whip-1');
 assert.ok(echo?.area?.mode==='area');
 const box=echo.parentFootprint;
 assert.equal(box.shape,'rectangle');
 const forward=[Math.cos(box.yaw),-Math.sin(box.yaw)];
 const endpoint=[box.position[0]+forward[0]*box.length*.5,box.position[2]+forward[1]*box.length*.5];
 assert.ok(Math.hypot(echo.area.visualCenter[0]-endpoint[0],echo.area.visualCenter[2]-endpoint[1])<.001);
 assert.ok(echo.area.radius<=box.width*.5);
});
test('authoritative fusion hit clipping rejects every point outside the main warning',()=>{
 const circle={shape:'circle',position:[0,0,0],radius:5};
 const box={shape:'rectangle',position:[0,0,0],yaw:0,length:16,width:2};
 assert.equal(insideSpellFootprint(circle,[4,0,0]),true);
 assert.equal(insideSpellFootprint(circle,[5.1,0,0]),false);
 assert.equal(insideSpellFootprint(box,[8,0,0]),true);
 assert.equal(insideSpellFootprint(box,[1,0,1.1]),false);
 assert.equal(insideSpellFootprint(box,[-8.1,0,0]),false);
 const bag=readFileSync(new URL('../src/bag-view.js',import.meta.url),'utf8');
 assert.match(bag,/previewMarkup\(item\)/);
 assert.doesNotMatch(bag,/fallbackItemIcon|drawNext/);
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.doesNotMatch(main,/portraitViewport\.lastWidth=0;requestAnimationFrame/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/src\/shared\/goldfish-school\.js/);
});
