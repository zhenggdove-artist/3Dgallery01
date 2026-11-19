// GGTEMPLE: skeletal two-hand staff presentation. The shaft must remain
// attached to the actual right-hand joint at every animation frame.
import * as THREE from 'three';

export const STAFF_RAISE_SECONDS=.1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const advanceStaffRaise=(previous,casting,dt)=>
 clamp((Number(previous)||0)+(casting?1:-1)*clamp(Number(dt)||0,0,.12)/STAFF_RAISE_SECONDS,0,1);
const smooth=t=>t*t*(3-2*t);

// Both arms solve toward a physically reachable overhead grip. Unlike the old
// root-relative 2.04m socket, the final staff grip is read BACK from the actual
// animated right-hand bone, so animation blending cannot detach the weapon.
export function poseOverheadStaff(root,blade,bones,restore,progress=1){
 const rightHand=bones?.get('RightHand'),leftHand=bones?.get('LeftHand');
 const rightArm=bones?.get('RightArm'),leftArm=bones?.get('LeftArm');
 if(!rightHand)return;
 const weight=smooth(clamp(progress,0,1));
 root.updateWorldMatrix(true,true);
 const forward=new THREE.Vector3(0,0,1).applyQuaternion(
  root.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
 if(forward.lengthSq()<.001)forward.set(0,0,1);
 const shoulderR=rightArm?.getWorldPosition(new THREE.Vector3());
 const shoulderL=leftArm?.getWorldPosition(new THREE.Vector3());
 const rightElbow=bones?.get('RightForeArm');
 const restHand=rightHand.getWorldPosition(new THREE.Vector3());
 const upper=rightArm&&rightElbow?rightArm.getWorldPosition(new THREE.Vector3())
  .distanceTo(rightElbow.getWorldPosition(new THREE.Vector3())):.38;
 const lower=rightElbow?rightElbow.getWorldPosition(new THREE.Vector3()).distanceTo(restHand):.38;
 const reach=clamp(upper+lower,.3,1.7);
 const shoulder=shoulderR?.clone()||restHand.clone().add(new THREE.Vector3(0,.35,0));
 if(shoulderL)shoulder.add(shoulderL).multiplyScalar(.5);
 const aim=Array.isArray(root.userData.staffAimDirection)?
  new THREE.Vector3(...root.userData.staffAimDirection):forward.clone();
 if(aim.lengthSq()<.001)aim.copy(forward);
 aim.normalize();
 // Lower the two forward-ray wand grips without separating the mesh from
 // the skeletal right-hand joint. Native rays still originate at the tip.
 const beamWand=['beam','lightning'].includes(blade.userData.family);
 const handLift=beamWand?.16:.48;
 const rightTarget=shoulder.addScaledVector(forward,Math.min(.33,reach*.43))
  .add(new THREE.Vector3(0,Math.min(handLift,reach*.6),0));
 // Never ask a short-armed model to reach an impossible high target.
 if(shoulderR){
  const offset=rightTarget.clone().sub(shoulderR),limit=reach*.9;
  if(offset.length()>limit)rightTarget.copy(shoulderR).add(offset.setLength(limit));
 }
 const saved=new Map();
 const capture=bone=>{
  if(!bone||saved.has(bone))return;
  const initial=bone.quaternion.clone();
  saved.set(bone,initial);
  restore.push([bone,'quaternion',initial.clone()]);
 };
 const joint=new THREE.Vector3(),handPos=new THREE.Vector3(),actual=new THREE.Vector3();
 const desired=new THREE.Vector3(),delta=new THREE.Quaternion();
 const parentQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion();
 const solve=(side,target)=>{
  const hand=bones?.get(side+'Hand'),fore=bones?.get(side+'ForeArm');
  const arm=bones?.get(side+'Arm');
  const chain=[fore,arm].filter(Boolean);
  if(!hand||!chain.length)return;
  chain.forEach(capture);
  for(let pass=0;pass<4;pass++)for(const bone of chain){
   bone.getWorldPosition(joint);
   hand.getWorldPosition(handPos);
   actual.copy(handPos).sub(joint);
   desired.copy(target).sub(joint);
   if(actual.lengthSq()<1e-8||desired.lengthSq()<1e-8)continue;
   delta.setFromUnitVectors(actual.normalize(),desired.normalize());
   bone.parent.getWorldQuaternion(parentQ).invert();
   bone.getWorldQuaternion(worldQ);
   bone.quaternion.copy(parentQ.multiply(delta).multiply(worldQ)).normalize();
   // Refresh only this joint and its descendants, not the entire skinned scene.
   bone.updateWorldMatrix(true,true);
  }
 };
 solve('Right',rightTarget);
 root.updateWorldMatrix(true,true);
 const solvedRight=rightHand.getWorldPosition(new THREE.Vector3());
 if(leftArm&&leftHand)solve('Left',solvedRight.clone().add(new THREE.Vector3(0,-.15,0)));
 // Blend from the actual walk/idle hand pose to the raised position over .1s.
 for(const [bone,initial] of saved){
  const raised=bone.quaternion.clone();
  bone.quaternion.copy(initial).slerp(raised,weight);
 }
 root.updateWorldMatrix(true,true);
 // Always lock the staff origin to the skinned right palm, including mid-raise.
 const grip=rightHand.getWorldPosition(new THREE.Vector3());
 blade.position.copy(root.worldToLocal(grip.clone()));
 const upright=new THREE.Vector3(aim.x*.035,1,aim.z*.035).normalize();
 const targetQuaternion=root.getWorldQuaternion(new THREE.Quaternion()).invert()
  .multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),upright));
 blade.quaternion.slerp(targetQuaternion,weight).normalize();
 blade.updateWorldMatrix(true,true);
}
