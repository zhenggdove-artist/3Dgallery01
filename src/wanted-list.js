const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=(base,id)=>base+'/api/wanted/media/'+encodeURIComponent(id);
const clampPercent=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(100,v)):50;
const cropPosition=c=>clampPercent(c?.x)+'% '+clampPercent(c?.y)+'%';
// CSS cover positions are percentages of the *overflow*, not frame dimensions.
const zoomValue=v=>Number.isFinite(Number(v))?Math.max(1,Math.min(3,Number(v))):1;
export function dragBackgroundCrop(start,dx,dy,w,h,iw,ih,zoom=1){
 if(!(w>0&&h>0&&iw>0&&ih>0))return {x:clampPercent(start?.x),y:clampPercent(start?.y)};
 const scale=Math.max(w/iw,h/ih)*zoomValue(zoom),ox=iw*scale-w,oy=ih*scale-h;
 return {x:clampPercent(clampPercent(start?.x)-(ox>.01?dx*100/ox:0)),y:clampPercent(clampPercent(start?.y)-(oy>.01?dy*100/oy:0))};
}
function applyWantedStyle(el,s,source){
 el.style.setProperty('--wanted-color',s.color||'#422943');el.style.setProperty('--wanted-size',(Number(s.fontSize)||13)+'px');
 el.style.setProperty('--wanted-flash-color',s.flash?.color||'#ffffff');el.style.setProperty('--wanted-flash-period',(1/Math.max(.25,Math.min(2,Number(s.flash?.hz)||1)))+'s');el.classList.toggle('wanted-flashing',s.flash?.enabled===true);
 el.style.setProperty('--wanted-zoom',String(zoomValue(s.backgroundZoom)));el.style.backgroundPosition=cropPosition(s.backgroundCrop);el.style.setProperty('--wanted-origin',cropPosition(s.backgroundCrop));
 const image=source?'url("'+source+'")':'none';if(el.style.getPropertyValue('--wanted-bg')!==image){el.style.setProperty('--wanted-bg',image);el.style.backgroundImage=image;}
}
// Precomposed Zalgo glyphs: combining marks above, below and through letters.
const zalgo=['G̸͙̹̥̞̏͛͂̈́G̴̜͚̘̦̾͐͌̽T̷̫̯͔̿̈́̓͘E̶̪̙̲͋͊͛̒M̸̦̬̺̄̀͒͝P̴̹̮̥̑͒͋͐L̶̩̝̺̓̈́̄͝È̷̹̗̬̅̚͘','S̷̖̟̩̽͑̓͘C̴̩̗̱̑͒̓͝A̸̼͔̯͂̀̽̕T̴̛͔̗̺͋̓Ṯ̵̪̥̈́͗͝E̶̹̪͋͌͝ͅR̷̛̙̗̻̾͂','0̶̜̞̔͌x̸̺̱͊̓͘F̴̻̺̈́̚F̸̺̞͊͘/̴̠̗͌͝/̵̲̺̈́͐Ë̵̜̗́̚R̵͍̪̈́͊Ṟ̴̛̦͌'];
const zalgoTrack=()=>{const text=zalgo.join(' · ');return '<span class="wanted-zalgo-track">'+esc(text+' · '+text+' · '+text+' · '+text)+'</span>';};
function mountWantedFrame(panel){if(!panel)return;const header=panel.querySelector(':scope > header');if(header&&!header.querySelector('.wanted-zalgo-top')){const band=document.createElement('span');band.className='wanted-zalgo-band wanted-zalgo-top';band.setAttribute('aria-hidden','true');band.innerHTML=zalgoTrack();header.insertBefore(band,header.querySelector('#panel-close'));}for(const edge of ['left','right','bottom'])if(!panel.querySelector('.wanted-zalgo-'+edge)){const band=document.createElement('div');band.className='wanted-zalgo-band wanted-zalgo-'+edge;band.setAttribute('aria-hidden','true');band.innerHTML=zalgoTrack();panel.append(band);}}
let buttonSignature='',buttonRevision=-1;
const PAGE_SIZE=6;
export function syncWantedButton(settings,base){
 const b=document.getElementById('wanted-button');if(!b)return;const s=settings||{label:'Wanted List'},revision=Number(s.revision)||0,key=JSON.stringify([s,base]);if(revision<buttonRevision||key===buttonSignature)return;buttonRevision=revision;buttonSignature=key;b.querySelector('span').textContent=s.label||'Wanted List';applyWantedStyle(b,s,s.background?url(base,s.background):'');b.classList.toggle('wanted-custom',!!s.background);
}
export function bindWantedList(ui,network,jump,action){
 let page=0,requestId=0,data=null,edit=false,admin=false,objectURL=null,crop={x:50,y:50},artPage=0,previewCount=0,previewPage=0,backgroundPreview=null,backgroundCrop={x:50,y:50},backgroundZoom=1,listSeed=0,saving=false;
 const active=()=>ui.panelName===(admin?'wanted-gm':'wanted');
 const revoke=()=>{if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;};
 const api=body=>network.request('/api/wanted',{method:'POST',body,timeoutMs:20000});
 const image=(id,c)=>id?'<img src="'+esc(url(network.base,id))+'" style="object-position:'+Number(c?.x??50)+'% '+Number(c?.y??50)+'%" alt="">':'<span>?</span>';
 async function load(next=page){const id=++requestId;try{const result=await network.request('/api/wanted?page='+next+'&seed='+listSeed,{timeoutMs:15000});if(id!==requestId||!active())return;data=result;page=result.page;syncWantedButton(result.settings,network.base);render();}catch(e){if(active())ui.content.textContent=e.message;}}
 function render(){
  if(!active()||!data)return;
  const p=data.self||{},simulated=admin&&previewCount>0,shownPage=simulated?previewPage:page,pages=simulated?Math.ceil(previewCount/PAGE_SIZE):data.pages,total=simulated?previewCount:data.total;
  const entries=simulated?Array.from({length:Math.min(PAGE_SIZE,previewCount-previewPage*PAGE_SIZE)},(_,i)=>({key:'preview-'+i,name:'Artist '+String(previewPage*PAGE_SIZE+i+1).padStart(2,'0'),website:'https://artist.example',quote:'An exhibition statement.',level:10,kills:12,deaths:4,hasArtwork:true})):data.entries;
  ui.content.innerHTML='<section class="wanted-app"><header class="wanted-title">'+esc(admin?'Wanted List · GM':data.settings.label)+'.exe <span class="wanted-ascii wanted-zalgo-band" aria-hidden="true">'+zalgoTrack()+'</span></header>'+
   '<div class="wanted-toolbar"><button type="button" data-wanted-edit '+(simulated?'disabled':'')+'>'+ (p.name?'Edit my profile':'Create my profile')+'</button><span>'+total+' artists'+(simulated?' · PREVIEW':'')+'</span></div>'+
   (admin&&!simulated?'<form data-wanted-settings><label>Button label<input name="label" maxlength="32" required value="'+esc(data.settings.label)+'"></label><div class="wanted-style-fields"><label>Text color<input name="color" type="color" value="'+esc(data.settings.color||'#422943')+'"></label><label>Text size (px)<input name="fontSize" type="number" min="8" max="30" step="1" required value="'+(data.settings.fontSize||13)+'"></label></div><label class="wanted-check"><input name="flashEnabled" type="checkbox" '+(data.settings.flash?.enabled?'checked':'')+'>Blink text</label><div class="wanted-style-fields"><label>Flash color<input name="flashColor" type="color" value="'+esc(data.settings.flash?.color||'#ffffff')+'"></label><label>Frequency (Hz)<input name="flashHz" type="number" min="0.25" max="2" step="0.25" required value="'+(data.settings.flash?.hz||1)+'"></label></div><label>Background image / GIF<input name="background" type="file" accept="image/*,.gif"></label><small>建議 432 × 192 px（9:4）；按鈕實際 108 × 48 px。PNG / JPEG / WebP / GIF，最多 5 MB。</small><div class="wanted-button-preview" tabindex="0" role="group" aria-label="Drag to reposition background image"><span></span></div><small>在預覽框直接拖曳圖片，調整裁切位置（支援滑鼠與觸控）。</small><label>Background zoom <output data-wanted-zoom-value>100%</output><input name="backgroundZoom" type="range" min="1" max="3" step="0.01" value="'+zoomValue(data.settings.backgroundZoom)+'"></label><div class="wanted-style-fields"><button type="button" data-wanted-center>置中圖片</button><button type="button" data-wanted-zoom-reset>Reset zoom</button></div><label><input type="checkbox" name="clear">Remove background</label><button type="submit" data-wanted-save-button>Save button</button><small data-wanted-save-status role="status"></small></form><div class="wanted-hidden">'+(data.hidden||[]).map(v=>'<button type="button" data-wanted-show="'+esc(v.key)+'">Restore '+esc(v.name)+'</button>').join('')+'</div><button type="button" data-wanted-artworks>Manage artworks</button>':'')+(admin?'<div class="wanted-preview-controls"><label>Preview artist count <input type="number" data-wanted-count min="1" max="999" value="'+(previewCount||6)+'"></label><button type="button" data-wanted-preview>Preview</button><button type="button" data-wanted-preview-reset>Real list</button></div>':'')+
   (edit?'<form data-wanted-profile><div class="wanted-crop" tabindex="0" aria-label="Drag to position avatar">'+image(p.avatar,p.crop)+'</div><label>Avatar<input name="avatar" type="file" accept="image/*,.gif,.bmp,.avif"></label><small>Recommended 512 × 512 px · 5 MB max · PNG, JPEG, WebP, GIF, AVIF, BMP. Drag image to adjust crop.</small><label>Artist name<input name="name" maxlength="24" required value="'+esc(p.name||ui.world?.profile?.name||'')+'"></label><label class="wanted-check"><input type="checkbox" name="useName" '+(p.useName?'checked':'')+'>Use artist name as character name</label><label>Website<input name="website" type="url" maxlength="300" value="'+esc(p.website)+'" placeholder="https://"></label><label>One sentence<input name="quote" maxlength="160" value="'+esc(p.quote)+'"></label><button>Save profile</button><button type="button" data-wanted-cancel>Cancel</button></form>':'')+
   '<div class="wanted-grid">'+entries.map(v=>'<article class="wanted-card"><div class="wanted-avatar">'+image(v.avatar,v.crop)+'</div><div class="wanted-info"><strong>'+esc(v.name)+'</strong>'+(v.website?'<a title="'+esc(v.website)+'" href="'+esc(v.website)+'" target="_blank" rel="noopener noreferrer">'+esc(v.website)+'</a>':'')+'<p title="'+esc(v.quote)+'">'+esc(v.quote)+'</p><button type="button" data-wanted-jump="'+esc(v.key)+'" '+(v.hasArtwork&&!simulated?'':'disabled')+'>Go to artwork</button><details><summary>Stats</summary>LV '+v.level+' · K '+v.kills+' · D '+v.deaths+'</details>'+(admin&&!simulated?'<button type="button" data-wanted-hide="'+esc(v.key)+'">Hide profile</button>':'')+'</div></article>').join('')+'</div><footer><button type="button" data-wanted-page="'+(shownPage-1)+'" '+(shownPage===0?'disabled':'')+'>Previous</button><span>'+(shownPage+1)+' / '+pages+'</span><button type="button" data-wanted-page="'+(shownPage+1)+'" '+(shownPage+1>=pages?'disabled':'')+'>Next</button></footer><small data-wanted-status role="status"></small></section>';
  if(admin&&!simulated){
   const form=ui.content.querySelector('[data-wanted-settings]'),sample=form.querySelector('.wanted-button-preview'),v=form.elements;
   backgroundCrop={x:clampPercent(data.settings.backgroundCrop?.x),y:clampPercent(data.settings.backgroundCrop?.y)};backgroundZoom=zoomValue(data.settings.backgroundZoom);
   // A re-render creates a new file field; don't show a stale unpublished file.
   if(backgroundPreview){URL.revokeObjectURL(backgroundPreview);backgroundPreview=null;}
   let source='',size=null,drag=null;
   const update=()=>{
    sample.querySelector('span').textContent=v.label.value;backgroundZoom=zoomValue(v.backgroundZoom.value);form.querySelector('[data-wanted-zoom-value]').textContent=Math.round(backgroundZoom*100)+'%';
    const next=v.clear.checked?'':backgroundPreview||(data.settings.background?url(network.base,data.settings.background):'');
    if(source!==next){source=next;size=null;drag=null;sample.classList.toggle('has-background',!!source);
     if(source){const img=new Image(),expected=source;img.onload=()=>{if(source===expected)size={width:img.naturalWidth,height:img.naturalHeight};};img.src=source;if(img.complete&&img.naturalWidth)size={width:img.naturalWidth,height:img.naturalHeight};}
    }
    applyWantedStyle(sample,{color:v.color.value,fontSize:Math.max(8,Math.min(30,Number(v.fontSize.value)||13)),flash:{enabled:v.flashEnabled.checked,color:v.flashColor.value,hz:Number(v.flashHz.value)},backgroundCrop,backgroundZoom},source);
   };
   form.addEventListener('input',update);
   v.background.onchange=()=>{if(backgroundPreview)URL.revokeObjectURL(backgroundPreview);backgroundPreview=v.background.files[0]?URL.createObjectURL(v.background.files[0]):null;backgroundCrop=backgroundPreview?{x:50,y:50}:{x:clampPercent(data.settings.backgroundCrop?.x),y:clampPercent(data.settings.backgroundCrop?.y)};if(backgroundPreview){v.clear.checked=false;v.backgroundZoom.value='1';}else v.backgroundZoom.value=String(zoomValue(data.settings.backgroundZoom));update();};
   sample.addEventListener('pointerdown',event=>{if(event.button!==0||!source||!size||drag)return;event.preventDefault();event.stopPropagation();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,crop:{...backgroundCrop},w:sample.clientWidth,h:sample.clientHeight,iw:size.width,ih:size.height,zoom:backgroundZoom};try{sample.setPointerCapture(event.pointerId);}catch{}sample.classList.add('is-dragging');});
   sample.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();backgroundCrop=dragBackgroundCrop(drag.crop,event.clientX-drag.startX,event.clientY-drag.startY,drag.w,drag.h,drag.iw,drag.ih,drag.zoom);sample.style.backgroundPosition=cropPosition(backgroundCrop);sample.style.setProperty('--wanted-origin',cropPosition(backgroundCrop));});
   const finish=event=>{if(drag?.id!==event.pointerId)return;drag=null;sample.classList.remove('is-dragging');try{if(sample.hasPointerCapture(event.pointerId))sample.releasePointerCapture(event.pointerId);}catch{}};
   for(const type of ['pointerup','pointercancel','lostpointercapture'])sample.addEventListener(type,finish);
   sample.addEventListener('keydown',event=>{const directions={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]};if(!source||!size||!directions[event.key])return;event.preventDefault();event.stopPropagation();const [dx,dy]=directions[event.key];backgroundCrop=dragBackgroundCrop(backgroundCrop,dx,dy,sample.clientWidth,sample.clientHeight,size.width,size.height,backgroundZoom);sample.style.backgroundPosition=cropPosition(backgroundCrop);sample.style.setProperty('--wanted-origin',cropPosition(backgroundCrop));});
   form.querySelector('[data-wanted-center]').onclick=()=>{backgroundCrop={x:50,y:50};update();};form.querySelector('[data-wanted-zoom-reset]').onclick=()=>{v.backgroundZoom.value='1';update();};
   update();
  }
  if(edit){crop={x:p.crop?.x??50,y:p.crop?.y??50};const form=ui.content.querySelector('[data-wanted-profile]'),frame=form.querySelector('.wanted-crop');let drag=null;
   form.avatar.onchange=()=>{revoke();const file=form.avatar.files[0];if(!file)return;objectURL=URL.createObjectURL(file);frame.replaceChildren();const img=document.createElement('img');img.src=objectURL;frame.append(img);crop={x:50,y:50};img.style.objectPosition='50% 50%';};
   frame.onpointerdown=e=>{if(!frame.querySelector('img'))return;e.preventDefault();frame.setPointerCapture(e.pointerId);drag={startX:e.clientX,startY:e.clientY,x:crop.x,y:crop.y};};
   frame.onpointermove=e=>{if(!drag)return;crop={x:Math.max(0,Math.min(100,drag.x-(e.clientX-drag.startX)*100/frame.clientWidth)),y:Math.max(0,Math.min(100,drag.y-(e.clientY-drag.startY)*100/frame.clientHeight))};frame.querySelector('img').style.objectPosition=crop.x+'% '+crop.y+'%';};
   frame.onpointerup=frame.onpointercancel=()=>{drag=null;};
  }
 }
 function renderArtworks(){if(!admin||!active())return;const list=ui.world?.customArtworks||[],pages=Math.max(1,Math.ceil(list.length/12));artPage=Math.max(0,Math.min(artPage,pages-1));ui.content.innerHTML='<section class="wanted-app"><header class="wanted-title">Uploaded artworks.exe</header><div class="wanted-toolbar"><button type="button" data-wanted-back>Back</button><span>'+list.length+' works</span></div>'+list.slice(artPage*12,(artPage+1)*12).map(a=>'<div class="wanted-art-row"><span><b>'+esc(a.title)+'</b><small>'+esc(a.author||'')+' · '+esc(a.type)+'</small></span><button type="button" data-wanted-art-edit="'+esc(a.id)+'">Edit</button><button type="button" data-wanted-art-delete="'+esc(a.id)+'">Delete</button></div>').join('')+'<footer><button type="button" data-wanted-art-page="'+(artPage-1)+'" '+(artPage===0?'disabled':'')+'>Previous</button><span>'+(artPage+1)+' / '+pages+'</span><button type="button" data-wanted-art-page="'+(artPage+1)+'" '+(artPage+1>=pages?'disabled':'')+'>Next</button></footer></section>';}
 async function upload(file){if(!file)return null;let blob=file;const ext=file.name.split('.').pop().toLowerCase();const type=file.type||({gif:'image/gif',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif',bmp:'image/bmp'}[ext]||'');if(!['image/gif','image/webp','image/png','image/jpeg','image/avif','image/bmp'].includes(type)){const bitmap=await createImageBitmap(file);try{const c=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);blob=await new Promise(r=>c.toBlob(r,'image/png'));}finally{bitmap.close();}}else if(type!==file.type)blob=new Blob([file],{type});
  if(!blob||blob.size>5*1024*1024)throw Error('Image exceeds 5 MB. Export a smaller image/GIF.');
  const response=await fetch(network.base+'/api/wanted/media',{method:'POST',headers:{Authorization:'Bearer '+network.token,'Content-Type':blob.type},body:blob});const result=await response.json();if(!response.ok)throw Error(result.error);return result.id;}
 ui.addEventListener('wanted-open',e=>{admin=e.detail.admin;mountWantedFrame(ui.content.closest('#panel'));listSeed=(Math.random()*4294967296)>>>0;edit=false;previewCount=0;previewPage=0;if(backgroundPreview)URL.revokeObjectURL(backgroundPreview);backgroundPreview=null;revoke();ui.content.textContent='Loading artists…';void load(0);});
 ui.content.addEventListener('click',async e=>{if(!active())return;const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  try{if('wantedEdit'in d){edit=true;render();}else if('wantedCancel'in d){edit=false;revoke();render();}else if('wantedPreview'in d&&admin){previewCount=Math.max(1,Math.min(999,Math.floor(Number(ui.content.querySelector('[data-wanted-count]').value)||6)));previewPage=0;edit=false;render();}else if('wantedPreviewReset'in d&&admin){previewCount=0;previewPage=0;await load(0);}else if('wantedPage'in d){edit=false;revoke();if(admin&&previewCount){previewPage=Math.max(0,Math.min(Math.ceil(previewCount/PAGE_SIZE)-1,Number(d.wantedPage)));render();}else await load(Number(d.wantedPage));}else if('wantedArtworks'in d){artPage=0;renderArtworks();}else if('wantedArtPage'in d){artPage=Number(d.wantedArtPage);renderArtworks();}else if('wantedBack'in d){render();}else if('wantedArtDelete'in d){if(confirm('Delete this artwork?')){b.disabled=true;const result=await action('gm-remove-artworks',{ids:[d.wantedArtDelete]});if(!result||result.error)throw Error(result?.error||'Delete failed');renderArtworks();}}else if('wantedArtEdit'in d){ui.emit('gm-artwork-select',{id:d.wantedArtEdit});}else if('wantedJump'in d){b.disabled=true;const result=await api({action:'jump',key:d.wantedJump});if(!result.destination)throw Error('No artwork destination returned');try{await jump(result.destination);}finally{b.disabled=false;}}else if('wantedHide'in d||'wantedShow'in d){await api({action:'moderate',key:d.wantedHide||d.wantedShow,hidden:'wantedHide'in d});await load();}}catch(error){b.disabled=false;ui.toast(error.message);}});
 async function saveForm(form){
  if(saving||!active()||!form.reportValidity())return;saving=true;
  const values=new FormData(form),button=form.querySelector('button[type=submit],button:not([type])'),status=form.querySelector('[data-wanted-save-status]');
  const say=message=>{if(status)status.textContent=message;};
  if(button)button.disabled=true;say('Saving…');
  try{
   if(form.matches('[data-wanted-profile]')){
    const file=form.elements.avatar.files[0],avatar=file?await upload(file):data.self?.avatar;
    const saved=await api({action:'save',name:values.get('name'),website:values.get('website'),quote:values.get('quote'),useName:values.has('useName'),avatar,crop});if(ui.world?.profile)ui.world.profile.wanted=saved.self;edit=false;revoke();await load();
   }else{
    const draftCrop={...backgroundCrop},draftZoom=zoomValue(Number(values.get('backgroundZoom'))),flash={enabled:values.has('flashEnabled'),color:values.get('flashColor'),hz:Number(values.get('flashHz'))},old=data.settings,file=form.elements.background.files[0];
    const background=values.has('clear')?'':file?await upload(file):old.background;
    const draft={action:'settings',label:String(values.get('label')).trim(),color:values.get('color'),fontSize:Number(values.get('fontSize')),background,backgroundCrop:draftCrop,backgroundZoom:background?draftZoom:1,flash};
    const result=await api(draft),saved=result.settings,expectedCrop=background?draftCrop:{x:50,y:50};
    if(!result.ok||!saved||saved.label!==draft.label||saved.color!==draft.color||saved.fontSize!==draft.fontSize||saved.background!==(background||null)||saved.backgroundZoom!==draft.backgroundZoom||saved.flash?.enabled!==flash.enabled||saved.flash?.color!==flash.color||saved.flash?.hz!==flash.hz||Number(saved.revision)<=Number(old.revision||0)||Math.abs((saved.backgroundCrop?.x??NaN)-expectedCrop.x)>.001||Math.abs((saved.backgroundCrop?.y??NaN)-expectedCrop.y)>.001)throw Error('Button save not confirmed by server');
    // Apply the receipt immediately. A delayed world snapshot cannot undo it.
    syncWantedButton(saved,network.base);data.settings=saved;
    if(ui.world)ui.world.wantedSettings=saved;
    const check=await network.request('/api/wanted?page='+page+'&seed='+listSeed,{timeoutMs:15000});
    if(!check.settings||Number(check.settings.revision)<saved.revision||(check.settings.revision===saved.revision&&JSON.stringify(check.settings)!==JSON.stringify(saved)))throw Error('Saved, but server readback is not current');
    syncWantedButton(check.settings,network.base);data=check;page=check.page;
    if(backgroundPreview)URL.revokeObjectURL(backgroundPreview);backgroundPreview=null;
    if(active()){render();const receipt=ui.content.querySelector('[data-wanted-save-status]');if(receipt)receipt.textContent='Saved · synced to all players';}
    ui.toast('WANTED BUTTON SAVED');
   }
  }catch(error){say(error.message);ui.toast(error.message);}finally{saving=false;if(button)button.disabled=false;}
 }
 // Explicitly own the save click; native submit remains available for keyboard.
 ui.content.addEventListener('click',e=>{const button=e.target.closest('[data-wanted-save-button]');if(!button||!active())return;e.preventDefault();void saveForm(button.form);},true);
 ui.content.addEventListener('submit',e=>{if(!active()||!e.target.matches('[data-wanted-profile],[data-wanted-settings]'))return;e.preventDefault();void saveForm(e.target);});
 ui.addEventListener('panel',e=>{if(!e.detail.open){requestId++;revoke();if(backgroundPreview)URL.revokeObjectURL(backgroundPreview);backgroundPreview=null;}});
}
