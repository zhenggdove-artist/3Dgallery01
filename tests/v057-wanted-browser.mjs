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
   const {bindWantedList,syncWantedButton}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
   const ui=new EventTarget();ui.panelName='wanted-gm';ui.content=document.getElementById('panel-content');ui.world={profile:{name:'Artist'}};ui.toast=console.error;
   const settings={label:'Artists',color:'#ff0022',fontSize:20,background:null};
   const calls=[];const network={base:'https://example.com',request:async(...args)=>{calls.push(args);return {settings,self:{name:'Artist'},total:1,pages:1,page:0,entries:[{key:'one',name:'Artist',quote:'Hello',level:1,kills:0,deaths:0,hasArtwork:true}]};}};
   syncWantedButton(settings,network.base);bindWantedList(ui,network,()=>{},()=>{});
   ui.dispatchEvent(new CustomEvent('wanted-open',{detail:{admin:true}}));
   await Promise.resolve();await Promise.resolve();
   const btn=document.querySelector('#wanted-button'),label=btn.querySelector('span'),paint=document.querySelector('#paint-button'),bag=document.querySelector('[data-panel=bag]'),write=document.querySelector('[data-panel=social]'),shop=document.querySelector('[data-panel=shop]'),support=document.querySelector('[data-panel=wing-shop]');
   const rect=n=>n.getBoundingClientRect(),s=getComputedStyle(label);
   const menuOk=label.textContent==='Artists'&&s.display!=='none'&&s.color==='rgb(255, 0, 34)'&&s.fontSize==='20px'&&rect(label).width>0&&rect(paint).top===rect(bag).top&&rect(write).top===rect(shop).top&&rect(btn).top===rect(support).top&&rect(paint).right<rect(bag).left;
   const form=ui.content.querySelector('[data-wanted-settings]'),hint=form.textContent.includes('432 × 192');
   form.elements.label.value='Custom';form.elements.color.value='#00ff00';form.elements.fontSize.value='18';form.dispatchEvent(new Event('input',{bubbles:true}));
   const preview=form.querySelector('.wanted-button-preview span'),style=getComputedStyle(preview),live=preview.textContent==='Custom'&&style.fontSize==='18px'&&style.color==='rgb(0, 255, 0)';
   ui.content.querySelector('[data-wanted-count]').value='25';ui.content.querySelector('[data-wanted-preview]').click();
   const count=()=>ui.content.querySelectorAll('.wanted-card').length;
   const first=count()===12&&!ui.content.querySelector('[data-wanted-settings]')&&[...ui.content.querySelectorAll('[data-wanted-jump]')].every(b=>b.disabled);
   ui.content.querySelector('[data-wanted-page="1"]').click();const second=count()===12;
   ui.content.querySelector('[data-wanted-page="2"]').click();const third=count()===1;
   return {menuOk,hint,live,first,second,third,noWrites:calls.length===1};
  },source);
  assert.deepEqual(result,{menuOk:true,hint:true,live:true,first:true,second:true,third:true,noWrites:true},JSON.stringify({viewport,result}));await page.close();
 }
 console.log('V057 Wanted layout and preview passed in desktop and mobile viewport');
}finally{await browser.close();}
