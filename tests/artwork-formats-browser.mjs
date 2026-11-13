import assert from 'node:assert/strict';import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();page.setDefaultTimeout(90000);await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>document.body.classList.contains('ready'));
 const result=await page.evaluate(async()=>{
  const T=await import('three'),{prepareArtwork}=await import('/src/artwork-upload.js'),{GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0xff00ff})),doc=await new GLTFExporter().parseAsync(mesh,{}),gltf=await prepareArtwork([new File([JSON.stringify(doc)],'box.gltf')]);
  const fbxData=await (await fetch('/models/model_0001.fbx')).arrayBuffer();let fbx;
  try{fbx={size:(await prepareArtwork([new File([fbxData],'model.fbx')])).blob.size};}catch(e){fbx={error:e.message};}
  const blob=await (await fetch('/tests/fixtures/artwork-video.webm')).blob();
  const video=await prepareArtwork([new File([blob],'clip.webm',{type:'video/webm'})]);
  const broken=structuredClone(doc);broken.buffers[0].uri='missing.bin';let missing;try{await prepareArtwork([new File([JSON.stringify(broken)],'broken.gltf')]);}catch(e){missing=e.message;}
  return {gltf:gltf.blob.type,fbx,video:video.blob.type,missing};
 });assert.equal(result.gltf,'model/gltf-binary');assert.equal(result.video,'video/webm');assert.match(result.missing,/Missing model dependency/);assert.ok(result.fbx.size||/Missing model dependency/.test(result.fbx.error),JSON.stringify(result.fbx));console.log(JSON.stringify(result));
}finally{await browser.close();}
