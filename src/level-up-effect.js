import * as THREE from 'three';
// One reusable geometry. Spiral motion, glow and fade evaluated entirely on
// GPU; no per-particle objects, textures, lights, or frame-by-frame uploads.
export function observeLevel(root,level){
 if(!root||!Number.isFinite(level))return false;
 const prior=root.userData.observedLevel;root.userData.observedLevel=level;
 return Number.isFinite(prior)&&level>prior;
}
export class LevelUpEffect{
 constructor(scene){
  this.scene=scene;this.active=new Map();const n=960,position=new Float32Array(n*3),seed=new Float32Array(n*4);
  for(let i=0;i<n;i++){const j=i*4;seed[j]=i*2.399963;seed[j+1]=(i%17)/16;seed[j+2]=(i%53)/52;seed[j+3]=(i%101)/100;}
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(position,3));this.geometry.setAttribute('spark',new THREE.BufferAttribute(seed,4));
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{age:{value:0},viewport:{value:800}},
   vertexShader:`attribute vec4 spark;uniform float age;uniform float viewport;varying vec3 tint;varying float alpha;
   vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
   void main(){float t=clamp((age-spark.y*.22)/.78,0.,1.);float a=spark.x+age*(7.+spark.z*5.);float r=(.45+spark.z*1.1)*(1.+.35*sin(t*3.14159));vec3 p=vec3(cos(a)*r,.2+4.5*t+spark.y*.55,sin(a)*r);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(.06+.12*spark.w)*viewport/max(1.,-mv.z);tint=mix(hue(fract(spark.w+age*.35)),vec3(1.),.25);alpha=smoothstep(0.,.09,age-spark.y*.22)*(1.-smoothstep(.85,1.3,age));}`,
   fragmentShader:`varying vec3 tint;varying float alpha;void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;float glow=pow(max(0.,1.-r),2.);float star=max(0.,1.-min(abs(q.x),abs(q.y))*16.)*max(0.,1.-r);gl_FragColor=vec4(tint,alpha*(glow+star*.5));}`});
 }
 async warm(renderer,camera){const stage=new THREE.Scene(),mesh=new THREE.Points(this.geometry,this.material);mesh.frustumCulled=false;stage.add(mesh);await renderer.compileAsync(stage,camera);}
 play(root){if(!root)return;this.remove(root);const material=this.material.clone(),mesh=new THREE.Points(this.geometry,material);mesh.frustumCulled=false;mesh.name='Level up rainbow spiral';mesh.position.copy(root.position);this.scene.add(mesh);this.active.set(root,{mesh,start:performance.now()});}
 remove(root){const e=this.active.get(root);if(!e)return;e.mesh.removeFromParent();e.mesh.material.dispose();this.active.delete(root);}
 update(now,height){for(const [root,e] of this.active){const age=(now-e.start)/1000;if(age>=1.3||!root.parent){this.remove(root);continue;}e.mesh.position.copy(root.position);e.mesh.material.uniforms.age.value=age;e.mesh.material.uniforms.viewport.value=height;}}
}
