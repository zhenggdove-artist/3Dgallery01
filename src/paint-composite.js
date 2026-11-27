// Replay on the existing decal, not one permanent GPU texture per owner.
// The common no-scoped-eraser path retains the original canvas rendering.
const work=new Map();
export function paintRecordOwner(record){return typeof record.owner==='string'&&record.owner?record.owner:null;}
function canvasContext(ctx){const c=document.createElement('canvas');c.width=ctx.canvas.width;c.height=ctx.canvas.height;return c.getContext('2d');}
export function paintOwnerStrokes(ctx,records,draw){
 if(!records.some(r=>r.tool==='eraser'&&r.eraseOwn===true)){
  for(const r of records)draw(ctx,r,r.tool==='eraser'?'destination-out':'source-over');
  return;
 }
 const width=ctx.canvas.width,height=ctx.canvas.height,key=width+'x'+height;
 let w=work.get(key);
 if(!w){w={scratch:canvasContext(ctx),masks:[]};work.set(key,w);if(work.size>4){const first=work.keys().next().value,old=work.get(first);for(const m of [old.scratch,...old.masks])m.canvas.width=m.canvas.height=0;work.delete(first);}}
 const masks=new Map();let used=0;
 const maskFor=key=>{let m=masks.get(key);if(!m){m=w.masks[used]||(w.masks[used]=canvasContext(ctx));used++;m.clearRect(0,0,width,height);masks.set(key,m);}return m;};
 ctx.save();ctx.globalCompositeOperation='destination-over';
 for(let i=records.length-1;i>=0;i--){
  const r=records[i],owner=paintRecordOwner(r);
  if(r.tool==='eraser'){
   if(r.eraseOwn===true&&!owner)continue;
   draw(maskFor(r.eraseOwn===true?owner:null),r,'source-over');continue;
  }
  const all=masks.get(null),own=owner&&masks.get(owner);
  if(!all&&!own){draw(ctx,r,'destination-over');continue;}
  const scratch=w.scratch;scratch.clearRect(0,0,width,height);
  draw(scratch,r,'source-over');scratch.save();scratch.globalCompositeOperation='destination-out';
  if(all)scratch.drawImage(all.canvas,0,0);if(own)scratch.drawImage(own.canvas,0,0);scratch.restore();
  ctx.globalCompositeOperation='destination-over';ctx.drawImage(scratch.canvas,0,0);
 }
 ctx.restore();
 // Shared workspace is bounded by canvas dimensions, not wall or player count.
 for(const m of w.masks.splice(3))m.canvas.width=m.canvas.height=0;
}
