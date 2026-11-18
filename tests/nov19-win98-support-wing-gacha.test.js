import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,createProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {drawWing,FREE_WING_TRIAL_LIMIT,WING_QUALITY_WEIGHTS} from '../src/shared/wing-shop.js';

const T=Date.UTC(2026,10,19,0,0,0);
const account='firebase:sample-project:verified-user';
const actor=(key=account,admin=false)=>({key,name:'tester',color:'#43b59a',admin,role:'fighter',position:[0,0,0]});
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Google user receives five lifetime server-persisted trial wings; sixth draw is rejected',()=>{
 const world=createInitialWorld(T);
 world.profiles[account]=createProfile(account,'tester','#43b59a',T,false);
 const before=world.profiles[account].inventory.length;
 for(let i=0;i<FREE_WING_TRIAL_LIMIT;i++){
  const result=applyAction(world,actor(),{action:'wing-draw'},{now:T+i,rng:()=>0});
  assert.equal(result.wingDraw.itemId,'wings-21');
  assert.equal(result.wingDraw.mode,'free-trial');
  assert.equal(result.wingDraw.drawsLeft,FREE_WING_TRIAL_LIMIT-i-1);
 }
 assert.equal(world.profiles[account].inventory.length,before+FREE_WING_TRIAL_LIMIT);
 assert.equal(worldView(world,account,T).profile.wingTrialDraws,5);
 const restored=migrateWorld(structuredClone(world),T+100);
 const denied=applyAction(restored,actor(),{action:'wing-draw'},{now:T+200,rng:()=>.99});
 assert.match(denied.error,/Five free wing draws used/);
 assert.equal(restored.profiles[account].inventory.length,before+5);
});

test('draw requests are authenticated and trial count cannot be bypassed by forged admin',()=>{
 const w=createInitialWorld(T);
 const guest='guest:impostor';
 w.profiles[guest]=createProfile(guest,'guest','#43b59a',T,false);
 const bad=applyAction(w,actor(guest,false),{action:'wing-draw',admin:true,price:0},{now:T,rng:()=>.94});
 assert.match(bad.error,/Google account required/);
 assert.equal(w.profiles[guest].wingTrialDraws,0);
 assert.equal(w.profiles[guest].inventory.length,1);
 const fake=applyAction(w,actor(guest,false),{action:'gm-wing-draw',admin:true},{now:T+1,rng:()=>0});
 assert.match(fake.error,/GM only/);
});

test('five percent Epic remains an independent rarity draw regardless of owned wings',()=>{
 assert.equal(WING_QUALITY_WEIGHTS.epic,5);
 const w=createInitialWorld(T);
 w.profiles[account]=createProfile(account,'tester','#43b59a',T,false);
 const won=applyAction(w,actor(),{action:'wing-draw'},{now:T,rng:()=>.94});
 assert.equal(won.wingDraw.quality,'epic');
 assert.ok(w.profiles[account].inventory.includes(won.wingDraw.itemId));
 assert.equal(drawWing({inventory:[]},()=>.94).quality,'epic');
});

test('Win98 login, public SUPPORT, functioning crank and full viewport painter are integrated',()=>{
 const html=read('index.html'),ui=read('src/ui.js'),css=read('wing-atelier.css'),main=read('src/main.js');
 assert.match(html,/GGTEMPLE\.EXE - Account Login/);
 assert.match(html,/id="wing-shop-button" data-panel="wing-shop"/);
 assert.match(html,/<span>SUPPORT<\/span>/);
 assert.doesNotMatch(html,/data-action="save-code"/);
 assert.match(ui,/data-draw-wing aria-label="轉動扭蛋機"/);
 assert.match(ui,/action:this\.self\?\.profile\?\.admin\?'gm-wing-draw':'wing-draw'/);
 assert.match(main,/\['gm-wing-draw','wing-draw'\]\.includes\(action\)/);
 assert.match(css,/body\.panel-wing-painter #panel\{/);
 assert.match(css,/width:100vw!important;height:100dvh!important/);
});
