import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {PALM_STORM_DURATION_MS,PALM_STORM_TICK_MS,visibleCollisionLifetimeMs} from '../src/shared/combat-balance.js';
import {scaleUltimateFootprint,chargedArea,spellFootprint,insideChargedArea,PALM_ULTIMATE_RADIUS_MULTIPLIER} from '../src/shared/charge-area.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';
import {PlantUltimateEffects} from '../src/plant-ultimate-effects.js';
const NOW=4000000,actor={key:'coconut-caster',name:'Caster',color:'#ffffff',role:'fighter',seat:0,position:[65,0,0]};
const tick=(w,at)=>tickWorld(w,{now:at,actors:[actor],activeFighters:0,rng:()=>.5});
function castPalm(tier=1){
 const world=createInitialWorld(NOW),palm=itemById('palm-'+tier),profile=ensureProfile(world,actor.key,actor.name,actor.color,NOW);
 profile.inventory.push(palm.id);profile.equipment.weapon=palm.id;
 world.monster={id:'coconut-target',active:true,model:'uncle',variant:'uncle',position:[65,0,12],hp:100000,maxHp:100000,skills:[],nextAttackAt:NOW+100000};
 const castAt=NOW+4000;
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},{now:NOW+1000,actors:[actor]}).charging,true);
 const result=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:1},{now:castAt,actors:[actor],rng:()=>.5});
 assert.equal(result.error,undefined);assert.equal(result.attackEvent.ultimate,true);
 return {world,palm,castAt,result};
}
test('five rarities share rebalanced proportional radius and identical VFX, warning and collision geometry',()=>{
 assert.equal(PALM_STORM_DURATION_MS,6000);assert.equal(PALM_STORM_TICK_MS,2000);
 for(let tier=1;tier<=5;tier++){
  const palm=itemById('palm-'+tier),q=weaponQuality(palm),stats=attackStats(palm,1);
  stats.range=+(stats.range*q.range).toFixed(2);
  stats.radius=forwardCastRadius(palm,q,stats.radius,false);
  const former=stats.radius*.6*2.5;
  scaleUltimateFootprint(stats,palm,q);
  assert.ok(Math.abs(stats.radius-former*(PALM_ULTIMATE_RADIUS_MULTIPLIER/2.5))<.002,palm.id);
  assert.equal(visibleCollisionLifetimeMs(palm,true),6000);
  const area=chargedArea(palm,[65,1.16,0],[0,0,1],stats,()=>0);
  const warning=spellFootprint(palm,[65,1.16,0],[0,0,1],stats,area,()=>0);
  assert.equal(area.mode,'area');assert.equal(warning.radius,area.radius);
  assert.deepEqual(warning.position,area.visualCenter);
  assert.equal(insideChargedArea(area,[area.center[0]+area.radius-.1,area.center[1],area.center[2]],0),true);
  assert.equal(insideChargedArea(area,[area.center[0]+area.radius+.1,area.center[1],area.center[2]],0),false);
  const scene=new THREE.Scene(),vfx=new PlantUltimateEffects(scene);
  assert.ok(vfx.play({ultimate:true,area,origin:[65,1.16,0],direction:[0,0,1]},palm));
  assert.ok(Math.abs(vfx.active[0].group.scale.x*4.3-warning.radius)<.001);
  assert.equal(vfx.active[0].duration,6);
  assert.equal(vfx.active[0].group.position.z,area.center[2]);
  vfx.dispose();
 }
});
test('server enforces exactly three storm pulses at 0, 2 and 4 seconds during six-second effect',()=>{
 const {world,castAt}=castPalm(1),fx=world.persistentAttacks.find(v=>v.weapon==='palm-1');
 assert.ok(fx);assert.equal(fx.expiresAt-castAt,6000);
 const hp=world.monster.hp;
 tick(world,castAt+30);
 assert.ok(world.monster.hp<hp);assert.equal(fx.pulseCount,1);
 const one=world.monster.hp;
 tick(world,castAt+900);tick(world,castAt+1999);
 assert.equal(world.monster.hp,one);
 tick(world,castAt+2030);assert.equal(fx.pulseCount,2);
 const two=world.monster.hp;assert.ok(two<one);
 tick(world,castAt+3950);assert.equal(world.monster.hp,two);
 tick(world,castAt+4030);assert.equal(fx.pulseCount,3);
 const three=world.monster.hp;assert.ok(three<two);
 tick(world,castAt+5500);assert.equal(world.monster.hp,three);
 tick(world,castAt+6010);assert.equal(world.monster.hp,three);
 assert.equal(world.persistentAttacks.some(v=>v.id===fx.id),false);
 assert.equal((world.damageEvents||[]).filter(v=>v.target==='coconut-target').length,3);
});
test('targets outside the true circle cannot be hit by the retired travelling projectile ray',()=>{
 const {world,castAt,result}=castPalm(1);
 const c=result.attackEvent.area.center,r=result.attackEvent.area.radius;
 world.monster.position=[c[0]+r+30,0,c[2]];
 const hp=world.monster.hp;
 for(const offset of [50,1000,2050,3050,4050,5050,6050])tick(world,castAt+offset);
 assert.equal(world.monster.hp,hp);
 assert.equal((world.damageEvents||[]).filter(v=>v.target==='coconut-target').length,0);
});
