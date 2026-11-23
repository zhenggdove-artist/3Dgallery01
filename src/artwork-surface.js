import * as THREE from 'three';
import {artworkAppearanceDefaults} from './shared/artwork-library.js';
export function addArtworkDepth(root,texture,width,height){
 const front=root.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry');if(!front)return;front.material.alphaTest=.035;front.material.transparent=false;
 front.material.side=THREE.FrontSide;
 const back=new THREE.Mesh(front.geometry.clone(),front.material.clone());back.material.side=THREE.BackSide;root.add(back);
 const positions=[],uv=[],size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0,size,size);const pixels=ctx.getImageData(0,0,size,size).data,solid=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&pixels[(y*size+x)*4+3]>9;
 const edge=(x1,y1,x2,y2)=>{const a=[(x1/size-.5)*width,(.5-y1/size)*height],b=[(x2/size-.5)*width,(.5-y2/size)*height];for(const [p,z]of [[a,-.5],[b,-.5],[b,.5],[a,-.5],[b,.5],[a,.5]]){positions.push(p[0],p[1],z);uv.push(p[0]/width+.5,p[1]/height+.5);}};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(solid(x,y)){if(!solid(x-1,y))edge(x,y+1,x,y);if(!solid(x+1,y))edge(x+1,y,x+1,y+1);if(!solid(x,y-1))edge(x,y,x+1,y);if(!solid(x,y+1))edge(x+1,y+1,x,y+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const side=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:texture,roughness:.8,side:THREE.DoubleSide}));root.add(side);root.userData.depthParts={front,back,side};
}
export function applyArtworkAppearance(root,value){const appearance={...artworkAppearanceDefaults(root.userData.record),...value},signature=JSON.stringify(appearance);const title=root.userData.editTitleDraft??root.userData.titleOverride??(root.userData.record?.mediaId?root.userData.record.title:'');if(title||root.userData.titlePlate)addArtworkTitlePlate(root,title,appearance.labelBackground);if(root.userData.appearanceSignature===signature)return;root.userData.appearanceSignature=signature;root.userData.appearance=appearance;const p=root.userData.depthParts;if(p){p.back.visible=appearance.depth>0;const side=appearance.depth>0?THREE.FrontSide:THREE.DoubleSide;if(p.front.material.side!==side){p.front.material.side=side;p.front.material.needsUpdate=true;}p.front.position.z=appearance.depth/2;p.back.position.z=-appearance.depth/2;p.side.scale.z=Math.max(.00001,appearance.depth);p.side.visible=appearance.depth>0;}
 root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(!m.isMeshStandardMaterial&&!m.isMeshPhongMaterial)continue;let state=m.userData.artAdjust;if(!state){state=m.userData.artAdjust={gain:{value:new THREE.Vector4()},tint:{value:new THREE.Color()}};const old=m.onBeforeCompile;m.onBeforeCompile=shader=>{old?.(shader);shader.uniforms.artGain=state.gain;shader.uniforms.artTint=state.tint;shader.fragmentShader='uniform vec4 artGain;uniform vec3 artTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`vec3 adjusted=max(vec3(0.),(outgoingLight-vec3(artGain.w))/max(.05,1.-artGain.w));adjusted=(adjusted-.5)*artGain.y+.5;float gray=dot(adjusted,vec3(.2126,.7152,.0722));outgoingLight=max(vec3(0.),mix(vec3(gray),adjusted,artGain.z)*artGain.x*artTint);\n#include <opaque_fragment>`);};m.customProgramCacheKey=()=> 'temple-art-adjust-v1';m.needsUpdate=true;}state.gain.value.set(appearance.brightness,appearance.contrast,appearance.saturation,appearance.blackPoint);state.tint.value.set(appearance.tint);}});
}
export async function loadCustomArtwork(arena,record,base){const root=new THREE.Group();root.name='Artwork '+record.title;root.userData={platformId:record.id,record,base:record.position};const url=base+'/api/art-media/'+encodeURIComponent(record.mediaId);
 if(record.type==='model'){const gltf=await arena.loader.loadAsync(url),model=gltf.scene;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=3/Math.max(size.x,size.y,size.z,.001);model.position.copy(center).negate();const holder=new THREE.Group();holder.add(model);holder.scale.setScalar(scale);root.add(holder);root.userData.model=true;if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations[0]).play();arena.mixers.push(mixer);}}
 else{let texture,width,height;if(record.type==='video'){const v=document.createElement('video');v.crossOrigin='anonymous';v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Video load timed out: '+record.title)),20000);v.onloadeddata=()=>{clearTimeout(timeout);resolve();};v.onerror=()=>{clearTimeout(timeout);reject(Error('Video cannot be decoded: '+record.title));};v.src=url;});texture=new THREE.VideoTexture(v);width=v.videoWidth;height=v.videoHeight;root.userData.video=v;}else{texture=await new THREE.TextureLoader().loadAsync(url);width=texture.image.width;height=texture.image.height;}texture.colorSpace=THREE.SRGBColorSpace;const h=3,w=3*width/height,mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,alphaTest:.035,side:THREE.DoubleSide,roughness:.7,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.16}));root.add(mesh);addArtworkDepth(root,texture,w,h);}
 const initialAppearance=arena.world?.artworkLayout?.[record.id]?.appearance||record.appearance;
 addArtworkTitlePlate(root,record.title,initialAppearance?.labelBackground);
 root.position.fromArray(record.position);applyArtworkAppearance(root,initialAppearance);return root;
}

/** Regenerate an uploaded artwork's label only if the title or hex
 * background changes. All other artwork media/geometry remains untouched.
 * Shared by GM edit previews, player appearance edits and remote room sync. */
export function addArtworkTitlePlate(root,title,background='#000000'){
 const value=String(title||'').trim().slice(0,120);
 const backdrop=/^#[0-9a-f]{6}$/i.test(background||'')?background:'#000000';
 const signature=JSON.stringify([value,backdrop]);
 if(root.userData.titlePlateSignature===signature)return root.userData.titlePlate||null;
 const prior=root.userData.titlePlate;
 if(prior){
  prior.removeFromParent();
  prior.material.map?.dispose();
  prior.material.dispose();
  delete root.userData.titlePlate;
 }
 root.userData.titlePlateSignature=signature;
 if(!value)return null;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const width=1024,padding=42,lineHeight=60;
 ctx.font='bold 44px system-ui, sans-serif';
 const rows=[];let current='';
 for(const glyph of Array.from(value)){
  if(glyph==='\n'){rows.push(current);current='';continue;}
  if(current&&ctx.measureText(current+glyph).width>width-padding*2){rows.push(current);current=glyph;}
  else current+=glyph;
 }
 if(current||!rows.length)rows.push(current);
 canvas.width=width;canvas.height=padding*2+lineHeight*rows.length;
 ctx.fillStyle=backdrop;ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.font='bold 44px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';
 for(let i=0;i<rows.length;i++)ctx.fillText(rows[i],width/2,padding+lineHeight*(i+.5),width-padding*2);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
 // Cache the original artwork's local base before adding any sprites. A world
 // translation must NOT change the label's offset when it is recoloured.
 if(!Number.isFinite(root.userData.titlePlateBaseY)){
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),bounds=new THREE.Box3().makeEmpty();
  root.traverse(o=>{
   if(!o.geometry)return;
   o.geometry.computeBoundingBox();
   bounds.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));
  });
  root.userData.titlePlateBaseY=Number.isFinite(bounds.min.y)?bounds.min.y:-1.5;
 }
 sprite.scale.set(3.5,3.5*canvas.height/width,1);
 sprite.position.set(0,root.userData.titlePlateBaseY-sprite.scale.y/2-.13,.18);
 sprite.name='Artwork title: '+value;sprite.renderOrder=10;
 root.add(sprite);root.userData.titlePlate=sprite;
 return sprite;
}
