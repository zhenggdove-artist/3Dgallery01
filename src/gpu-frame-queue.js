// Non-blocking WebGL2 backpressure. Never queue unlimited full-resolution frames
// behind a busy mobile GPU. Simulation/network remain independent of this gate.
export class GPUFrameQueue {
 constructor(gl,enabled=true,limit=2){
  this.gl=gl;this.limit=limit;this.pending=[];this.skipped=0;this.peak=0;this.failures=0;
  this.enabled=!!(enabled&&gl&&typeof gl.fenceSync==='function'&&typeof gl.clientWaitSync==='function');
 }
 canSubmit(){
  if(!this.enabled)return true;
  const gl=this.gl;
  if(gl.isContextLost())return false;
  try{
   while(this.pending.length){
    const status=gl.clientWaitSync(this.pending[0],0,0);
    if(status===gl.TIMEOUT_EXPIRED)break;
    if(status!==gl.ALREADY_SIGNALED&&status!==gl.CONDITION_SATISFIED){this.disable();return true;}
    gl.deleteSync(this.pending.shift());
   }
   if(this.pending.length>=this.limit){this.skipped++;return false;}
   return true;
  }catch{this.disable();return true;}
 }
 submitted(){
  if(!this.enabled)return;
  try{
   if(this.gl.isContextLost())return;
   const fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);
   if(!fence){this.disable();return;}
   this.pending.push(fence);this.peak=Math.max(this.peak,this.pending.length);
   this.gl.flush();
  }catch{this.disable();}
 }
 reset(){
  for(const fence of this.pending){try{this.gl.deleteSync(fence);}catch{}}
  this.pending.length=0;
 }
 disable(){this.failures++;this.reset();this.enabled=false;}
}
