// Real browser smoke for the ephemeral local Cloudflare Worker. No production URLs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const output='output/temple-ui-smoke';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(45000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',req=>errors.push('REQUEST '+req.url()+' '+req.failure()?.errorText));page.on('console',m=>{if(m.type()==='error'&&/Shader Error|WebGLProgram|shader compilation|ERROR: 0:/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('temple-backend-url','http://127.0.0.1:8787'));
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 try{await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:65000});}
 catch(error){
  const debug=await page.evaluate(()=>({
   bodyClass:document.body.className,
   loading:document.querySelector('#loading')?.textContent?.slice(0,1000),
   entryError:document.querySelector('#entry-error')?.textContent,
   status:document.querySelector('#loading-status')?.textContent,
   templeTest:!!window.templeTest,
   readyState:document.readyState,
   loadTimings:window.templeLoadTimings,
   resources:performance.getEntriesByType('resource').slice(-16).map(r=>({name:r.name.split('/').slice(-3).join('/'),ms:Math.round(r.duration),size:r.transferSize})),
   pendingAssets:document.querySelectorAll('script[type="module"]').length
  }));
  throw new Error('Temple never loaded: '+JSON.stringify(debug)+'; PAGEERRORS='+errors.join('; ').slice(0,2400),{cause:error});
 }
 // Join through the real guest character form (name/color -> network -> Worker).
 // Google login remains an independent authenticated path.
 await page.locator('#guest-form').waitFor({state:'visible'});
 await page.locator('#guest-name').fill('CIBrowser');
 await page.locator('#guest-enter').click();
 await page.locator('#hud').waitFor({state:'visible'});
 await page.waitForFunction(()=>window.templeTest?.controller()&&JSON.parse(window.render_game_to_text()).connected);
 // SHOP must display the complete 3D equipment models in the FIRST frame,
 // not Promise URLs, broken images, or the deleted generic RELETTER glyphs.
 await page.evaluate(()=>templeTest.ui.openPanel('shop'));
 await page.waitForFunction(()=>{
  const cards=[...document.querySelectorAll('.shop-grid .shop-cell')];
  const images=[...document.querySelectorAll('.shop-grid .shop-cell img')];
  return cards.length>0&&images.length===cards.length&&images.every(
   img=>img.complete&&img.naturalWidth>0&&/^(blob:|https?:)/.test(img.currentSrc)
  );
 },null,{timeout:12000});
 await page.screenshot({path:output+'/shop-complete-3d-previews.png'});

 // The new outfit portrait must come from the fully skinned character, not
 // the removed box-doll placeholder. Confirm live suit and matching headgear
 // can both attach to the same animated player rig.
 const wearable=await page.evaluate(()=>{
  const {arena,controller,ui}=window.templeTest,root=controller()?.root;
  const original={...(ui.world?.profile?.equipment||{})};
  arena.setPlayerEquipment(root,{...original,outfit:'outfit-creature-elephant',head:'hat-elephant'});
  const outfit=root?.userData?.outfit,head=root?.userData?.headgear;
  const result={surfaces:outfit?.surfaces?.length||0,
   parts:outfit?.parts?.length||0,headChildren:head?.children?.length||0,
   skinned:outfit?.surfaces?.some(p=>p.mesh.isSkinnedMesh)||false};
  arena.setPlayerEquipment(root,original);
  return result;
 });
 assert.ok(wearable.skinned&&wearable.surfaces>0&&wearable.parts>0&&wearable.headChildren>0,
  'Creature head and body must both be wearable on the original SkinnedMesh rig: '+JSON.stringify(wearable));
 await page.evaluate(()=>{
  templeTest.ui.shopTab='outfit';templeTest.ui.renderPanel();
 });
 await page.waitForFunction(()=>{
  const card=[...document.querySelectorAll('.shop-grid .shop-cell')]
   .find(node=>node.textContent.includes('Elephant Parade Suit'));
  const image=card?.querySelector('img');
  return !!image?.complete&&image.naturalWidth>0;
 },null,{timeout:12000});
 await page.evaluate(()=>{
  templeTest.ui.shopTab='near';templeTest.ui.renderPanel();
 });

 // SHOP hides #hud, so purchase confirmation must remain visible on top.
 await page.evaluate(()=>templeTest.ui.purchaseNotice('Comfort Cash · $20',3));
 await page.locator('#purchase-notice').waitFor({state:'visible',timeout:2500});
 assert.equal(await page.locator('#purchase-notice').textContent(),'PURCHASE SUCCESSFUL · Comfort Cash · $20 ×3');
 await page.waitForTimeout(1000);
 assert.equal(await page.locator('#purchase-notice').isVisible(),true,'Purchase popup must persist after one second');
 await page.locator('#purchase-notice').waitFor({state:'hidden',timeout:4000});

 await page.locator('#panel-close').click();
 // FISH has been retired from both the dock and shop.
 assert.equal(await page.locator('[data-action="fish"]').count(),0);
 // Inventory categories, custom 3D spell preview, readable descriptions.
 await page.evaluate(()=>{
  templeTest.ui.bagCategory='equipment';templeTest.ui.openPanel('bag');
 });
 await page.waitForFunction(()=>{
  const view=templeTest.portraitViewport,canvas=document.querySelector('#bag-portrait');
  return !!view?.model&&view.drawCount>0&&canvas?.width>=128&&!canvas.dataset.renderError;
 },null,{timeout:20000});
 const equipPixels=await page.evaluate(()=>{
  const canvas=document.querySelector('#bag-portrait');
  const gl=canvas?.getContext('webgl2');
  if(!gl)return {error:'missing independent WebGL2 canvas'};
  // WebGL's default drawing buffer is invalidated after the browser
  // compositor runs. Read immediately after an explicit render, not in a
  // later evaluate() turn where readPixels() can report a blank frame.
  const view=templeTest.portraitViewport;
  view.renderer.render(view.scene,view.camera);
  const pixels=new Uint8Array(canvas.width*canvas.height*4);
  gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let visible=0;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]>10)visible++;
  const t=templeTest.portraitViewport;
  let meshes=0,bones=0;t.model?.traverse(o=>{if(o.isMesh)meshes++;if(o.isBone)bones++;});
  return {visible,width:canvas.width,height:canvas.height,error:gl.getError(),
   meshes,bones,focus:{size:t.focus?.size?.toArray(),center:t.focus?.center?.toArray()},
   camera:t.camera?.position?.toArray(),modelScale:t.model?.scale?.toArray(),
   orientation:t.model?.quaternion?.toArray(),
   canvasRect:canvas.getBoundingClientRect().toJSON()};

 });
 await page.screenshot({path:output+'/equip-diagnostic.png'});
 assert.ok(equipPixels.visible>100,
  'EQUIP must render an actual 3D A-pose model, not blank alt-text: '+JSON.stringify(equipPixels));
 await page.screenshot({path:output+'/equip-3d-paper-doll.png'});
 for(const type of ['near','mid','far'])assert.equal(await page.locator('[data-category="'+type+'"]').count(),1,type);
 await page.locator('[data-category="near"]').click();
 await page.waitForTimeout(400);
 assert.ok(await page.locator('#bag-items [data-bag-item="saber-2"]').count()>0,'The current green starter saber must appear in close-range weapons');
 await page.screenshot({path:output+'/weapons.png'});
 await page.locator('#panel-close').click();
 // Browser geometry regression: blue-heart shield stat never overlaps HP, wallet or LV.
 // Check full desktop, portrait phones and narrow/landscape viewports.
 for(const [width,height] of [[1280,800],[390,844],[320,568],[844,390]]){
  await page.setViewportSize({width,height});
  const layout=await page.evaluate(()=>{
   const ui=templeTest.ui,profile=ui.world.profile;
   ui.world={...ui.world,profile:{...profile,
    equipment:{...profile.equipment,shield:'shield-1'},
    shield:{item:'shield-1',hp:12,maxHp:20,lastHit:0}}};
   ui.refreshHUD();
   const get=s=>{const el=document.querySelector(s),r=el?.getBoundingClientRect();
    return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null;};
   return {hp:get('#hp-label'),shield:get('#shield-label'),blue:get('#shield-readout .shield-heart'),
    level:get('#player-level'),wallet:get('#wallet'),shown:!document.querySelector('#shield-readout').hidden};
  });
  const overlaps=(a,b)=>a&&b&&Math.min(a.right,b.right)>Math.max(a.left,b.left)&&
   Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
  assert.ok(layout.shown,'Shield heart absent at '+width+'x'+height);
  assert.ok(['hp','shield','blue','level','wallet'].every(key=>layout[key]?.width>0),
   'Missing vital readout at '+width+'x'+height+': '+JSON.stringify(layout));
  for(const [a,b] of [['hp','shield'],['hp','blue'],['shield','wallet'],['blue','wallet'],['level','hp']])
   assert.ok(!overlaps(layout[a],layout[b]),'Overlapping '+a+' and '+b+' at '+width+'x'+height+': '+JSON.stringify(layout));
  await page.screenshot({path:output+'/shield-hud-'+width+'x'+height+'.png'});
 }
 await page.setViewportSize({width:1280,height:800});



 // World pickups must contain the full 3D weapon mesh, never a billboard.
 const weaponMesh=await page.evaluate(()=>{
  const view=templeTest.arena.adventure,previous=view.world;
  view.world={...previous,groundDrops:[...(previous?.groundDrops||[]),{id:'ci-3d-drop',kind:'weapon',itemId:'tide-1',position:[10,0,10]}]};
  view.nextSync=0;
  view.update(.016,performance.now()/1000,new Map(),templeTest.controller().camera);
  const obj=view.loot.get('ci-3d-drop');
  view.world=previous;
  return !!obj?.userData.weaponDrop&&obj.children.some(child=>child.isGroup&&child.children.some(part=>part.isMesh));
 });
 assert.ok(weaponMesh,'Weapon ground pickup must render a real 3D model');
 // Only real backend-supported WRITE can initiate the cinematic.
 await page.evaluate(()=>templeTest.ui.openPanel('social'));
 await page.waitForFunction(()=>templeTest.writer.phase==='write',null,{timeout:25000});
 const ascent=await page.evaluate(()=>({height:templeTest.controller().root.position.y,disc:templeTest.writer.disc.visible}));
 assert.ok(ascent.disc&&ascent.height>190,'WRITE must lift the character to the high disc');
 assert.equal(await page.locator('[data-form="plant"]').count(),1);
 await page.locator('[data-form="plant"] textarea[name="text"]').fill('Browser-tested eternal message');
 await page.locator('[data-form="plant"]').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>templeTest.ui.world?.plants?.some(p=>p.text==='Browser-tested eternal message'),null,{timeout:20000});
 await page.waitForFunction(()=>templeTest.writer.phase==='showcase'&&templeTest.writer.plantHalo.visible,null,{timeout:25000});
 await page.waitForFunction(()=>!!templeTest.writer.reveal?.plantId,null,{timeout:12000});
 assert.ok(await page.evaluate(()=>templeTest.writer.reveal?.plantId),'WRITE must save a plant before orbiting it');
 assert.equal(await page.evaluate(()=>templeTest.writer.fallCameraActive),true,'The WRITE camera must track the falling avatar');
 // The cinematic clears writer.reveal asynchronously. Pin the durable
 // backend plant ID instead of dereferencing an already-retired frame.
 const plantedId=await page.evaluate(()=>templeTest.ui.world?.plants?.find(p=>p.text==='Browser-tested eternal message')?.id);
 assert.ok(plantedId,'WRITE must persist the message plant');
 await page.waitForFunction(id=>templeTest.arena.adventure.plants.has(id),plantedId,{timeout:20000});
 const plantGrowth=await page.evaluate(id=>{
  const root=templeTest.arena.adventure.plants.get(id);
  if(!root)throw Error('Persisted plant disappeared before visual inspection: '+id);
  return {duration:root.userData.growDur,start:root.userData.growStart,full:root.userData.fullScale.x,now:root.scale.x};
 },plantedId);
 assert.equal(plantGrowth.duration,3100);
 assert.ok(plantGrowth.start>0&&plantGrowth.full>0&&plantGrowth.now<=plantGrowth.full,'A new plant must grow from a hidden initial state');
 await page.screenshot({path:output+'/write-and-plants.png'});
 await page.waitForFunction(()=>!templeTest.writer.active,null,{timeout:10000});
 assert.equal(await page.evaluate(()=>templeTest.controller().cameraLocked),false,'Camera must return to regular controls');
 await page.evaluate(()=>templeTest.ui.showPlantList());
 assert.ok((await page.locator('#panel-content').textContent()).includes('Browser-tested eternal message'));
 await page.locator('#panel-close').click();
 // Non-GM can upload and preview their own art bomb from BUILD.
 await page.evaluate(()=>templeTest.ui.openPanel('build'));
 const upload=page.locator('[data-form="art-bomb-upload"] input[name="artwork"]');
 assert.equal(await upload.count(),1);
 assert.equal(await page.locator('[data-form="art-bomb-upload"] input[name="size"]').getAttribute('min'),'1');
 assert.equal(await page.locator('[data-form="art-bomb-upload"] input[name="size"]').getAttribute('max'),'3');
 const png=await page.screenshot({clip:{x:50,y:50,width:128,height:128}});
 await upload.setInputFiles({name:'ci-art.png',mimeType:'image/png',buffer:png});
 await page.locator('[data-form="art-bomb-upload"] [name="title"]').fill('CI Artwork · 作品名稱');
 await page.locator('[data-form="art-bomb-upload"] [name="size"]').fill('2');
 await page.locator('[data-form="art-bomb-upload"]').evaluate(f=>f.requestSubmit());
 await page.waitForTimeout(1200);
 console.log('art-bomb-upload diagnostics',JSON.stringify(await page.evaluate(()=>({toast:document.querySelector('#toast')?.textContent,buildMode:!document.querySelector('#build-mode')?.hidden,preview:templeTest.arena.buildPreview?.userData.kind,network:templeTest.network.base}))));
 await page.waitForFunction(()=>templeTest.arena.buildPreview?.userData.kind==='art-bomb',{},{timeout:20000});
 await page.waitForFunction(()=>templeTest.arena.buildPreview?.userData.actualArtwork===true,null,{timeout:30000});
 assert.ok(await page.evaluate(()=>templeTest.arena.buildPreview.children[0]?.userData?.record?.mediaId),'The real uploaded media must be rendered instead of a placeholder');
 assert.equal(await page.evaluate(()=>templeTest.arena.buildPreview.children[0]?.userData?.record?.title),'CI Artwork · 作品名稱');
 assert.ok(await page.evaluate(()=>!!templeTest.arena.buildPreview.children[0]?.userData?.titlePlate),'Uploaded artwork must show its name on a black title plate');
 const start=await page.evaluate(()=>templeTest.arena.buildPreview.position.toArray());
 const stateBefore=await page.evaluate(()=>({enabled:templeTest.controller().enabled,grounded:templeTest.controller().grounded,position:templeTest.controller().root.position.toArray(),panel:templeTest.ui.panelName,buildKind:templeTest.ui.buildKind,active:templeTest.writer.active,focused:document.activeElement?.tagName}));
 await page.keyboard.down('w');
 try{
  // SwiftShader in headless CI renders only a few frames per wall-clock
  // second. Wait for actual world-space movement instead of a fixed delay.
  await page.waitForFunction(start=>Math.hypot(
   templeTest.controller().root.position.x-start[0],
   templeTest.controller().root.position.z-start[2])>.35,
   stateBefore.position,{timeout:30000,polling:150});
 }finally{await page.keyboard.up('w');}
 const stateDuring=await page.evaluate(()=>({enabled:templeTest.controller().enabled,grounded:templeTest.controller().grounded,position:templeTest.controller().root.position.toArray(),keys:[...templeTest.controller().keys],speed:templeTest.controller().speed}));
 const end=await page.evaluate(()=>templeTest.arena.buildPreview.position.toArray());
 console.log('art-bomb-carry diagnostics',JSON.stringify({start,end,stateBefore,stateDuring}));
 assert.ok(Math.hypot(end[0]-start[0],end[2]-start[2])>.25,'Uploaded art preview must follow the moving player');
 const scale=await page.evaluate(()=>templeTest.arena.buildPreview.scale.x);
 assert.equal(scale,2);
 await page.screenshot({path:output+'/art-bomb-placement.png'});
 // Exercise real WebGL compilation of bespoke charged attacks (the source-only
 // tests cannot catch browser shader compilation or alpha/blend regressions).
 const vfxState=await page.evaluate(()=>{
  const t=templeTest,items=t.items,v=t.arena.presentation.vfx,recipes={};
  for(const family of ['swatter','pan','saber','petal','planter','palm']){
   const item=items.find(w=>w.slot==='weapon'&&w.family===family&&!w.exotic);
   v.play({origin:[-20,1,-20],direction:[0,0,-1],range:24,charge:1,ultimate:true,area:{mode:'corridor',center:[-20,1,-40],radius:7}},item,null);
   recipes[family]=['swatter','pan','saber','petal','palm'].includes(family)?v.numberedEffects.active.at(-1)?.group?.name:
    ['petal','planter'].includes(family)?v.signatureEffects.active.at(-1)?.obj?.name:v.particleSkills.active.at(-1)?.recipe;
  }
  const gun=items.find(w=>w.id==='calico-cat');
  v.play({origin:[-20,1,-20],direction:[0,0,-1],range:8,charge:1,ultimate:true},gun,null);
  recipes.shotgun=v.signatureEffects.active.at(-1)?.obj?.name;
  const giraffe=items.find(w=>w.id==='giraffe');v.play({origin:[-20,1,-20],direction:[0,0,-1],range:28,charge:1,ultimate:true},giraffe,null);recipes.giraffe=v.signatureEffects.active.at(-1)?.obj?.name;
  return {recipes,sky:t.arena.scene.userData.moonlitSky?.root?.name};
 });
 assert.deepEqual(vfxState.recipes,{swatter:'00GameDevs original VFX #53 darkchain-detonation',pan:'00GameDevs original VFX #68 rolling-fireburst',saber:'00GameDevs original VFX #38 magma-fissure',petal:'00GameDevs original VFX #43 revival-bloom',planter:'Three stacked solid thorn-vine tiers',palm:'00GameDevs original VFX #31 thorn-crown',shotgun:'Twenty independent glowing rainbow shotgun spheres',giraffe:'Visible spinning yellow giraffe model, outbound and returning'});
 assert.equal(vfxState.sky,'World-oriented distant cloud sky (no moon)');
 await page.waitForTimeout(300);
 await page.screenshot({path:output+'/charged-particles.png'});
 // Exercise every exact source inside a real WebGL renderer (not merely in
 // Node). The magic-circle center and native group origin are inspected from
 // the same server-authoritative event data; shader errors are collected above.
 const numberedInspection=await page.evaluate(async()=>{
  const t=templeTest,v=t.arena.presentation.vfx,check=[
   ['clam',33,'channel'],['clam',33,'ultimate'],['saber-1',38,'ultimate'],['palm-1',31,'ultimate'],['bloom-1',43,'channel'],['bloom-1',43,'ultimate'],
   ['swatter-1',53,'ultimate'],['ember-1',73,'channel'],['pan-1',68,'ultimate'],
   ['frost-1',70,'channel'],['storm-1',8,'channel'],['nova-1',20,'channel'],['nova-1',20,'ultimate'],
   ['saber-4',47,'combo'],['jellybrella',26,'ultimate'],['whip-1',48,'ultimate']
  ],records=[];
  for(const [id,num,kind] of check){
   v.numberedEffects.dispose();
   const item=t.items.find(x=>x.id===id);
   const event={origin:[-22,1,-22],direction:[0,0,1],range:17,qualityScale:1,
    qualityTier:kind==='combo'?4:1,combo:kind==='combo'?5:0,
    channel:kind==='channel',ultimate:kind!=='combo',
    area:{mode:'area',center:[-22,.12,-8],visualCenter:[-22,.16,-8],radius:4,travel:14}};
   v.play(event,item,null);
   const fx=v.numberedEffects.active[0];
   records.push({id,num,source:fx?.group?.userData?.vfxSource,
    actual:fx?.spec?.number,group:fx?.group?.name,
    // Native cone/beam/wave/sword skills begin at the real nozzle; only
    // remote blast spells should be located at the ground AoE centre.
    aligned:num===38
      ?fx.group.position.z>-22&&Math.abs(fx.group.userData.fissureRange-17)<.001
      :kind!=='ultimate'||[20,31,33,43].includes(num)
        ?kind!=='ultimate'||Math.hypot(
          fx.group.position.x+22,fx.group.position.y-1,fx.group.position.z+22)<.0001
        :Math.hypot(
          fx.group.position.x+22,fx.group.position.y-.16,fx.group.position.z+8)<.0001});
   // Allow at least one real frame with each source material. #70 / #73
   // also exercise their mandatory authored render pipeline through VHS.
   await new Promise(resolve=>setTimeout(resolve,220));
  }
  v.numberedEffects.dispose();
  return records;
 });
 assert.equal(numberedInspection.length,16);
 for(const result of numberedInspection){
  assert.equal(result.actual,result.num,JSON.stringify(result));
  assert.equal(result.source,'00GameDevs',JSON.stringify(result));
  assert.equal(result.aligned,true,JSON.stringify(result));
 }
 // Reproduce the two reported browser freezes under the real WebGL scene:
 // repeated #47 saber finales and a humanoid stomp at landing.
 const animationStress=await page.evaluate(async()=>{
  const {MonsterAttackEffects}=await import('/src/monster-attack-effects.js');
  const monsters=new MonsterAttackEffects(templeTest.arena.scene);
  const numbered=templeTest.arena.presentation.vfx.numberedEffects;
  const actor=templeTest.arena.islandEnemies.extraModels[0];
  const saber=templeTest.items.find(item=>item.id==='saber-2');
  if(!actor||!saber)throw Error('Missing live model or saber for VFX stress test');
  let frames=0,landings=0,jumpHeight=0;
  try{
   for(let i=0;i<4;i++){
    const t=performance.now();
    const ascent={id:'ci-stomp-'+i,motion:'stomp',phase:'active',
     origin:[-35,0,-35],aim:[-35,0,-35],start:t-650,end:t+850,radius:7};
    templeTest.arena.islandEnemies.updateModel(actor,{
     active:true,skills:[ascent],moving:false,lastHitAt:0
    },.016,t);
    jumpHeight=Math.max(jumpHeight,actor.userData.pivot.position.y);
    const landing={...ascent,start:t-1200,end:t+300};
    monsters.sync([{id:'ci-monster-'+i,active:true,position:[-35,0,-35],skills:[landing]}],t);
    const effect=[...monsters.live.values()][0];
    if(!effect?.rubble?.visible||!effect?.fractures?.visible)
     throw Error('Monster stomp landing FX did not activate');
    landings++;
    numbered.play({id:'ci-rend-'+i,origin:[-35,1,-35],direction:[0,0,1],
     range:8,qualityTier:2,combo:5,ultimate:false},saber,null);
    numbered.update(.016);
    if(numbered.active.filter(e=>e.spec.number===47).length!==1)
     throw Error('Concurrent dimensional-rend GPU effects are not bounded to one');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    frames++;
    monsters.sync([],t+350);
   }
   return {frames,landings,jumpHeight,failed:[...monsters.failedSkills],
    nativeFailed:[...(numbered.failedEffects||[])]};
  }finally{
   monsters.sync([],performance.now());
   numbered.dispose();
  }
 });
 assert.equal(animationStress.frames,4,'four successive GPU frames must complete');
 assert.equal(animationStress.landings,4,'stomp debris and cracks must activate every time');
 assert.ok(animationStress.jumpHeight>1,'humanoid must visibly rise during the leap');
 assert.deepEqual(animationStress.failed,[],'stomp rendering must not throw');
 assert.deepEqual(animationStress.nativeFailed,[],'original dimensional-rend update must not throw');
 // CSS must keep field labels left and numeric controls right, even on a narrow
 // mobile portrait screen; no hidden second row or horizontal overflow.
 await page.setViewportSize({width:360,height:740});
 const mobileFields=await page.evaluate(async()=>{
  const {editorPanelMarkup}=await import('/src/art-editor-panel.js');
  const el=document.getElementById('art-editor');
  el.innerHTML=editorPanelMarkup({depth:.1,brightness:1,contrast:1,saturation:1,blackPoint:0,tint:'#ffffff'},3.2,true);
  el.hidden=false;
  const fields=[...el.querySelectorAll('.art-editor-field')];
  const result={count:fields.length,aligned:fields.every(row=>{
   const label=row.querySelector('.art-field-name')?.getBoundingClientRect(),
     input=row.querySelector('input')?.getBoundingClientRect();
   return label&&input&&input.left>=label.right-1&&input.right<=innerWidth-3&&input.top>=row.getBoundingClientRect().top-2;
  }),overflows:el.scrollWidth>el.clientWidth+2};
  el.hidden=true;
  return result;
 });
 assert.ok(mobileFields.count>=9&&mobileFields.aligned&&!mobileFields.overflows,JSON.stringify(mobileFields));
 // A mobile screenshot exposed ATTACK physically covering the chat input.
 // Keep these interactive rectangles disjoint in the actual viewport.
 const mobileControls=await page.evaluate(()=>{
  const get=id=>{const r=document.querySelector(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const chat=get('#chat-hud'),attack=get('#attack-button'),jump=get('[data-action=jump]'),
   stick=get('#mobile-stick'),interactButton=document.querySelector('[data-action=interact]');
  const overlaps=(a,b)=>a.left<b.right-2&&a.right>b.left+2&&a.top<b.bottom-2&&a.bottom>b.top+2;
  const controls={chat,attack,jump,stick};
  return {controls,collisions:Object.entries(controls).flatMap(([id,rect],i)=>Object.entries(controls).slice(i+1).filter(([,r])=>overlaps(rect,r)).map(([key])=>id+' / '+key)),
   interactVisible:!!interactButton&&getComputedStyle(interactButton).display!=='none',
   chatInside:chat.left>=0&&chat.right<=innerWidth+1&&chat.top>=0&&chat.bottom<=innerHeight+1};
 });
 assert.equal(mobileControls.interactVisible,false,'mobile E must be removed (A handles context)');
 assert.ok(mobileControls.chatInside,JSON.stringify(mobileControls));
 assert.deepEqual(mobileControls.collisions,[],'mobile chat, joystick, A and jump must never overlap');
 await page.screenshot({path:output+'/mobile-responsive.png'});
 // Isolate desktop sniper tests AFTER WRITE and all other server smoke.
 await page.setViewportSize({width:1280,height:800});
 // Desktop sniper regression: two V presses (CAMERA) enter 2x scope, and
 // BOTH an ordinary mouse click and a mask-area click must fire, not exit.
 const setupDesk=await page.evaluate(()=>{
  const t=templeTest,gun=t.gun;
  // Exactly like real online game updates, old snapshots can restore "clam".
  // Force the authoritative local snapshot to carry the actual sniper so
  // GunController's CLOSED-OVER weapon() callback also sees black-cat.
  const originalSetWorld=t.ui.setWorld.bind(t.ui);
  const originalAction=t.network.action.bind(t.network);
  window.desktopScopeShots=0;
  window.desktopScopeLog=[];
  window.desktopForceGun=true;
  t.ui.setWorld=w=>{
   if(window.desktopForceGun&&w?.profile?.equipment)w.profile.equipment.weapon='black-cat';
   return originalSetWorld(w);
  };
  t.ui.world.profile.equipment.weapon='black-cat';
  t.network.action=async function(action,...args){
   if(action==='attack'){window.desktopScopeShots++;return {};}
   return originalAction(action,...args);
  };
  addEventListener('pointerdown',e=>window.desktopScopeLog.push({
   target:e.target?.id||e.target?.tagName,
   type:e.pointerType,x:e.clientX,y:e.clientY,locked:!!document.pointerLockElement
  }),true);
  // Pointer lock may remain stuck indefinitely in overloaded headless Chrome.
  // This test checks scoped shooting; native lock is covered by GunController
  // separately, and is not necessary to exercise pointer event routing.
  const originalRequestLock=gun.canvas.requestPointerLock;
  gun.canvas.requestPointerLock=()=>Promise.resolve();
  window.restoreDesktopScope=()=>{
   gun.canvas.requestPointerLock=originalRequestLock;
   gun.end();window.desktopForceGun=false;
   t.ui.setWorld=originalSetWorld;t.network.action=originalAction;
   t.ui.world.profile.equipment.weapon='clam';
  };
  t.controller().setEnabled(true);
  gun.cycle();gun.cycle();
  return {mode:gun.mode,scopeVisible:!gun.overlay.hidden,weapon:gun.weapon()?.id};
 });
 assert.equal(setupDesk.mode,2,'desktop sniper CAMERA enters full scope');
 // Headless Chrome can swallow Playwright mouse events during native pointer lock.
 // Release the test browser's lock without ending the sniper scope, then
 // exercise real DOM pointerdown with Playwright's ordinary mouse input.
 await page.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock();});
 await page.waitForFunction(()=>document.pointerLockElement===null,{timeout:5000}).catch(async()=>{
  await page.evaluate(()=>document.exitPointerLock?.());
 });
 await page.mouse.click(640,400);
 await page.waitForTimeout(200);
 const firstScope=await page.evaluate(()=>({
  shots:window.desktopScopeShots,mode:templeTest.gun.mode,
  gunWeapon:templeTest.gun.weapon()?.id,
  worldWeapon:templeTest.ui.world?.profile?.equipment?.weapon,
  controllerEnabled:templeTest.controller()?.enabled,
  holdingArt:templeTest.controller()?.holdingArt,
  panel:templeTest.ui.panelName,events:window.desktopScopeLog,
  locked:document.pointerLockElement?.id,
  canvas:document.elementFromPoint(640,400)?.id||document.elementFromPoint(640,400)?.tagName
 }));
 assert.equal(firstScope.shots,1,'desktop scope must fire: '+JSON.stringify(firstScope));
 assert.equal(await page.evaluate(()=>templeTest.gun.mode),2,
  'desktop mouse click must fire without quitting sniper view');
 await page.mouse.click(1010,620);
 await page.waitForTimeout(200);
 const secondScope=await page.evaluate(()=>({
  shots:window.desktopScopeShots,mode:templeTest.gun.mode,
  events:window.desktopScopeLog,locked:document.pointerLockElement?.id
 }));
 assert.equal(secondScope.shots,2,'desktop mask click must fire: '+JSON.stringify(secondScope));
 assert.equal(await page.evaluate(()=>templeTest.gun.mode),2,
  'desktop click outside glass circle must not trigger mobile-only scope exit');
 await page.evaluate(()=>window.restoreDesktopScope());
 // SUPPORT sells a fixed personal painting entitlement, never random wings.
 await page.evaluate(()=>templeTest.ui.openPanel('wing-shop'));
 await page.locator('.wing-design-support [data-wing-checkout]').waitFor({state:'attached'});
 assert.equal(await page.locator('.wing-design-support .wing-gacha-machine').count(),0);
 const support=await page.evaluate(()=>{
  const panel=document.querySelector('#panel'),app=document.querySelector('.wing-design-support'),
   button=app.querySelector('[data-wing-checkout]');
  const p=panel.getBoundingClientRect(),r=app.getBoundingClientRect();
  return {panelWidth:p.width,panelHeight:p.height,appWidth:r.width,
   gachaCount:app.querySelectorAll('[data-draw-wing]').length,
   oneCheckout:app.querySelectorAll('[data-wing-checkout]').length,
   title:app.querySelector('.wing-shop-hero h3')?.textContent||'',
   buttonVisible:getComputedStyle(button).display!=='none'};
 });
 assert.ok(support.panelWidth>900&&support.panelHeight>600,support);
 assert.equal(support.oneCheckout,1,support);
 assert.equal(support.gachaCount,0,support);
 assert.ok(support.buttonVisible,support);
 assert.match(support.title,/THANK YOU FOR YOUR SUPPORT/);
 await page.screenshot({path:output+'/win98-support-personal-wing.png'});
 await page.locator('#panel-close').click();
 assert.deepEqual(errors,[],errors.join('\n'));
 console.log(JSON.stringify({ok:true,write:true,artBombPreview:scale,errors}));
}catch(err){console.error(err);throw err;}finally{await browser.close();}
