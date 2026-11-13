import * as THREE from 'three';
// Animal guns fire from the mouth on the original procedural head, not the avatar.
// Keep the socket local to the weapon so skinning, shoulder IK and rotation follow it.
export function weaponMuzzle(root,item,target=new THREE.Vector3()){
  const weapon=root?.userData.blade;
  if(!weapon||!item?.firstPerson)return null;
  let socket=weapon.getObjectByName('projectile-muzzle');
  if(!socket){socket=new THREE.Object3D();socket.name='projectile-muzzle';socket.position.set(0,.97,.265);weapon.add(socket);}
  socket.updateWorldMatrix(true,false);return socket.getWorldPosition(target);
}
