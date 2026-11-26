// Compare with the exact published V85 in this checkout, using the same
// JS runtime for both implementations. No fetch, credentials or live world.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';

const original='15ede91';
const path='../src/shared/city-layout.js';
const originalURL=new URL(path+'?v085-original',import.meta.url).href;
const originalSource=execFileSync('git',['show',original+':src/shared/city-layout.js'],{encoding:'utf8'});
const hooks=registerHooks({
 resolve(specifier,context,next){
  const result=next(specifier,context);
  return context.parentURL?.includes('?v085-original')&&result.url===new URL(path,import.meta.url).href
   ?{...result,url:originalURL}:result;
 },
 load(url,context,next){
  return url===originalURL?{format:'module',source:originalSource,shortCircuit:true}:next(url,context);
 }
});
const old=await import(path+'?v085-original');
const current=await import(path);
const oldRules=await import('../src/shared/temple-rules.js?v085-original');
const currentRules=await import('../src/shared/temple-rules.js');
hooks.deregister();

function layout(m){
 const start=performance.now();
 const signs=m.CITY_LOTS.map(lot=>[lot.id,m.cityShopSignSpec(lot),m.citySignSpecs(lot)]);
 return {ms:performance.now()-start,signs};
}
const before=layout(old),after=layout(current);
assert.equal(JSON.stringify(after.signs),JSON.stringify(before.signs),'all original transforms, mount options and draw order');

const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const random=rng(85026);
let aimedSignCases=0;
for(const lot of old.CITY_LOTS)for(const sign of old.citySignSpecs(lot)){
 const p=old.signWorldPosition(lot,sign),s=Math.sin(lot.yaw),c=Math.cos(lot.yaw);
 // Pass through both the exact center and the upper outer slab edge;
 // especially exercise raised roofs and narrow blades near lot boundaries.
 for(const edge of [0,1]){
  const x=edge*(sign.width/2+.059),y=edge*(sign.height/2+.059),z=sign.depth/2+.5;
  const origin=[p[0]+x*c+z*s,p[1]+y,p[2]-x*s+z*c],direction=[-s,0,-c];
  assert.deepEqual(current.cityRaycast(origin,direction,1),old.cityRaycast(origin,direction,1),lot.id+' '+sign.id);
  aimedSignCases++;
 }
}
for(let i=0;i<2000;i++){
 const lot=old.CITY_LOTS[Math.floor(random()*old.CITY_LOTS.length)];
 const origin=[lot.x+(random()-.5)*60,random()*50,lot.z+(random()-.5)*60];
 const yaw=random()*6.283,dy=random()- .5,direction=[Math.sin(yaw),dy,Math.cos(yaw)];
 const state={[lot.id]:{hp:i%2?0:85,parts:{'sign-roof-0':0}}};
 const range=4+random()*130;
 assert.deepEqual(current.cityRaycast(origin,direction,range,state),old.cityRaycast(origin,direction,range,state));
}
for(let i=0;i<16;i++){
 const house={kind:'house',gmHouse:true,house:{width:5+i*.6,depth:5+i*.35,height:7+i,
  floors:1+i%7,signs:1+i%4,bladeCount:2,roofCount:2,flatStyle:'portrait'}};
 assert.deepEqual(current.structureSignSpecs(house),old.structureSignSpecs(house));
}
function combat(m){
 const base=1_795_650_000_000,random=rng(85),realUUID=crypto.randomUUID,realRandom=Math.random;
 let n=0;
 crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;
 Math.random=random;
 try{
  const world=m.createInitialWorld(base);
  const actor={key:'fixture',name:'V85 Fixture',color:'#43b59a',position:[101,0,-51],admin:true,role:'fighter',seat:0};
  m.ensureProfile(world,actor.key,actor.name,actor.color,base,true);
  const events=[];
  const act=(action,data,ms)=>{
   const result=m.applyAction(world,actor,{action,...data},{now:base+ms,rng:random,actors:[actor],seatIndex:0});
   assert.ok(!result.error,result.error);
   events.push(result);
   return result;
  };
  act('gm-player-level',{targetKey:actor.key,level:100},10);
  act('equip',{itemId:'saber-2'},20);
  act('attack',{charge:0,direction:[1,0,0]},500);
  act('equip',{itemId:'frost-5'},1800);
  act('attack',{phase:'charge'},2200);
  const released=act('attack',{charge:1,direction:[1,-.03,1]},5100);
  assert.ok(released.attackEvent?.ultimate,'full original frost cast');
  for(let ms=5200;ms<=7300;ms+=70)m.tickWorld(world,{now:base+ms,rng:random,activeFighters:1,actors:[actor]});
  act('equip',{itemId:'prism-5'},8000);
  act('attack',{phase:'charge'},8100);
  act('attack',{phase:'channel-start'},11100);
  for(let ms=11200;ms<=13800;ms+=1300){
   act('attack',{phase:'channel',charge:1,direction:[1,-.03,1]},ms);
   m.tickWorld(world,{now:base+ms+100,rng:random,activeFighters:1,actors:[actor]});
  }
  act('attack',{phase:'channel-stop'},14200);
  return JSON.stringify({events,world});
 }finally{
  crypto.randomUUID=realUUID;Math.random=realRandom;
 }
}
assert.equal(combat(currentRules),combat(oldRules),'ordered actions, event IDs, damage, mana and full final state');
console.log(JSON.stringify({lots:after.signs.length,rayCases:2000+aimedSignCases,customHouses:16,orderedCombatReplay:'byte-identical',layoutMs:{before:before.ms,after:after.ms}}));
