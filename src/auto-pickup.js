// Detect contact in the existing simulation frame; keep the old 300ms
// retry interval for the same target, not first contact with a new target.
import {nearbySnapshotRows} from './shared/arena.js';
export class PickupScheduler{
 constructor(platforms,send,clock=()=>performance.now()){this.platforms=platforms;this.send=send;this.clock=clock;this.pending=new Set();this.retry=new Map();this.owner=null;this.last=null;this.nextScan=0;}
 reset(owner){this.owner=owner;this.pending=new Set();this.retry=new Map();this.last=null;this.nextScan=0;}
 request(action,id,field,automatic=false){
  const key=action+':'+id,pending=this.pending,retry=this.retry;
  if(pending.has(key))return null;
  pending.add(key);
  if(automatic)this.last=null;
  const finish=()=>{
   pending.delete(key);
   // An outstanding request from an old session cannot affect the new one.
   if(this.pending!==pending)return;
   retry.set(key,this.clock()+300);
   this.last=null;
  };
  try{return Promise.resolve(this.send(action,{[field]:id},automatic)).finally(finish);}catch(error){finish();return Promise.reject(error);}
 }
 poll(world,position,owner,now,wallTime){
  if(this.owner!==owner)this.reset(owner);
  if(!world||!owner||this.pending.size>=4)return null;
  const {x,y,z}=position,coins=world.coins,drops=world.groundDrops,last=this.last;
  if(last&&last.x===x&&last.y===y&&last.z===z&&last.coins===coins&&last.drops===drops&&now<this.nextScan)return null;
  this.last={x,y,z,coins,drops};this.nextScan=now+300;
  for(const [key,at] of this.retry){if(at<=now)this.retry.delete(key);else this.nextScan=Math.min(this.nextScan,at);}
  const available=key=>!this.pending.has(key)&&!this.retry.has(key);
  // Preserve the exact previous reach, coin priority, and owner lock.
  const coin=this.platforms.find(c=>coins?.[c.id]?.available&&available('pickup-coin:'+c.id)&&(x-c.coinPosition[0])**2+(z-c.coinPosition[2])**2<2.8**2&&Math.abs(y-c.coinPosition[1])<3.1);
  if(coin)return this.request('pickup-coin',coin.id,'platformId',true);
  const drop=nearbySnapshotRows(drops,x,z,2.2).find(d=>{
   if(!available('pickup-drop:'+d.id)||(x-d.position[0])**2+(y-d.position[1])**2+(z-d.position[2])**2>=2.2**2)return false;
   if(d.owner===owner&&wallTime<d.ownerLockedUntil){this.nextScan=Math.min(this.nextScan,now+d.ownerLockedUntil-wallTime);return false;}
   return true;
  });
  if(drop)return this.request('pickup-drop',drop.id,'dropId',true);
  return null;
 }
}
