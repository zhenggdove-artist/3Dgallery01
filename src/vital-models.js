import * as THREE from 'three';
import {createHeart} from './heart-model.js';
export class VitalModels{
 constructor(coinGeometry,coinMaterial){
  this.canvas=document.createElement('canvas');this.canvas.id='vital-models';this.canvas.setAttribute('aria-hidden','true');document.getElementById('vitals').append(this.canvas);
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'low-power'});this.renderer.setSize(48,96);this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,2,-2,.1,20);this.camera.position.set(0,0,8);this.scene.add(new THREE.HemisphereLight(0xffffff,0x49304c,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,3,4);this.scene.add(light);
  const heart=createHeart();heart.scale.setScalar(.9);heart.position.y=1;this.heart=heart;this.scene.add(heart);this.fill={value:1};this.level=1;
  const bounds=new THREE.Box3().setFromBufferAttribute(heart.geometry.attributes.position),min=bounds.min.y,max=bounds.max.y;
  heart.material.onBeforeCompile=shader=>{shader.uniforms.healthFill=this.fill;shader.vertexShader='varying float heartY;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nheartY=(position.y-(${min.toFixed(5)}))/${(max-min).toFixed(5)};`);shader.fragmentShader='uniform float healthFill;varying float heartY;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(heartY>healthFill){diffuseColor.rgb=vec3(.55,.48,.59);diffuseColor.a=.2;}');};heart.material.transparent=true;
  const coin=new THREE.Mesh(coinGeometry,coinMaterial.clone());coin.geometry.computeBoundingBox();const size=coin.geometry.boundingBox.getSize(new THREE.Vector3()),center=coin.geometry.boundingBox.getCenter(new THREE.Vector3()),holder=new THREE.Group();coin.position.copy(center).negate();holder.add(coin);holder.scale.setScalar(1.5/Math.max(size.x,size.y,size.z));holder.position.y=-1;this.coin=holder;this.scene.add(holder);this.next=0;
 }
 update(time,hp,max){if(time<this.next||document.getElementById('hud').hidden||document.body.classList.contains('panel-open'))return;const dt=Math.min(.1,Math.max(0,time-(this.last||time)));this.last=time;this.next=time+1/30;const target=Math.max(0,Math.min(1,hp/Math.max(1,max)));this.level+=(target-this.level)*(1-Math.exp(-dt*7));this.fill.value=this.level;this.heart.rotation.y=time*.8;this.coin.rotation.y=time*2;this.renderer.render(this.scene,this.camera);}
}
