import {itemById,EQUIPPABLE_SLOTS,RARITIES,shopWeaponVariant} from './shared/catalog.js';
import {previewMarkup,hydrateItemPreviews} from './item-preview.js';
import {weaponClass,explainEquipment} from './shared/weapon-info.js';
import {weaponPresentation} from './shared/weapon-presentation.js';
import {fusionChance} from './shared/temple-fusion.js';
import {fusionRecordAt} from './shared/fusion-instances.js';
import {groupInventoryStacks} from './shared/inventory-stacks.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tabs=[['all','Items'],['equipment','EQUIP'],['weapons','All Weapons'],['near','Close Range'],['mid','Mid Range'],['far','Long Range'],['head','Head'],['outfit','Outfits'],['wings','Wings'],['shields','Shields'],['comfort','Comfort for the Soul']];
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
  if(!base?.exotic||base.slot!=='weapon')return base;
  const uid=profile.inventoryInstances?.[index]?.uid;
  // A legacy T3 copy must never inherit the tier of another equipped UID.
  const tier=profile.fusionByInstance?.[uid]?.shopTier??
   profile.inventoryInstances?.[index]?.shopTier??
   (index>=0?base.tier:profile.fusion?.[id]?.shopTier??base.tier);
  return shopWeaponVariant(base,tier)||base;
 };
 const tab=ui.bagCategory==='garden'?'all':ui.bagCategory||'all',
  items=(profile.inventory||[]).map((id,index)=>({item:tieredItem(id,index),index})).filter(v=>v.item),
  equipped=(i,index)=>profile.equipment?.[i.slot]===i.id&&
   (!Number.isInteger(index)||!profile.equippedInstanceIds?.[i.slot]||
   profile.equippedInstanceIds[i.slot]===profile.inventoryInstances?.[index]?.uid),
  recordAt=(i,index)=>Number.isInteger(index)?fusionRecordAt(profile,index):profile.fusion?.[i.id];
 const unseenIds=new Set((profile.inventoryInstances||[]).filter(row=>row.viewed===false).map(row=>row.itemId));
 const cell=(item,index=null,count=1)=>{const f=weaponPresentation(item,recordAt(item,index));return `<button class="bag-cell ${equipped(item,index)?'equipped':''}" data-bag-item="${item.id}" ${Number.isInteger(index)?`data-inventory-index="${index}"`:``} data-rarity="${item.rarity}" style="--rarity:${RARITIES.find(r=>r.id===item.rarity)?.color||'#eadcf4'}" draggable="true" title="${esc(f.title)}" aria-label="${esc(f.title)}${count>1?' ×'+count:''}">${previewMarkup(item)}${item.slot==='weapon'?`<small class="range-mark">${({near:'C',mid:'M',far:'L'})[weaponClass(item)]||''}</small>`:''}${f.level?`<small class="fusion-level">+${f.level}</small>`:''}${count>1?`<span class="bag-stack-count" aria-hidden="true">×${count}</span>`:''}${unseenIds.has(item.id)?'<small class="bag-new-mark" aria-label="New item">NEW</small>':''}</button>`;};
 let body='';if(tab==='equipment'){const slot=s=>{const base=itemById(profile.equipment?.[s]),index=profile.inventoryInstances?.findIndex(v=>v.uid===profile.equippedInstanceIds?.[s]&&v.itemId===base?.id)??-1,i=tieredItem(base?.id,index);return `<div class="equip-position"><b>${s.toUpperCase()}${i?.slot==='weapon'?' · '+({near:'Close Range',mid:'Mid Range',far:'Long Range'}[weaponClass(i)]||''):''}</b>${i?cell(i,index>=0?index:null):'<div class="bag-cell"></div>'}<span>${esc(i?weaponPresentation(i,recordAt(i,index>=0?index:null)).title:'Empty')}</span></div>`;};body=`<div class="equipment-layout"><div class="equip-column">${['head','outfit','weapon','shield'].map(slot).join('')}</div><div id="bag-portrait-frame"><canvas id="bag-portrait" role="img" aria-label="Front-facing full 3D character wearing current equipment"></canvas></div><div class="equip-column">${['wings','armor'].map(slot).join('')}</div></div>`;}else{const filter={weapons:['weapon'],head:['head'],outfit:['outfit'],wings:['wings'],shields:['shield'],comfort:['consumable']}[tab];const list=items.filter(({item:i})=>['near','mid','far'].includes(tab)?i.slot==='weapon'&&weaponClass(i)===tab:!filter||filter.includes(i.slot));
 const grouped=groupInventoryStacks(list,recordAt);
 body=grouped.map(({item,index,count})=>cell(item,index,count)).join('')+
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
  body+=`<section class="comfort-bag-gear" aria-label="Comfort for the Soul">
   <h3>Comfort for the Soul</h3>
   <p>Double tap a consumable, then choose shortcut 1, 2 or 3 in the popup. Restock at SHOP.</p>
   <div class="comfort-equip-slots">${assigned}</div>
   <div class="comfort-bag-supplies">${supply||'<small>EMPTY · BUY AT SHOP</small>'}</div>
  </section>`;
 }
 const keepPortrait=tab==='equipment'&&ui.content.querySelector('.equipment-view');
 if(keepPortrait){
  // Keep the actual canvas connected during equipment changes. Detaching
  // and recreating it invalidates all GL state, textures and programs.
  const fresh=document.createElement('template');fresh.innerHTML=body;
  keepPortrait.querySelectorAll('.equip-column').forEach((column,i)=>{
   const next=fresh.content.querySelectorAll('.equip-column')[i];
   const top=column.scrollTop;column.replaceChildren(...next.childNodes);column.scrollTop=top;
  });
  const nextCash=fresh.content.querySelector('.comfort-bag-gear');
  const currentCash=keepPortrait.querySelector('.comfort-bag-gear');
  if(nextCash&&currentCash)currentCash.replaceWith(nextCash);
  else if(nextCash)keepPortrait.append(nextCash);
 }else{
  ui.content.innerHTML=`<div class="original-bag"><nav id="bag-tabs">${tabs.map(([id,label])=>`<button data-category="${id}" aria-pressed="${id===tab}">${label}</button>`).join('')}</nav><button id="fusion-toggle" aria-pressed="${!!ui.bagFusionMode}">FUSION: ${ui.bagFusionMode?'ON':'OFF'}</button><div id="bag-items" class="${tab==='equipment'?'equipment-view':''}">${body}</div><div id="bag-detail">Tap to inspect · Double tap to equip / remove</div><p id="bag-feedback">${ui.bagFusionMode?'Long press and drag to fuse same-category gear; drag near top/bottom to scroll. Turn FUSION OFF to swap inventory slots.':''}</p></div>`;
  if(tab==='equipment'){
   const fresh=ui.content.querySelector('#bag-portrait');
   if(ui.bagPortraitCanvas)fresh.replaceWith(ui.bagPortraitCanvas);
   else ui.bagPortraitCanvas=fresh;
  }
 }
 // The content node is replaced on each authoritative inventory update.
 // Restore both nested grid and outer panel positions after each fusion.
 if(ui.bagLastCategory===tab){
  ui.content.scrollTop=scroll.content;
  ui.content.querySelector('#bag-items').scrollTop=scroll.items;
  ui.content.querySelector('#bag-tabs').scrollLeft=scroll.tabs;
 }
 ui.bagLastCategory=tab;
 ui.content.querySelector('#bag-tabs').onclick=e=>{const b=e.target.closest('[data-category]');if(b){ui.bagCategory=b.dataset.category;renderOriginalBag(ui,ui.world.profile);}};
 ui.content.querySelector('#fusion-toggle').onclick=e=>{ui.bagFusionMode=!ui.bagFusionMode;e.currentTarget.textContent='FUSION: '+(ui.bagFusionMode?'ON':'OFF');e.currentTarget.setAttribute('aria-pressed',String(ui.bagFusionMode));const feedback=ui.content.querySelector('#bag-feedback');if(feedback)feedback.textContent=ui.bagFusionMode?'Long-press and drag same-slot gear to fuse · Drag near an edge to scroll':'FUSION OFF · Drag items to rearrange slots · Drag near an edge to scroll';};
 ui.content.querySelector('#bag-items').onclick=e=>{
  const target=e.target.closest('[data-quick-slot-target]');
  if(target){
   ui.selectedQuickSlot=Number(target.dataset.quickSlotTarget);
   renderOriginalBag(ui,ui.world.profile);return;
  }
  const b=e.target.closest('[data-bag-item]'),i=b&&itemById(b.dataset.bagItem);if(!i)return;
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
 const description=comfort?`<div class="comfort-bag-description">${esc(i.description)} · ${Math.round(i.healFraction*100)}% HP · STOCK ×${ownedCount}</div>
  <div>Double tap to choose shortcut 1, 2 or 3. ${(profile.quickSlots||[]).map((id,j)=>id===i.id?'SLOT '+(j+1):'').filter(Boolean).join(' · ')}</div>`:'';
 ui.content.querySelector('#bag-detail').innerHTML=`<strong>${esc(f.title)}</strong> <span>${esc(i.category||i.rarity)}</span>
  <div>${esc(explainEquipment(i,record))}</div>${description}
  ${comfort?'':`<div>Next Fusion: +${completed+1} · Success Chance: ${(odds*100).toFixed(5).replace(/0+$/,'').replace(/\.$/,'')}% · Failure consumes the ingredient but does not increase fusion level or lower future odds</div>`}
  ${f.traits.length&&!comfort?`<div class="weapon-traits">${f.traits.map(t=>`<span class="weapon-trait" title="${esc(t.details)}">${esc(t.name)} · ${esc(t.details)}</span>`).join('')}</div>`:''}
  ${f.bonuses.length&&!comfort?`<div class="weapon-bonuses">${f.bonuses.map(x=>`<span>${esc(x)}</span>`).join(' · ')}</div>`:''}
  <div>${comfort?'Double tap to assign':equipped(i,index>=0?index:null)?'Equipped · Double tap to remove':'Double tap to equip'}
   ${!comfort&&EQUIPPABLE_SLOTS.includes(i.slot)?equipped(i,index>=0?index:null)?
   `<button type="button" data-unequip="${esc(i.slot)}">UNEQUIP</button>`:
   `<button type="button" data-equip="${esc(i.id)}" ${index>=0?`data-equip-index="${index}"`:''}>EQUIP NOW</button>`:''}
  ${!equipped(i,index>=0?index:null)?`<button data-sell="${i.id}">SELL · +${i.sell||0}</button>`:''}</div>`;
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
