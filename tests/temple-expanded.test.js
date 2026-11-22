import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,applyAction,ensureProfile,tickWorld} from '../src/shared/temple-rules.js';
import {chargedArea,insideChargedArea,ULTIMATE_FOOTPRINT_SCALE} from '../src/shared/charge-area.js';
import {artBombDamage,projectileHitsActor,artworkBlastHits,ARTWORK_BLAST_RADIUS} from '../src/shared/art-bomb.js';
import {WEAPONS,attackStats} from '../src/shared/catalog.js';
import {ARTWORK_DISCS,discGroundHeight} from '../src/shared/artwork-discs.js';

const actor=(key,position=[75,0,0])=>({key,name:key,color:'#123456',position,role:'fighter',admin:false});
test('every weapon has finite charge distance and a target rune outside the caster',()=>{
 assert.ok(WEAPONS.length>40);
 for(const weapon of WEAPONS){
  const stats=attackStats(weapon,1),area=chargedArea(weapon,[0,1,0],[0,0,1],stats);
  assert.ok(area.radius>=.1&&Number.isFinite(area.radius),weapon.id);
  assert.ok(area.travel>=1&&area.travel<=area.range+(weapon.id.startsWith('whip-')?area.radius:0),weapon.id);
  assert.ok(area.center.every(Number.isFinite),weapon.id);
  assert.ok(area.center[2]>0,weapon.id);
 }
 const w=WEAPONS.find(w=>w.family==='ice'),area=chargedArea(w,[0,1,0],[0,0,1],attackStats(w,1));
 assert.equal(area.mode,'area');
 assert.equal(insideChargedArea(area,[area.center[0]+1,1,area.center[2]]),true);
 assert.equal(insideChargedArea(area,[999,1,999]),false);
});
test('all authored art-route discs have double visual/collision radii',()=>{
 assert.equal(ARTWORK_DISCS.length,75);
 assert.ok(ARTWORK_DISCS.every(d=>d.radius>=4.8));
 const p=ARTWORK_DISCS[0];
 assert.equal(discGroundHeight(p.position[0],p.position[2],p.top),p.top);
});
test('players own their uploaded artworks; ownership, size, and limits are enforced',()=>{
 const world=createInitialWorld(1000),owner=actor('owner'),other=actor('other');
 const original={action:'publish-art-bomb',artwork:{title:'My Art',position:[77,3,0],appearance:{depth:.1}},verifiedArtMedia:{id:'secure-id',type:'image/png'},size:2};
 const created=applyAction(world,owner,original,{now:2000});
 assert.ok(created.artwork?.bomb,created.error);
 const id=created.artwork.id,layout=world.artworkLayout[id];
 assert.deepEqual(layout.scale,[2,2,2]);assert.equal(created.artwork.owner,'owner');
 assert.equal(applyAction(world,other,{action:'resize-art-bomb',id,size:4},{now:2010}).error?.includes('Only'),true);
 assert.ok(applyAction(world,owner,{action:'resize-art-bomb',id,size:3},{now:2020}).artworkLayout);
 assert.deepEqual(world.artworkLayout[id].scale,[3,3,3]);
 assert.match(applyAction(world,owner,{action:'resize-art-bomb',id,size:4},{now:2030}).error,/1–3/);
 assert.match(applyAction(world,owner,{action:'resize-art-bomb',id,size:.8},{now:2030}).error,/1–3/);
 for(let i=0;i<3;i++)assert.ok(applyAction(world,owner,original,{now:2100+i}).artwork);
 assert.match(applyAction(world,owner,original,{now:3000}).error,/four art bombs/);
});
test('artwork splash has a 50% instant elimination roll and Epic pan radius',()=>{
 assert.equal(artBombDamage(100,()=>0),100);
 assert.equal(artBombDamage(100,()=>.4999),100);
 assert.equal(artBombDamage(100,()=>.5),50);
 assert.equal(artBombDamage(100,()=>1),50);
 assert.ok(ARTWORK_BLAST_RADIUS>2);
 assert.equal(artworkBlastHits([0,0,0],[ARTWORK_BLAST_RADIUS-.2,1,0]),true);
 assert.equal(artworkBlastHits([0,0,0],[ARTWORK_BLAST_RADIUS+3,1,0]),false);
 const event={origin:[0,1.4,0],direction:[0,0,1],power:1};
 assert.equal(projectileHitsActor(event,[0,0,11],1.5,1),true);
 assert.equal(projectileHitsActor(event,[20,0,11],1.5,1),false);
});

test('WRITE server journey accepts begin, drink and creates a persistent plant',()=>{
 const world=createInitialWorld(1000),writer=actor('writer',[0,0,0]);
 const started=applyAction(world,writer,{action:'write-begin'},{now:1000});
 assert.ok(started.journey,started.error);
 const early=applyAction(world,writer,{action:'write-drink',duration:2},{now:2000});
 assert.match(early.error,/Wait until/);
 const drinking=applyAction(world,writer,{action:'write-drink',duration:2},{now:4000});
 assert.ok(drinking.journey?.drinkAt,drinking.error);
 const planted=applyAction(world,writer,{action:'plant',text:'my persistent installation',position:[0,0,0]},{now:9600});
 assert.ok(planted.plant,planted.error);
 assert.equal(world.plants.at(-1).text,'my persistent installation');
 assert.equal(world.profiles.writer.writeJourney,null);
});

test('normal weapon attacks shake/damage player buildings and eventually destroy them',()=>{
 const world=createInitialWorld(1000),attacker=actor('attacker',[75,0,0]);
 ensureProfile(world,attacker.key,attacker.name,attacker.color,1000).equipment.weapon='tide-1';
 world.structures=[{id:'player-cube',kind:'cube',owner:'owner',hp:20,position:[75,0,6],rotation:0,variant:1,createdAt:1000}];
 const direction=[0,0,1];
 const first=applyAction(world,attacker,{action:'attack',direction,charge:0},{now:5000,actors:[]});
 assert.ok(first.structureHit,JSON.stringify(first.error||first));
 assert.ok(first.structureHit.hp<20);
 let destroyed=false;
 for(let i=1;i<7;i++){
  const result=applyAction(world,attacker,{action:'attack',direction,charge:0},{now:5000+i*1000,actors:[]});
  if(result.structureDestroyed){destroyed=true;break;}
 }
 assert.ok(destroyed);
 assert.equal(world.structures.length,0);
});

test('fully charged area spell damages two opponents and player-built architecture at one target',()=>{
 const world=createInitialWorld(1000),caster=actor('caster',[75,0,0]);
 ensureProfile(world,caster.key,caster.name,caster.color,1000).equipment.weapon='tide-1';
 const weapon=WEAPONS.find(w=>w.id==='tide-1');
 const a=chargedArea(weapon,[75,1,0],[0,0,1],attackStats(weapon,1));
 assert.equal(a.mode,'area');
 const t1=actor('target-one',[75,0,a.center[2]]);
 const t2=actor('target-two',[77,0,a.center[2]+.5]);
 ensureProfile(world,t1.key,t1.name,t1.color,1000);
 ensureProfile(world,t2.key,t2.name,t2.color,1000);
 world.structures=[{id:'art-wall',kind:'wall',position:[76,0,a.center[2]],hp:140,owner:'builder',rotation:0,createdAt:1000}];
 assert.ok(applyAction(world,caster,{action:'attack',phase:'charge'},{now:1000}).charging);
 const cast=applyAction(world,caster,{action:'attack',direction:[0,0,1],charge:1},{now:3000,actors:[caster,t1,t2],rng:()=>.4});
 assert.equal(cast.attackEvent?.ultimate,true,JSON.stringify(cast.error));
 assert.equal(cast.hits?.length,0,'charged attacks cannot damage on release');
 const initialHp1=world.profiles[t1.key].hp,initialHp2=world.profiles[t2.key].hp;
  assert.equal(initialHp1,world.profiles[t1.key].maxHp);
 tickWorld(world,{now:3700,actors:[caster,t1,t2],rng:()=>.4,activeFighters:0});
 assert.ok(world.profiles[t1.key].hp<initialHp1&&world.profiles[t2.key].hp<initialHp2);
 assert.ok(cast.structureHit?.hp<140,JSON.stringify(cast));
});

test('thrown original gallery art without a target completes without a charge-area reference error',()=>{
 const world=createInitialWorld(1000),thrower=actor('thrower',[75,0,0]);
 world.artworks['platform-01'].holder=thrower.key;
 const result=applyAction(world,thrower,{action:'throw-artwork',direction:[0,0,1],power:1},{now:5000,actors:[],rng:()=>.2});
 assert.ok(result.throwEvent,JSON.stringify(result));
 assert.ok(!result.structureHit||result.structureHit.kind==='city-house', 'Nearby solid buildings can be damaged by the explosion');
});

test('player-published artwork bomb uses ballistic collision and server damage against another fighter',()=>{
 const world=createInitialWorld(1000),thrower=actor('thrower',[75,0,0]),target=actor('target',[75,0,12]);
 ensureProfile(world,target.key,target.name,target.color,1000);
 world.customArtworks=[{id:'bomb-test',bomb:true,owner:thrower.key,position:[75,2,0],type:'image',mediaId:'not-needed-for-throw'}];
 world.artworks['bomb-test']={holder:thrower.key,availableAt:0,throwEvent:null};
 world.artworkLayout['bomb-test']={position:[75,2,0],rotation:[0,0,0],scale:[1,1,1],revision:1};
 const result=applyAction(world,thrower,{action:'throw-artwork',direction:[0,0,1],power:1},{now:5000,actors:[thrower,target],rng:()=>0});
 assert.ok(result.throwEvent?.bomb,JSON.stringify(result));
 assert.equal(result.hit,undefined,'the projectile has not yet reached the victim');
 assert.equal(world.profiles[target.key].hp,100,'no damage on launch');
 tickWorld(world,{now:5100,actors:[thrower,target],activeFighters:0,rng:()=>0});
 assert.equal(world.profiles[target.key].hp,100,'artwork has not touched the target');
 tickWorld(world,{now:5380,actors:[thrower,target],activeFighters:0,rng:()=>0});
 assert.ok(world.profiles[target.key].hp<100,'impact applies only after the artwork reaches its target');
 assert.ok((world.damageEvents||[]).some(hit=>hit.target===target.key));
});

test('GM /RESET clears all non-GM artworks, preserves GM and original works, and returns orphan media IDs',()=>{
 const world=createInitialWorld(1000),gm={...actor('gm'),admin:true},one=actor('one'),two=actor('two');
 ensureProfile(world,gm.key,gm.name,gm.color,1000,true);
 const upload=(by,label,mediaId,at)=>applyAction(world,by,{action:'publish-art-bomb',artwork:{title:label,mediaId,position:[75,1.5,0]},verifiedArtMedia:{id:mediaId,type:'image/png'},size:1},{now:at});
 const gmArt=upload(gm,'Admin remains','gm-media',2000).artwork;
 const a=upload(one,'First bomb','user-1',2001).artwork;
 const b=upload(two,'Second bomb','user-2',2002).artwork;
 assert.ok(gmArt&&a&&b);
 const denied=applyAction(world,one,{action:'reset-player-artworks'},{now:4000});
 assert.equal(denied.error,'GM only');
 assert.equal(world.customArtworks.length,3);
 const result=applyAction(world,gm,{action:'reset-player-artworks'},{now:5000});
 assert.equal(result.removedArtworks,2);
 assert.deepEqual(new Set(result.removedArtworkMediaIds),new Set(['user-1','user-2']));
 assert.deepEqual(world.customArtworks.map(r=>r.id),[gmArt.id]);
 assert.ok(world.artworkLayout[gmArt.id]);
 assert.ok(!world.artworkLayout[a.id]&&!world.artworkLayout[b.id]);
 assert.ok(world.artworks['platform-01']);
 assert.equal(applyAction(world,gm,{action:'reset-player-artworks'},{now:6000}).removedArtworks,0);
});
test('uploaded art stays projectile equipment, never a damageable BUILD structure',()=>{
 const world=createInitialWorld(1000),owner=actor('owner'),attacker=actor('attacker');
 ensureProfile(world,attacker.key,attacker.name,attacker.color,1000).equipment.weapon='tide-1';
 const created=applyAction(world,owner,{action:'publish-art-bomb',artwork:{title:'Bomb',mediaId:'saved',position:[75,1.5,0]},verifiedArtMedia:{id:'saved',type:'image/png'},size:3},{now:2000});
 assert.ok(created.artwork,JSON.stringify(created));
 world.structures=[{id:'breakable',kind:'wall',owner:'owner',hp:20,position:[75,0,5],rotation:0,createdAt:1000}];
 const hit=applyAction(world,attacker,{action:'attack',direction:[0,0,1]},{now:5000,actors:[]});
 assert.ok(hit.structureHit);
 assert.equal(world.customArtworks.length,1);
 assert.equal(world.artworks[created.artwork.id].holder,null);
 for(let i=0;i<8&&world.structures.length;i++){
  const result=applyAction(world,attacker,{action:'destroy',structureId:'breakable',direction:[0,0,1]},{now:6000+i*1000});
  assert.equal(result.error,undefined);
 }
 assert.equal(world.structures.length,0);
 assert.equal(world.customArtworks.length,1);
});

test('regular strikes damage every player-built structure even after hitting a fighter',()=>{
 const world=createInitialWorld(1000),caster=actor('caster',[75,0,0]),target=actor('target',[75,0,3]);
 ensureProfile(world,caster.key,caster.name,caster.color,1000).equipment.weapon='tide-1';
 ensureProfile(world,target.key,target.name,target.color,1000);
 world.structures=[{id:'shared-cube',kind:'cube',owner:'builder',position:[75,0,5],hp:140,maxHp:140,rotation:0,createdAt:1000}];
 const strike=applyAction(world,caster,{action:'attack',direction:[0,0,1],charge:0},{now:5000,actors:[caster,target]});
 assert.equal(strike.hit,null,'PvP hit resolves only on projectile contact');
 tickWorld(world,{now:5400,actors:[caster,target],rng:()=>.5,activeFighters:0});
 assert.ok(world.profiles.target.hp<100);
 assert.ok(strike.structureHit,JSON.stringify(strike.error||strike));
 assert.equal(strike.structureHits.length,1);
 assert.ok(world.structures[0].hp<140);
});
test('a fully charged area hits every player-built structure in its radius',()=>{
 const world=createInitialWorld(1000),caster=actor('caster',[75,0,0]);
 ensureProfile(world,caster.key,caster.name,caster.color,1000).equipment.weapon='tide-1';
 const weapon=WEAPONS.find(w=>w.id==='tide-1');
 const area=chargedArea(weapon,[75,1,0],[0,0,1],attackStats(weapon,1));
 world.structures=[
  {id:'wall-one',kind:'wall',owner:'owner-a',position:[75,0,area.center[2]],hp:140,maxHp:140,createdAt:1000},
  {id:'wall-two',kind:'wall',owner:'owner-b',position:[77,0,area.center[2]],hp:140,maxHp:140,createdAt:1000}
 ];
 assert.ok(applyAction(world,caster,{action:'attack',phase:'charge'},{now:1000}).charging);
 const strike=applyAction(world,caster,{action:'attack',charge:1,direction:[0,0,1]},{now:3000,actors:[caster]});
 assert.equal(strike.structureHits?.length,2,JSON.stringify(strike));
 assert.ok(world.structures.every(s=>s.hp<140));
});

test('all cat guns keep their advertised normal and charged range and deal PvP damage',()=>{
  const guns=[
    ['white-cat',22,28,18,25],
    ['black-cat',256,256,65,85],
    ['calico-cat',10,17,8,14]
  ];
  for(const [id,range,chargedRange,normalDistance,chargedDistance] of guns){
    const weapon=WEAPONS.find(w=>w.id===id);
    assert.equal(!!weapon?.firstPerson,id!=='calico-cat',id+' only calico fires without shoulder camera');
    assert.equal(attackStats(weapon,0).range,range,id+' normal range');
    assert.equal(attackStats(weapon,1).range,chargedRange,id+' charged range');
    for(const [charge,distance] of [[0,normalDistance],[1,chargedDistance]]){
      // Charged collision/preview now share 60% of the catalog reach.
      const actualDistance=charge?Math.min(distance,chargedRange*ULTIMATE_FOOTPRINT_SCALE*.75):distance;
      const world=createInitialWorld(1000),shooter=actor('shooter',[0,0,-35]),target=actor('target',[0,0,-35+actualDistance]);
      ensureProfile(world,target.key,target.name,target.color,1000);
      const profile=ensureProfile(world,shooter.key,shooter.name,shooter.color,1000);
      profile.inventory.push(id);profile.equipment.weapon=id;
      if(charge)assert.equal(applyAction(world,shooter,{action:'attack',phase:'charge',...(id==='black-cat'?{scoped:true}:{})},{now:2000}).charging,true);
      const result=applyAction(world,shooter,{action:'attack',direction:[0,0,1],origin:[0,1,-35],charge,...(id==='black-cat'?{scoped:true}:{})},
        {now:5000,actors:[shooter,target],rng:()=>.8});
      assert.equal(result.hit,null,id+' must not hit instantaneously');
      tickWorld(world,{now:5900,actors:[shooter,target],activeFighters:0,rng:()=>.8});
      assert.ok(world.profiles.target.hp<100,id+' charge '+charge+' must damage a fighter upon contact');
    }
  }
  const spell=WEAPONS.find(w=>w.id==='tide-1');
  assert.equal(attackStats(spell,0).range,+(spell.range/3).toFixed(3),'ordinary spells retain Temple range balancing');
});

test('cat bullets aimed at the visible upper body of a tall monster deal damage',()=>{
  const world=createInitialWorld(1000),shooter=actor('shooter',[0,0,15]);
  const profile=ensureProfile(world,shooter.key,shooter.name,shooter.color,1000);
  profile.inventory.push('white-cat');profile.equipment.weapon='white-cat';
  world.monster={id:'tall-test',active:true,position:[0,0,35],hp:500,maxHp:500,model:'auntie'};
  const vector=[0,6,20],size=Math.hypot(...vector),direction=vector.map(v=>v/size);
  const result=applyAction(world,shooter,{action:'attack',direction,origin:[0,1,15]},{now:5000,actors:[shooter],rng:()=>.8});
  assert.equal(result.monsterHit,null,'monster is not struck on release');
  tickWorld(world,{now:5400,actors:[shooter],activeFighters:0,rng:()=>.8});
  assert.ok(world.monster.hp<500);
});

test('cat gun server hitbox still rejects bullets passing beside the monster',()=>{
  const world=createInitialWorld(1000),shooter=actor('shooter',[0,0,15]);
  const profile=ensureProfile(world,shooter.key,shooter.name,shooter.color,1000);
  profile.inventory.push('white-cat');profile.equipment.weapon='white-cat';
  world.monster={id:'tall-test',active:true,position:[0,0,35],hp:500,maxHp:500,model:'auntie'};
  const vector=[6,6,20],size=Math.hypot(...vector),direction=vector.map(v=>v/size);
  const result=applyAction(world,shooter,{action:'attack',direction,origin:[0,1,15]},{now:5000,actors:[shooter],rng:()=>.8});
  assert.equal(result.error,undefined);
  assert.equal(result.monsterHit,null);
  tickWorld(world,{now:5400,actors:[shooter],activeFighters:0,rng:()=>.8});
  assert.equal(world.monster.hp,500);
});
