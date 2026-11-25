import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=await read('src/wanted-list.js'),html=await read('index.html');
const menu=html.match(/<nav id="dock"[\s\S]*?<\/nav>/)[0];
const css=(await Promise.all(['styles.css','sketch-hud.css','fidelity-ui.css','wall-paint.css','wanted-list.css'].map(read))).join('\n');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const page=await browser.newPage({viewport});
  await page.setContent('<style>'+css+'</style><div id="hud" class="functions-open">'+menu+'</div><section id="panel"><div id="panel-content"></div></section>');
  const result=await page.evaluate(async source=>{
   const {bindWantedList,syncWantedButton,dragBackgroundCrop}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
   const ui=new EventTarget();ui.panelName='wanted-gm';ui.content=document.getElementById('panel-content');ui.world={profile:{name:'Artist'}};ui.toast=console.error;
   const settings={label:'Artists',color:'#ff0022',fontSize:20,background:null,backgroundCrop:{x:21,y:73},revision:1};
   const calls=[];const network={base:'https://example.com',request:async(...args)=>{calls.push(args);if(args[1]?.body?.action==='settings'){const {action,...draft}=args[1].body;Object.assign(settings,draft,{revision:settings.revision+1});return {ok:true,settings:{...settings}};}return {settings:{...settings},self:{name:'Artist'},total:1,pages:1,page:0,entries:[{key:'one',name:'Artist',quote:'Hello',level:1,kills:0,deaths:0,hasArtwork:true}]};}};
   syncWantedButton(settings,network.base);bindWantedList(ui,network,()=>{},()=>{});
   ui.dispatchEvent(new CustomEvent('wanted-open',{detail:{admin:true}}));
   await Promise.resolve();await Promise.resolve();
   const btn=document.querySelector('#wanted-button'),label=btn.querySelector('span'),paint=document.querySelector('#paint-button'),bag=document.querySelector('[data-panel=bag]'),write=document.querySelector('[data-panel=social]'),shop=document.querySelector('[data-panel=shop]'),support=document.querySelector('[data-panel=wing-shop]');
   const rect=n=>n.getBoundingClientRect(),s=getComputedStyle(label);
   const menuOk=label.textContent==='Artists'&&s.display!=='none'&&s.color==='rgb(255, 0, 34)'&&s.fontSize==='20px'&&rect(label).width>0&&rect(paint).top===rect(bag).top&&rect(write).top===rect(shop).top&&rect(btn).top===rect(support).top&&rect(paint).right<rect(bag).left;
   const form=ui.content.querySelector('[data-wanted-settings]'),hint=form.textContent.includes('432 × 192');
   const cropFrame=form.querySelector('.wanted-button-preview');const persisted=btn.style.backgroundPosition==='21% 73%'&&cropFrame.style.backgroundPosition==='21% 73%';
   const canvas=document.createElement('canvas');canvas.width=canvas.height=200;const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob],'square.png',{type:'image/png'}));form.elements.background.files=transfer.files;form.elements.background.dispatchEvent(new Event('change',{bubbles:true}));
   const image=new Image();image.src=cropFrame.style.backgroundImage.slice(5,-2);await image.decode();await new Promise(r=>requestAnimationFrame(r));
   const pointer=(type,y)=>cropFrame.dispatchEvent(new PointerEvent(type,{pointerId:1,button:0,clientX:50,clientY:y,bubbles:true,cancelable:true,pointerType:innerWidth<640?'touch':'mouse'}));pointer('pointerdown',100);pointer('pointermove',115);pointer('pointerup',115);
   const expected=dragBackgroundCrop({x:50,y:50},0,15,cropFrame.clientWidth,cropFrame.clientHeight,200,200);const dragged=Math.abs(parseFloat(cropFrame.style.backgroundPosition.split(' ')[1])-expected.y)<.01&&expected.y<50;
   form.querySelector('[data-wanted-center]').click();const centered=cropFrame.style.backgroundPosition==='50% 50%';
   form.elements.label.value='Custom';form.elements.color.value='#00ff00';form.elements.fontSize.value='18';form.dispatchEvent(new Event('input',{bubbles:true}));
   const preview=form.querySelector('.wanted-button-preview span'),style=getComputedStyle(preview),live=preview.textContent==='Custom'&&style.fontSize==='18px'&&style.color==='rgb(0, 255, 0)';
   ui.content.querySelector('[data-wanted-count]').value='25';ui.content.querySelector('[data-wanted-preview]').click();
   const count=()=>ui.content.querySelectorAll('.wanted-card').length;
   const first=count()===6&&!ui.content.querySelector('[data-wanted-settings]')&&[...ui.content.querySelectorAll('[data-wanted-jump]')].every(b=>b.disabled);
   ui.content.querySelector('[data-wanted-page="1"]').click();const second=count()===6;
   ui.content.querySelector('[data-wanted-page="2"]').click();const third=count()===6;ui.content.querySelector('[data-wanted-page="3"]').click();const fourth=count()===6;ui.content.querySelector('[data-wanted-page="4"]').click();const fifth=count()===1;
   const noWrites=calls.length===1;ui.content.querySelector('[data-wanted-preview-reset]').click();await new Promise(r=>setTimeout(r,20));const save=ui.content.querySelector('[data-wanted-settings]');save.elements.label.value='Saved Style';save.elements.color.value='#00ff00';save.elements.fontSize.value='18';save.querySelector('[data-wanted-save-button]').click();await new Promise(r=>setTimeout(r,40));syncWantedButton({label:'STALE',revision:1},network.base);const saved=btn.querySelector('span').textContent==='Saved Style'&&ui.content.querySelector('[data-wanted-save-status]').textContent.includes('Saved')&&calls.some(c=>c[1]?.body?.action==='settings');return {menuOk,hint,live,first,second,third,fourth,fifth,persisted,dragged,centered,noWrites,saved};
  },source);
  assert.deepEqual(result,{menuOk:true,hint:true,live:true,first:true,second:true,third:true,fourth:true,fifth:true,persisted:true,dragged:true,centered:true,noWrites:true,saved:true},JSON.stringify({viewport,result}));await page.close();
 }
 console.log('V057 Wanted layout and preview passed in desktop and mobile viewport');
}finally{await browser.close();}
