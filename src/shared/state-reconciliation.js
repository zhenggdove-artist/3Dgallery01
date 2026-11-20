// A server rejection refers to the pose sent at a specific sequence, not the
// fighter's current pose. Recover only the movement that happened AFTER that
// rejected packet; replaying an old authority point verbatim caused a visible
// backwards step each time an overloaded renderer delayed socket processing.
export function rebaseRejectedPose(accepted,submitted,current,blocked=()=>false){
 if(!Array.isArray(accepted)||!Array.isArray(submitted)||!Array.isArray(current)||
  [accepted,submitted,current].some(v=>v.length!==3||v.some(n=>!Number.isFinite(n))))return null;
 const dx=current[0]-submitted[0],dy=current[1]-submitted[1],dz=current[2]-submitted[2];
 const travel=Math.hypot(dx,dy,dz);
 // This is a prediction replay, never an allowance to bypass the server's
 // movement/collision rules or to replay a large unsupported teleport.
 // A delayed 90ms socket sample may trail several valid strides on busy frames.
 if(travel>12)return [...accepted];
 const next=[accepted[0]+dx,accepted[1]+dy,accepted[2]+dz];
 if(blocked(next[0],next[2],next[1]))return [...accepted];
 return next;
}
export function shouldIgnoreRejection(rejectionSeq,lastAcceptedSeq,lastCorrectedSeq){
 return Number.isSafeInteger(rejectionSeq)&&rejectionSeq>0&&
  (rejectionSeq<=lastAcceptedSeq||rejectionSeq<=lastCorrectedSeq);
}

// A speed-budget rejection during a late frame is not a forced teleport.
// Keep locally collision-validated movement visible and resend immediately;
// the Worker can then validate against the elapsed time since its last
// accepted pose. Hard building/invalid-position rejections still rebase.
export function keepPredictedMoveOnLatencyReject(error,accepted,submitted,current,blocked=()=>false){
 if(error!=='Movement rejected')return false;
 if(![accepted,submitted,current].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)))return false;
 const clientAdvance=Math.hypot(...current.map((v,i)=>v-submitted[i]));
 const authorityGap=Math.hypot(...current.map((v,i)=>v-accepted[i]));
 return clientAdvance<=3.5&&authorityGap<=8&&
  !blocked(current[0],current[2],current[1]);
}
