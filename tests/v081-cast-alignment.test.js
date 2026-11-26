import test from 'node:test';
import assert from 'node:assert/strict';
import {castBaseOrigin,resolveCastOrigin,chargedArea,spellFootprint} from '../src/shared/charge-area.js';
import {itemById} from '../src/shared/catalog.js';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
test('all strict cast samples keep the exact shown origin, never silently relocate',()=>{
 const actor=[20,2,30],sample=[20.8,3.3,30.2];
 assert.deepEqual(castBaseOrigin(actor),[20,3.16,30]);
 assert.deepEqual(resolveCastOrigin(actor,sample,{strict:true}),sample);
 assert.equal(resolveCastOrigin(actor,[90,1,80],{strict:true}),null);
 assert.deepEqual(resolveCastOrigin(actor,[90,1,80],{legacyMuzzle:true}),castBaseOrigin(actor));
 assert.deepEqual(resolveCastOrigin(actor,sample),castBaseOrigin(actor));
});
test('pitched forward warning lies on the ground projection of the actual hit ray',()=>{
 const origin=[12,3,8],direction=[.3,.8,Math.sqrt(.27)],range=30,stats={range,radius:1,ultimate:true};
 const item=itemById('ember-1'),a=chargedArea(item,origin,direction,stats,()=>0,true);
 const fp=spellFootprint(item,origin,direction,stats,a,()=>0);
 assert.ok(Math.abs(fp.length-18)<1e-8);
 assert.ok(Math.abs(fp.position[0]-(origin[0]+direction[0]*range/2))<1e-8);
 assert.ok(Math.abs(fp.position[2]-(origin[2]+direction[2]*range/2))<1e-8);
 const ice=itemById('frost-1');
 assert.equal(spellFootprint({...ice,family:'ice',slot:'weapon'},origin,direction,stats,null,()=>0).length,range);
});
test('release and preview share a captured cast; non-channel effects cannot drift with the avatar',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const native=readFileSync(new URL('../src/numbered-weapon-effects.js',import.meta.url),'utf8');
 assert.match(main,/chargePreview\.update\(localRoot,chargedWeapon,charge,cast\.direction,arena,[^\n]+cast\.origin,dt\)/);
 assert.match(main,/performAttack\(1,null,releaseAim,\{\},pending\)/);
 assert.match(native,/if\(entry\.root&&entry\.channel\) \{/);
});

test('authoritative normal and charged attacks retain captured origin after movement; invalid samples do not spend mana',()=>{
 const now=1700000000,actor={key:'alignment',name:'Alignment',role:'fighter',position:[75,0,0],color:'#ffffff'};
 for(const id of ['pan-1','saber-1','frost-1','giraffe','goldfish','ember-1']){
  const item=itemById(id);assert.ok(item,id);
  for(const full of [false,true]){
   const world=createInitialWorld(now),p=ensureProfile(world,actor.key,actor.name,actor.color,now);
   p.inventory.push(id);p.equipment.weapon=id;p.mana=p.maxMana;
   const origin=[75.5,1.16,.5],direction=[0,0,1],ms=item.chargeMs||1500;
   if(full)assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},{now:now+1000}).charging,true,id);
   const time=now+1000+(full?ms+200:0);
   const before=p.mana;
   const invalid=applyAction(world,actor,{action:'attack',direction,charge:full?1:0,origin:[180,1,180],castPoseV081:true},{now:time});
   assert.match(invalid.error,/position changed/,id);assert.equal(p.mana,before);
   const valid=applyAction(world,actor,{action:'attack',direction,charge:full?1:0,origin,castPoseV081:true},{now:time});
   assert.ok(valid.attackEvent,id+': '+valid.error);
   assert.equal(valid.attackEvent.ultimate,full,id);
   assert.equal(valid.attackEvent.origin[0],origin[0],id);
   assert.equal(valid.attackEvent.origin[2],origin[2],id);
   const fx=world.persistentAttacks.find(a=>a.owner===actor.key);
   assert.ok(fx,id);assert.deepEqual(fx.origin,valid.attackEvent.origin,id);
   if(full&&valid.attackEvent.area?.mode==='area'){
    const fp=spellFootprint(item,origin,direction,valid.attackEvent,valid.attackEvent.area,()=>0);
    if(fp.shape==='circle')assert.deepEqual(fp.position,valid.attackEvent.area.visualCenter,id);
   }
  }
 }
});
