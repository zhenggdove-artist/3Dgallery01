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
 console.log('WebKit Safari module graph booted: '+JSON.stringify({timings:loaded,errorCount:messages.length}));
 await page.screenshot({path:'output/temple-safari-startup/success.png'});
} finally{await browser.close();}
