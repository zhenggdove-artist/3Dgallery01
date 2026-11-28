// Real WebKit module graph startup: unlike Chromium emulation this uses
// the engine shipped in iOS Safari. Run against isolated local static files.
import assert from 'node:assert/strict';
import {webkit} from 'playwright';
import {mkdir} from 'node:fs/promises';

await mkdir('output/temple-safari-startup',{recursive:true});
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,
  deviceScaleFactor:2
 });
 const messages=[];
 page.on('pageerror',e=>messages.push('SCRIPT '+e.message));
 page.on('requestfailed',r=>messages.push('FETCH '+r.url()+' '+(r.failure()?.errorText||'')));
 page.on('console',m=>{if(m.type()==='error')messages.push('CONSOLE '+m.text());});
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded',timeout:20000});
 try{
  await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:105000});
 }catch(error){
  const diagnostic=await page.evaluate(()=>({
   state:document.body.className,
   loading:document.querySelector('#loading')?.innerText?.slice(0,900),
   logs:window.templeStartupDiagnostics,
   timings:window.templeLoadTimings,
   lastResources:performance.getEntriesByType('resource').slice(-20).map(x=>x.name.split('/').at(-1))
  }));
  await page.screenshot({path:'output/temple-safari-startup/failed.png'}).catch(()=>{});
  throw new Error('WebKit startup failed: '+JSON.stringify(diagnostic)+' ERRORS: '+messages.slice(0,12).join(' | '),{cause:error});
 }
 assert.equal(await page.locator('#loading').isVisible(),false);
 assert.ok(await page.locator('[data-google-login]').isVisible());
 assert.equal(await page.locator('[data-login-provider="apple"]').count(),0);
 assert.equal(await page.locator('[data-login-provider="facebook"]').count(),0);
 assert.ok(!(await page.locator('#entry-form').isVisible()),
  'Character naming is gated behind Google authentication');
 const loaded=await page.evaluate(()=>window.templeLoadTimings);
 // Safari/iPhone is the affected engine. Exercise the exact original
 // 00GameDevs shaders with a low rear camera, lowered wand and elevated reticle.
 // Module boot alone is NOT evidence that an Arc Ray/Charged Beam is visible.
 const safariBeams=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {NumberedWeaponEffects}=await import('/src/numbered-weapon-effects.js');
  const {raisedBeamDirection,crosshairNdc}=await import('/src/aiming.js');
  const renderer=templeTest.renderer,originalTarget=renderer.getRenderTarget();
  const scene=new THREE.Scene();scene.background=new THREE.Color('#000000');
  const camera=new THREE.PerspectiveCamera(55,390/844,.1,250);
  camera.position.set(0,1.1,10);
  camera.lookAt(0,6.5,-30);
  const source=new THREE.Vector3(.2,2.2,0);
  const aim=raisedBeamDirection(camera,source);
  const target=new THREE.WebGLRenderTarget(256,512,{depthBuffer:true});
  const pixels=new Uint8Array(256*512*4),res=[];
  const effects=new NumberedWeaponEffects(scene,()=>source.clone());
  try{
   for(const item of [{id:'storm-3',family:'lightning'},{id:'prism-3',family:'beam'}]){
    const play=effects.play({channel:true,ultimate:true,origin:source.toArray(),
      direction:aim.toArray(),range:35,charge:1,qualityTier:3,qualityScale:1},item,null);
    renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
    renderer.readRenderTargetPixels(target,0,0,256,512,pixels);
    let bright=0;
    for(let i=0;i<pixels.length;i+=4)if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>80)bright++;
    const active=effects.active.at(-1);
    res.push({item:item.id,play,bright,phase:active?.fx.phase,aim:aim.toArray(),
      ndc:crosshairNdc(844).toArray(),glError:renderer.getContext().getError()});
    effects.remove(active);
   }
  }finally{renderer.setRenderTarget(originalTarget);effects.dispose();target.dispose();}
  return res;
 });
 console.log('WEBKIT_BEAM_VISIBILITY='+JSON.stringify(safariBeams));
 for(const result of safariBeams){
  assert.equal(result.play,true,result.item+' must instantiate the original 00GameDevs module');
  assert.equal(result.phase,'active',result.item+' cannot remain stuck charging');
  assert.ok(result.aim[1]>0,result.item+' must fire upward at the raised reticle');
  assert.ok(result.bright>60,result.item+' native beam must produce visible high-intensity pixels on mobile WebKit: '+JSON.stringify(result));
  assert.equal(result.glError,0);
 }
 // Repeated real WebGL uploads and disposal on the same live renderer.
 // Count resources after the first cycle (renderer internal caches are warm).
 const lifecycle=await page.evaluate(async()=>{
  const T=await import('three'),{createWings,disposeGardenModel}=await import('/src/reletter/garden-art.js'),{createHeadgear,disposeHeadgear}=await import('/src/reletter/headgear-model.js'),{itemById}=await import('/src/shared/catalog.js'),{outfitTextureResources}=await import('/src/shared-render-resources.js');
  const renderer=templeTest.renderer,prior=renderer.getRenderTarget(),target=new T.WebGLRenderTarget(64,64),stage=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,20);
  camera.position.set(0,1,5);camera.lookAt(0,0,0);stage.add(new T.HemisphereLight(0xffffff,0x333333,3));
  const counts=()=>({textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,refs:outfitTextureResources.snapshot().references});
  const before=counts(),rows=[];
  try{
   renderer.setRenderTarget(target);
   for(let i=0;i<16;i++){
    const item={id:'wing-webkit-probe',design:'painted-wing',tier:1,color:'#dd77bb',shape:'rounded',scaleX:1,scaleY:1,abilities:[]};
    const a=createWings(T,item),b=createWings(T,item),h=createHeadgear(T,itemById('hat-elephant'));
    b.position.x=.2;stage.add(a,b,h);renderer.render(stage,camera);
    const shared=a.userData.texture===b.userData.texture,canvas=a.userData.texture.image;
    disposeGardenModel(a);const alive=canvas.width>0;disposeGardenModel(b);disposeHeadgear(h);
    renderer.render(stage,camera);
    rows.push({...counts(),shared,alive,released:canvas.width===0&&canvas.height===0,glError:renderer.getContext().getError()});
   }
  }finally{renderer.setRenderTarget(prior);target.dispose();}
  return {before,rows};
 });
 console.log('WEBKIT_TEXTURE_LIFECYCLE='+JSON.stringify(lifecycle));
 const stable=lifecycle.rows[0];
 for(const row of lifecycle.rows){assert.ok(row.shared&&row.alive&&row.released);assert.equal(row.refs,lifecycle.before.refs);assert.equal(row.glError,0);assert.equal(row.textures,stable.textures);assert.equal(row.geometries,stable.geometries);}
 const weapons=await page.evaluate(async()=>{
  const T=await import('three'),{makeHeldWeapon}=await import('/src/reletter/held-weapons.js'),{makeSpellEquipment}=await import('/src/spell-equipment.js'),{itemById}=await import('/src/shared/catalog.js'),{WeaponVFX}=await import('/src/weapon-vfx.js'),{disposeOwnedVisual,wearableResourceSnapshot,outfitTextureResources}=await import('/src/shared-render-resources.js');
  const renderer=templeTest.renderer,prior=renderer.getRenderTarget(),target=new T.WebGLRenderTarget(64,64),stage=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,40);
  camera.position.set(0,2,7);camera.lookAt(0,1,0);stage.add(new T.HemisphereLight(0xffffff,0x333333,3));
  const vfx=new WeaponVFX(stage),rows=[],before=wearableResourceSnapshot(),refs=outfitTextureResources.snapshot().references;
  try{
   renderer.setRenderTarget(target);
   for(let i=0;i<12;i++){
    const giraffe=makeHeldWeapon(itemById('giraffe')),token=makeHeldWeapon({id:'chiang-token',family:'token'}),staff=makeSpellEquipment(itemById('prism-3'));
    const fx=vfx.create('tidal-surge');fx.update(.18);
    stage.add(giraffe,token,staff,fx.group);renderer.render(stage,camera);
    let skeleton;giraffe.traverse(o=>{if(o.isSkinnedMesh)skeleton=o.skeleton;});
    const hadBoneTexture=!!skeleton?.boneTexture;disposeOwnedVisual(giraffe);disposeOwnedVisual(token);disposeOwnedVisual(staff);fx.dispose();
    renderer.render(stage,camera);
    const owners=wearableResourceSnapshot();rows.push({textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,refs:outfitTextureResources.snapshot().references,weapon:owners.weapon.active,effect:owners.effect.active,hadBoneTexture,boneReleased:!skeleton?.boneTexture,glError:renderer.getContext().getError()});
   }
  }finally{renderer.setRenderTarget(prior);target.dispose();vfx.dispose();}
  return {rows,before,refs};
 });
 console.log('WEBKIT_WEAPON_LIFECYCLE='+JSON.stringify(weapons));
 for(const row of weapons.rows){assert.ok(row.hadBoneTexture&&row.boneReleased);assert.equal(row.glError,0);assert.equal(row.refs,weapons.refs);assert.equal(row.weapon,weapons.before.weapon.active);assert.equal(row.effect,weapons.before.effect.active);assert.equal(row.textures,weapons.rows[0].textures);assert.equal(row.geometries,weapons.rows[0].geometries);}
 console.log('WebKit Safari module graph booted: '+JSON.stringify({timings:loaded,errorCount:messages.length}));
 await page.screenshot({path:'output/temple-safari-startup/success.png'});
} finally{await browser.close();}
