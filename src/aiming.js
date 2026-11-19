import * as THREE from 'three';
import {meleeFamilies} from './reletter/melee-motion.js';
import {isChannelStaff} from './shared/weapon-abilities.js';
import {ENEMY_RADIUS,ENEMY_HEIGHT} from './shared/island-combat.js';
export const AIM_RAISE_PX=5;
// NDC Y is positive upward. Both the reticle and ALL weapon rays share this
// five-CSS-pixel offset, including iPhone-sized viewports and sniper optics.
export const crosshairNdc=(height=globalThis.innerHeight||720)=>new THREE.Vector2(0,2*AIM_RAISE_PX/Math.max(1,height));
const ray=new THREE.Raycaster(),box=new THREE.Box3(),sphere=new THREE.Sphere(),hit=new THREE.Vector3(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
export function cameraAimDirection(camera){
 camera.updateMatrixWorld();
 ray.setFromCamera(crosshairNdc(),camera);
 return ray.ray.direction.clone();
}
// RELETTER cameraElevationAim/rangedAim: camera parallax supplies elevation,
// character heading supplies yaw; melee stays level. Only host targets differ.
export function attackDirection(controller,camera,arena,roots,item,charge,muzzle=null){
 const heading=controller.root.rotation.y;
 if(meleeFamilies.includes(item.family)&&!(item.exotic&&charge>=1))return [Math.sin(heading),0,Math.cos(heading)];
 if(item.firstPerson)return cameraAimDirection(camera).toArray();
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
