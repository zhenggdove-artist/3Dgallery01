import test from 'node:test';
import assert from 'node:assert/strict';
import {GPUFrameQueue} from '../src/gpu-frame-queue.js';
function mockGL(){
 const g={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,ALREADY_SIGNALED:3,CONDITION_SATISFIED:4,WAIT_FAILED:5,created:0,deleted:0,flushes:0,status:2,lost:false};
 g.isContextLost=()=>g.lost;g.fenceSync=()=>({id:++g.created});g.clientWaitSync=()=>g.status;g.deleteSync=()=>g.deleted++;g.flush=()=>g.flushes++;return g;
}
test('full resolution submissions cannot build an unbounded GPU queue',()=>{
 const gl=mockGL(),q=new GPUFrameQueue(gl,true,2);
 assert.equal(q.canSubmit(),true);q.submitted();
 assert.equal(q.canSubmit(),true);q.submitted();
 for(let i=0;i<100;i++)assert.equal(q.canSubmit(),false);
 assert.equal(gl.created,2);assert.equal(q.skipped,100);
 gl.status=gl.CONDITION_SATISFIED;assert.equal(q.canSubmit(),true);
 assert.equal(gl.deleted,2);assert.equal(q.pending.length,0);
 q.submitted();q.reset();assert.equal(gl.deleted,3);
});
test('unsupported or failed fences gracefully use original renderer path',()=>{
 const gl=mockGL(),q=new GPUFrameQueue(gl);q.submitted();gl.status=gl.WAIT_FAILED;
 assert.equal(q.canSubmit(),true);assert.equal(q.enabled,false);assert.equal(gl.deleted,1);
 assert.equal(new GPUFrameQueue({},true).canSubmit(),true);
 const lost=new GPUFrameQueue(gl);gl.lost=true;assert.equal(lost.canSubmit(),false);
});
