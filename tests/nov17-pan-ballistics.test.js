import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerController} from '../src/player-controller.js';
import {PAN_BLAST_LAUNCH_SPEED,PAN_BLAST_BOUNCE_SPEEDS,PAN_BLAST_INITIAL_DURATION,
 samplePanBlastArc,samplePanBlastPosition,PAN_BLAST_TOTAL_DURATION} from '../src/shared/pan-blast-flight.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';

test('sampled path has one high arc followed by exactly three decaying upward bounces',()=>{
 const v=[PAN_BLAST_LAUNCH_SPEED,...PAN_BLAST_BOUNCE_SPEEDS];
 const g=25,peaks=[];
 let start=0;
 for(const velocity of v){
  const duration=2*velocity/g,peak=samplePanBlastArc((start+duration/2)*1000);
  peaks.push(peak.height);
  assert.ok(peak.height>0,'every bounce must leave the ground');
  start+=duration;
 }
 assert.ok(peaks[0]>peaks[1]&&peaks[1]>peaks[2]&&peaks[2]>peaks[3]);
 assert.ok(peaks[0]>=3,'initial blast must be a visible aerial launch, not a ground shove');
 assert.equal(samplePanBlastArc((PAN_BLAST_TOTAL_DURATION+.1)*1000).completed,true);
 const flight={origin:[10,0,20],vector:[1,0,0],distance:8,startAt:10000};
 const end=samplePanBlastPosition(flight,10000+PAN_BLAST_TOTAL_DURATION*1000+10);
 assert.deepEqual(end.position,[18,0,20],'final horizontal displacement equals explosion radius');
 assert.ok(PAN_BLAST_INITIAL_DURATION<1.2);
});

test('real player controller launches, flies horizontally, lands and bounces three times',()=>{
 const c=Object.create(PlayerController.prototype);
 c.root=new THREE.Group();c.root.position.set(60,0,0);
 c.arena={groundHeight:()=>0,blocked:()=>false};
 c.jumpVelocity=new THREE.Vector3();c.enabled=true;c.stunUntil=0;
 c.updateCamera=()=>{};c.state=()=>({});
 c.panBlastFlight=null;c.grounded=true;c.velocityY=0;c.speed=8;
 assert.equal(c.beginPanBlast({panBlast:true,vector:[1,0,0],knockbackDistance:7}),true);
 assert.equal(c.grounded,false);
 assert.equal(c.velocityY,PAN_BLAST_LAUNCH_SPEED);
 let contacts=0,lastY=c.root.position.y,heights=[0,0,0,0];
 for(let i=0;i<700;i++){
  const phase=c.panBlastFlight?.rebounds??3;
  c.update(.005);
  heights[phase]=Math.max(heights[phase],c.root.position.y);
  if(lastY>0&&c.root.position.y===0)contacts++;
  lastY=c.root.position.y;
  if(!c.panBlastFlight)break;
 }
 assert.equal(contacts,4,'one main landing plus three diminishing rebound landings');
 assert.ok(heights[0]>=3&&heights[0]>heights[1]&&heights[1]>heights[2]&&heights[2]>heights[3]);
 assert.ok(Math.abs(c.root.position.x-67)<.015,'launch carries victim exactly the explosion radius');
 assert.equal(c.root.position.y,0);assert.equal(c.grounded,true);assert.equal(c.panBlastFlight,null);
});

test('server monster is NOT teleported and follows the same three airborne bounces',()=>{
 const T=2_300_000;
 const world=createInitialWorld(T),caster={key:'caster',name:'caster',color:'#ffffff',position:[75,0,0],role:'fighter',admin:false};
 const p=ensureProfile(world,'caster','caster','#ffffff',T);
 p.inventory.push('pan-1');p.equipment.weapon='pan-1';
 world.monster={active:true,id:'mob',generation:1,variant:'warden',
  model:'warden',hp:1000,maxHp:1000,position:[75.4,0,9],nextAttackAt:T+20000};
 const start=applyAction(world,caster,{action:'attack',phase:'charge'},{now:T+1000});
 assert.equal(start.error,undefined);
 const at=T+4000;
 const shot=applyAction(world,caster,{action:'attack',direction:[0,0,1],charge:1},{now:at,actors:[caster]});
 assert.equal(shot.error,undefined);
 const detonation=at+650;
 tickWorld(world,{now:detonation,actors:[caster],activeFighters:0,rng:()=>.5});
 const flight=world.monster.panBlastFlight;
 assert.ok(flight,'a struck monster starts a server-owned launch instead of an instant teleport');
 assert.ok(Math.abs(world.monster.position[0]-flight.origin[0])<.001,'initial knockback position has not jumped');
 tickWorld(world,{now:detonation+200,actors:[caster],activeFighters:0,rng:()=>.5});
 assert.ok(world.monster.position[1]>0,'monster visibly rises from ground after detonation');
 assert.ok(world.monster.position[0]>flight.origin[0],'horizontal displacement progresses over time');
 tickWorld(world,{now:detonation+(PAN_BLAST_TOTAL_DURATION+0.1)*1000,actors:[caster],activeFighters:0,rng:()=>.5});
 assert.equal(world.monster.panBlastFlight,undefined);
 assert.ok(Math.abs(world.monster.position[1])<.01,'final monster position is back at ground');
});
