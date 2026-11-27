// Presentation only: server owns inventory, currency, healing and removal.
export function pickupAvailable(world,action,id){
 return action==='pickup-coin'?world?.coins?.[id]?.available===true:
  action==='pickup-drop'?(world?.groundDrops||[]).some(d=>d.id===id):false;
}
export class PickupPreviewLedger{
 constructor(cancel){this.entries=new Map();this.cancel=cancel;}
 has(action,id){return this.entries.has(action+':'+id);}
 begin(action,id,world,start){
  const key=action+':'+id;
  if(this.entries.has(key)||!pickupAvailable(world,action,id))return null;
  const visual=start();if(!visual)return null;
  const entry={key,action,id,visual,revision:null};this.entries.set(key,entry);return entry;
 }
 finish(entry,result,world){
  if(!entry||this.entries.get(entry.key)!==entry)return;
  if(!pickupAvailable(world,entry.action,entry.id)){this.entries.delete(entry.key);return;}
  const revision=result?.worldRevision??result?.world?.revision;
  if(result&&Number.isFinite(revision)&&revision>(world?.revision??-1)){entry.revision=revision;return;}
  this.entries.delete(entry.key);this.cancel(entry);
 }
 reconcile(world){
  for(const entry of this.entries.values()){
   if(!pickupAvailable(world,entry.action,entry.id)){this.entries.delete(entry.key);continue;}
   if(entry.revision!==null&&world.revision>=entry.revision){this.entries.delete(entry.key);this.cancel(entry);}
  }
 }
}
