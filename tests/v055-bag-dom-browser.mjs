import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const source=await readFile(new URL('../src/bag-dom.js',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
  const result=await page.evaluate(async source=>{
   const {patchBagNode,reconcileBagGrid}=await import('data:text/javascript;base64,'+btoa(source));
   const art='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="red"/%3E%3C/svg%3E';
   const cell=(id,equipped=false,extra='')=>`<button class="bag-cell${equipped?' equipped':''}" data-bag-key="${id}" data-inventory-index="${id}"><img data-preview="item-${id}" src='${art}' loading="lazy">${extra}</button>`;
   const grid=document.createElement('div');document.body.append(grid);
   grid.innerHTML=cell(1,true)+cell(2)+cell(3)+'<div class="bag-cell"></div>';
   const initial=[...grid.children],images=initial.slice(0,3).map(n=>n.firstElementChild);
   await Promise.all(images.map(img=>img.decode()));
   images.forEach(img=>img.dataset.previewRecovery='1');
   const changes=new MutationObserver(()=>{});changes.observe(grid,{subtree:true,childList:true,attributes:true});
   const fresh=document.createElement('template');fresh.innerHTML=cell(1)+cell(2,true)+cell(3)+'<div class="bag-cell"></div>';
   reconcileBagGrid(grid,fresh.content);
   const equipMutations=changes.takeRecords();
   const stable=initial.every((n,i)=>grid.children[i]===n)&&images.every((n,i)=>grid.children[i].firstElementChild===n&&n.complete&&n.naturalWidth>0&&n.dataset.previewRecovery==='1');
   const noImageWrites=equipMutations.every(m=>m.type==='attributes'&&m.attributeName==='class'&&m.target.nodeName==='BUTTON');
   const correct=!initial[0].classList.contains('equipped')&&initial[1].classList.contains('equipped');
   fresh.innerHTML=cell(3)+cell(2,true,'<small class="fusion-level">+1</small>')+cell(4)+'<div class="bag-cell"></div>';
   reconcileBagGrid(grid,fresh.content);
   const reordered=grid.children[0]===initial[2]&&grid.children[1]===initial[1]&&grid.children[1].firstElementChild===images[1]&&!initial[0].isConnected;
   const equip=document.createElement('div');equip.innerHTML='<div class="equip-column">'+cell(2,true)+cell(3)+'</div><div id="bag-portrait-frame"><canvas id="bag-portrait"></canvas></div>';document.body.append(equip);
   const column=equip.firstElementChild,unchanged=column.children[1].firstElementChild,canvas=equip.querySelector('canvas');
   const context=canvas.getContext('2d');context.fillStyle='red';context.fillRect(0,0,1,1);
   fresh.innerHTML='<div class="equip-column">'+cell(4,true)+cell(3)+'</div>';
   patchBagNode(column,fresh.content.firstElementChild);
   const portrait=canvas===equip.querySelector('canvas')&&canvas.isConnected&&context.getImageData(0,0,1,1).data[0]===255&&column.children[1].firstElementChild===unchanged;
   return {stable,noImageWrites,correct,reordered,portrait};
  },source);
  assert.deepEqual(result,{stable:true,noImageWrites:true,correct:true,reordered:true,portrait:true},JSON.stringify(result));
  await page.close();
 }
 console.log('V055 BAG DOM regression passed: desktop and mobile, no img detach/src writes on equip, canvas preserved');
}finally{await browser.close();}
