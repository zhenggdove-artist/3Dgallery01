import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,validateState} from '../src/shared/temple-rules.js';
import {attackStats,itemById} from '../src/shared/catalog.js';
import {SNIPER_RANGE,sniperHitsHead,pvpShotDamage,contactDamageIntervalMs,visibleCollisionLifetimeMs} from '../src/shared/combat-balance.js';
import {applyElementalHit,effectActive} from '../src/shared/combat-status.js';
import {ELEMENTAL_FILTERS} from '../src/elemental-status-visuals.js';
import {PLAYER_SPAWNS,SAFE_ZONE} from '../src/shared/arena.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {GOLDFISH_SWIM_RADIUS} from '../src/shared/weapon-abilities.js';

const NOW=930_000;
const actor=(key,position)=>({key,name:key,color:'#ffffff',role:'fighter',position,admin:false});
function room(weapon,victimPosition=[75,0,30]){
 const world=createInitialWorld(NOW),shooter=actor('shooter',[75,0,0]),target=actor('victim',victimPosition);
 const profile=ensureProfile(world,shooter.key,shooter.name,shooter.color,NOW);
 const victim=ensureProfile(world,target.key,target.name,target.color,NOW);
 if(!profile.inventory.includes(weapon))profile.inventory.push(weapon);
 profile.equipment.weapon=weapon;
 return {world,shooter,target,profile,victim};
}
function shoot(room,at,options={}){
 return applyAction(room.world,room.shooter,{action:'attack',direction:[0,0,1],...(room.profile.equipment.weapon==='black-cat'?{scoped:true}:{}),...options},
  {now:at,rng:()=>.99,actors:[room.shooter,room.target]});
}
function tick(room,at){
 return tickWorld(room.world,{now:at,rng:()=>.99,actors:[room.shooter,room.target],activeFighters:0});
}

test('new fighter spawns inside central message sanctuary without overlapping the tree',()=>{
 for(const p of PLAYER_SPAWNS){
  assert.ok(Math.hypot(p[0]-SAFE_ZONE.x,p[2]-SAFE_ZONE.z)<SAFE_ZONE.radius);
   assert.ok(Math.hypot(p[0]-SAFE_ZONE.x,p[2]-SAFE_ZONE.z)>3);
 }
});

test('sniper has full-map 256m range and exactly triple the previous 27 PvP base',()=>{
 const sniper=itemById('black-cat'),stats=attackStats(sniper,0);
 assert.equal(stats.range,SNIPER_RANGE);
 assert.equal(SNIPER_RANGE,256);
 assert.equal(pvpShotDamage(sniper,stats,{tier:1}),81);
 assert.ok(stats.damage>=itemById('white-cat').damage*3);
 assert.ok(sniperHitsHead([75,1,0],[0,1.02/Math.hypot(30,1.02),30/Math.hypot(30,1.02)],256,[75,0,30]));
 assert.equal(sniperHitsHead([75,1,0],[0,0,1],256,[75,0,30]),false);
});

test('server kills with a real sniper head ray even through armour/shield',()=>{
 const r=room('black-cat');
 r.victim.equipment.armor='relic-shell';
 r.victim.equipment.shield='shield-10';
 r.victim.shield={item:'shield-10',hp:500,lastHit:NOW+2000};
 const dy=1.02/Math.hypot(30,1.02),dz=30/Math.hypot(30,1.02),at=NOW+2000;
 const result=shoot(r,at,{direction:[0,dy,dz],origin:[75,1,0]});
 assert.equal(result.attackEvent.range,256);
 tick(r,at+320);
 assert.equal(r.victim.hp,0);
 assert.equal(r.victim.shield.hp,500,'verified lethal headshot ignores shield');
 const event=r.world.damageEvents.find(e=>e.target==='victim');
 assert.ok(event);
 assert.ok(event.amount>=100,'damage number displays the amount that caused the kill');
 assert.ok(event.kind==='headshot'||event.kind==='critical-headshot');
});

test('overkill float number shows incoming damage, never only 10 remaining HP',()=>{
 const r=room('black-cat');r.victim.hp=10;
 const at=NOW+2000;
 shoot(r,at);
 tick(r,at+320);
 assert.equal(r.victim.hp,0);
 const event=r.world.damageEvents.find(e=>e.target==='victim');
 assert.ok(event.amount>10,event?.amount);
 assert.ok(event.amount>=80);
});

test('electric paralysis denies attacks for 1.5 sec but allows movement, 5-sec effect lock',()=>{
 const v={key:'victim',hp:100,maxHp:100,effects:{},effectLocks:{}},src={key:'shooter'};
 const weapon={family:'lightning',element:'electric'};
 assert.equal(applyElementalHit(v,src,weapon,NOW),'paralysis');
 assert.equal(v.effects.paralysis.until,NOW+1500);
 assert.equal(applyElementalHit(v,src,weapon,NOW+1600),null);
 assert.equal(v.effectLocks.paralysis,NOW+5000);
 assert.ok(effectActive(v,'paralysis',NOW+1499));
 assert.equal(effectActive(v,'paralysis',NOW+1500),null);
 assert.equal(applyElementalHit(v,src,weapon,NOW+5000),'paralysis');
 assert.equal(ELEMENTAL_FILTERS.paralysis,'#a04bff');
 const prev={position:[75,0,0],rotation:0,animation:'idle',visible:true};
 const next={position:[76,0,0],rotation:1,animation:'walk',visible:true};
 const moved=validateState(prev,next,1000,'fighter',null,null,NOW+200,{effects:v.effects});
 assert.deepEqual(moved.state.position,next.position,'paralysis cannot immobilise');
 const r=room('storm-1');
 r.profile.effects=v.effects;
 const blocked=shoot(r,NOW+200,{phase:'charge'});
 assert.match(blocked.error,/Paralysed/);
});

test('every live effect has a weapon-specific contact interval between 1–3 sec',()=>{
 for(const id of ['jellybrella','goldfish','giraffe','fan','clam','black-cat','calico-cat','pan-1','storm-1']){
  const interval=contactDamageIntervalMs(itemById(id));
  assert.ok(interval>=1000&&interval<=3000,id+': '+interval);
 }
 assert.equal(visibleCollisionLifetimeMs(itemById('jellybrella'),true),5000);
});

test('spinning jellybrella wheel deals damage again every ~1.2s until its 5s animation ends',()=>{
 const r=room('jellybrella',[75,0,14]);
 const charge=applyAction(r.world,r.shooter,{action:'attack',phase:'charge'},
  {now:NOW+2000,rng:()=>.99,actors:[r.shooter,r.target]});
 assert.equal(charge.charging,true);
 const at=NOW+4000,shot=shoot(r,at,{charge:1});
 assert.equal(shot.attackEvent.ultimate,true);
 assert.equal(shot.attackEvent.area.mode,'area');
 assert.ok(shot.attackEvent.area.radius>=6,'jelly warning and hitbox are both 60% of the former minimum');
 tick(r,at+650);
 const first=r.world.damageEvents.filter(e=>e.target==='victim').length;
 assert.ok(first>=1,'first visible wheel contact must damage');
 tick(r,at+950);
 assert.equal(r.world.damageEvents.filter(e=>e.target==='victim').length,first,'cooldown prevents over-ticking');
 tick(r,at+2000);
 tick(r,at+3400);
 const repeated=r.world.damageEvents.filter(e=>e.target==='victim');
 assert.ok(repeated.length>first,'same still-visible wheel must hit repeatedly');
 const hp=r.victim.hp;
 tick(r,at+5600);
 assert.equal(r.victim.hp,hp,'the wheel must stop damaging after its animation expires');
});

test('fish ultimate is half-size and red with no GPU-heavy cloned ghost fish',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponSignatureEffects(scene);
 assert.equal(GOLDFISH_SWIM_RADIUS,1.05);
 const rendered=vfx.play({origin:[75,1,0],direction:[0,0,1],range:32,
  qualityScale:1,qualityDuration:1,ultimate:true},itemById('goldfish'));
 assert.equal(rendered,true);
 const root=vfx.active[0].obj;
 assert.equal(root.children.length,2,'one hidden detailed fish prototype and one GPU-instanced school');
 const fish=root.children[0],school=root.children[1];
 assert.equal(fish.visible,false,'original authored fish is the shared model source');
 assert.equal(fish.scale.x,.21,'each fish is reduced to ordinary cannonball scale');
 assert.ok(school.children.every(c=>c.isInstancedMesh&&c.count===30),'school uses thirty instances per original mesh');
 const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 assert.ok(school.children.length<50,'thirty detailed fish share fewer than fifty instanced draw calls');
 assert.ok(meshes.every(m=>!m.material.isMeshPhysicalMaterial),'no high-cost transmission passes');
 assert.ok(school.children.some(m=>m.geometry.getAttribute('color')&&m.material.vertexColors),'fish bodies preserve baked warm multicolour gradients');
 vfx.update(.2);
 vfx.dispose();assert.equal(scene.children.length,0);
});

test('shotgun luminous spheres dissolve during the final 30% of projectile flight',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponSignatureEffects(scene);
 vfx.play({origin:[0,1,0],direction:[0,0,1],range:10,
  time:1000,ultimate:false},itemById('calico-cat'));
 const duration=vfx.active[0].duration;
 vfx.update(duration*.85);
 assert.ok(vfx.active[0].obj.children[0].material.opacity<1);
 assert.ok(vfx.active[0].obj.children[0].material.opacity>0);
 vfx.dispose();
});

test('jellybrella actual 00GameDevs #26 group is scaled 2x, not only its capped size option',()=>{
 const scene=new THREE.Scene(),fx=new NumberedWeaponEffects(scene,()=>new THREE.Vector3());
 const item=itemById('jellybrella');
 const event={origin:[0,1,0],direction:[0,0,1],range:22,ultimate:true,
  qualityScale:1,area:{mode:'area',visualCenter:[0,.16,15],center:[0,.12,15],radius:10}};
 assert.equal(fx.play(event,item,null),true);
 assert.equal(fx.active[0].spec.number,26);
 const visualSize=fx.active[0].fx.group.scale.x;
 assert.ok(visualSize>=2,'at least the original wheel scale');
 fx.update(.1);
 assert.equal(fx.active[0].fx.group.scale.x,visualSize,'native asset preserves world scaling');
 fx.dispose();
});
