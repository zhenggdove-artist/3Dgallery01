import * as THREE from 'three';
import {meleeFamilies} from './reletter/melee-motion.js';
import {isChannelStaff} from './shared/weapon-abilities.js';
import {ENEMY_RADIUS,ENEMY_HEIGHT} from './shared/island-combat.js';
export const AIM_RAISE_PX=30;
export const BEAM_RETICLE_DISTANCE=90; // World-space target is beyond the avatar, not at the wand tip.
// NDC Y is positive upward. Both the reticle and ALL weapon rays share this
// thirty-CSS-pixel offset, including iPhone-sized viewports and sniper optics.
export const crosshairNdc=(height=globalThis.innerHeight||720)=>new THREE.Vector2(0,2*AIM_RAISE_PX/Math.max(1,height));
const ray=new THREE.Raycaster(),box=new THREE.Box3(),sphere=new THREE.Sphere(),hit=new THREE.Vector3(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
export function cameraAimDirection(camera){
 camera.updateMatrixWorld();
 ray.setFromCamera(crosshairNdc(),camera);
 return ray.ray.direction.clone();
}
// A third-person camera is BEHIND and typically BELOW the held wand.
// Sending a parallel ray out of the wand retains that offset forever. The
// authentic #08/#29 native beam therefore misses the screen reticle even
// though its own WebGL mesh is rendering. Converge the wand emitter on a
// DISTANT camera reticle point: clearly forward of the actor, with positive
// elevation whenever the player looks upward. Never intersect near terrain.
export function raisedBeamDirection(camera,muzzle=null){
 camera.updateMatrixWorld();
 ray.setFromCamera(crosshairNdc(),camera);
 const forward=ray.ray.direction.clone();
 if(!muzzle?.isVector3)return forward;
 const target=ray.ray.at(BEAM_RETICLE_DISTANCE,new THREE.Vector3());
 const aimed=target.sub(muzzle).normalize();
 // Looking upward must NEVER produce an underground ray merely because the
 // third-person camera is offset below the emitter. Retain continuous yaw.
 if(forward.y>0&&aimed.y<Math.min(.01,forward.y)) {
  aimed.y=Math.min(.01,forward.y);
  aimed.normalize();
 }
 return aimed;
}
// RELETTER cameraElevationAim/rangedAim: camera parallax supplies elevation,
// character heading supplies yaw; melee stays level. Only host targets differ.
export function attackDirection(controller,camera,arena,roots,item,charge,muzzle=null){
 const heading=controller.root.rotation.y;
 if(meleeFamilies.includes(item.family)&&!(item.exotic&&charge>=1))return [Math.sin(heading),0,Math.cos(heading)];
 if(item.firstPerson)return cameraAimDirection(camera).toArray();
 // Straight lightning / prism spells must follow the camera's FULL 3D
 // reticle ray, including upward pitch. The generic muzzle-to-intersection
 // correction may select a nearby ground/structure point BELOW the raised
 // staff when the camera is looking up from a lower level. That inverted
 // the ray and sent the actual 00GameDevs #08/#29 effects underground.
 // Both the server attack and the live native emitter consume this same
 // vector, so their damage volumes and graphics cannot disagree.
 if(isChannelStaff(item)&&(item.family==='lightning'||item.family==='beam'))
  return raisedBeamDirection(camera,muzzle).toArray();
 const origin=muzzle?.isVector3?muzzle.clone():controller.root.position.clone().add(new THREE.Vector3(0,1,0));camera.updateMatrixWorld();ray.setFromCamera(crosshairNdc(),camera);ray.far=250;
 // Use actual screen-centre ray intersections, then project FROM the live staff tip.
 // A 150m guess made nearby targets and raised staffs fire below the crosshair.
 const minDistance=camera.position.distanceTo(origin)*.3,point=ray.ray.at(150,new THREE.Vector3());let nearest=150;
 const accept=p=>{if(!p)return;const distance=p.distanceTo(ray.ray.origin);if(distance>minDistance&&distance<nearest){nearest=distance;point.copy(p);}};
 for(const mesh of arena.structureGroup.children)for(const h of ray.intersectObject(mesh,false))accept(h.point);
 for(const enemy of [arena.world?.monster,...(arena.world?.monsters||[])])if(enemy?.active){const p=enemy.position,r=enemy.bodyRadius||ENEMY_RADIUS,h=enemy.bodyHeight||ENEMY_HEIGHT;box.min.set(p[0]-r,p[1]-.3,p[2]-r);box.max.set(p[0]+r,p[1]+h+.3,p[2]+r);accept(ray.ray.intersectBox(box,hit));}
 for(const model of [arena.islandEnemies?.current,...(arena.islandEnemies?.extraModels||[])])if(model?.visible){box.setFromObject(model);accept(ray.ray.intersectBox(box,hit));}
 for(const root of roots.values())if(root!==controller.root&&root.visible){sphere.center.copy(root.position);sphere.center.y+=1;sphere.radius=1.25;accept(ray.ray.intersectSphere(sphere,hit));}
 const floor=ray.ray.intersectPlane(ground,hit);if(floor&&floor.distanceTo(ray.ray.origin)<nearest)point.copy(floor);
 let direction=point.sub(origin).normalize();if(direction.dot(ray.ray.direction)<.1)direction=ray.ray.direction.clone();
 if(isChannelStaff(item))return direction.toArray();
 const vertical=THREE.MathUtils.clamp(direction.y,charge>=1&&controller.root.position.y<5?0:-.98,.98),horizontal=Math.sqrt(1-vertical*vertical);
 return [Math.sin(heading)*horizontal,vertical,Math.cos(heading)*horizontal];
}
