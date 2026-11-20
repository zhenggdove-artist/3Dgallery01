import * as THREE from 'three';

// Curves the ORIGINAL 00GameDevs #08/#29 vertex shaders. We retain every
// vendor particle, lightning fork, charging ring, shader colour and geometry.
// No replacement line/cylinder/sprite and no extra draw calls are created.
const header=`
uniform vec3 uTempleCurveStart,uTempleCurveDirection,uTempleCurveRight;
uniform float uTempleCurveLength,uTempleCurveBend,uTempleCurveSigmoid;
uniform mat4 uTempleCurveCameraWorld;
vec4 templeCurvedMV(vec4 originalEye) {
  if(abs(uTempleCurveBend)<0.001 || uTempleCurveLength<0.001)return originalEye;
  vec3 world=(uTempleCurveCameraWorld*originalEye).xyz;
  float t=clamp(dot(world-uTempleCurveStart,uTempleCurveDirection)/uTempleCurveLength,0.0,1.0);
  // Prism uses an S-shaped cubic-inflection sweep: zero at both tips AND
  // midpoint, with opposite gentle curves before and after the midpoint.
  // Lightning keeps its original single-lobe bend.
  float bow=4.0*t*(1.0-t);
  float sigmoid=48.0*t*t*(1.0-t)*(1.0-t)*(2.0*t-1.0);
  world+=uTempleCurveRight*(mix(bow,sigmoid,uTempleCurveSigmoid)*uTempleCurveBend);
  return viewMatrix*vec4(world,1.0);
}
`;
export const BEAM_CURVE_METRES=3.8;
export function curvePoint(start,end,bend,t,shape='bow'){
 const axis=end.clone().sub(start),right=new THREE.Vector3(-axis.z,0,axis.x);
 if(right.lengthSq()<1e-8)right.set(1,0,0);
 right.normalize();
 return start.clone().lerp(end,t).addScaledVector(right,bend*(shape==='s'?48*t*t*(1-t)*(1-t)*(2*t-1):4*t*(1-t)));
}
export function lateralBeamInput(movement,aim,active=true){
 if(!active||!movement?.isVector3||movement.lengthSq()<1e-8)return 0;
 const side=new THREE.Vector3(-aim.z,0,aim.x);
 if(side.lengthSq()<1e-8)return 0;
 return THREE.MathUtils.clamp(movement.clone().setY(0).normalize().dot(side.normalize()),-1,1);
}
export function targetOnBeam(origin,direction,range,points,margin=1.4){
 let best=null,near=Infinity;
 for(const candidate of points||[]){
  const p=candidate?.isVector3?candidate:Array.isArray(candidate)?new THREE.Vector3(...candidate):null;
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z))continue;
  const along=p.clone().sub(origin).dot(direction);
  if(along<=1||along>range||along>=near)continue;
  const perpendicular=p.distanceTo(origin.clone().addScaledVector(direction,along));
  // Do not create purely visual auto-hits on enemies outside the server ray.
  if(perpendicular>margin)continue;
  near=along;best=p.clone();
 }
 return best;
}
export function installNativeCurve(fx){
 if(fx.group.userData.templeCurve)return fx.group.userData.templeCurve;
 const uniforms={
  start:{value:new THREE.Vector3()},direction:{value:new THREE.Vector3(1,0,0)},
  right:{value:new THREE.Vector3(0,0,1)},length:{value:1},
  bend:{value:0},sigmoid:{value:0},cameraWorld:{value:new THREE.Matrix4()}
 };
 let patched=0;
 fx.group.traverse(mesh=>{
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials){
   if(!material?.isShaderMaterial||material.userData.templeCurvePatched)continue;
   let shader=material.vertexShader,changes=0;
   // The native arc uses modelViewMatrix->mv before screen-facing billboard
   // widening; charged-beam uses both of these projection forms.
   shader=shader.replace(/gl_Position\s*=\s*projectionMatrix\s*\*\s*modelViewMatrix\s*\*\s*(vec4\([^;]+\))\s*;/g,
    (_,position)=>{changes++;return 'gl_Position=projectionMatrix*templeCurvedMV(modelViewMatrix*'+position+');';});
   shader=shader.replace(/gl_Position\s*=\s*projectionMatrix\s*\*\s*mv\s*;/g,
    ()=>{changes++;return 'gl_Position=projectionMatrix*templeCurvedMV(mv);';});
   if(!changes)continue;
   material.vertexShader=header+shader;
   Object.assign(material.uniforms,{
    uTempleCurveStart:uniforms.start,
    uTempleCurveDirection:uniforms.direction,
    uTempleCurveRight:uniforms.right,
    uTempleCurveLength:uniforms.length,
    uTempleCurveBend:uniforms.bend,
    uTempleCurveSigmoid:uniforms.sigmoid,
    uTempleCurveCameraWorld:uniforms.cameraWorld
   });
   material.userData.templeCurvePatched=true;
   material.needsUpdate=true;
   patched+=changes;
  }
  if(mesh.isMesh)mesh.frustumCulled=false;
 });
 if(patched<1)throw Error('No native 00GameDevs ray vertices were bendable');
 const state={...uniforms,patched};
 fx.group.userData.templeCurve=state;
 fx.group.userData.templeCurveShaderCount=patched;
 return state;
}
export function updateNativeCurve(fx,start,end,strafe=0,camera=null,shape='bow'){
 const u=fx.group.userData.templeCurve;
 if(!u)return;
 const direction=end.clone().sub(start),length=direction.length();
 if(length<1e-5){u.bend.value=0;return;}
 direction.divideScalar(length);
 const right=new THREE.Vector3(-direction.z,0,direction.x);
 if(right.lengthSq()<1e-8)right.set(1,0,0);
 right.normalize();
 u.start.value.copy(start);u.direction.value.copy(direction);
 u.right.value.copy(right);u.length.value=length;
 u.bend.value=THREE.MathUtils.clamp(strafe,-1,1)*Math.min(BEAM_CURVE_METRES,length*.27);
 u.sigmoid.value=shape==='s'?1:0;
 if(camera){camera.updateMatrixWorld();u.cameraWorld.value.copy(camera.matrixWorld);}
}
