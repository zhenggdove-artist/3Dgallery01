import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
export const ART_ACCEPT='.png,.jpg,.jpeg,.webp,.mp4,.webm,.glb,.gltf,.fbx,.bin';
export async function prepareArtwork(files,{maxBytes=8*1024*1024}={}){
 const file=files.find(f=>/\.(glb|gltf|fbx)$/i.test(f.name))||files.find(f=>/\.(png|jpe?g|webp|mp4|webm)$/i.test(f.name));if(!file)throw Error('Choose PNG / JPEG / WebP, MP4 / WebM, or GLB / glTF / FBX.');
 if(files.reduce((n,f)=>n+f.size,0)>64*1024*1024)throw Error('Selected files exceed 64 MB.');
 const ext=file.name.split('.').pop().toLowerCase(),title=file.name.replace(/\.[^.]+$/,'');let blob=file;
 if(['png','jpg','jpeg','webp'].includes(ext)){
  const image=await createImageBitmap(file);
  try{
   if(!image.width||!image.height)throw Error('Image has no pixels.');
   const maxEdge=Math.max(image.width,image.height),keepPng=ext==='png';
   // Preserve original PNG alpha/pixels if it already fits. JPEG/WebP stays
   // efficiently compressed instead of expanding into a huge 4096px PNG.
   if(keepPng&&maxEdge<=4096&&file.size<=Math.min(maxBytes,2*1024*1024))blob=file;
   else{
    const canvas=document.createElement('canvas');
    let scale=Math.min(1,4096/maxEdge);const targetBytes=Math.min(maxBytes,3*1024*1024);
    for(let attempt=0;attempt<9;attempt++){
     canvas.width=Math.max(1,Math.round(image.width*scale));
     canvas.height=Math.max(1,Math.round(image.height*scale));
     const ctx=canvas.getContext('2d',{alpha:true});
     if(!ctx)throw Error('Image conversion unavailable');
     ctx.clearRect(0,0,canvas.width,canvas.height);
     ctx.drawImage(image,0,0,canvas.width,canvas.height);
     blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.92));
     if(!blob)throw Error('Image could not be encoded');
     if(blob.size<=targetBytes||blob.size<=maxBytes&&scale<=.75)break;
     scale*=Math.max(.65,Math.min(.9,Math.sqrt(targetBytes/blob.size)*.96));
    }
   }
  }finally{image.close();}
 }
 else if(['mp4','webm'].includes(ext)){const video=document.createElement('video'),url=URL.createObjectURL(file);try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video decoding timed out. Use H.264 MP4 or VP9 WebM.')),15000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(Error('This browser cannot decode the video. Use H.264 MP4 or VP9 WebM.'));};video.preload='auto';video.muted=true;video.src=url;});if(!video.videoWidth)throw Error('Video has no picture.');if(video.videoWidth>3840||video.videoHeight>2160)throw Error('Video resolution exceeds 4K; export a smaller copy.');blob=new Blob([file],{type:ext==='mp4'?'video/mp4':'video/webm'});}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}}
 else{
  const urls=[],manager=new THREE.LoadingManager(),errors=[];let pending=0,finish;const done=new Promise(r=>finish=r),start=manager.itemStart.bind(manager),end=manager.itemEnd.bind(manager);manager.itemStart=url=>{pending++;start(url);};manager.itemEnd=url=>{end(url);pending--;if(!pending)finish();};manager.onError=url=>errors.push(url);
  manager.setURLModifier(url=>{if(/^(data:|blob:)/.test(url))return url;const name=decodeURIComponent(url).replace(/\\/g,'/').split('/').pop(),asset=files.find(f=>f.name===name);if(!asset)throw Error('Missing model dependency: '+name+'. Select its textures / BIN together with the model.');const blobURL=URL.createObjectURL(asset);urls.push(blobURL);return blobURL;});
  let root,animations=[];const draco=new DRACOLoader();draco.setDecoderPath('./vendor/three/examples/jsm/libs/draco/');
  try{if(ext==='fbx'){root=new FBXLoader(manager).parse(await file.arrayBuffer(),'');animations=root.animations||[];if(pending)await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error('Model textures timed out')),20000))]);}else{const loader=new GLTFLoader(manager).setDRACOLoader(draco),asset=await loader.parseAsync(ext==='gltf'?await file.text():await file.arrayBuffer(),'');root=asset.scene;animations=asset.animations||[];}if(errors.length)throw Error('A model texture failed to decode.');let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;}});if(!meshes||!Number.isFinite(triangles))throw Error('Model contains no valid mesh.');if(triangles>500000)throw Error('Model exceeds 500,000 triangles. Simplify it before upload.');if(meshes>200)throw Error('Model exceeds 200 mesh objects. Merge materials / meshes first.');const binary=await new GLTFExporter().parseAsync(root,{binary:true,animations,maxTextureSize:2048});blob=new Blob([binary],{type:'model/gltf-binary'});}finally{urls.forEach(URL.revokeObjectURL);draco.dispose();if(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());}}
 }
 if(!blob||blob.size>maxBytes)throw Error('Prepared artwork exceeds '+Math.round(maxBytes/1024/1024)+' MB. Use a smaller file, resolution, or model.');return {blob,title};
}
export async function uploadArtwork(network,files,{maxBytes=8*1024*1024}={}){
 // Check the deployed Worker first. A successful GitHub Pages update cannot
 // make an old Cloudflare Durable Object understand /api/art-media.
 let health;
 try{
  const response=await fetch(network.base+'/health',{cache:'no-store'});
  health=response.ok?await response.json():null;
 }catch(error){throw Error('Cloudflare Worker 無法連線，無法上傳作品：'+error.message);}
 if(health?.features?.artMediaUpload!==true||health?.features?.artBombPlace!==true)
  throw Error('Cloudflare Worker 後端仍是舊版本，尚未部署作品上傳 API。請在 GitHub Actions 設定 CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_ID，執行 Deploy Temple Worker。');
 const {blob,title}=await prepareArtwork(files,{maxBytes});
 let response;
 try{response=await fetch(network.base+'/api/art-media',{method:'POST',headers:{Authorization:'Bearer '+network.token,'Content-Type':blob.type},body:blob});}
 catch(error){throw Error('Cloudflare upload could not connect. '+error.message);}
 const media=await response.json().catch(()=>null);
 if(!response.ok){
  if(response.status===404||response.status===405)throw Error('The live Cloudflare Worker does not support player artwork uploads yet. Deploy the matching backend first.');
  throw Error(media?.error||'Artwork upload failed (HTTP '+response.status+')');
 }
 if(!media?.id||media?.type!==blob.type||media?.size!==blob.size)throw Error('Worker did not confirm the artwork bytes or format');
 // Do not show PLACE as available until the saved bytes can be retrieved.
 let verify;
 try{verify=await fetch(network.base+'/api/art-media/'+encodeURIComponent(media.id),{headers:{Range:'bytes=0-31'}});}
 catch(error){throw Error('Uploaded artwork could not be read back: '+error.message);}
 if(!(verify.status===206||verify.status===200))throw Error('Backend saved an artwork ID but its file cannot be read (HTTP '+verify.status+')');
 const sample=await verify.arrayBuffer();
 if(!sample.byteLength)throw Error('Backend returned an empty artwork after upload');
 if((verify.headers.get('Content-Type')||'').split(';')[0]!==media.type)throw Error('Backend returned the wrong media format');
 return {title,mediaId:media.id,mediaType:media.type,mediaSize:media.size};
}
