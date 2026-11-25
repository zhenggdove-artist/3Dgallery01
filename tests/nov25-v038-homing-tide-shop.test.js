import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {advanceGoldfishSchool} from '../src/shared/goldfish-school.js';
import {GOLDFISH_SWIM_MS,TIDE_PUSH_INTERVAL_MS,TIDE_PUSH_DURATION_MS,TIDE_PUSH_DISTANCE} from '../src/shared/weapon-abilities.js';
import {createInitialWorld,ensureProfile,applyAction,tickTidalChannels,worldView} from '../src/shared/temple-rules.js';
test('goldfish acquires a player behind launch, changes elevation and travels twice as fast at unchanged range',()=>{
 const fx={origin:[0,3.5,0],direction:[0,0,1],launchDirection:[0,0,1],range:24,travelled:0};
 advanceGoldfishSchool(fx,{position:[0,0,-10]},500,GOLDFISH_SWIM_MS);
 assert.equal(GOLDFISH_SWIM_MS,2400);assert.ok(fx.position[2]<-4.9);assert.ok(fx.position[1]<3.5);assert.equal(fx.travelled,5);
});
test('tide uses an independent one-second push every three seconds',()=>{
 assert.equal(TIDE_PUSH_INTERVAL_MS,3000);assert.equal(TIDE_PUSH_DURATION_MS,1000);assert.equal(TIDE_PUSH_DISTANCE,3);
 const code=readFileSync(new URL('../src/shared/temple-rules.js',import.meta.url),'utf8');
 assert.match(code,/victim\.tidePush=\{id:id\(\),time:now,durationMs:TIDE_PUSH_DURATION_MS/);
 assert.match(code,/nextPushAt:pushNow\?now\+TIDE_PUSH_INTERVAL_MS:nextPushAt/);
 assert.match(code,/tidePush:profile\.tidePush\|\|null/);
});
test('shop opens on headwear and weapon filters only appear inside weapons',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(ui,/if\(name==='shop'&&this\.panelName!=='shop'\)\{this\.shopTab='head'/);
 assert.match(ui,/\['weapons','shield','comfort'\],\.\.\.\(weaponActive\?\[weaponTabs\]:\[\]\)/);
});

test('tide locks keep a three-second push schedule and a one-second monster displacement',()=>{
 const T=100000,world=createInitialWorld(T),caster={key:'caster',name:'Caster',role:'fighter',position:[75,0,0],color:'#ffffff'};
 const p=ensureProfile(world,caster.key,caster.name,caster.color,T);p.inventory.push('tide-1');p.equipment.weapon='tide-1';
 world.monster={id:'mob',active:true,model:'uncle',variant:'uncle',position:[75,0,5],hp:100000,maxHp:100000,nextAttackAt:T+100000,skills:[]};
 const attack=(time,body)=>applyAction(world,caster,{action:'attack',direction:[0,0,1],...body},{now:time,actors:[caster],rng:()=>.5});
 assert.equal(attack(T+1000,{phase:'charge'}).charging,true);
 assert.equal(attack(T+4000,{phase:'channel-start'}).channeling,true);
 assert.equal(attack(T+4100,{phase:'channel',charge:1}).error,undefined);
 tickTidalChannels(world,[caster],T+4150,()=>.5);
 // Renew the existing live channel without resetting locks.
 for(let time=T+4400;time<=T+7150;time+=250){attack(time,{phase:'channel',charge:1});tickTidalChannels(world,[caster],time,()=>.5);}
 assert.equal(world.monster.tidePush?.durationMs,600);
 const z=world.monster.position[2];
 tickTidalChannels(world,[],T+7450,()=>.5);
 assert.ok(Math.abs(world.monster.position[2]-z-.9)<1e-6);
 tickTidalChannels(world,[],T+7750,()=>.5);
 assert.ok(Math.abs(world.monster.position[2]-z-1.8)<1e-6);
});
