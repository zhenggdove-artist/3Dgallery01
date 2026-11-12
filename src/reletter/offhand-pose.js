// Original RELETTER three-iteration offhand IK.
import * as THREE from 'three';
const cache=new WeakMap();function fishingBones(model){if(cache.has(model))return cache.get(model);const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/[^a-z0-9]/gi,'').replace(/^mixamorig\d*/i,'')]=o;});cache.set(model,bones);return bones;}
export function supportOffhand(model,target,strength){
 const bones=fishingBones(model),hand=bones.LeftHand;if(!hand)return;model.updateMatrixWorld(true);
 for(let i=0;i<3;i++)for(const bone of [bones.LeftForeArm,bones.LeftArm]){if(!bone)continue;const origin=bone.getWorldPosition(new THREE.Vector3()),actual=hand.getWorldPosition(new THREE.Vector3()).sub(origin),desired=target.clone().sub(origin);if(actual.lengthSq()<1e-8||desired.lengthSq()<1e-8)continue;const delta=new THREE.Quaternion().setFromUnitVectors(actual.normalize(),desired.normalize());delta.slerp(new THREE.Quaternion(),1-strength);const world=bone.getWorldQuaternion(new THREE.Quaternion()),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(delta).multiply(world));bone.updateMatrixWorld(true);}
}
