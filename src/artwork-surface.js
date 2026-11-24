import * as THREE from 'three';
import {artworkAppearanceDefaults,LABEL_STYLE_DEFAULTS} from './shared/artwork-library.js';
const artworkAnimations=new WeakMap();
export function releaseArtworkAnimation(root){const record=artworkAnimations.get(root);if(!record)return;const {arena,mixer,model}=record;mixer.stopAllAction();mixer.uncacheRoot(model);const i=arena.mixers.indexOf(mixer);if(i>=0)arena.mixers.splice(i,1);artworkAnimations.delete(root);}
export function addArtworkDepth(root,texture,width,height){
 const front=root.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry');if(!front)return;front.material.alphaTest=.035;front.material.transparent=false;
 front.material.side=THREE.FrontSide;
 const back=new THREE.Mesh(front.geometry.clone(),front.material.clone());back.material.side=THREE.BackSide;root.add(back);
 const positions=[],uv=[],size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0,size,size);const pixels=ctx.getImageData(0,0,size,size).data,solid=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&pixels[(y*size+x)*4+3]>9;
 const edge=(x1,y1,x2,y2)=>{const a=[(x1/size-.5)*width,(.5-y1/size)*height],b=[(x2/size-.5)*width,(.5-y2/size)*height];for(const [p,z]of [[a,-.5],[b,-.5],[b,.5],[a,-.5],[b,.5],[a,.5]]){positions.push(p[0],p[1],z);uv.push(p[0]/width+.5,p[1]/height+.5);}};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(solid(x,y)){if(!solid(x-1,y))edge(x,y+1,x,y);if(!solid(x+1,y))edge(x+1,y,x+1,y+1);if(!solid(x,y-1))edge(x,y,x+1,y);if(!solid(x,y+1))edge(x+1,y+1,x,y+1);}
 canvas.width=canvas.height=0;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const side=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:texture,roughness:.8,side:THREE.DoubleSide}));root.add(side);root.userData.depthParts={front,back,side};
}
export function applyArtworkAppearance(root,value){const appearance={...artworkAppearanceDefaults(root.userData.record),...value,...root.userData.previewAppearance},signature=JSON.stringify(appearance);const title=root.userData.editTitleDraft??root.userData.titleOverride??(root.userData.record?.mediaId?root.userData.record.title:'');if(title||root.userData.titlePlate)addArtworkTitlePlate(root,title,appearance.labelBackground,appearance);if(root.userData.appearanceSignature===signature)return;root.userData.appearanceSignature=signature;root.userData.appearance=appearance;const p=root.userData.depthParts;if(p){p.back.visible=appearance.depth>0;const side=appearance.depth>0?THREE.FrontSide:THREE.DoubleSide;if(p.front.material.side!==side){p.front.material.side=side;p.front.material.needsUpdate=true;}p.front.position.z=appearance.depth/2;p.back.position.z=-appearance.depth/2;p.side.scale.z=Math.max(.00001,appearance.depth);p.side.visible=appearance.depth>0;}
 root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(!m.isMeshStandardMaterial&&!m.isMeshPhongMaterial)continue;let state=m.userData.artAdjust;if(!state){state=m.userData.artAdjust={gain:{value:new THREE.Vector4()},tint:{value:new THREE.Color()}};const old=m.onBeforeCompile;m.onBeforeCompile=shader=>{old?.(shader);shader.uniforms.artGain=state.gain;shader.uniforms.artTint=state.tint;shader.fragmentShader='uniform vec4 artGain;uniform vec3 artTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`vec3 adjusted=max(vec3(0.),(outgoingLight-vec3(artGain.w))/max(.05,1.-artGain.w));adjusted=(adjusted-.5)*artGain.y+.5;float gray=dot(adjusted,vec3(.2126,.7152,.0722));outgoingLight=max(vec3(0.),mix(vec3(gray),adjusted,artGain.z)*artGain.x*artTint);\n#include <opaque_fragment>`);};m.customProgramCacheKey=()=> 'temple-art-adjust-v1';m.needsUpdate=true;}state.gain.value.set(appearance.brightness,appearance.contrast,appearance.saturation,appearance.blackPoint);state.tint.value.set(appearance.tint);}});
}
// Proximity fade operates on existing SpriteMaterial opacity; unlike texture
// regeneration it is safe to evaluate on every render frame.
export function titleOpacityByDistance(distance,revealDistance=LABEL_STYLE_DEFAULTS.labelRevealDistance,nearFadeDistance=LABEL_STYLE_DEFAULTS.labelNearFadeDistance,minOpacity=LABEL_STYLE_DEFAULTS.labelNearMinOpacity,nearDistance=distance){
 if(!Number.isFinite(distance)||!Number.isFinite(nearDistance))return 0;
 const far=THREE.MathUtils.clamp(Number(revealDistance)||LABEL_STYLE_DEFAULTS.labelRevealDistance,3,80);
 const fadeSpan=Math.min(3,far*.45);
 const t=THREE.MathUtils.clamp((far-distance)/fadeSpan,0,1);
 const farAlpha=t*t*(3-2*t);
 const near=THREE.MathUtils.clamp(Number.isFinite(nearFadeDistance)?nearFadeDistance:LABEL_STYLE_DEFAULTS.labelNearFadeDistance,0,20);
 if(near===0)return farAlpha;
 const floor=THREE.MathUtils.clamp(Number.isFinite(minOpacity)?minOpacity:LABEL_STYLE_DEFAULTS.labelNearMinOpacity,0,1);
 const n=THREE.MathUtils.clamp(nearDistance/near,0,1);
 return farAlpha*(floor+(1-floor)*n*n*(3-2*n));
}
const titleArtWorld=new THREE.Vector3(),titlePlateWorld=new THREE.Vector3(),titlePlateScale=new THREE.Vector3(),titleTextScale=new THREE.Vector3();
// Use the billboard's camera-independent enclosing radius and vertical extent.
// Compare against the standing avatar's body rather than just its feet.
export function titleDistanceToAvatar(plate,viewerPosition){
 if(!viewerPosition?.isVector3)return Infinity;
 plate.getWorldPosition(titlePlateWorld);plate.getWorldScale(titlePlateScale);
 const text=plate.userData.textSprite;
 if(text)text.getWorldScale(titleTextScale);else titleTextScale.set(0,0,0);
 const halfWidth=Math.max(Math.abs(titlePlateScale.x),Math.abs(titleTextScale.x))*.5;
 const halfHeight=Math.max(Math.abs(titlePlateScale.y),Math.abs(titleTextScale.y))*.5;
 const dx=titlePlateWorld.x-viewerPosition.x,dz=titlePlateWorld.z-viewerPosition.z;
 const horizontal=Math.max(0,Math.hypot(dx,dz)-halfWidth);
 const vertical=Math.max(0,titlePlateWorld.y-halfHeight-(viewerPosition.y+1.6),viewerPosition.y-(titlePlateWorld.y+halfHeight));
 return Math.hypot(horizontal,vertical);
}
export function updateArtworkTitleVisibility(root,viewerPosition,force=false){
 const plate=root?.userData?.titlePlate;
 if(!plate?.material)return 0;
 // No local player yet: keep the name hidden rather than falling back to
 // camera distance (which changes when the user zooms in or out).
 const distance=viewerPosition?.isVector3?
  root.getWorldPosition(titleArtWorld).distanceTo(viewerPosition):Infinity;
 const appearance=root.userData.appearance;
 const alpha=force||root.userData.editing?1:
  titleOpacityByDistance(distance,appearance?.labelRevealDistance,appearance?.labelNearFadeDistance,appearance?.labelNearMinOpacity,titleDistanceToAvatar(plate,viewerPosition));
 if(plate.material.opacity!==alpha)plate.material.opacity=alpha;
 const text=plate.userData.textSprite;
 if(text?.material&&text.material.opacity!==alpha)text.material.opacity=alpha;
 return alpha;
}
export async function loadCustomArtwork(arena,record,base){const root=new THREE.Group();root.name='Artwork '+record.title;root.userData={platformId:record.id,record,base:record.position};const url=base+'/api/art-media/'+encodeURIComponent(record.mediaId);
 if(record.type==='model'){const gltf=await arena.loader.loadAsync(url),model=gltf.scene;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=3/Math.max(size.x,size.y,size.z,.001);model.position.copy(center).negate();const holder=new THREE.Group();holder.add(model);holder.scale.setScalar(scale);root.add(holder);root.userData.model=true;if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations[0]).play();arena.mixers.push(mixer);artworkAnimations.set(root,{arena,mixer,model});}}
 else{let texture,width,height;if(record.type==='video'){const v=document.createElement('video');v.crossOrigin='anonymous';v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Video load timed out: '+record.title)),20000);v.onloadeddata=()=>{clearTimeout(timeout);resolve();};v.onerror=()=>{clearTimeout(timeout);reject(Error('Video cannot be decoded: '+record.title));};v.src=url;});texture=new THREE.VideoTexture(v);width=v.videoWidth;height=v.videoHeight;root.userData.video=v;}else{texture=await new THREE.TextureLoader().loadAsync(url);width=texture.image.width;height=texture.image.height;}texture.colorSpace=THREE.SRGBColorSpace;const h=3,w=3*width/height,mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,alphaTest:.035,side:THREE.DoubleSide,roughness:.7,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.16}));root.add(mesh);addArtworkDepth(root,texture,w,h);}
 const initialAppearance=arena.world?.artworkLayout?.[record.id]?.appearance||record.appearance;
 addArtworkTitlePlate(root,record.title,initialAppearance?.labelBackground,initialAppearance);
 root.position.fromArray(record.position);applyArtworkAppearance(root,initialAppearance);return root;
}

/**
 * Two independent sprites: the editable coloured backdrop and a centered
 * text sprite. Editing width/height only alters the backdrop while the
 * glyphs retain a fixed physical size and center without stretch/jumping.
 * The parent remains an actual Sprite to preserve artwork picking behavior.
 */
export function addArtworkTitlePlate(root,title,background='#000000',options={}){
 const value=String(title||'').trim().slice(0,120),author=String(root.userData.editAuthorDraft??root.userData.authorOverride??root.userData.record?.author??'').trim().slice(0,100);
 const style={...LABEL_STYLE_DEFAULTS,...options,labelBackground:background||options?.labelBackground||'#000000'};
 const color=/^#[0-9a-f]{6}$/i.test(style.labelColor)?style.labelColor:'#ffffff';
 const backdrop=/^#[0-9a-f]{6}$/i.test(style.labelBackground)?style.labelBackground:'#000000';
 const fontSize=Math.max(18,Math.min(120,Number(style.labelFontSize)||44));
 const width=Math.max(.5,Math.min(12,Number(style.labelWidth)||3.5));
 const height=Math.max(.18,Math.min(4,Number(style.labelHeight)||.492));
 const offsetX=Number.isFinite(style.labelOffsetX)?style.labelOffsetX:0;
 const offsetY=Number.isFinite(style.labelOffsetY)?style.labelOffsetY:0;
 const signature=JSON.stringify([value,backdrop,color,fontSize,width,height,offsetX,offsetY,author]);
 if(root.userData.titlePlateSignature===signature)return root.userData.titlePlate||null;
 const prior=root.userData.titlePlate;
 if(prior){
  prior.removeFromParent();
  prior.traverse(node=>{node.material?.map?.dispose();node.material?.dispose();});
  delete root.userData.titlePlate;
 }
 root.userData.titlePlateSignature=signature;
 if(!value)return null;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)return null;
 canvas.width=4;canvas.height=4;
 ctx.fillStyle=backdrop;ctx.fillRect(0,0,canvas.width,canvas.height);
 const backgroundTexture=new THREE.CanvasTexture(canvas);
 backgroundTexture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
  map:backgroundTexture,transparent:true,opacity:1,depthTest:false,depthWrite:false,toneMapped:false
 }));
 const textCanvas=document.createElement('canvas');
 textCanvas.width=1024;textCanvas.height=320;
 const textCtx=textCanvas.getContext('2d');
 if(textCtx){
  const rows=[];let current='';
  textCtx.font='bold 44px system-ui, sans-serif';
  // Fixed wrapping width independent from background resize. Text never
  // reflows merely because a GM drags an edge handle.
  for(const glyph of Array.from(value)){
   if(glyph==='\n'){rows.push(current);current='';continue;}
   if(current&&textCtx.measureText(current+glyph).width>940){
    rows.push(current);current=glyph;
   }else current+=glyph;
  }
  if(current||!rows.length)rows.push(current);
  textCtx.textAlign='center';textCtx.textBaseline='middle';
  textCtx.font='bold 44px system-ui, sans-serif';textCtx.fillStyle=color;
  const lineHeight=58;
  const center=author?137:160;
  for(let i=0;i<rows.length;i++)
   textCtx.fillText(rows[i],512,center+(i-(rows.length-1)/2)*lineHeight,940);
  if(author){textCtx.font='32px system-ui, sans-serif';textCtx.fillText(author,512,Math.min(298,center+(rows.length-1)*lineHeight/2+55),940);}
 }
 const textTexture=new THREE.CanvasTexture(textCanvas);
 textTexture.colorSpace=THREE.SRGBColorSpace;
 textTexture.minFilter=THREE.LinearFilter;textTexture.generateMipmaps=false;
 const textSprite=new THREE.Sprite(new THREE.SpriteMaterial({
  map:textTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false
 }));
 textSprite.name='Artwork title lettering';textSprite.position.z=.03;
 sprite.add(textSprite);
 sprite.userData.textSprite=textSprite;
 // The text's world-size stays constant when the parent background grows.
 const textWorldWidth=3.5*fontSize/44;
 const textWorldHeight=textWorldWidth*textCanvas.height/textCanvas.width;
 sprite.scale.set(width,height,1);
 textSprite.scale.set(textWorldWidth/width,textWorldHeight/height,1);
 if(!Number.isFinite(root.userData.titlePlateBaseY)){
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),bounds=new THREE.Box3().makeEmpty();
  root.traverse(o=>{
   if(!o.geometry)return;
   o.geometry.computeBoundingBox();
   bounds.union(o.geometry.boundingBox.clone().applyMatrix4(
    new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));
  });
  root.userData.titlePlateBaseY=Number.isFinite(bounds.min.y)?bounds.min.y:-1.5;
 }
 sprite.position.set(offsetX,root.userData.titlePlateBaseY-height/2-.13+offsetY,.18);
 sprite.name='Artwork title: '+value;sprite.renderOrder=10;
 textSprite.renderOrder=11;
 root.add(sprite);root.userData.titlePlate=sprite;
 return sprite;
}
