import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';
import {applyStatus,applyElementalHit} from '../src/shared/combat-status.js';

const NOW=41_000_000;
const person=(key,position=[75,0,0])=>({key,name:key,role:'fighter',color:'#abcdef',position});
const act=(world,who,now,body)=>applyAction(world,who,body,{now,rng:()=>body.action==='fuse'?0:.91,actors:[who]});

test('five rarity tiers have distinctly larger charged hitboxes',()=>{
 const weapon=itemById('ember-1');
 const tiers=[1,2,3,4,5].map(tier=>weaponQuality({...weapon,tier}));
 const radii=tiers.map(q=>forwardCastRadius(weapon,q,attackStats(weapon,1).radius));
 for(let i=1;i<radii.length;i++)assert.ok(radii[i]>radii[i-1]*1.3,'rarity '+(i+1));
 assert.ok(tiers[4].visual>tiers[0].visual*3);
});

test('shop-purchased materials fuse and only two sources provide ultimate echoes',()=>{
 const world=createInitialWorld(NOW),shooter=person('shooter'),p=ensureProfile(world,'shooter','shooter','#abcdef',NOW);
 p.wallet=100_000;p.inventory.push('ember-1','storm-1','tide-2');
 const bought=act(world,shooter,NOW+100,{action:'buy',itemId:'frost-1'});
 assert.ok(!bought.error,'purchased frost staff must be a legitimate fusion material');
 for(const [sourceId,key,i] of [['frost-1','echo-1',0],['storm-1','echo-2',1],['tide-2','stats-only-3',2]]){
  const fusion=act(world,shooter,NOW+300+i*150,{action:'fuse',sourceId,targetId:'ember-1',requestId:key+'-unique'});
  assert.ok(!fusion.error,JSON.stringify(fusion));
  assert.equal(fusion.fusion.success,true);
 }
 assert.deepEqual(p.fusion['ember-1'].effects,['frost-1','storm-1']);
 assert.equal(p.fusion['ember-1'].sources.length,3);
 assert.equal(p.fusion['ember-1'].sources[2].echo,false);
 assert.ok(p.fusion['ember-1'].templeStats.damage>itemById('ember-1').damage);
 p.equipment.weapon='ember-1';
 const t=NOW+3000;
 assert.equal(act(world,shooter,t,{action:'attack',phase:'charge'}).charging,true);
 const cast=act(world,shooter,t+4000,{action:'attack',charge:1,direction:[0,0,1]});
 assert.equal(cast.attackEvent.ultimate,true);
 const echoes=cast.attackEvent.fusionEchoes;
 assert.deepEqual(echoes.map(e=>e.weapon),['frost-1','storm-1']);
 assert.ok(echoes.every(e=>e.ultimate&&e.fusionEcho&&e.echoPower===.2));
 assert.ok(echoes.every(e=>e.radius<cast.attackEvent.radius));
 assert.equal(world.persistentAttacks.filter(v=>v.echo).length,2);
 for(const fx of world.persistentAttacks.filter(v=>v.echo))
  assert.ok(fx.damage>0&&fx.charge===1);
});

test('ordinary hits may damage but do not inflict charged elemental statuses',()=>{
 const world=createInitialWorld(NOW),a=person('a'),b=person('b',[75,0,2]);
 const source=ensureProfile(world,'a','a','#abcdef',NOW),victim=ensureProfile(world,'b','b','#abcdef',NOW);
 source.inventory.push('frost-1');source.equipment.weapon='frost-1';
 const result=applyAction(world,a,{action:'attack',direction:[0,0,1]},{now:NOW+2000,rng:()=>.6,actors:[a,b]});
 assert.ok(result.attackEvent&&!result.attackEvent.ultimate);
 tickWorld(world,{now:NOW+2220,rng:()=>.6,actors:[a,b],activeFighters:0});
 assert.equal(victim.effects?.freeze,undefined);
 assert.equal(victim.effects?.paralysis,undefined);
});

test('fusion echo status requires its own impact and is 20% strength, never a full primary proc',()=>{
 const world=createInitialWorld(NOW),source=ensureProfile(world,'caster','caster','#abcdef',NOW);
 source.fusion['ember-1']={effects:['frost-1']};
 const target={hp:1000,maxHp:1000,effects:{},effectLocks:{}};
 applyStatus(world,source,target,itemById('ember-1'),
  {damage:35,charge:1,direction:[0,0,1],qualityDuration:1},NOW+1000);
 assert.ok(target.effects.burn,'primary fire ultimate applies its own burn');
 assert.equal(target.effects.slow,undefined,'full-strength legacy ice slow must never proc on primary contact');
 assert.equal(target.effects.freeze,undefined,'fused ice cannot freeze before its own projectile hits');
 applyElementalHit(target,source,itemById('frost-1'),NOW+1020,.2);
 assert.equal(target.effects.freeze.until-(NOW+1020),200,'fused ice duration is 20% of full 1000ms');
});
