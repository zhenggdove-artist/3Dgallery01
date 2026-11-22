import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WEAPONS,itemById,attackStats} from '../src/shared/catalog.js';
import {calicoPellets} from '../src/shared/calico-pellets.js';
import {pvpShotDamage,projectileFlightMs} from '../src/shared/combat-balance.js';
import {weaponQuality} from '../src/shared/weapon-abilities.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';

const T=800000;
const fighter=(key,position)=>({key,name:key,color:'#ffffff',role:'fighter',position,admin:false});
function scenario(weapon='clam',position=[75,0,6]){
 const w=createInitialWorld(T),caster=fighter('caster',[75,0,0]),victim=fighter('victim',position);
 const a=ensureProfile(w,'caster','caster','#ffffff',T),b=ensureProfile(w,'victim','victim','#ffffff',T);
 a.inventory.push(weapon);a.equipment.weapon=weapon;
 return {w,caster,victim,a,b};
}
function fire(w,caster,time,extra={}){
 return applyAction(w,caster,{action:'attack',direction:[0,0,1],...(w.profiles[caster.key]?.equipment?.weapon==='black-cat'?{scoped:true}:{}),...extra},{now:time,rng:()=>.94,actors:[caster]});
}
function advance(w,time,actors,rng=()=>.94){
 tickWorld(w,{now:time,actors,activeFighters:0,rng});
}
test('each weapon has its own full-charge duration, with the sniper slowest and longest cooldown',()=>{
 const durations=WEAPONS.map(w=>w.chargeMs);
 assert.ok(durations.every(t=>t>=700&&Number.isFinite(t)));
 assert.equal(new Set(durations).size,durations.length);
 assert.ok(itemById('black-cat').chargeMs>itemById('white-cat').chargeMs*2);
 assert.ok(itemById('black-cat').cooldown>=3000);
});
test('PvP power is weighted by range, radius, cooldown and charging duration',()=>{
 const q={tier:1},normal={ultimate:false,radius:1},ultimate={ultimate:true,radius:3};
 const candidate=(props)=>({id:'test',family:'pan',chargeMs:1300,range:8,radius:.5,cooldown:750,...props});
 assert.ok(pvpShotDamage(candidate({range:4}),normal,q)>pvpShotDamage(candidate({range:40}),normal,q));
 assert.ok(pvpShotDamage(candidate({cooldown:1300}),normal,q)>pvpShotDamage(candidate({cooldown:250}),normal,q));
 assert.ok(pvpShotDamage(candidate({radius:5}),normal,q)<pvpShotDamage(candidate({radius:.5}),normal,q));
 assert.ok(pvpShotDamage(candidate({chargeMs:2400}),ultimate,q)>pvpShotDamage(candidate({chargeMs:800}),ultimate,q));
 assert.ok(pvpShotDamage(candidate({}),{ultimate:true,radius:18},q)<pvpShotDamage(candidate({}),ultimate,q));
 assert.ok(pvpShotDamage(itemById('black-cat'),attackStats(itemById('black-cat'),0),q)>
  pvpShotDamage(itemById('prism-1'),attackStats(itemById('prism-1'),0),q)*2);
 for(const w of WEAPONS)if(w.id!=='black-cat'){
  const normalPower=pvpShotDamage(w,attackStats(w,0),weaponQuality(w));
  assert.ok(normalPower<=12.2,w.id);
  assert.ok(Math.ceil(100/(normalPower*1.14))>=8,
   w.id+' must never two-shot via critical or headshot multipliers');
 }
});
test('ordinary water clam needs 8–10 strikes and never inflicts charged-only soak',()=>{
 const {w,caster,victim,b}=scenario('clam',[75,0,2.2]);
 let hits=0;
 for(let i=0;i<14&&b.hp>0;i++){
  const at=T+2000+i*1350;
  const shot=fire(w,caster,at);
  assert.equal(shot.error,undefined);
  assert.equal(shot.hit,null);
  advance(w,at+420,[caster,victim]);
  if(worldView(w,'caster',at+421).damageEvents.some(e=>e.target==='victim'))hits++;
 }
 assert.ok(b.hp<=0,'victim eventually dies');
 assert.ok(hits>=8&&hits<=10,'expected 8–10 ordinary hits without charged water vulnerability, got '+hits);
 assert.equal(b.effects?.soaked,undefined,'normal clam impacts may not inflict elemental status');
});
test('damage is absent on firing and while the sphere has not yet reached the avatar',()=>{
 const {w,caster,victim,b}=scenario('calico-cat',[75,0,8]);
 const at=T+2000,shot=fire(w,caster,at);
 assert.equal(shot.attackEvent.pellets.length,20);
 assert.equal(b.hp,100);
 assert.equal((w.damageEvents||[]).length,0);
 assert.equal(shot.hit,null);
 advance(w,at+90,[caster,victim]);
 assert.equal(b.hp,100,'90ms pellet travel cannot reach the eight-metre victim');
 assert.equal((w.damageEvents||[]).length,0);
 advance(w,at+365,[caster,victim]);
 assert.ok(b.hp<100);
 const events=worldView(w,'victim',at+366).damageEvents.filter(e=>e.target==='victim');
 assert.ok(events.length>0,'damage digits appear only at actual contact');
 const old=b.hp;
 advance(w,at+700,[caster,victim]);
 assert.equal(b.hp,old,'each pellet touches this target at most once');
});
test('moving out of the trajectory before impact avoids all hits',()=>{
 const {w,caster,victim,b}=scenario('calico-cat',[75,0,8]);
 const at=T+2000;
 fire(w,caster,at);
 advance(w,at+80,[caster,victim]);
 victim.position=[89,0,8];
 advance(w,at+365,[caster,victim]);
 assert.equal(b.hp,100);
 assert.equal((w.damageEvents||[]).filter(e=>e.target==='victim').length,0);
});
test('shotgun uses twenty unique randomly scattered 3-D sphere trajectories, each with a complex multicolour surface',()=>{
 const weapon=itemById('calico-cat'),scene=new THREE.Scene(),fx=new WeaponSignatureEffects(scene);
 const a=calicoPellets([0,0,1],false,111),b=calicoPellets([0,0,1],false,222);
 assert.notDeepEqual(a.map(p=>p.direction),b.map(p=>p.direction));
 assert.deepEqual(a,calicoPellets([0,0,1],false,111),'client/server share deterministic lanes');
 assert.equal(new Set(a.map(p=>p.direction.join(','))).size,20);
 const positions=a.map(p=>[p.direction[0],p.direction[1]]);
 assert.ok(new Set(positions.map(p=>p[1].toFixed(3))).size>=6,'not two neat rows');
 assert.ok(new Set(positions.map(p=>p[0].toFixed(3))).size>=6,'not five neat columns');
 fx.play({origin:[0,1,0],direction:[0,0,1],range:10,time:111,pellets:a.map(x=>x.direction)},weapon);
 const group=fx.active.at(-1).obj;
 assert.equal(group.children.length,20);
 for(const child of group.children){
  assert.ok(child.isMesh&&child.geometry.type==='SphereGeometry');
  assert.ok(child.geometry.attributes.normal,'real sphere surface normals');
  assert.ok(child.material.isMeshPhysicalMaterial&&child.material.vertexColors,'shaded 3-D physical material');
  const colors=child.geometry.getAttribute('color');
  assert.ok(colors.count>=500,'complex surface topology');
  const unique=new Set();
  for(let j=0;j<colors.count;j+=9)unique.add([colors.getX(j),colors.getY(j),colors.getZ(j)].map(v=>v.toFixed(1)).join(','));
  assert.ok(unique.size>=8,'each sphere has multiple interlaced colours');
 }
 const ms=projectileFlightMs(weapon,false);
 fx.update(ms/2000);
 assert.ok(group.children.every(c=>c.position.z>0&&c.position.z<10));
 fx.dispose();assert.equal(scene.children.length,0);
});

test('black-cat rifle retains slow high-damage long-range shots unlike regular 8-hit weapons',()=>{
 const {w,caster,victim,b}=scenario('black-cat',[75,0,30]);
 const at=T+2000,initialHp=b.hp;
 const first=fire(w,caster,at);
 assert.equal(first.error,undefined);
 assert.equal(b.hp,initialHp,'projectile must not damage the target before contact');
 advance(w,at+500,[caster,victim]);
 assert.ok(initialHp-b.hp>=75&&b.hp>=0,
  'sniper must retain its heavy hit regardless of randomized max-HP enchantments');
 assert.equal(fire(w,caster,at+500).error,'Weapon is recovering');
 assert.equal(fire(w,caster,at+3700).error,undefined);
 const {w:charged,caster:c,victim:v,b:target}=scenario('black-cat',[75,0,30]);
 assert.ok(applyAction(charged,c,{action:'attack',phase:'charge',scoped:true},{now:T+1000}).charging);
 const ultimate=fire(charged,c,T+4000,{charge:1});
 assert.equal(ultimate.attackEvent.ultimate,true);
 advance(charged,T+4500,[c,v]);
 assert.ok(target.hp<65,'longer charge increases black-cat ultimate damage');
});
