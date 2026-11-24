import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {GunController} from '../src/gun-controller.js';
import {disguiseFrame} from '../src/reletter/outfit-model.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('scope ray is optical center and shoulder retains lifted reticle',()=>{
 const camera=new T.PerspectiveCamera(20,1,.1,100);camera.position.set(1,2,3);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const c={root:new T.Group()},context={camera,mode:2,controller:()=>c,weapon:()=>({id:'black-cat'})};
 const scoped=new T.Vector3(...GunController.prototype.shot.call(context).direction),forward=camera.getWorldDirection(new T.Vector3());
 assert.ok(scoped.distanceTo(forward)<1e-7);
 context.mode=1;const shoulder=new T.Vector3(...GunController.prototype.shot.call(context).direction);assert.ok(shoulder.distanceTo(forward)>.001);
 assert.match(read('gun.css'),/body\.sniper-scoped #crosshair,#gun-overlay\.scoped \.gun-reticle\{display:none!important\}/);
});
test('disguise local vertical follows anatomy even with rotated head and hips',()=>{
 const model=new T.Group();model.scale.setScalar(100);model.rotation.z=Math.PI;
 const bones=new Map();
 for(const [name,p] of [['Head',[0,.015,0]],['HeadTop_End',[0,.018,0]],['Hips',[0,.009,0]],['LeftFoot',[.002,0,0]],['RightFoot',[-.002,0,0]],['LeftArm',[.004,.013,0]],['RightArm',[-.004,.013,0]]]){
  const b=new T.Bone();b.position.set(...p);b.rotation.x=Math.PI;model.add(b);bones.set(name,b);
 }
 model.updateMatrixWorld(true);const frame=disguiseFrame(T,model,bones,.3);
 assert.ok(new T.Vector3(0,1,0).applyQuaternion(frame.rotation).distanceTo(new T.Vector3(0,1,0))<1e-6);
 assert.ok(frame.height>.018&&frame.height<.02);assert.ok(frame.base.y<.001);
 assert.match(read('src/reletter/outfit-model.js'),/model\.add\(g\);g\.updateMatrixWorld\(true\)/);
});
test('release tokens retain numeric format required by deploy pipeline',()=>{
 assert.match(read('index.html'),/const release = '20\d{6}-[^']+-r\d+'/);
});