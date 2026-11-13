import * as THREE from 'three';
import {meleeFamilies} from './reletter/melee-motion.js';
const ray=new THREE.Raycaster(),center=new THREE.Vector2(),box=new THREE.Box3(),sphere=new THREE.Sphere(),hit=new THREE.Vector3(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
// RELETTER cameraElevationAim/rangedAim: camera parallax supplies elevation,
// character heading supplies yaw; melee stays level. Only host targets differ.
export function attackDirection(controller,camera,arena,roots,item,charge){
 const heading=controller.root.rotation.y;
 if(meleeFamilies.includes(item.family)&&!(item.exotic&&charge>=1))return [Math.sin(heading),0,Math.cos(heading)];
 if(item.firstPerson)return [-Math.sin(controller.yaw)*Math.cos(controller.pitch),-Math.sin(controller.pitch),-Math.cos(controller.yaw)*Math.cos(controller.pitch)];
 const origin=controller.root.position.clone().add(new THREE.Vector3(0,1,0));camera.updateMatrixWorld();ray.setFromCamera(center,camera);ray.far=250;
 const minDistance=camera.position.distanceTo(origin)*.3,point=ray.ray.at(150,new THREE.Vector3());let nearest=150;
 const accept=p=>{if(!p)return;const distance=p.distanceTo(ray.ray.origin);if(distance>minDistance&&distance<nearest){nearest=distance;point.copy(p);}};
 for(const mesh of arena.structureGroup.children)for(const h of ray.intersectObject(mesh,false))accept(h.point);
 const enemy=arena.world?.monster;if(enemy?.active){const p=enemy.position;box.min.set(p[0]-.45,p[1],p[2]-.45);box.max.set(p[0]+.45,p[1]+1.575,p[2]+.45);accept(ray.ray.intersectBox(box,hit));}
 for(const root of roots.values())if(root!==controller.root&&root.visible){sphere.center.copy(root.position);sphere.center.y+=1;sphere.radius=1.25;accept(ray.ray.intersectSphere(sphere,hit));}
 const floor=ray.ray.intersectPlane(ground,hit);if(floor&&floor.distanceTo(ray.ray.origin)<nearest)point.copy(floor);
 let direction=point.sub(origin).normalize();if(direction.dot(ray.ray.direction)<.1)direction=ray.ray.direction.clone();
 const vertical=THREE.MathUtils.clamp(direction.y,charge>=1&&controller.root.position.y<5?0:-.98,.98),horizontal=Math.sqrt(1-vertical*vertical);
 return [Math.sin(heading)*horizontal,vertical,Math.cos(heading)*horizontal];
}
