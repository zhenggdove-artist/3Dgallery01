import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {availableRoleSeat} from '../src/shared/spectator-seats.js';
import {createInitialWorld,ensureProfile,applyAction,MAX_FIGHTERS,MAX_SPECTATORS} from '../src/shared/temple-rules.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const T=77_000_000;
test('four fighter seats are authoritative and fifth join goes to spectator',()=>{
 const four=Array.from({length:4},(_,seat)=>({role:'fighter',seat}));
 assert.equal(availableRoleSeat(four,'fighter',MAX_FIGHTERS,MAX_SPECTATORS),undefined);
 assert.equal(availableRoleSeat(four,'spectator',MAX_FIGHTERS,MAX_SPECTATORS),4);
 assert.equal(availableRoleSeat(four.slice(0,3),'fighter'),3);
});
test('GM spectator test reserves original fighter seat until restoration',()=>{
 const viewers=[{role:'fighter',seat:0},{role:'fighter',seat:1},{role:'fighter',seat:3},
  {role:'spectator',seat:4,preview_seat:2}];
 assert.equal(availableRoleSeat(viewers,'fighter'),undefined,
  'ordinary joins cannot steal the temporarily reserved GM seat');
 assert.equal(availableRoleSeat(viewers,'spectator'),5);
 assert.equal(availableRoleSeat(viewers.filter(v=>v.preview_seat===undefined),'fighter'),2);
});
test('spectator WRITE/REPLY persists while combat and building remain denied',()=>{
 const world=createInitialWorld(T);
 const actor={key:'viewer-5',name:'Viewer',color:'#82b1ec',role:'spectator',position:[0,0,0]};
 ensureProfile(world,actor.key,actor.name,actor.color,T);
 const context={now:T+1000,actors:[actor],rng:()=>.5};
 const result=applyAction(world,actor,{action:'plant',text:'Observer writes from the central tree',position:[0,0,0]},context);
 assert.equal(result.error,undefined);
 assert.equal(result.plant.author,'Viewer');
 assert.ok(world.plants.some(v=>v.id===result.plant.id));
 const reply=applyAction(world,actor,{action:'plant',text:'A reply',parentId:result.plant.id,position:[0,0,0]},
  {...context,now:T+2000});
 assert.equal(reply.error,undefined);
 assert.equal(reply.plant.parentId,result.plant.id);
 for(const action of ['attack','build','pickup-coin','write-begin']){
  assert.match(applyAction(world,actor,{action},context).error,/Spectators/);
 }
});
test('Google verified identity makes guest button nonfunctional and hidden before profile creation',()=>{
 const ui=read('src/ui.js'),main=read('src/main.js'),network=read('src/network.js'),
  html=read('index.html'),css=read('fidelity-ui.css');
 assert.match(ui,/confirmGoogleIdentity\(token\)/);
 assert.match(ui,/this\.googleAuthenticated=true/);
 assert.match(ui,/\$\('guest-form'\)\.hidden=true/);
 assert.match(ui,/if\(this\.googleAuthenticated\|\|this\.firebaseIdToken\)/);
 assert.match(main,/ui\.confirmGoogleIdentity\(token\)/);
 assert.match(network,/if\(mode==='guest'&&firebaseIdToken\)/);
 assert.match(css,/#guest-form\[hidden\]/);
 assert.match(html,/id="entry-form" hidden/);
});
test('public viewer and GM test use one real role, invisible first-person camera and writable tree',()=>{
 const main=read('src/main.js'),controller=read('src/player-controller.js'),
  network=read('src/network.js'),worker=read('cloudflare/worker.js'),
  ui=read('src/ui.js'),html=read('index.html');
 assert.match(main,/network\.changeRole\(\{role:returning\?'fighter':'spectator',gmPreview:true\}\)/);
 assert.match(main,/function applyRoleTransition\(data\)/);
 assert.match(controller,/this\.root\.visible=role==='fighter'/);
 assert.match(controller,/this\.role==='spectator'&&!this\.followTarget/);
 assert.match(ui,/name==='social'&&!fromJourney&&this\.self\.role!=='spectator'/);
 assert.match(ui,/data-gm-action="spectator-test"/);
 assert.match(html,/id="gm-spectator-test-exit"/);
 assert.match(html,/id="spectator-fly-controls"/);
 assert.match(network,/typeof role==='string'\?\{role\}:role/);
 assert.match(worker,/preview_seat/);
 assert.match(worker,/const spectatorWrite=session\.role==='spectator'&&body\.action==='plant'/);
 assert.match(worker,/position:spectatorWrite\|\|!state\?\.position\?\[0,0,0\]:state\.position/);
});
