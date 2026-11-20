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
