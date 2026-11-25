import {weaponManaQuote,weaponManaLabel,tunedEquipment} from './shared/equipment-tuning.js';
import {equippedItem} from './shared/fusion-adapter.js';
import {itemById,EQUIPPABLE_SLOTS,RARITIES,shopWeaponVariant,shopResalePrice,inventoryCapacity} from './shared/catalog.js';
import {previewMarkup,hydrateItemPreviews} from './item-preview.js';
import {weaponClass,explainEquipment} from './shared/weapon-info.js';
import {weaponPresentation} from './shared/weapon-presentation.js';
import {fusionChance} from './shared/temple-fusion.js';
import {fusionRecordAt} from './shared/fusion-instances.js';
import {groupInventoryStacks} from './shared/inventory-stacks.js';
import {patchBagNode,reconcileBagGrid} from './bag-dom.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tabs=[[['all','Items'],['equipment','Equip'],['weapons','Weapons'],['near','Near'],['mid','Mid'],['far','Far']],[['head','Headwear'],['outfit','Outfits'],['wings','Wings'],['shields','Shields'],['comfort','Comfort']]];
// An explicit three-way choice replaces automatic placement.
function showConsumableSlotPicker(ui,item,profile){
 document.getElementById('comfort-slot-dialog')?.close();
 const dialog=document.createElement('dialog');
 dialog.id='comfort-slot-dialog';
 dialog.className='comfort-slot-dialog';
 dialog.setAttribute('aria-label','Choose a consumable shortcut');
 const assigned=Array.isArray(profile.quickSlots)?profile.quickSlots:[null,null,null];
 dialog.innerHTML=`<div class="comfort-slot-dialog-inner">
  <h3>ASSIGN CONSUMABLE</h3>
  <p>${esc(item.name)} · Select a quick slot (1 / 2 / 3).</p>
  <div class="comfort-slot-choices">${[0,1,2].map(slot=>{
   const previous=itemById(assigned[slot]);
   return `<button type="button" data-assign-comfort-slot="${slot}" aria-label="Assign ${esc(item.name)} to slot ${slot+1}">
    <strong>${slot+1}</strong><span>${esc(previous?.name||'EMPTY')}</span>
    <small>${assigned[slot]===item.id?'CURRENT':'REPLACE SLOT'}</small>
   </button>`;
  }).join('')}</div>
  <button type="button" class="comfort-slot-cancel" data-cancel-comfort-slot>CANCEL</button>
 </div>`;
 dialog.addEventListener('click',event=>{
  const chosen=event.target.closest('[data-assign-comfort-slot]');
  if(chosen){
   const slot=Number(chosen.dataset.assignComfortSlot);
   ui.selectedQuickSlot=null;
   ui.emit('server-action',{action:'assign-consumable',slot,itemId:item.id});
   dialog.close();
  }else if(event.target===dialog||event.target.closest('[data-cancel-comfort-slot]'))dialog.close();
 });
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);
 dialog.showModal();
}
// RELETTER refreshBag/bagCell/inspectBag; Temple's authoritative inventory adapter.
export function renderOriginalBag(ui,profile){
 const scroll={content:ui.content.scrollTop,items:ui.content.querySelector('#bag-items')?.scrollTop||0,tabs:ui.content.querySelector('#bag-tabs')?.scrollLeft||0};
 ui.bagObserver?.disconnect();
 const tieredItem=(id,index)=>{
  const base=itemById(id);
  if(!base||base.slot!=='weapon')return base;
  const uid=profile.inventoryInstances?.[index]?.uid;
  const purchasedGrade=profile.fusionByInstance?.[uid]?.shopTier??
    profile.inventoryInstances?.[index]?.shopTier;
  // Keep ungraded legacy melee/staff copies exactly as originally obtained.
  if(!base.exotic&&!Number.isInteger(purchasedGrade))return base;
  // A legacy T3 copy must never inherit the tier of another equipped UID.
  const tier=purchasedGrade??
   (index>=0?base.tier:profile.fusion?.[id]?.shopTier??base.tier);
  return shopWeaponVariant(base,tier)||base;
 };
 const tab=ui.bagCategory==='garden'?'all':ui.bagCategory||'all',
  items=(profile.inventory||[]).map((id,index)=>({item:tieredItem(id,index),index})).filter(v=>v.item&&v.item.slot!=='armor'),
  equipped=(i,index)=>profile.equipment?.[i.slot]===i.id&&
   (!Number.isInteger(index)||!profile.equippedInstanceIds?.[i.slot]||
   profile.equippedInstanceIds[i.slot]===profile.inventoryInstances?.[index]?.uid),
  recordAt=(i,index)=>Number.isInteger(index)?fusionRecordAt(profile,index):profile.fusion?.[i.id];
 const unseenIds=new Set((profile.inventoryInstances||[]).filter(row=>row.viewed===false).map(row=>row.itemId));
 const cell=(item,index=null,count=1)=>{const f=weaponPresentation(item,recordAt(item,index));return `<button class="bag-cell ${equipped(item,index)?'equipped':''}" data-bag-item="${item.id}" data-bag-key="${esc(profile.inventoryInstances?.[index]?.uid||item.id+':'+String(index))}" ${Number.isInteger(index)?`data-inventory-index="${index}"`:``} data-rarity="${item.rarity}" style="--rarity:${RARITIES.find(r=>r.id===item.rarity)?.color||'#eadcf4'}" draggable="true" title="${esc(f.title)}" aria-label="${esc(f.title)}${count>1?' ×'+count:''}">${previewMarkup(item)}${item.slot==='weapon'?`<small class="range-mark">${({near:'C',mid:'M',far:'L'})[weaponClass(item)]||''}</small>`:''}${f.level?`<small class="fusion-level">+${f.level}</small>`:''}${count>1?`<span class="bag-stack-count" aria-hidden="true">×${count}</span>`:''}${unseenIds.has(item.id)?'<small class="bag-new-mark" aria-label="New item">NEW</small>':''}</button>`;};
 let body='';if(tab==='equipment'){const slot=s=>{const base=itemById(profile.equipment?.[s]),index=profile.inventoryInstances?.findIndex(v=>v.uid===profile.equippedInstanceIds?.[s]&&v.itemId===base?.id)??-1,i=tieredItem(base?.id,index);return `<div class="equip-position"><b>${s.toUpperCase()}${i?.slot==='weapon'?' · '+({near:'Close Range',mid:'Mid Range',far:'Long Range'}[weaponClass(i)]||''):''}</b>${i?cell(i,index>=0?index:null):'<div class="bag-cell"></div>'}<span>${esc(i?weaponPresentation(i,recordAt(i,index>=0?index:null)).title:'Empty')}</span></div>`;};body=`<div class="equipment-layout"><div class="equip-column">${['head','outfit','weapon'].map(slot).join('')}</div><div id="bag-portrait-frame"><canvas id="bag-portrait" role="img" aria-label="Front-facing full 3D character wearing current equipment"></canvas></div><div class="equip-column">${['wings','shield'].map(slot).join('')}</div></div>`;}else{const filter={weapons:['weapon'],head:['head'],outfit:['outfit'],wings:['wings'],shields:['shield'],comfort:['consumable']}[tab];const list=items.filter(({item:i})=>['near','mid','far'].includes(tab)?i.slot==='weapon'&&weaponClass(i)===tab:!filter||filter.includes(i.slot));
 const grouped=groupInventoryStacks(list,recordAt);
 const recent=row=>Math.max(...row.indices.map(i=>profile.inventoryInstances?.[i]?.acquiredAt??i));
 const rank=row=>({common:1,uncommon:2,rare:3,relic:4,epic:5})[row.item.rarity]||1;
 if(ui.bagSort!=='manual')grouped.sort((a,b)=>
   (ui.bagSort==='quality'?rank(b)-rank(a):0)||recent(b)-recent(a)||b.index-a.index);
 body=(['all','wings'].includes(tab)&&profile.wingDesignCredits>0?`<button class="bag-cell wing-canvas-note" data-wing-canvas title="Double tap to draw wings"><svg viewBox="0 0 100 64" width="100%" height="100%" aria-hidden="true"><rect x="3" y="4" width="94" height="56" rx="4" fill="#fff8dc" fill-opacity=".8" stroke="#927b55" stroke-width="1.4"/><rect x="7" y="8" width="86" height="48" rx="2" fill="none" stroke="#b8a66d" stroke-width=".7"/><path d="M8 8Q32 2 54 8T92 8Q98 30 92 56Q64 62 42 56T8 56Q1 30 8 8Z" fill="none" stroke="#507b55" stroke-width="1.1"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(10 8) rotate(-15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(90 56) rotate(165)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(20 9.97089945997692) rotate(15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(80 57.97089945997692) rotate(195)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(30 8.66997630031181) rotate(-15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(70 56.66997630031181) rotate(165)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(40 6.2568484551728245) rotate(15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(60 54.25684845517282) rotate(195)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(50 6.7374667242553565) rotate(-15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(50 54.737466724255356) rotate(165)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(60 9.313973197437578) rotate(15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(40 57.313973197437576) rotate(195)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(70 9.709197816176562) rotate(-15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(30 57.70919781617656) rotate(165)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(80 7.267041741496146) rotate(15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(20 55.26704174149614) rotate(195)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(90 6.041644541697365) rotate(-15)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(10 54.041644541697366) rotate(165)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(7 16) rotate(90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(93 16) rotate(-90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(7 26) rotate(90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(93 26) rotate(-90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(7 36) rotate(90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(93 36) rotate(-90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(7 46) rotate(90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><path d="M0 0 Q-4 -6 -8 -3 Q-6 3 0 0 M0 0 Q5 1 6 -4 Q1 -5 0 0" transform="translate(93 46) rotate(-90)" fill="#739967" stroke="#416e51" stroke-width=".5"/><g transform="translate(8 7) scale(.9 .78)"><path d="M25 38 C14 31 19 20 29 16 C43 9 63 15 76 5 C85 -1 91 8 83 17 L78 23 C88 30 79 35 72 36 C75 43 65 47 59 46 C53 52 38 54 29 47 C17 41 19 28 29 26 C38 23 46 31 43 39 C41 45 31 46 29 39 C27 35 31 32 34 35" fill="#fffdf4" stroke="#8fc9de" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/></g><text x="50" y="54" font-size="5.5" text-anchor="middle" fill="#5c513a" font-family="serif" letter-spacing="1">WING CANVAS</text></svg><b>×${profile.wingDesignCredits}</b></button>`:'')+grouped.map(({item,index,count})=>cell(item,index,count)).join('')+
  '<div class="bag-cell" aria-hidden="true"></div>'.repeat(Math.max(0,42-grouped.length));}
 if(tab==='equipment'){
  const quick=Array.isArray(profile.quickSlots)?profile.quickSlots:[null,null,null];
  const stock=new Map();for(const {item} of items)if(item.slot==='consumable')
   stock.set(item.id,(stock.get(item.id)||0)+1);
  const assigned=quick.map((id,slot)=>{
   const item=itemById(id),amount=stock.get(id)||0,empty=!item,selected=ui.selectedQuickSlot===slot;
   return `<button type="button" class="comfort-equip-slot ${empty?'empty':''} ${item&&!amount?'depleted':''} ${selected?'selected':''}"
     data-quick-slot-target="${slot}" aria-pressed="${selected}" title="Shortcut ${slot+1} · Double tap a consumable to assign">
     <b>${slot+1}</b>${item?`${previewMarkup(item)}<span class="comfort-equip-count">×${amount}</span>`:'<span>EMPTY</span>'}
    </button>`;
  }).join('');
  const supply=[...stock].map(([id,count])=>{
   const item=itemById(id),index=items.find(v=>v.item.id===id)?.index;
   return `<div class="comfort-supply">${cell(item,index,count)}</div>`;
  }).join('');
  const st=profile.stats||{},lv=Math.max(0,(profile.level||1)-1),round=v=>Number((Number(v)||0).toFixed(1));
  const statRows=[['HP',st.maxHp,100,lv*4],['ATK',(st.attack??1)*100,100,0],['DEF',(1-(st.defense??1))*100,0,0],['SPD',(st.speed??1)*100,100,0],['JUMP',(st.jump??1)*100,100,0],['MP',st.maxMana??100,100,lv*4]];
  body+=`<section class="equip-stat-summary">${statRows.map(([label,total,base,level])=>`<div><b>${label} ${round(total)}${['ATK','DEF','SPD','JUMP'].includes(label)?'%':''}</b> (<span class="stat-o">${round(base)}</span> + <span class="stat-a">${round(level)}</span> + <span class="stat-b">${round(total-base-level)}</span>)</div>`).join('')}<small>O Base · A Level · B Gear / active effects</small>${profile.equipment?.weapon?`<div class="bag-mana-cost">${esc(weaponManaLabel(weaponManaQuote(ui.world,equippedItem(profile,itemById(profile.equipment.weapon)),profile.fusion?.[profile.equipment.weapon])))}</div>`:''}</section>`;
  body+=`<section class="comfort-bag-gear" aria-label="Comfort for the Soul">
   <h3>Comfort for the Soul</h3>
   <p>Double tap a consumable, then choose shortcut 1, 2 or 3 in the popup. Restock at SHOP.</p>
   <div class="comfort-equip-slots">${assigned}</div>
   <div class="comfort-bag-supplies">${supply||'<small>EMPTY · BUY AT SHOP</small>'}</div>
  </section>`;
 }
 const sellable=items.filter(({item,index})=>{const row=profile.inventoryInstances?.[index],starter=profile.starterWeaponId||'saber-2';return row?.uid&&!equipped(item,index)&&!(item.id===starter&&profile.inventory.indexOf(starter)===index);});
 const sellSlots=[['weapon','Weapons'],['outfit','Outfits'],['head','Headwear'],['shield','Shields'],['wings','Wings'],['consumable','Consumables']];
 const saleSlot=ui.bagSaleSlot||({weapons:'weapon',near:'weapon',mid:'weapon',far:'weapon',outfit:'outfit',head:'head',shields:'shield',wings:'wings',comfort:'consumable'}[tab]||'weapon'),saleRarity=ui.bagSaleRarity||'common';
 const saleMatches=sellable.filter(({item})=>item.slot===saleSlot&&item.rarity===saleRarity),saleTotal=saleMatches.reduce((sum,{item,index})=>sum+shopResalePrice(item,profile.inventoryInstances[index],ui.world?.shopPrices),0);
 const bulkMarkup=`<div class="bag-sale-tools" id="bag-sale-tools" ${ui.bagSaleOpen?'':'hidden'}><label>Category<select id="bag-sale-slot">${sellSlots.map(([id,name])=>`<option value="${id}" ${id===saleSlot?'selected':''}>${name}</option>`).join('')}</select></label><label>Quality<select id="bag-sale-rarity">${['common','uncommon','rare','relic','epic'].map((id,i)=>`<option value="${id}" ${id===saleRarity?'selected':''}>${['White','Green','Blue','Gold','Purple'][i]}</option>`).join('')}</select></label><button type="button" id="bag-sell-bulk" ${saleMatches.length?'':'disabled'}>SELL ${saleMatches.length} · +${saleTotal.toLocaleString('en-US')}</button></div>`;
 const used=profile.inventory?.length||0,capacity=inventoryCapacity(profile);
 const bagStatus=`<div class="bag-capacity"><strong>BAG · ${used.toLocaleString('en-US')} / ${capacity.toLocaleString('en-US')}</strong><span>${Math.max(0,capacity-used).toLocaleString('en-US')} FREE</span></div><div class="bag-inventory-status" data-inventory-error role="status" aria-live="polite" ${ui.inventoryActionError||ui.inventoryActionNotice?'':'hidden'}>${esc(ui.inventoryActionError||ui.inventoryActionNotice||'')}</div>`;
 const keepPortrait=tab==='equipment'&&ui.content.querySelector('.equipment-view');
 const keepGrid=tab!=='equipment'&&ui.bagLastCategory===tab&&ui.content.querySelector('.original-bag #bag-items:not(.equipment-view)');
 if(keepPortrait){
  // Keep the actual canvas connected during equipment changes. Detaching
  // and recreating it invalidates all GL state, textures and programs.
  const fresh=document.createElement('template');fresh.innerHTML=body;
  keepPortrait.querySelectorAll('.equip-column').forEach((column,i)=>{
   const next=fresh.content.querySelectorAll('.equip-column')[i];
   const top=column.scrollTop;patchBagNode(column,next);column.scrollTop=top;
  });
  const nextStats=fresh.content.querySelector('.equip-stat-summary'),currentStats=keepPortrait.querySelector('.equip-stat-summary');if(nextStats&&currentStats)patchBagNode(currentStats,nextStats);
  const nextCash=fresh.content.querySelector('.comfort-bag-gear');
  const currentCash=keepPortrait.querySelector('.comfort-bag-gear');
  if(nextCash&&currentCash)patchBagNode(currentCash,nextCash);
  else if(nextCash)keepPortrait.append(nextCash);
 }else if(keepGrid){
  const fresh=document.createElement('template');fresh.innerHTML=body;
  reconcileBagGrid(keepGrid,fresh.content);
  ui.content.querySelector('#bag-detail').textContent='Tap to inspect · Double tap to equip / remove';
  ui.content.querySelector('#bag-sort').value=ui.bagSort||'recent';
 }else{
  ui.content.innerHTML=`<div class="original-bag">${bagStatus}<nav id="bag-tabs">${tabs.map(row=>`<div class="bag-tab-row">${row.map(([id,label])=>`<button data-category="${id}" aria-pressed="${id===tab}">${label}</button>`).join('')}</div>`).join('')}</nav><div class="bag-toolbar"><label class="bag-sort-control">SORT <select id="bag-sort"><option value="recent" ${!ui.bagSort||ui.bagSort==='recent'?'selected':''}>Newest first</option><option value="quality" ${ui.bagSort==='quality'?'selected':''}>Quality ↓</option><option value="manual" ${ui.bagSort==='manual'?'selected':''}>Manual order</option></select></label><button id="fusion-toggle" aria-pressed="${!!ui.bagFusionMode}">FUSION: ${ui.bagFusionMode?'ON':'OFF'}</button><button type="button" id="bag-sale-toggle" aria-expanded="${!!ui.bagSaleOpen}" aria-controls="bag-sale-tools">SELL</button></div>${bulkMarkup}<div id="bag-items" class="${tab==='equipment'?'equipment-view':''}">${body}</div><div id="bag-detail">Tap to inspect · Double tap to equip / remove</div><p id="bag-feedback">${ui.bagFusionMode?'Drag same-category gear to fuse.':''}</p></div>`;
  if(tab==='equipment'){
   const fresh=ui.content.querySelector('#bag-portrait');
   if(ui.bagPortraitCanvas&&!ui.bagPortraitCanvas.dataset.portraitRetired)fresh.replaceWith(ui.bagPortraitCanvas);
   else ui.bagPortraitCanvas=fresh;
  }
 }
 // Restore both nested grid and outer panel positions after each fusion.
 if(ui.bagLastCategory===tab){
  ui.content.scrollTop=scroll.content;
  ui.content.querySelector('#bag-items').scrollTop=scroll.items;
  ui.content.querySelector('#bag-tabs').scrollLeft=scroll.tabs;
 }
 ui.bagLastCategory=tab;
 if(keepPortrait||keepGrid){
  const fresh=document.createElement('template');fresh.innerHTML=bagStatus+bulkMarkup;
  for(const selector of ['.bag-capacity','.bag-inventory-status','.bag-sale-tools']){
   const old=ui.content.querySelector(selector),next=fresh.content.querySelector(selector);
   if(old&&next)patchBagNode(old,next);
  }
  ui.content.querySelector('#bag-sale-slot').value=saleSlot;
  ui.content.querySelector('#bag-sale-rarity').value=saleRarity;
 }
 ui.content.querySelector('#bag-sale-toggle').onclick=e=>{ui.bagSaleOpen=!ui.bagSaleOpen;e.currentTarget.setAttribute('aria-expanded',String(ui.bagSaleOpen));ui.content.querySelector('.bag-sale-tools').hidden=!ui.bagSaleOpen;};
 ui.content.querySelector('#bag-sale-slot').onchange=e=>{ui.bagSaleSlot=e.target.value;renderOriginalBag(ui,ui.world.profile);};
 ui.content.querySelector('#bag-sale-rarity').onchange=e=>{ui.bagSaleRarity=e.target.value;renderOriginalBag(ui,ui.world.profile);};
 ui.content.querySelector('#bag-sell-bulk').onclick=()=>{if(ui.shopPurchasePending||!saleMatches.length||!window.confirm(`Sell ${saleMatches.length} ${saleRarity} ${saleSlot} items for ${saleTotal} coins? Equipped items and one starter copy are protected.`))return;ui.emit('server-action',{action:'sell-bulk',slot:saleSlot,rarity:saleRarity,uids:saleMatches.map(({index})=>profile.inventoryInstances[index].uid)});};
 ui.content.querySelector('#bag-tabs').onclick=e=>{const b=e.target.closest('[data-category]');if(b){ui.bagCategory=b.dataset.category;ui.bagSaleSlot=undefined;renderOriginalBag(ui,ui.world.profile);}};
 ui.content.querySelector('#bag-sort').onchange=e=>{ui.bagSort=e.target.value;renderOriginalBag(ui,ui.world.profile);};
 ui.content.querySelector('#fusion-toggle').onclick=e=>{ui.bagFusionMode=!ui.bagFusionMode;e.currentTarget.textContent='FUSION: '+(ui.bagFusionMode?'ON':'OFF');e.currentTarget.setAttribute('aria-pressed',String(ui.bagFusionMode));const feedback=ui.content.querySelector('#bag-feedback');if(feedback)feedback.textContent=ui.bagFusionMode?'Drag same-category gear to fuse.':'';};
 ui.content.querySelector('#bag-items').onclick=e=>{
  const canvas=e.target.closest('[data-wing-canvas]');if(canvas){const now=performance.now();if(ui.canvasTap&&now-ui.canvasTap<500){ui.canvasTap=0;ui.openPanel('wing-personal-painter');}else{ui.canvasTap=now;ui.content.querySelector('#bag-detail').textContent='WING CANVAS · Double tap to design your own wings';}return;}
  const target=e.target.closest('[data-quick-slot-target]');
  if(target){
   ui.selectedQuickSlot=Number(target.dataset.quickSlotTarget);
   renderOriginalBag(ui,ui.world.profile);return;
  }
  const b=e.target.closest('[data-bag-item]');if(!b)return;const i=tieredItem(b.dataset.bagItem,Number(b.dataset.inventoryIndex??-1));if(!i)return;
  // Acknowledgement occurs on explicit BAG inspection only, not on purchase,
  // drag, hover, tab changes or automatic equipment rendering.
  if(unseenIds.has(i.id)){
   unseenIds.delete(i.id);
   for(const instance of profile.inventoryInstances||[])
    if(instance.itemId===i.id)instance.viewed=true;
   for(const cell of ui.content.querySelectorAll('[data-bag-item]'))
    if(cell.dataset.bagItem===i.id)cell.querySelector('.bag-new-mark')?.remove();
   ui.emit('server-action',{action:'inspect-item',itemId:i.id});
  }const index=b.hasAttribute('data-inventory-index')?Number(b.dataset.inventoryIndex):-1,key=profile.inventoryInstances?.[index]?.uid||i.id,now=performance.now(),twice=ui.bagTap?.id===key&&now-ui.bagTap.time<400;ui.bagTap={id:twice?null:key,time:now};ui.content.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));b.classList.add('selected');const record=recordAt(i,index>=0?index:null),f=weaponPresentation(i,record);
 const odds=fusionChance(profile,i.id,index>=0?index:undefined),completed=Math.max(0,Math.floor(Number(record?.layer)||0));
 const ownedCount=profile.inventory.filter(id=>id===i.id).length;
 const comfort=i.slot==='consumable';
 const description=comfort?`<div class="comfort-bag-description">${esc(i.description)} · ${Math.round((i.manaFraction||i.healFraction)*100)}% ${i.manaFraction?'MP':'HP'} · CD ${i.cooldownMs/1000}s · STOCK ×${ownedCount}</div>
  <div>Double tap to choose shortcut 1, 2 or 3. ${(profile.quickSlots||[]).map((id,j)=>id===i.id?'SLOT '+(j+1):'').filter(Boolean).join(' · ')}</div>`:'';
 ui.content.querySelector('#bag-detail').innerHTML=`<strong>${esc(f.title)}</strong> <span>${esc(i.category||i.rarity)}</span>
  <div>${esc(explainEquipment(tunedEquipment(ui.world,i),record))}</div>${i.slot==='weapon'&&i.id!=='black-cat'?`<div class="bag-mana-cost">${esc(weaponManaLabel(weaponManaQuote(ui.world,equippedItem(profile,itemById(i.id),{...record,shopTier:i.shopTier??record?.shopTier??i.tier}),record)))}</div>`:''}${description}
  ${comfort?'':`<div>Next Fusion: +${completed+1} · Success Chance: ${(odds*100).toFixed(5).replace(/0+$/,'').replace(/\.$/,'')}% · Failure consumes the ingredient but does not increase fusion level or lower future odds</div>`}
  ${f.traits.length&&!comfort?`<div class="weapon-traits">${f.traits.map(t=>`<span class="weapon-trait" title="${esc(t.details)}">${esc(t.name)} · ${esc(t.details)}</span>`).join('')}</div>`:''}
  ${f.bonuses.length&&!comfort?`<div class="weapon-bonuses">${f.bonuses.map(x=>`<span>${esc(x)}</span>`).join(' · ')}</div>`:''}
  <div>${comfort?'Double tap to assign':equipped(i,index>=0?index:null)?'Equipped · Double tap to remove':'Double tap to equip'}
   ${!comfort&&EQUIPPABLE_SLOTS.includes(i.slot)?equipped(i,index>=0?index:null)?
   `<button type="button" data-unequip="${esc(i.slot)}">UNEQUIP</button>`:
   `<button type="button" data-equip="${esc(i.id)}" ${index>=0?`data-equip-index="${index}"`:''}>EQUIP NOW</button>`:''}
  ${!equipped(i,index>=0?index:null)?`<button type="button" data-sell="${i.id}" data-sell-uid="${esc(profile.inventoryInstances?.[index]?.uid||'')}">SELL · +${shopResalePrice(i,profile.inventoryInstances?.[index],ui.world?.shopPrices)}</button>`:''}</div>`;
 if(twice){
  if(comfort)showConsumableSlotPicker(ui,i,profile);
  else if(EQUIPPABLE_SLOTS.includes(i.slot))
   ui.emit('server-action',equipped(i,index>=0?index:null)?
    {action:'unequip',slot:i.slot}:
    {action:'equip',itemId:i.id,...(index>=0?{inventoryIndex:index}:{})});
  else ui.emit('use-item',i.id);
 }
 };
 // Every full preview is produced during startup; for a newly designed GM
 // wing, hydrate all pending DOM thumbnails together after its first render.
 void hydrateItemPreviews(ui.content);
 if(tab==='equipment')ui.emit('equipment-portrait');
}
