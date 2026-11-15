import {MONSTER_SPAWNS,ARENA_RADIUS,insideArtSanctuary} from './arena.js';
import {ISLAND_ENEMIES,ENEMY_HEIGHT,ENEMY_RADIUS} from './island-combat.js';
const rngInt=(rng,n)=>Math.min(n-1,Math.floor(Math.max(0,Math.min(.999999,rng()))*n));
export const MONSTER_PACK_SIZE=5;
export const MONSTER_SCALE=6;
export function monsterPosition(rng=Math.random,others=[]){
 for(let t=0;t<64;t++){
  const angle=rng()*Math.PI*2,distance=63+Math.sqrt(rng())*25;
  const p=[Math.cos(angle)*distance,0,Math.sin(angle)*distance];
  if(!insideArtSanctuary(p)&&Math.hypot(p[0],p[2])<=ARENA_RADIUS-2&&others.every(m=>Math.hypot(p[0]-m.position[0],p[2]-m.position[2])>12))return p;
 }
 const a=others.length*Math.PI*2/MONSTER_PACK_SIZE,r=76;
 return [Math.cos(a)*r,0,Math.sin(a)*r];
}
export function spawnMonsterPack(world,now=Date.now(),rng=Math.random){
 world.monsters??=[];let changed=false;
 for(let i=0;i<MONSTER_PACK_SIZE;i++){
  const old=world.monsters[i];
  if(old?.active)continue;
  // Respawn a fallen creature at another safe perimeter position. Each slot
  // retains its model identity to avoid loading duplicate 6x asset variants.
  const peers=world.monsters.filter((m,n)=>n!==i&&m?.active);
  const position=monsterPosition(rng,peers),model=ISLAND_ENEMIES[i%ISLAND_ENEMIES.length];
  const generation=(old?.generation||0)+1,maxHp=350+45*i;
  world.monsters[i]={
   id:crypto.randomUUID(),slot:i,active:true,model,variant:model,position,
   hp:maxHp,maxHp,skills:[],generation,spawnedAt:now,
   nextAttackAt:now+1800+i*230,nextSpawnAt:now,attackStyles:true,
   level:Math.max(1,Math.floor(generation/4)+1),bodyHeight:ENEMY_HEIGHT,
   bodyRadius:ENEMY_RADIUS,attackRadius:4.5,damage:10+i*2
  };
  changed=true;
 }
 if(world.monsters.length>MONSTER_PACK_SIZE){world.monsters.length=MONSTER_PACK_SIZE;changed=true;}
 return changed;
}
