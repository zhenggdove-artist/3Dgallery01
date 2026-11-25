import {equippedItem} from './shared/fusion-adapter.js';
import {tuningFields,equipmentTuning,tunedEquipment,tuningDamageRatio,weaponManaQuote,weaponManaLabel,restorativeCooldown} from './shared/equipment-tuning.js';
import {FloatingGmEditorPanel} from './gm-floating-panel.js';
import {renderOriginalBag} from './bag-view.js';
import {weaponRangeClass} from './reletter/odd-weapons.js';
import {ART_ACCEPT} from './artwork-upload.js';
import {bindBagDrag} from './bag-drag.js';
import {PLATFORMS} from './shared/arena.js';
import {playerArtworkAppearanceMarkup} from './art-editor-panel.js';
import {ECONOMY,RARITIES,SHOP_ITEMS,SHOP_WEAPON_GRADES,shopWeaponGroups,EQUIPPABLE_SLOTS,ITEMS,itemById,attackStats,shopWeaponVariant,inventoryCapacity,shopOutfitCollection,shopPrice} from './shared/catalog.js';
import {SOUND_PROFILES} from './game-audio.js';
import {pvpShotDamage} from './shared/combat-balance.js';
import {weaponQuality} from './shared/weapon-abilities.js';
import {weaponPresentation} from './shared/weapon-presentation.js';
import {explainEquipment} from './shared/weapon-info.js';
import {previewMarkup,hydrateItemPreviews} from './item-preview.js';
import {drawingForm,attachDrawing,mediaMarkup} from './media-ui.js';
import {SWALLOWTAIL_WINGS} from './reletter/wing-catalog.js';
import {wingIcon} from './reletter/garden-art.js';
import {wingRarity,WING_QUALITY_NAMES,WING_QUALITY_COLORS} from './shared/wing-shop.js';
import {mountWingPainter} from './gm-wing-painter.js';
import {bindChatLayout} from './chat-layout.js';
import {comfortCashImage} from './comfort-cash-art.js';

const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Item inspection is a read receipt. Ignore only the 'viewed' bit when
// deciding whether a full BAG re-render is necessary, preserving the selected
// cell and open description while NEW is removed in place.
export function inventoryPanelSignature(profile){
 return JSON.stringify([
  profile?.inventory,profile?.equipment,profile?.wallet,profile?.fusion,profile?.inventoryCapacity,profile?.admin,
  profile?.wingDesignCredits,profile?.quickSlots,profile?.level,
  (profile?.inventoryInstances||[]).map(row=>[row.uid,row.itemId,row.shopTier])
 ]);
}

export class TempleUI extends EventTarget{
  constructor(){
    super();this.world=null;this.players=[];this.self=null;this.panelName='';this.toastTimer=0;this.near=null;this.chat=[];this.buildKind='';this.selectedPlant=null;this.saveCode='';this.platformDeleteMode=false;this.gmPresenceData=null;this.gmPresenceError='';this.gmPresenceLoading=false;this.lastWingDraw=null;this.wingPaymentStatus=null;this.firebaseIdToken='';this.googleAuthenticated=false;this.authMode='firebase';this.pendingLoginMode='firebase';this.joining=false;this.selectedQuickSlot=null;this.quickBarSignature='';this.shopQuantities={};
    this.entry=$('entry');this.form=$('entry-form');this.hud=$('hud');this.panel=$('panel');this.content=$('panel-content');this.buildFloat=new FloatingGmEditorPanel(this.panel,{force:true,storageKey:'temple-build-floating-v1'});this.buildTab='upload';
    bindBagDrag(this);this.chatLayout=bindChatLayout();addEventListener('resize',()=>this.scheduleRosterLayout());
    this.bind();
    const hotbar=$('comfort-hotbar');
    const quickUse=event=>{
      const button=event.target.closest?.('[data-quick-use]');
      if(!button||button.disabled||this.panelName||this.self?.role!=='fighter')return;
      const slot=Number(button.dataset.quickUse),now=performance.now();
       this.lastQuickUseAt??=new Map();
       if(now-(this.lastQuickUseAt.get(slot)??-Infinity)<140)return;
       this.lastQuickUseAt.set(slot,now);
       this.emit('quick-use',{slot});
    };
    // Dispatch on pointer DOWN, independently of the held left-thumb joystick.
    // iOS may suppress the later synthetic click during simultaneous touches.
    hotbar?.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const button=event.target.closest?.('[data-quick-use]');
      if(!button||button.disabled)return;
      event.preventDefault();event.stopPropagation();
      quickUse(event);
    },{passive:false});
    // iOS sometimes suppresses pointerdown on a second finger while moving.
     hotbar?.addEventListener('touchstart',event=>{
       const button=event.target.closest?.('[data-quick-use]');
       if(!button||button.disabled)return;
       event.preventDefault();event.stopPropagation();
       quickUse(event);
     },{capture:true,passive:false});
     // Keyboard / accessibility activation has no preceding pointerdown.
     hotbar?.addEventListener('click',event=>{
      if(event.detail===0)quickUse(event);
    });
    this.content.addEventListener('input',event=>{
     const input=event.target.closest('[data-shop-quantity]');
     if(!input||this.panelName!=='shop')return;
     const card=input.closest('.item'),buyButton=card?.querySelector('[data-buy]'),
       base=itemById(buyButton?.dataset.buy),
       item=base&&buyButton?.dataset.shopTier?
        shopWeaponVariant(base,Number(buyButton.dataset.shopTier)):base;
     if(!item)return;
     const raw=Number(input.value),quantity=Number.isSafeInteger(raw)?raw:0;
     this.shopQuantities[input.dataset.shopQuantity]=quantity;
     const valid=quantity>=1&&quantity<=99,profile=this.world?.profile,price=shopPrice(item,this.world?.shopPrices);
     const affordable=profile?.admin||this.self?.profile?.admin||Number(profile?.wallet)>=price*quantity;
     const room=(profile?.inventory?.length||0)+quantity<=inventoryCapacity(this.self?.profile?.admin?{...profile,admin:true}:profile);
     const button=card.querySelector('[data-buy]'),label=card.querySelector('[data-buy-total]');
     if(button){button.disabled=!valid||!affordable||!room;button.textContent=!room&&valid?'BAG FULL':!affordable&&valid?'NOT ENOUGH COINS':'BUY '+(valid?'×'+quantity:'')+' · '+(valid?((price*quantity).toLocaleString('en-US')+' COINS'):'—');}
     if(label)label.textContent=!valid?'QUANTITY 1–99':!room?'BAG FULL · '+inventoryCapacity(profile)+' MAX':'TOTAL · '+(price*quantity).toLocaleString('en-US')+' COINS';
    });
    this.content.addEventListener('change',event=>{
     const select=event.target.closest('[data-shop-variant]');
     if(!select||!['shop','shop-prices'].includes(this.panelName))return;
     this.shopVariantChoice??={};
     this.shopVariantChoice[select.dataset.shopVariant]=select.value;
     const offset=this.content.scrollTop;
     this.renderShop(this.world?.profile||this.self?.profile||{inventory:[],equipment:{},wallet:0});
     this.content.scrollTop=offset;
     const next=[...this.content.querySelectorAll('[data-shop-variant]')].find(el=>el.dataset.shopVariant===select.dataset.shopVariant);
     next?.focus({preventScroll:true});
    });$('gm-help').onclick=()=>this.openPanel('help');$('gm-menu').onclick=()=>this.openPanel('gm');this.content.addEventListener('dragstart',e=>{const cell=e.target.closest('[data-bag-item]');if(cell&&this.panelName==='bag'&&cell.dataset.inventoryIndex!==undefined){
     e.dataTransfer.setData('text/plain',cell.dataset.bagItem);
     e.dataTransfer.setData('application/x-temple-slot',cell.dataset.inventoryIndex);
     e.dataTransfer.effectAllowed=this.bagFusionMode?'copyMove':'move';
    }});this.content.addEventListener('dragover',e=>{if(this.panelName==='bag')e.preventDefault();});this.content.addEventListener('drop',e=>{if(this.panelName!=='bag')return;e.preventDefault();
    const target=e.target.closest('[data-inventory-index]');
    const sourceIndex=Number(e.dataTransfer.getData('application/x-temple-slot'));
    const from=e.dataTransfer.getData('application/x-temple-slot');
    if(!target||!from||!Number.isInteger(sourceIndex))return;
    const sourceId=this.world?.profile?.inventory?.[sourceIndex],targetId=target.dataset.bagItem;
    if(this.bagFusionMode){
     if(sourceId&&targetId&&sourceIndex!==Number(target.dataset.inventoryIndex)){const targetIndex=Number(target.dataset.inventoryIndex),ids=this.world?.profile?.inventoryInstances||[];this.emit('server-action',{action:'fuse',sourceId,targetId,sourceIndex,targetIndex,sourceInstanceUid:ids[sourceIndex]?.uid,targetInstanceUid:ids[targetIndex]?.uid,requestId:crypto.randomUUID()});}
    }else this.emit('server-action',{action:'swap-inventory',fromIndex:sourceIndex,toIndex:Number(target.dataset.inventoryIndex)});
   });
    $('function-toggle').onclick=()=>{const open=this.hud.classList.toggle('functions-open');$('function-toggle').setAttribute('aria-expanded',String(open));};
    // A single IME Return commits and sends the completed text.
    const chatInput=$('chat-input');let composing=false,imeEnter=false;
    const chatFocus=active=>{document.body.classList.toggle('chat-typing',active);this.chatLayout?.refit?.();};
    chatInput.addEventListener('focus',()=>chatFocus(true));chatInput.addEventListener('blur',()=>chatFocus(false));
    window.addEventListener('pagehide',()=>chatFocus(false));
    const sendChat=()=>{if(composing)return;const value=chatInput.value.trim();if(!value)return;chatInput.value='';imeEnter=false;chatInput.blur();this.emit('chat',value);};
    chatInput.addEventListener('compositionstart',()=>{composing=true;});
    chatInput.addEventListener('compositionend',()=>{composing=false;if(imeEnter){imeEnter=false;setTimeout(()=>{if(!composing)sendChat();},0);}});
    chatInput.addEventListener('keydown',event=>{if(event.key!=='Enter')return;if(composing||event.isComposing||event.keyCode===229){imeEnter=true;return;}event.preventDefault();sendChat();});
    chatInput.addEventListener('keyup',event=>{if(event.key==='Enter'&&imeEnter&&!composing){imeEnter=false;sendChat();}});
    $('chat-form').onsubmit=event=>{event.preventDefault();if(!composing&&!imeEnter)sendChat();};
  }
  bind(){
    // Suppress native Safari text selection / Lookup / loupe on game controls.
    // Inputs remain selectable and editable; BAG scrolling and paint tools are untouched.
    const mobileControl=target=>target?.closest?.('#attack-button,#dock [data-action="jump"],#mobile-stick');
    const editable=target=>target?.closest?.('input,textarea,select,[contenteditable="true"]');
    document.addEventListener('selectstart',event=>{
      if(!editable(event.target)&&event.target?.closest?.('#game,#hud,#dock'))event.preventDefault();
    },{capture:true});
    document.addEventListener('pointerdown',event=>{
      if(!mobileControl(event.target))return;
      // A selection left by the chat field can make iOS magnify the A button.
      // Clear it only on gameplay controls, never during text editing.
      const active=document.activeElement;
      if(editable(active))active.blur();
      const selection=window.getSelection?.();
      if(selection?.rangeCount)selection.removeAllRanges();
    },{capture:true});
    document.addEventListener('selectionchange',()=>{
      // Safari may select the A/JUMP label after a long press even when
      // selectstart was canceled. Clear only selection anchored in gameplay.
      const selection=window.getSelection?.(),anchor=selection?.anchorNode;
      const element=anchor?.nodeType===1?anchor:anchor?.parentElement;
      if(selection?.rangeCount&&element?.closest?.('#dock,#mobile-stick,#game'))
       selection.removeAllRanges();
    });
    document.addEventListener('dragstart',event=>{
      // Stop native drag previews over touch controls without interfering
      // with equipment drag-and-drop in BAG.
      if(mobileControl(event.target))event.preventDefault();
    },{capture:true});
    document.addEventListener('contextmenu',event=>{
      if(!editable(event.target)&&event.target?.closest?.('#game,#hud,#dock'))event.preventDefault();
    });
    document.addEventListener('touchstart',event=>{
      if(mobileControl(event.target))event.preventDefault();
    },{capture:true,passive:false});
    document.addEventListener('gesturestart',event=>{
      if(!editable(event.target)&&event.target?.closest?.('#game,#hud,#dock'))event.preventDefault();
    },{capture:true,passive:false});
    this.entry.addEventListener('click',event=>{
      const button=event.target.closest('[data-google-login]');
      if(!button||button.disabled)return;
      // Retry the verified identity after a failed game connection.
      // Only the initial click opens Google's account chooser.
      // Keep native user activation intact for iOS Safari's Google popup.
      // Guard rapid duplicate taps with a flag rather than disabling the
      // clicked element while the browser is opening its auth window.
      if(this.googleLoginBusy)return;
      this.googleLoginBusy=true;
      this.pendingLoginMode='firebase';
      this.form.hidden=true;
      $('entry-error').textContent='';
      $('account-login-status').textContent=this.firebaseIdToken?'Reconnecting your verified account…':'正在開啟 Google 帳號選擇視窗…';
      this.emit('firebase-login');
    });
    $('guest-form').addEventListener('submit',event=>{
      event.preventDefault();
      if(this.joining)return;
       if(this.googleAuthenticated||this.firebaseIdToken){
        this.pendingLoginMode='firebase';
        this.joinError('Google account already selected. Create or enter with Google.');
        return;
       }
       $('guest-error').textContent='';
       this.pendingLoginMode='guest';
      this.emit('join',{name:$('guest-name').value.trim(),color:$('guest-color').value,
        mode:'guest',backendUrl:window.TEMPLE_CONFIG.backendUrl});
    });
    this.form.addEventListener('submit',event=>{
      event.preventDefault();$('entry-error').textContent='';
      this.pendingLoginMode='firebase';
      if(!this.firebaseIdToken)return this.joinError('Select a Google account first.');
      this.emit('join',{name:$('player-name').value.trim(),color:$('clothing-color').value,
        firebaseIdToken:this.firebaseIdToken,backendUrl:window.TEMPLE_CONFIG.backendUrl});
    });
    const charge=$('attack-button');let attackPointer=null;charge.onpointerdown=event=>{event.preventDefault();if(attackPointer!==null)return;attackPointer=event.pointerId;charge.setPointerCapture(event.pointerId);this.emit('attack-start');};const endAttack=(event,cancel=false)=>{if(event.pointerId!==attackPointer)return;attackPointer=null;this.emit(cancel?'attack-cancel':'attack-release');};charge.onpointerup=e=>endAttack(e);charge.onpointercancel=charge.onlostpointercapture=e=>endAttack(e,true);const jump=document.querySelector('[data-action=jump]');jump.onpointerdown=e=>{e.preventDefault();jump.setPointerCapture(e.pointerId);this.emit('jump');};jump.onclick=e=>{if(e.detail===0)this.emit('jump');e.stopPropagation();};
    addEventListener('keydown',event=>{if(this.self&&!this.panelName&&event.code==='KeyQ'&&!event.repeat&&!/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)){event.preventDefault();this.emit('attack-start');}});
    addEventListener('keyup',event=>{if(event.code==='KeyQ')this.emit('attack-release');});addEventListener('blur',()=>this.emit('attack-cancel'));
    $('gallery-guide').onclick=()=>this.openPanel('gallery-guide');$('wing-gift-button').onclick=()=>this.openPanel('wing-personal-painter');$('panel-close').onclick=()=>this.closePanel();document.getElementById('dock').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.panel)this.openPanel(button.dataset.panel);else if(button.id==='wing-gift-button')this.openPanel('wing-personal-painter');else if(button.dataset.action)this.emit(button.dataset.action);});
    $('build-confirm').onclick=()=>this.emit('build-confirm');$('build-rotate').onclick=()=>this.emit('build-rotate');$('build-cancel').onclick=()=>this.emit('build-cancel');
    this.content.addEventListener('click',event=>this.panelClick(event));this.content.addEventListener('submit',event=>this.panelSubmit(event));
    // Native color inputs dispatch 'input' continuously while the picker
    // moves. Preview the selected owner's artwork without a network save.
    this.content.addEventListener('input',event=>{
     const form=event.target.closest('[data-form="art-bomb-appearance"]');
     if(!form||!event.target.name)return;
     const values=new FormData(form);
     this.emit('art-bomb-appearance-preview',{
      id:String(values.get('id')),
      appearance:{
       labelBackground:String(values.get('labelBackground')||'#000000'),
       labelColor:String(values.get('labelColor')||'#ffffff'),
       labelFontSize:Number(values.get('labelFontSize')||44),
       labelWidth:Number(values.get('labelWidth')||3.5),
       labelHeight:Number(values.get('labelHeight')||.492)
      }
     });
    });
    this.content.addEventListener('click',event=>{
     const button=event.target.closest('[data-apply-my-label-style]');
     if(!button)return;
     const form=button.closest('[data-form="art-bomb-appearance"]');
     if(!form)return;
     const data=new FormData(form);
     this.emit('apply-my-label-style',{style:{
      labelBackground:String(data.get('labelBackground')||'#000000'),
      labelColor:String(data.get('labelColor')||'#ffffff'),
      labelFontSize:Number(data.get('labelFontSize')||44),
      labelWidth:Number(data.get('labelWidth')||3.5),
      labelHeight:Number(data.get('labelHeight')||.492)
     }});
    });

    this.content.addEventListener('change',event=>{
       const input=event.target.closest('[data-gm-music-file]');
       if(!input||!this.self?.profile?.admin||!input.files?.[0])return;
       this.emit('gm-music-upload',input.files[0]);
       input.value='';
     });
     this.content.addEventListener('change',event=>{const el=event.target.closest('[data-gm-volume]');if(!el||!this.self?.profile?.admin)return;const value=Math.max(0,Math.min(2,Number(el.value)||0));this.emit('gm-audio-setting',{key:el.dataset.gmVolume,value});});
     this.content.addEventListener('input',event=>{
  const el=event.target.closest('[data-gm-volume],[data-gm-fusion-chance]');
  if(!el)return;
  const label=el.parentElement.querySelector('output');
  if(label)label.value=el.hasAttribute('data-gm-fusion-chance')?el.value+'%':Math.round(Number(el.value)*100)+'%';
 });
 this.content.addEventListener('change',event=>{
  if(!this.self?.profile?.admin)return;
  if(event.target.matches('[data-gm-player]')){
   const target=this.gmPlayerTargets().find(p=>p.key===event.target.value),field=this.content.querySelector('[data-gm-level]');
   if(field)field.value=target?.level||1;
   return;
  }
  const chance=event.target.closest('[data-gm-fusion-chance]');
  if(chance){this.emit('gm-fusion-chance',{percent:Number(chance.value)});return;}
  const invincible=event.target.closest('[data-gm-invincible]');
  if(invincible)this.emit('gm-invincible',{enabled:invincible.checked});
 });
     this.content.addEventListener('click',event=>{const action=event.target.closest('[data-gm-action]')?.dataset.gmAction;if(!action||!this.self?.profile?.admin)return;if(action==='refresh')this.requestGmPresence();else if(action==='editor')this.openPanel('editor');else if(action==='help')this.openPanel('help');else if(action==='wing-painter')this.openPanel('wing-painter');else if(action==='wing-player-preview')this.openPanel('wing-player-preview');else if(action==='wing-manage')this.openPanel('wing-manage');
      else if(['self-level','player-level','player-canvas'].includes(action)){
       if(this.gmPlayerActionPending)return;
       const selfOnly=action==='self-level',targetKey=selfOnly?this.self.key:this.content.querySelector('[data-gm-player]')?.value;
       if(!targetKey)return this.toast('請選擇玩家');
       const target=this.gmPlayerTargets().find(p=>p.key===targetKey);
       if(!target)return this.toast('找不到玩家資料');
       if(action==='player-canvas'){if(!target.online&&target.persistent===false)return this.toast('訪客帳號不保留登入身分，請待玩家上線後贈送');this.emit('server-action',{action:'gm-wing-canvas',targetKey});}
       else{const level=Number(this.content.querySelector(selfOnly?'[data-gm-self-level]':'[data-gm-level]')?.value);if(!Number.isInteger(level)||level<1||level>999)return this.toast('等級須為 1–999');this.emit('server-action',{action:'gm-player-level',targetKey,level});}
      }
      else if(action==='chat-position-edit'){this.closePanel();this.chatLayout?.prepare();this.toast('拖曳 CHAT 的 ＋ 至指定位置，再開啟 GM 控制中心儲存');}
      else if(action==='chat-position-save'){this.closePanel();requestAnimationFrame(()=>{const position=this.chatLayout?.position();if(position)this.emit('server-action',{action:'gm-chat-default',...position});});}
      else if(action==='recover-misplaced-artwork')this.emit('server-action',{action:'recover-misplaced-artwork'});
      else if(action==='reset-buildings')this.emit('server-action',{action:'reset-buildings'});
       else if(action==='clean-graffiti'&&window.confirm('確定清除全部永久保存的房屋塗鴉？這個操作無法復原。'))this.emit('server-action',{action:'clean-graffiti'});
      else if(action==='reset-messages'&&window.confirm('確定要永久清空所有留言樹記錄與聊天室訊息？'))this.emit('server-action',{action:'reset-messages'});
       else if(action==='spectator-test')this.emit('gm-spectator-test');});
    this.content.addEventListener('click',event=>{const b=event.target.closest('button');if(b?.dataset.unequip)this.emit('server-action',{action:'unequip',slot:b.dataset.unequip});if(b?.dataset.use)this.emit('use-item',b.dataset.use);});
    this.content.addEventListener('click',event=>{const b=event.target.closest('[data-original]');if(!b)return;this.emit('original-action',{action:b.dataset.original,id:b.dataset.id,hole:b.dataset.hole,item:b.dataset.item,pond:b.dataset.pond});});
    $('gm-spectator-test-exit').addEventListener('click',()=>this.emit('gm-spectator-test'));
     for(const button of document.querySelectorAll('[data-spectator-lift]')){
       const direction=Number(button.dataset.spectatorLift);
       let pointer=null;
       button.addEventListener('pointerdown',event=>{
         if(this.self?.role!=='spectator'||pointer!==null)return;
         event.preventDefault();pointer=event.pointerId;
         button.setPointerCapture(event.pointerId);
         this.emit('spectator-lift',direction);
       });
       const stop=event=>{
         if(pointer!==event.pointerId)return;
         pointer=null;this.emit('spectator-lift',0);
       };
       for(const type of ['pointerup','pointercancel','lostpointercapture'])
        button.addEventListener(type,stop);
     }
     addEventListener('keydown',event=>{if(!this.panelName&&this.self?.role==='fighter'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&
      !/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)&&/^Digit[123]$/.test(event.code)){
      event.preventDefault();this.emit('quick-use',{slot:Number(event.code.slice(-1))-1});return;
     }if(event.code==='Escape'&&this.panelName){event.preventDefault();this.closePanel();return;}if(/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName))return;const code=event.code;if(this.buildKind){if(code==='KeyE'){event.preventDefault();this.emit('build-confirm');}if(code==='KeyR')this.emit('build-rotate');if(code==='Escape')this.emit('build-cancel');return;}if(code==='Tab'&&this.self?.role==='spectator'){event.preventDefault();this.emit('spectator-cycle');return;}if(code==='KeyJ')this.emit('attack');if(code==='KeyB')this.openPanel('bag');if(code==='KeyI')this.openPanel('shop');if(code==='KeyV')this.openPanel('build');if(code==='KeyC')this.openPanel('social');if(code==='Escape')this.closePanel();if(code==='KeyY'&&event.shiftKey){event.preventDefault();this.openPanel('editor');}});
  }
  setLoading(progress,label){$('loading-fill').style.width=`${Math.round(progress*100)}%`;$('loading-detail').textContent=label;$('loading-percent').textContent=`${Math.round(progress*100)}%`;}
  ready(){document.body.classList.add('ready');document.body.classList.remove('booting');}
  setFirebaseLoginStatus(enabled,message=''){
    this.googleLoginBusy=false;
    const button=this.entry.querySelector('[data-google-login]');
    if(button){button.disabled=!enabled;const label=button.querySelector('span:last-child');if(label)label.textContent=this.firebaseIdToken?'Retry connection':'Choose Google Account';}
    $('account-login-status').textContent=message||(
      enabled?'Choose an account to continue.':
      'Google sign-in is unavailable.'
    );
  }
  confirmGoogleIdentity(token){
     if(!token)return;
     this.googleAuthenticated=true;
     this.firebaseIdToken=token;
     this.pendingLoginMode='firebase';
     $('guest-form').hidden=true;
     $('guest-enter').disabled=true;
     $('guest-error').textContent='';
   }
   selectFirebaseAccount(token,profile=null){
     this.confirmGoogleIdentity(token);
     this.googleLoginBusy=false;
    this.pendingLoginMode='firebase';
    this.entry.querySelector('[data-google-login]').disabled=false;
    this.firebaseIdToken=token;
    const existing=!!profile;
    this.entryExistingProfile=existing;
    $('account-login-status').textContent=existing?
      'Account verified. Enter your character.':
      'Account verified. Create your character.';
    $('entry-profile-heading').textContent=existing?'Confirm Character':'Create Character';
    $('player-name').value=existing?String(profile.name||''):'';
    $('clothing-color').value=existing&&/^#[0-9a-fA-F]{6}$/.test(profile.color||'')?profile.color:'#43b59a';
    $('enter-button').textContent=existing?'Enter Game':'Create & Enter';
    this.form.hidden=false;
    this.entry.querySelector('[data-google-login]').hidden=true;
    $('player-name').required=true;
    if(!existing)$('player-name').focus();
  }
  joinBusy(value){
    this.joining=!!value;
    $('enter-button').disabled=value;
    $('enter-button').textContent=value?'Connecting…':this.entryExistingProfile?'Enter Game':'Create & Enter';
    $('guest-enter').disabled=value;
    $('guest-enter').textContent=value&&this.pendingLoginMode==='guest'?'Connecting…':'Enter as Guest';
  }
  joinError(message){
    const details=String(message||'Sign-in failed');
    if(this.pendingLoginMode==='guest')$('guest-error').textContent=details;
    else{
      $('entry-error').textContent=details;
      const status=$('account-login-status');
      if(status&&this.entry&&!this.entry.hidden)
       status.textContent='Character loading failed. '+details+(this.firebaseIdToken?' Retry your verified account.':' Select your Google account to retry.');
    }
    this.googleLoginBusy=false;
    const login=this.entry.querySelector('[data-google-login]');login.disabled=false;const label=login.querySelector('span:last-child');if(label)label.textContent=this.firebaseIdToken?'Retry connection':'Choose Google Account';
    this.joinBusy(false);
  }
  refreshSpectatorControls(){
     const isViewer=this.self?.role==='spectator';
     $('spectator-fly-controls').hidden=!isViewer;
     $('gm-spectator-test-exit').hidden=!(this.self?.profile?.admin&&this.self?.gmSpectatorPreview);
   }
   enter(data){document.activeElement?.blur();this.self=data.self;this.refreshGalleryGuideAttention();this.authMode=data.authMode||'firebase';this.world=data.world;this.chatLayout?.applyDefault(data.world?.chatDefault);this.players=data.players||[];this.joinedAt=Date.now();this.entry.hidden=true;this.firebaseIdToken='';this.hud.hidden=false;document.body.classList.toggle('spectator',data.role==='spectator');$('hud-name').textContent=data.self.name;$('hud-role').textContent=data.role.toUpperCase()+(data.self.profile?.admin?' · GM':'');$('gm-help').hidden=!data.self.profile?.admin||!!data.self.gmSpectatorPreview;$('gm-menu').hidden=!data.self.profile?.admin||!!data.self.gmSpectatorPreview;$('wing-shop-button').hidden=false;this.refreshSpectatorControls();this.refreshHUD();this.joinBusy(false);}
  setSelf(self){this.self={...this.self,...self};$('hud-name').textContent=this.self.name;$('hud-role').textContent=String(this.self.role||'fighter').toUpperCase()+(this.self.profile?.admin?' · GM':'');document.body.classList.toggle('spectator',this.self.role==='spectator');$('gm-help').hidden=!this.self.profile?.admin||!!this.self.gmSpectatorPreview;$('gm-menu').hidden=!this.self.profile?.admin||!!this.self.gmSpectatorPreview;$('wing-shop-button').hidden=false;this.refreshSpectatorControls();this.refreshHUD();if(this.panelName&&this.panelName!=='bag')this.renderPanel();}
  setPlayers(players){this.players=players||[];this.refreshHUD();if(this.panelName==='gm')this.refreshGmPlayerTargets();}
  setWorld(world){this.world=world;this.chatLayout?.applyDefault(world.chatDefault);this.refreshHUD();if(['bag','shop','shop-prices','wing-shop'].includes(this.panelName)&&(this.panelSignature!==inventoryPanelSignature(world.profile)||(['shop','shop-prices'].includes(this.panelName)&&this.shopPriceSignature!==JSON.stringify([world.shopPrices||{},world.equipmentTuning||{}])))&&!(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)&&this.content.contains(document.activeElement)))this.renderPanel();}
  refreshHUD(){const profile=this.world?.profile||this.self?.profile;if(profile){$('wallet').textContent=`${profile.wallet}`;$('hp').max=profile.maxHp||100;$('hp').value=profile.hp||0;$('hp-label').textContent=Math.ceil(profile.hp||0)+'/'+profile.maxHp;$('player-level').textContent='LV. '+(profile.level||1);
 const mp=$('mana-bar'),mpLabel=$('mana-label');if(mp&&mpLabel){mp.max=profile.maxMana||100;mp.value=profile.mana??mp.max;mpLabel.textContent=Math.floor(mp.value)+'/'+mp.max;}
 const shieldItem=itemById(profile.equipment?.shield),shieldDisplay=$('shield-readout');
 if(shieldDisplay){
  const hasShield=shieldItem?.slot==='shield';shieldDisplay.hidden=!hasShield;
  if(hasShield){
   const max=Math.max(0,Math.ceil(Number(profile.shield?.maxHp??shieldItem.capacity*10)||0));
   const current=Math.min(max,Math.max(0,Math.ceil(Number(profile.shield?.hp??max)||0)));
   $('shield-label').textContent=current+'/'+max;
  }
 }
 const held=itemById(profile.equipment?.weapon);
 $('weapon').textContent=(held?weaponPresentation(held,profile.fusion?.[held.id]).title:'UNARMED').toUpperCase();
}const fighters=this.players.filter(p=>p.role==='fighter').length,spectators=this.players.length-fighters;$('online').textContent=`${fighters}/4 · ${spectators}/100`;this.renderRoster();this.renderQuickBar(profile);
    const gift=$('wing-gift-button');
    if(gift)gift.hidden=!(Number(profile?.wingDesignCredits)||0);
     this.showCanvasGrant(profile);
    const monster=this.world?.monster,visible=false;$('monster-hud').hidden=!visible;if(visible){$('monster-name').textContent=`${String(monster.variant).toUpperCase()} · GENERATION ${monster.generation}`;$('monster-hp').max=monster.maxHp;$('monster-hp').value=monster.hp;}}
  showCanvasGrant(profile){
   const grant=profile?.lastWingCanvasGrant;if(!grant?.id||!profile?.key||!this.self||document.getElementById('hud').hidden)return;
   const key='ggtemple-canvas-grant:'+profile.key;
   if(this.seenCanvasGrant===grant.id)return;
   try{if(localStorage.getItem(key)===grant.id)return;localStorage.setItem(key,grant.id);}catch{}
   this.seenCanvasGrant=grant.id;
   if(!(profile.wingDesignCredits>0))return;
   document.querySelector('.canvas-grant-celebration')?.remove();
   const el=document.createElement('div');el.className='canvas-grant-celebration';el.setAttribute('role','status');
   el.innerHTML=`<strong>THANK YOU!</strong><span>WING CANVAS ×${Number(grant.quantity)||1}</span><small>${grant.source==='gm'?'A gift from GGTEMPLE':'Thank you for supporting GGTEMPLE'}</small>`;
   document.body.append(el);setTimeout(()=>el.remove(),3600);
  }
  renderQuickBar(profile){
   const root=$('comfort-hotbar');if(!root)return;
   if(!this.self||this.self.role!=='fighter'){root.hidden=true;return;}
   root.hidden=false;
   const assigned=Array.isArray(profile?.quickSlots)?profile.quickSlots:[null,null,null];
   const inventory=profile?.inventory||[];
   if(this.quickCountInventory!==inventory||!this.quickItemCounts){
    this.quickCountInventory=inventory;this.quickItemCounts=new Map();
    for(const id of inventory)if(itemById(id)?.slot==='consumable')this.quickItemCounts.set(id,(this.quickItemCounts.get(id)||0)+1);
   }
   const slots=Array.from({length:3},(_,i)=>{
    const item=itemById(assigned[i]),count=item?.slot==='consumable'?(this.quickItemCounts.get(item.id)||0):0;
    return {item:item?.slot==='consumable'?item:null,count};
   });
   const until=slots.map(v=>v.item?restorativeCooldown(profile,v.item):0),remaining=until.some(v=>v>Date.now());
   const signature=JSON.stringify([slots.map(v=>[v.item?.id||null,v.count]),until]);
   if(this.quickBarSignature===signature){this.updateQuickCooldown();return;}
   this.quickBarSignature=signature;this.quickCooldownUntil=until;clearInterval(this.quickCooldownTimer);
   root.innerHTML=slots.map(({item,count},i)=>{
    const empty=!item,depleted=!!item&&count===0;
    const label=item?`${item.name} · ${count} remaining`:`Quick slot ${i+1} · Empty`;
    return `<button type="button" class="comfort-quick-slot ${depleted?'depleted':''}" data-quick-use="${i}" ${empty||depleted||until[i]>Date.now()?'disabled':''}
     aria-label="${escape(label)}" title="${escape(label)}">
     ${item?`<img src="${escape(comfortCashImage(item))}" alt="" draggable="false">`:''}
     <span class="comfort-quick-key">${i+1}</span>${item?'<span class="comfort-cooldown" hidden></span>':''}
     ${item?`<span class="comfort-quick-count">×${count}</span>`:'<span class="comfort-quick-blank">+</span>'}
    </button>`;
   }).join('');
   this.updateQuickCooldown();if(remaining)this.quickCooldownTimer=setInterval(()=>this.updateQuickCooldown(),100);
  }
  updateQuickCooldown(){let active=false;for(const b of document.querySelectorAll('#comfort-hotbar [data-quick-use]')){const overlay=b.querySelector('.comfort-cooldown');if(!overlay)continue;const remaining=Math.max(0,(this.quickCooldownUntil?.[Number(b.dataset.quickUse)]||0)-Date.now());active||=remaining>0;overlay.hidden=!remaining;overlay.textContent=remaining?(remaining/1000).toFixed(1):'';b.disabled=!!remaining||b.classList.contains('depleted');}if(!active)clearInterval(this.quickCooldownTimer);}
  renderRoster(){
    const box=$('player-roster');if(!box)return;
    const signature=JSON.stringify(this.players.map(p=>[p.key,p.name,p.role,p.profile?.hp,p.profile?.maxHp]));
    if(this.rosterSignature===signature)return;this.rosterSignature=signature;
    box.replaceChildren();
    for(const p of this.players.filter(player=>player.role==='fighter').slice(0,4)){
      const max=Math.max(1,Number(p.profile?.maxHp)||100),hp=Math.max(0,Number(p.profile?.hp)||0);
      const row=document.createElement('div');row.className='roster-player'+(p.key===this.self?.key?' roster-self':'');
      const label=document.createElement('div');label.className='roster-title';
      const name=document.createElement('span');name.className='roster-name';name.textContent=p.name||'PLAYER';
      const score=document.createElement('small');score.textContent=p.role==='spectator'?'SPECTATOR':Math.ceil(hp)+' / '+max;
      label.append(name,score);
      const track=document.createElement('div');track.className='roster-track';
      track.setAttribute('role','progressbar');track.setAttribute('aria-label',(p.name||'PLAYER')+' health');
      track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(max));track.setAttribute('aria-valuenow',String(hp));
      const fill=document.createElement('i');fill.style.width=(p.role==='spectator'?0:Math.min(100,hp/max*100))+'%';
      if(hp/max<.25)fill.className='critical';track.append(fill);row.append(label,track);box.append(row);
    }
    this.scheduleRosterLayout();
  }
  scheduleRosterLayout(){
    cancelAnimationFrame(this.rosterLayoutFrame||0);
    this.rosterLayoutFrame=requestAnimationFrame(()=>{
      const roster=$('player-roster');if(!roster?.childElementCount||this.hud?.hidden)return;
      // Previous scale was .4: enlarge 1.3x, shrink an additional 10%
      // only when viewport bounds or other HUD elements would be covered.
      roster.style.setProperty('--roster-scale','.52');
      const box=roster.getBoundingClientRect();
      const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const ids=['wallet','identity','chat-hud','dock','mobile-stick','map-cluster','gm-help','gm-menu'];
      const obstructed=ids.some(id=>{
        const node=$(id);if(!node||node.hidden||getComputedStyle(node).display==='none')return false;
        return overlap(box,node.getBoundingClientRect());
      });
      if(obstructed||box.left<6||box.right>innerWidth-6||box.top<6||box.bottom>innerHeight-6)
        roster.style.setProperty('--roster-scale','.468');
    });
  }
  showKillEvents(events=[]){
    if(!this.self)return;
    this.seenKillEvents??=new Set();
    for(const e of events){
      if(!e?.id||this.seenKillEvents.has(e.id))continue;
      this.seenKillEvents.add(e.id);
      if(e.killerKey!==this.self.key||e.victimKey===this.self.key||e.time<(this.joinedAt||0)-500||Date.now()-e.time>5500)continue;
      const notice=$('kill-notice');notice.textContent='YOU ELIMINATED '+(e.victimName||'PLAYER');
      notice.hidden=false;clearTimeout(this.killNoticeTimer);this.killNoticeTimer=setTimeout(()=>{notice.hidden=true},3000);
    }
    if(this.seenKillEvents.size>128)this.seenKillEvents.clear();
  }
  setNear(near,holding=false){this.near=near;const prompt=$('prompt');let text='';const touch=matchMedia('(pointer:coarse)').matches;if(this.platformToolMode==='place')text='GM PLACE · ENTER / E / PLACE · ESC';else if(this.platformToolMode==='edit')text='GM EDIT · CLICK DISC / PEDESTAL → BLUE';else if(this.buildKind)text=touch?'A · PLACE':'E · PLACE  R · ROTATE  ESC · CANCEL';else if(holding)text='HOLD A · CHARGE THROW';else if(near?.type==='coin'||near?.type==='drop')text='';else if(near?.type==='artwork')text='A · TAKE ARTWORK';else if(near?.type==='plant')text='';else if(near?.type==='structure')text='ATTACK · DAMAGE STRUCTURE';if(prompt.textContent===text&&this.nearPromptText===text)return;this.nearPromptText=text;prompt.textContent=text;prompt.classList.toggle('artwork-pickup-hint',text==='A · TAKE ARTWORK');prompt.classList.toggle('artwork-throw-hint',text==='HOLD A · CHARGE THROW');prompt.classList.toggle('visible',!!text);}
  showCollectorSale(sale,key){
   // Fresh server-confirmed sale notifications are displayed exactly once.
   // Once visible, the appraisal NEVER times out or disappears on world sync.
   if(!sale||!key||sale.buyer!==key||this.seenCollectorSaleId===sale.id||
      !Number.isFinite(sale.time)||Date.now()-sale.time>10_000)return;
   if(this.collectorSaleOverlay){
    this.pendingCollectorSale={sale,key};
    return;
   }
   this.seenCollectorSaleId=sale.id;
   const overlay=document.createElement('div');
   overlay.id='collector-sale-overlay';overlay.setAttribute('role','dialog');
   overlay.setAttribute('aria-modal','true');
   overlay.setAttribute('aria-label','Collector appraisal');
   const card=document.createElement('div');card.id='collector-sale-card';
   const title=document.createElement('small');title.textContent='COLLECTOR · APPRAISAL';
   const quote=document.createElement('p');quote.textContent=String(sale.review||'');
   const reward=document.createElement('strong');
   reward.textContent='+'+Number(sale.price||0).toLocaleString('en-US')+' COINS';
   const hint=document.createElement('small');hint.textContent='TAP ANYWHERE TO CLOSE';
   card.append(title,quote,reward,hint);overlay.append(card);
   overlay.addEventListener('pointerdown',event=>{
    event.preventDefault();event.stopPropagation();
    overlay.remove();
    if(this.collectorSaleOverlay===overlay)this.collectorSaleOverlay=null;
    const pending=this.pendingCollectorSale;
    this.pendingCollectorSale=null;
    if(pending)this.showCollectorSale(pending.sale,pending.key);
   });
   document.body.append(overlay);
   this.collectorSaleOverlay=overlay;
  }
  setShopPurchasePending(pending){
    this.shopPurchasePending=pending;
    for(const button of this.content.querySelectorAll('[data-buy]')){
      if(pending){if(!button.hasAttribute('data-idle-label')){button.dataset.idleLabel=button.textContent;button.dataset.idleDisabled=String(button.disabled);}button.disabled=true;button.textContent='PURCHASING…';}
      else if(button.hasAttribute('data-idle-label')){button.textContent=button.dataset.idleLabel;button.disabled=button.dataset.idleDisabled==='true';delete button.dataset.idleLabel;delete button.dataset.idleDisabled;}
    }
  }
  showPurchaseStatus(state,message){
    const notice=$('purchase-notice');if(!notice)return;
    clearTimeout(this.purchaseNoticeTimer);clearTimeout(this.purchaseHideTimer);
    notice.dataset.state=state;notice.textContent=message;notice.hidden=false;
    notice.classList.remove('leaving');notice.classList.add('visible');
    if(state==='pending')return;
    this.purchaseNoticeTimer=setTimeout(()=>{notice.classList.add('leaving');this.purchaseHideTimer=setTimeout(()=>{notice.classList.remove('visible','leaving');notice.hidden=true;},250);},3500);
  }
  purchaseNotice(itemName,quantity){
    this.showPurchaseStatus('success','PURCHASE SUCCESSFUL · '+String(itemName||'ITEM')+' ×'+String(quantity||1));
  }
  toast(message){clearTimeout(this.toastTimer);const toast=$('toast');toast.textContent=message;toast.classList.add('visible');this.toastTimer=setTimeout(()=>toast.classList.remove('visible'),2200);}
  fusionFeedback(success,message=''){
    clearTimeout(this.fusionTimer);
    this.fusionIndicator?.remove();
    const box=document.createElement('div');box.id='fusion-outcome';
    box.setAttribute('role','status');box.textContent=success?'FUSION SUCCESS':'FUSION FAILED';
    box.title=String(message).slice(0,240);
    box.style.cssText='position:fixed;left:50%;top:28%;transform:translateX(-50%);z-index:9999;pointer-events:none;padding:10px 20px;border-radius:8px;text-align:center;font:700 24px system-ui,sans-serif;letter-spacing:.12em;background:rgba(17,22,35,.64);border:1px solid '+(success?'rgba(108,255,195,.6)':'rgba(255,100,125,.65)')+';color:'+(success?'#91ffcf':'#ff8ca6')+';text-shadow:0 1px 6px #000;opacity:0.88;max-width:75vw';
    document.body.append(box);this.fusionIndicator=box;
    box.animate([{opacity:.9,offset:0},{opacity:.9,offset:.5},{opacity:0,offset:1}],{duration:1000,fill:'forwards'});
    this.fusionTimer=setTimeout(()=>{box.remove();if(this.fusionIndicator===box)this.fusionIndicator=null;},1020);
  }
  death(until,killer=''){if(this.deathUntil===until&&this.deathKiller===killer)return;this.deathUntil=until;this.deathKiller=killer;clearTimeout(this.deathTimer);const overlay=$('death');$('death-killer').textContent=killer?'KILLED BY '+killer:'';if(!until||until<=Date.now()){overlay.hidden=true;return;}overlay.hidden=false;const update=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000));$('respawn-count').textContent=left;if(left)this.deathTimer=setTimeout(update,200);else overlay.hidden=true;};update();}
  galleryGuideKey(){return 'temple-gallery-guide-read-v1:'+String(this.self?.key||'guest');}
  refreshGalleryGuideAttention(){const key=this.galleryGuideKey();let read=this.galleryGuideReadKey===key;try{read=read||localStorage.getItem(key)==='1';}catch{}$('gallery-guide').classList.toggle('guide-unread',!read);}
  markGalleryGuideRead(){const key=this.galleryGuideKey();this.galleryGuideReadKey=key;try{localStorage.setItem(key,'1');}catch{}$('gallery-guide').classList.remove('guide-unread');}
  openPanel(name,fromJourney=false){if(!this.self)return;if(this.self.gmSpectatorPreview&&['gm','editor','help','sky-color','wing-manage','wing-painter','wing-personal-painter','wing-player-preview','shop-prices'].includes(name))return;
     if(['gm','wing-manage','shop-prices','wing-player-preview','wing-painter'].includes(name)&&!this.self.profile?.admin)return;
     // Sky editing is a separate GM capability; retain the existing SUPPORT access contract.
     if(name==='sky-color'&&!this.self.profile?.admin)return;
    if(name==='wing-personal-painter'&&!(this.world?.profile?.wingDesignCredits>0))return;if(name==='social'&&!fromJourney&&this.self.role!=='spectator'){this.emit('write-start');return;}this.hud.classList.remove('functions-open');$('function-toggle').setAttribute('aria-expanded','false');if(name==='shop'&&this.panelName!=='shop'){this.shopTab='head';this.shopSelectedKey=null;}this.panelName=name;document.body.classList.add('panel-open');document.body.classList.toggle('panel-wing-painter',['wing-painter','wing-personal-painter','wing-player-preview'].includes(name));document.body.classList.toggle('panel-wing-shop',['wing-shop','wing-manage'].includes(name));this.panel.hidden=false;this.panel.classList.toggle('build-floating',['build','sky-color','gallery-guide'].includes(name));this.panel.classList.toggle('sky-color-floating',name==='sky-color');this.panel.classList.toggle('gallery-guide-floating',name==='gallery-guide');if(['build','sky-color','gallery-guide'].includes(name)){this.buildFloat.open();this.buildFloat.setCollapsed(false);}else{this.buildFloat.mobile=false;this.panel.classList.remove('gm-mobile-floating');}this.renderPanel();this.emit('panel',{open:true,name});
    if(name==='wing-shop'){$('panel-close').focus({preventScroll:true});this.emit('wing-payment-status-request');}
    if(name==='gm'){this.content.scrollTop=0;this.requestGmPresence();this.content.scrollTop=0;}}
  closePanel(){if(this.panel.hidden)return;this.panel.hidden=true;this.buildFloat.mobile=false;this.panel.classList.remove('build-floating','gm-mobile-floating','sky-color-floating','gallery-guide-floating');document.body.classList.remove('panel-open','panel-wing-painter','panel-wing-shop');this.wingGalleryObserver?.disconnect();this.panelName='';this.emit('panel',{open:false});}
  renderPanel(){this.panelSignature=inventoryPanelSignature(this.world?.profile);const profile=this.world?.profile;if(!profile)return;const titles={'sky-color':'星空底色','gallery-guide':'GGTEMPLE · 操作說明',bag:'BAG',shop:'TEMPLE SHOP','shop-prices':'GM · 售價／裝備數值','wing-shop':'SUPPORT',build:'BUILD',social:'WRITE',plant:'MESSAGE PLANT','plant-list':'留言之樹',editor:'GM 編輯器',gm:'GM 控制中心','wing-painter':'翅膀繪圖工作室','wing-personal-painter':'翅膀繪圖工作室','wing-player-preview':'翅膀繪圖工作室 · GM TEST','wing-manage':'GM · 翅膀上架管理',save:'SAVE / MEMORY CODE'};$('panel-title').textContent=titles[this.panelName]||'TEMPLE';
    if(this.panelName==='sky-color'){this.renderSkyColor();return;}
    if(this.panelName==='gallery-guide'){this.content.innerHTML=`<p class="gallery-guide-copy">《GGTEMPLE》 是一座自由的虛擬藝廊。
在這裡您可以點選 BUILD 功能上傳您的作品自由參與展出，
或透過點選PAINT在周邊建築物上塗鴉。
您可以將地圖上其他人的作品盜賣給地圖上的藏家快速賺取金錢
接著在右上的功能欄位點選SHOP 可購買各種商品
如果您還喜歡這個空間可以點選SUPPORT贊助GGdove NT$30，
贊助後您的帳號可獲得一雙能自由塗鴉造型的永久翅膀。
Ａ鍵：攻擊／長按蓄氣／拿起／投擲物品</p>`;this.markGalleryGuideRead();return;}
    if(this.panelName==='gm'){this.renderGm();return;}
     if(['wing-painter','wing-personal-painter','wing-player-preview'].includes(this.panelName)){mountWingPainter(this,{personal:this.panelName==='wing-personal-painter',preview:this.panelName==='wing-player-preview'});return;}
    if(this.panelName==='help'){this.content.innerHTML='<h3>GM 編輯快捷鍵</h3><p>點擊作品選取。<br>Shift + Y：設定／匯出／上傳／新增圓盤<br>Shift + T：縮放（四角等比、中點單軸）<br>Shift + R：三軸旋轉<br>Shift + G：三軸移動<br>Shift + O：圓盤／三角檯座編輯（點選變藍，可修改座標與尺寸、DELETE 刪除、ESC 離開）<br>滑鼠中鍵拖曳：編輯模式下自由旋轉視角<br>跟隨 GM：讓作品隨玩家移動<br>儲存：發布預設位置與尺寸<br>ESC：取消尚未儲存修改</p><h3>GM 指令</h3><p><code>/reset building</code>：復原全部破損房屋（保留塗鴉）<br><code>/clean graffic</code>：永久清除牆面塗鴉<br><code>/reset message</code>：永久清空中央留言與聊天室<br><code>/reset</code>：清空玩家上傳作品<br><code>/recovery</code>：還原藝術品</p>';return;}if(this.panelName==='save')this.renderSave();if(this.panelName==='bag')this.renderBag(profile);if(['shop','shop-prices'].includes(this.panelName))this.renderShop(profile);if(this.panelName==='wing-shop')this.renderWingShop(profile);if(this.panelName==='wing-manage')this.renderWingManage(profile);if(this.panelName==='build')this.renderBuild(profile);if(this.panelName==='social')this.renderSocial(profile);if(this.panelName==='plant')this.renderPlant();if(this.panelName==='plant-list')this.renderPlantList();if(this.panelName==='editor'){this.renderEditor();if(this.self.profile?.admin)this.content.insertAdjacentHTML('beforeend',`<section class="gm-wing-workspace"><h3>GM 觀眾模式測試</h3><p>使用正式觀眾權限及無模型自由鏡頭；測試期間保留 GM 戰鬥席。</p><button type="button" class="panel-button" data-gm-action="spectator-test">${this.self.gmSpectatorPreview?'結束測試／返回 GM':'以觀眾模式遊玩（實際測試）'}</button><hr><h3>GM 翅膀編輯工作區</h3><p>繪製、上架、設定中獎率及下架管理。</p><div class="gm-tools"><button type="button" data-gm-action="wing-painter">畫翅膀／上架</button><button type="button" data-gm-action="wing-player-preview">測試玩家已開通的繪圖介面</button><button type="button" data-gm-action="wing-manage">已上架翅膀／機率／下架</button></div></section><hr><h3>編輯展示圓盤與檯座</h3>
 <div class="gm-tools">
  <button type="button" data-gm-platform-tool="edit">編輯圓盤／三角檯座</button>
  <button type="button" data-gm-platform-tool="place" data-gm-platform-kind="disc">增加圓盤</button>
  <button type="button" data-gm-platform-tool="place" data-gm-platform-kind="pedestal">增加灰色三角檯座</button>
 </div>
 <p>編輯：直接點選場景中的物件使其變藍，再修改位置／半徑／高度，SAVE 儲存或 DELETE 刪除。新增：物件跟隨 GM，按 PLACE / ENTER 固定。</p>
 <h3>作品位置與拾取修復</h3>
 <p>可以直接選取未顯示、無法點擊的作品；修復將清除持有鎖定並移到 GM 前方。</p>
 <div class="gm-artwork-list" style="max-height:240px;overflow:auto">
 ${[...PLATFORMS.map((p,i)=>({id:p.id,title:'Original '+(i+1)})).filter(p=>!(this.world?.removedArtworkIds||[]).includes(p.id)),...(this.world?.customArtworks||[])].map(a=>`<div style="display:flex;gap:4px;align-items:center;justify-content:space-between;padding:3px 0">
  <label class="gm-artwork-check"><input type="checkbox" data-delete-artwork value="${escape(a.id)}"><span style="min-width:0;overflow-wrap:anywhere">${escape(a.title)}</span></label>
  <button type="button" data-gm-artwork-select="${escape(a.id)}">編輯</button>
  <button type="button" data-gm-artwork-repair="${escape(a.id)}">解鎖並移到面前</button>
 </div>`).join('')}
 </div><button type="button" class="panel-button" data-gm-delete-artworks>刪除勾選作品</button><hr><h3>上傳藝術品</h3><form data-form="upload-artwork"><p>PNG／JPEG／WebP、MP4／WebM、GLB／glTF／FBX。模型貼圖與 BIN 檔請一起選取。轉換後上限 32 MB、50 萬三角面、200 個網格；保留圖片透明度，模型會打包成完整 GLB。</p><label>作品名稱<input name="title" type="text" maxlength="100" required placeholder="輸入作品名稱"></label><label>作者姓名<input name="author" type="text" maxlength="100" placeholder="作者姓名"></label><label>名稱底色<input name="labelBackground" type="color" value="#000000" aria-label="上傳作品名稱底色"></label><input name="artwork" type="file" accept="${ART_ACCEPT}" multiple required><button class="panel-button" data-upload-submit>驗證並發布</button><p data-upload-status role="status"></p></form>`);}
  }
  requestGmPresence(){
    if(!this.self?.profile?.admin)return;
    this.gmPresenceError='';this.gmPresenceLoading=true;
    if(this.panelName==='gm')this.renderGm();
    this.emit('gm-presence-request');
  }
  setGmPresence(data){
    if(!this.self?.profile?.admin)return;
    this.gmPresenceData={online:Array.isArray(data?.online)?data.online:[],events:Array.isArray(data?.events)?data.events:[],knownPlayers:Array.isArray(data?.knownPlayers)?data.knownPlayers:[]};
    this.gmPresenceLoading=false;this.gmPresenceError='';
    if(this.panelName==='gm')this.renderGm();
  }
  setGmPresenceError(message){
    this.gmPresenceLoading=false;this.gmPresenceError=String(message||'無法讀取上下線紀錄');
    if(this.panelName==='gm')this.renderGm();
  }
  gmPlayerTargets(){
   const own={key:this.self.key,name:this.self.name,level:this.world?.profile?.level||this.self.profile?.level||1,online:true};
   const known=(this.gmPresenceData?.knownPlayers||[]).filter(p=>p.key&&p.key!==own.key).map(p=>({...p,online:false}));
   const online=(this.players||[]).filter(p=>p.key&&p.key!==own.key).map(p=>({key:p.key,name:p.name,level:p.profile?.level||1,online:true}));
   const merged=[...new Map([...known,...online].map(p=>[p.key,p])).values()];
   merged.sort((a,b)=>Number(b.online)-Number(a.online)||String(a.name).localeCompare(String(b.name)));
   return [own,...merged];
  }
  refreshGmPlayerTargets(){
   const select=this.content.querySelector('[data-gm-player]');if(!select)return;
   const targets=this.gmPlayerTargets(),signature=JSON.stringify(targets);
   if(select.dataset.rosterSignature===signature)return;
   const previous=select.value;
   select.innerHTML=targets.map(p=>`<option value="${escape(p.key)}">${p.key===this.self.key?'自己 · ':''}${escape(p.name)} · LV ${p.level} · ${p.online?'在線':p.persistent===false?'離線訪客（無法領取）':'離線'}</option>`).join('');
   select.value=targets.some(p=>p.key===previous)?previous:this.self.key;
   select.dataset.rosterSignature=signature;
   if(select.value!==previous){const field=this.content.querySelector('[data-gm-level]');if(field)field.value=targets.find(p=>p.key===select.value)?.level||1;}
  }
  setGmPlayerActionState(pending,message=''){
   this.gmPlayerActionPending=pending;this.gmPlayerActionMessage=message;
   const card=this.content.querySelector('.gm-player-controls');if(!card)return;
   for(const button of card.querySelectorAll('button'))button.disabled=pending;
   const status=card.querySelector('[data-gm-player-status]');if(status)status.textContent=message;
  }
  renderGm(){
    if(!this.self?.profile?.admin){this.content.textContent='GM only';return;}
    const data=this.gmPresenceData,online=data?.online||this.players||[],events=data?.events||[];
    const date=time=>{const ms=Number(time);return Number.isFinite(ms)?new Date(ms).toLocaleString('zh-TW',{hour12:false}):'—';};
    const volumes=this.world?.audioSettings||{};
    const slider=(key,label)=>{const value=Math.max(0,Math.min(2,Number(volumes[key]??1)));return `<label style="display:grid;grid-template-columns:minmax(90px,1fr) minmax(80px,2fr) 3em;align-items:center;gap:10px;padding:3px 0"><span>${escape(label)}</span><input data-gm-volume="${escape(key)}" type="range" min="0" max="2" step=".05" value="${value}" aria-label="${escape(label)}"><output>${Math.round(value*100)}%</output></label>`;};
    const soundControls=['master','music',...Object.keys(SOUND_PROFILES)].map(key=>slider(key,key==='master'?'總音量':key==='music'?'背景音樂':key)).join('');
    const weaponControls=ITEMS.filter(item=>item.slot==='weapon').map(item=>slider('weapon-'+item.id,item.name||item.id)).join('');
    const selectedTarget=this.content.querySelector('[data-gm-player]')?.value||this.self.key,selectedLevel=this.content.querySelector('[data-gm-level]')?.value,selfLevel=this.content.querySelector('[data-gm-self-level]')?.value;
    const targets=this.gmPlayerTargets(),target=targets.find(p=>p.key===selectedTarget)||targets[0],disabled=this.gmPlayerActionPending?'disabled':'';
    this.content.innerHTML=`<section class="gm-admin">
      <section class="gm-player-controls" aria-label="GM 玩家測試與贈送">
       <h3>GM 玩家測試與贈送</h3>
       <label for="gm-self-level">自身等級 · LV ${targets[0].level}</label>
       <div class="gm-player-row"><input id="gm-self-level" data-gm-self-level type="number" inputmode="numeric" min="1" max="999" step="1" value="${escape(selfLevel??targets[0].level)}"><button type="button" data-gm-action="self-level" ${disabled}>調整自身等級</button></div>
       <label for="gm-target-player">指定玩家</label>
       <select id="gm-target-player" data-gm-player>${targets.map(p=>`<option value="${escape(p.key)}" ${p.key===target.key?'selected':''}>${p.key===this.self.key?'自己 · ':''}${escape(p.name)} · LV ${p.level} · ${p.online?'在線':p.persistent===false?'離線訪客（無法領取）':'離線'}</option>`).join('')}</select>
       <div class="gm-player-row"><input data-gm-level aria-label="指定玩家等級" type="number" inputmode="numeric" min="1" max="999" step="1" value="${escape(target.key===selectedTarget?(selectedLevel??target.level):target.level)}"><button type="button" data-gm-action="player-level" ${disabled}>調整玩家等級</button></div>
       <button class="gm-canvas-gift" type="button" data-gm-action="player-canvas" ${disabled}>贈送翅膀畫布 ×1</button>
       <small data-gm-player-status role="status">${escape(this.gmPlayerActionMessage||'可贈送曾登入的玩家（包含離線）。')}</small>
      </section>
      <h3>GM 功能</h3><div class="gm-tools">
        <button type="button" data-gm-action="editor">作品與圓盤編輯</button><button type="button" data-open-sky-color>星空環境底色</button><button type="button" data-gm-action="chat-position-edit">調整全服 CHAT 預設位置</button><button type="button" data-gm-action="chat-position-save">儲存目前 CHAT 位置為全服預設</button><button type="button" data-open-shop-prices>商品售價／裝備數值編輯</button>
         <button type="button" data-gm-action="spectator-test">${this.self.gmSpectatorPreview?'結束測試／返回 GM':'以觀眾模式遊玩（實際測試）'}</button>
        <button type="button" data-gm-action="help" aria-label="GM instructions and shortcuts">！ GM 說明與快捷鍵</button>
        <button type="button" data-gm-action="wing-painter">畫翅膀／上架翅膀</button><button type="button" data-gm-action="wing-player-preview">測試玩家已開通的繪圖介面</button>
        <button type="button" data-gm-action="wing-manage">翅膀上架管理／刪除／中獎率</button>

        <button type="button" data-gm-action="reset-buildings">/reset building · 復原所有房屋（保留塗鴉）</button>
         <button type="button" data-gm-action="clean-graffiti">/clean graffic · 永久清除牆面塗鴉</button>
        <button type="button" data-gm-action="reset-messages">/reset message · 清空留言</button>
        <button type="button" data-gm-action="refresh">${this.gmPresenceLoading?'讀取中…':'重新整理紀錄'}</button>
      </div>

      <p><strong>GM 指令：</strong><code>/recoverposition</code> 找回座標 -100 的作品 · <code>/reset building</code> 復原房屋（保留塗鴉） · <code>/clean graffic</code> 清除塗鴉 · <code>/reset message</code> 清空留言 · <code>/reset</code> 清空玩家作品 · <code>/recovery</code> 還原藝術品</p>
      <h3>GM 個人設定</h3>
       <label style="display:flex;gap:10px;align-items:center"><input data-gm-invincible type="checkbox" ${this.world?.profile?.gmInvincible!==false?'checked':''}>自身無敵（可關閉以接受正常傷害）</label>
       <label style="display:grid;grid-template-columns:7em 1fr 4em;align-items:center;gap:8px">合成成功率
         <input data-gm-fusion-chance type="range" min="0" max="100" step="1" value="${Math.round((this.world?.profile?.gmFusionChance??1)*100)}">
         <output>${Math.round((this.world?.profile?.gmFusionChance??1)*100)}%</output>
       </label><small>僅影響 GM 自己的合成；其他玩家每次嘗試 50% / 25% / 12.5% 依次減半。失敗消耗素材。</small>
       <h3>GM 背景音樂（MP3）</h3><p>上傳後取代所有玩家的背景音樂，循環播放。支援最大 7.5 MB。</p><label>選擇背景 MP3<input data-gm-music-file type="file" accept=".mp3,audio/mpeg"></label><small>${this.world?.musicVersion?'已上傳 · '+escape(new Date(this.world.musicVersion).toLocaleString('zh-TW')):'尚未上傳專用背景音樂，使用預設曲目'}</small><h3>全服音效控制（GM）</h3><p>調整後放開滑桿即同步所有玩家。100% 為預設值。</p>
      <details><summary>音效類型與背景音樂</summary>${soundControls}</details>
      <details><summary>每把武器的獨立音量</summary>${weaponControls}</details>
      <h3>目前在線（${online.length}）</h3>
      <div class="gm-presence-live">${online.map(p=>`<span>${escape(p.name)} · ${p.role==='fighter'?'玩家':'觀眾'}</span>`).join('')||'<small>目前沒有在線玩家</small>'}</div>
      <h3>玩家上下線紀錄</h3>
      <p>以伺服器時間記錄登入及離線，顯示最近 200 筆；斷線重連的 45 秒寬限期不視為離線。</p>
      ${this.gmPresenceError?`<p role="alert">${escape(this.gmPresenceError)}</p>`:''}
      <div class="gm-presence-list" role="log">${events.map(e=>`<div class="gm-presence-row"><strong>${escape(e.name)} · ${e.event==='online'?'上線':'下線'} · ${e.role==='fighter'?'玩家':'觀眾'}</strong><time>${escape(date(e.time))}</time></div>`).join('')||(this.gmPresenceLoading?'<p>正在取得紀錄…</p>':'<p>目前沒有可顯示的上下線紀錄。</p>')}</div>
    </section>`;
  }
  renderSave(){
    if(this.authMode==='firebase'){
      this.content.innerHTML='<h3>帳號進度自動儲存</h3><p>使用 Firebase Google 登入時，裝備、翅膀、等級、背包與遊戲進度都儲存在伺服器。下次使用相同帳號登入即可恢復，無需 Memory Code。</p>';
      return;
    }
    const code=this.saveCode||this.self?.saveCode||'';this.content.innerHTML=`<h3>MEMORY CODE</h3><p>將目前的等級、裝備、背包與遊戲進度儲存至伺服器。重新進入遊戲時，在 Memorycode 欄位輸入代碼恢復。</p><label for="save-code-output">存檔代碼<input id="save-code-output" readonly autocomplete="off" spellcheck="false" class="panel-input" value="${escape(code)}" placeholder="尚未產生代碼"></label><button type="button" class="panel-button" data-save-code>產生／重新取得代碼</button><button type="button" class="panel-button" data-copy-save-code ${code?'':'disabled'}>複製存檔代碼</button><p>請妥善保管代碼。擁有代碼的人可能存取你的存檔。</p>`;}
  showSaveCode(code){this.saveCode=String(code||'');this.openPanel('save');this.content.querySelector('#save-code-output')?.select();}
  renderBag(profile){renderOriginalBag(this,profile);}
  renderShop(profile){
    this.shopPriceSignature=JSON.stringify([this.world?.shopPrices||{},this.world?.equipmentTuning||{}]);
    const editing=this.panelName==='shop-prices'&&!!(profile.admin||this.self?.profile?.admin),prices=this.world?.shopPrices||{};
    const tab=['owned','armor'].includes(this.shopTab)?'head':this.shopTab||'head',weaponTabs=['near','mid','far','mystery'],weaponActive=weaponTabs.includes(tab),tabs={
     weapons:'Weapons',
     near:'Near',mid:'Mid',far:'Far',mystery:'Mystery Weapons',
     comfort:'Comfort for the Soul',shield:'Shields',head:'Headwear',
     outfit:'Outfits',wings:'Wings'};
    // One card per family: the shop has five qualities, not five separate
    // native weapon IDs each with a second set of grades.
    const groups=editing?shopWeaponGroups([...new Map([...SHOP_ITEMS,...ITEMS.filter(i=>['weapon','head','outfit','shield','wings','consumable'].includes(i.slot)),...(this.world?.customWings||[])].filter(i=>!i.retired).map(i=>[i.id,i])).values()]):shopWeaponGroups(SHOP_ITEMS);
    const ownedIndicesFor=variant=>(profile.inventory||[]).flatMap((id,index)=>{
     if(id!==variant.id)return [];
     if(!variant.shopTier)return [index];
     const row=profile.inventoryInstances?.[index],base=itemById(id);
     const tier=profile.fusionByInstance?.[row?.uid]?.shopTier??row?.shopTier??
       (base?.exotic?Math.min(5,base.tier):base?.tier);
     return Number(tier)===variant.shopTier?[index]:[];
    });
    const visible=groups.filter(group=>{
     const base=group.base;
     if(tab==='mystery')return base.mysteryWeapon;
     if(['near','mid','far'].includes(tab))return base.slot==='weapon'&&!base.mysteryWeapon&&weaponRangeClass(base)===tab;
     return base.slot===tab||(tab==='comfort'&&base.slot==='consumable');
    });
    this.shopVariantChoice??={};this.shopQuantities??={};
    const scroll=this.content.querySelector('.shop-grid')?.scrollTop||0;
    const chosen=visible.find(g=>g.key===this.shopSelectedKey);
    const cards=(chosen?[chosen]:[]).map(group=>{
     const {key,variants}=group;
     const selected=variants.find(v=>String(v.shopTier??v.id)===this.shopVariantChoice[key])||
       variants.find(v=>v.shopTier===3)||variants[0];
     const ownedIndices=ownedIndicesFor(selected),ownedCount=ownedIndices.length;
     const equippedUid=profile.equippedInstanceIds?.[selected.slot];
     const equippedInstance=profile.inventoryInstances?.find(row=>row.uid===equippedUid);
     const equippedTier=profile.fusionByInstance?.[equippedUid]?.shopTier??equippedInstance?.shopTier??
       itemById(selected.id)?.tier;
     const selectedEquipped=profile.equipment?.[selected.slot]===selected.id&&
       (!selected.shopTier||Number(equippedTier)===selected.shopTier);
     const quantity=this.shopQuantities[key]??1;
     const valid=Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=99;
     const price=shopPrice(selected,prices),total=valid?price*quantity:0;
     const affordable=profile.admin||this.self?.profile?.admin||Number(profile.wallet)>=total;
     const room=(profile.inventory?.length||0)+quantity<=inventoryCapacity(this.self?.profile?.admin?{...profile,admin:true}:profile);
     const outfitCollection=shopOutfitCollection(selected);
     const familyName=outfitCollection||(selected.slot==='weapon'&&!selected.exotic?
       selected.name.replace(/^(?:Seed|Dawn|Radiant|Celestial|Eternal)\s+/,''):group.base.name);
     const selection=variants.length>1?`<label class="shop-quality-picker">${outfitCollection?'OUTFIT VARIANT / PRICE':'WEAPON QUALITY / PRICE'}
       <select data-shop-variant="${escape(key)}" aria-label="Choose variant for ${escape(familyName)}">
       ${variants.map(v=>{
        const grade=v.slot==='weapon'&&v.shopTier?SHOP_WEAPON_GRADES[v.shopTier-1]:null;
        const value=String(v.shopTier??v.id),current=String(selected.shopTier??selected.id);
        return `<option value="${escape(value)}" ${value===current?'selected':''}>${escape(grade?.label||v.name)} · ${escape((grade?.rarity||v.rarity||'common').toUpperCase())} — ${shopPrice(v,prices).toLocaleString('en-US')} Coins</option>`;
       }).join('')}
       </select></label>`:'';
     const actions=`<div class="shop-purchase"><div class="shop-unit-price">UNIT PRICE · ${price.toLocaleString('en-US')} COINS</div>
       <label class="shop-quantity-label">QUANTITY
         <input type="number" min="1" max="99" step="1" inputmode="numeric"
          data-shop-quantity="${escape(key)}" value="${escape(quantity)}" aria-label="Purchase quantity for ${escape(familyName)}">
       </label>
       <output data-buy-total>${!valid?'QUANTITY 1–99':!room?'BAG FULL · '+inventoryCapacity(profile)+' MAX':'TOTAL · '+total.toLocaleString('en-US')+' COINS'}</output>
       <button type="button" data-buy="${escape(selected.id)}" ${selected.shopTier?`data-shop-tier="${selected.shopTier}"`:''} ${!valid||!affordable||!room?'disabled':''}>${!room&&valid?'BAG FULL':!affordable&&valid?'NOT ENOUGH COINS':`BUY ×${valid?quantity:1} · ${total.toLocaleString('en-US')} COINS`}</button>
     </div>`;
     const canPrice=SHOP_ITEMS.some(i=>i.id===selected.id),tuning=equipmentTuning(this.world,selected),fields=tuningFields(selected,this.world),gradeAttr=selected.shopTier?`data-shop-tier="${selected.shopTier}"`:'';
     const edit=editing?(canPrice?`<section class="shop-price-editor"><label>UNIT PRICE (COINS)<input type="number" inputmode="numeric" min="1" max="100000000" step="1" data-gm-price-input value="${price}"></label><div class="shop-price-actions"><button type="button" data-gm-price-save="${escape(selected.id)}" ${selected.shopTier?`data-shop-tier="${selected.shopTier}"`:''}>SAVE PRICE</button><button type="button" data-gm-price-reset="${escape(selected.id)}" ${selected.shopTier?`data-shop-tier="${selected.shopTier}"`:''}>RESET DEFAULT</button></div><small>Applies to this exact quality / style for every player.</small></section>`:'')+`<section class="gm-equipment-tuning"><h3>裝備數值測試</h3><small>修改任一品質後按套用，同系列品質按目前比例同步調整。售價仍獨立。魔力為大絕首次消耗。</small><div class="gm-tuning-grid">${fields.map(f=>`<label>${escape(f.label)}<input type="number" inputmode="decimal" data-gm-tuning-field="${f.key}" data-current-value="${tuning[f.key]??f.value}" min="${f.min}" max="${f.max}" step="${f.step===1?1:'any'}" value="${tuning[f.key]??f.value}"></label>`).join('')}</div><div class="shop-price-actions"><button type="button" data-gm-tuning-save="${escape(selected.id)}" ${gradeAttr}>套用數值</button><button type="button" data-gm-tuning-reset="${escape(selected.id)}" ${gradeAttr}>恢復預設</button></div></section>`:'';
     return itemCard({...tunedEquipment(this.world,selected),name:selected.name,manaQuote:weaponManaQuote(this.world,selected),gmDamageRatio:tuningDamageRatio(this.world,selected,false)},selection+(editing?edit:actions));
    });
    this.content.innerHTML=`<div class="armory-balance"><span>Equipment · ${(profile.inventory?.length||0).toLocaleString('en-US')}/${inventoryCapacity(profile).toLocaleString('en-US')} BAG</span><b>${profile.admin?'∞':profile.wallet} coins</b></div>
     <div data-inventory-error role="alert" ${this.inventoryActionError?'':'hidden'} style="color:#9c2740;font-size:12px;overflow-wrap:anywhere">${escape(this.inventoryActionError||'')}</div><nav class="shop-tabs">${[['head','outfit','wings'],['weapons','shield','comfort'],...(weaponActive?[weaponTabs]:[])].map(row=>`<div class="shop-tab-row">${row.map(id=>`<button data-shop-tab="${id}" aria-pressed="${tab===id||(id==='weapons'&&weaponActive)}">${tabs[id]}</button>`).join('')}</div>`).join('')}</nav>
     <div class="shop-layout ${chosen?'has-selection':''}"><div class="shop-grid" role="group" aria-label="Shop items">${visible.map(g=>{
      const item=g.variants.find(v=>String(v.shopTier??v.id)===this.shopVariantChoice[g.key])||g.variants.find(v=>v.shopTier===3)||g.base;
      const label=shopOutfitCollection(item)||g.base.name;
      const color=RARITIES.find(v=>v.id===item.rarity)?.color||'#eadcf4';
      return `<button type="button" class="bag-cell shop-cell ${g===chosen?'selected':''}" data-shop-select="${escape(g.key)}" data-rarity="${escape(item.rarity)}" style="--rarity:${color}" aria-pressed="${g===chosen}" title="${escape(label)}">${previewMarkup(item)}<span class="shop-cell-name">${escape(label)}</span></button>`;
     }).join('')||'<p>There are no items in this category.</p>'}</div>
     <div class="shop-detail">${chosen?'<button type="button" class="shop-close-detail" data-close-shop-detail>BACK TO ITEMS</button>':''}${cards.join('')||'<p>Select an item to inspect its stats, quality and price.</p>'}</div></div>`;
    this.content.querySelector('.shop-grid').scrollTop=scroll;
    if(this.shopPurchasePending)this.setShopPurchasePending(true);
    void hydrateItemPreviews(this.content);
  }

  // SUPPORT sells authoring entitlements, not chance-based capsules.
  // The merchant/checkout status is provided by the authenticated Worker.
  renderWingShop(profile){
   const credits=Math.max(0,Number(profile.wingDesignCredits)||0);
   const status=this.wingPaymentStatus;
   const ready=status?.checkoutEnabled===true;
   const stage=status?.checkoutMode==='stage-only',busy=!!this.wingCheckoutBusy;
   const amount=Number.isInteger(status?.amount)&&status.amount>0?status.amount:30;
   const flexible=status?.flexibleAmount===true,maxQuantity=flexible?(status.maxQuantity||100):1,maxAmount=flexible?(status.maxAmount||20000):amount;
   const draft=this.wingSupportDraft??={quantity:1,extra:''};
   const quantity=Math.min(maxQuantity,Math.max(1,Number(draft.quantity)||1));
   this.content.innerHTML=`<section class="wing-shop-panel wing-support-app wing-design-support" aria-label="Support GGTEMPLE">
    <div class="y2k-shell-header"><strong>▣ &nbsp; GGTEMPLE — SUPPORT.EXE</strong>${stage?'<small>TEST MODE</small>':''}</div>
    <div class="wing-support-controls">
     <header class="wing-shop-hero">
      <svg aria-hidden="true" width="64" height="48" viewBox="0 0 64 48"><path d="M31 36C11 35 4 20 4 7c12 1 22 9 27 24m2 5C53 35 60 20 60 7c-12 1-22 9-27 24" fill="#e6dcff" stroke="#574279" stroke-width="2"/><path d="M12 19c9 2 15 7 19 16m21-16c-9 2-15 7-19 16M32 3v12m-6-6h12" fill="none" stroke="#8c6ab3" stroke-width="2"/></svg>
      <div><h3>Make your own wings.</h3><p>Support GGTEMPLE and unlock your own wing canvases.</p></div>
     </header>
     <section class="wing-payment-preview">
      <div class="wing-order-line"><span>Wing canvas · NT$${amount} each</span><strong><label>Qty <select data-wing-order-quantity aria-label="Number of wing canvases" ${!flexible||busy?'disabled':''}>${Array.from({length:maxQuantity},(_,i)=>`<option value="${i+1}" ${quantity===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label></strong></div>
      <div class="wing-order-line"><label for="wing-extra-support">Custom total (optional)</label><input id="wing-extra-support" data-wing-order-amount type="number" inputmode="numeric" min="${quantity*amount}" max="${maxAmount}" step="1" placeholder="NT$${quantity*amount}" value="${escape(draft.extra)}" ${!flexible||busy?'disabled':''} style="width:8em;max-width:45%;min-height:32px"></div>
      <small>Each canvas costs NT$30. Any amount above your selected canvas cost is additional support.</small>
      <div class="wing-order-line"><span data-wing-order-summary>${quantity} × Wing canvas</span><strong data-wing-order-total>NT$${quantity*amount}</strong></div>
      <button type="button" class="panel-button wing-support-pay" data-wing-checkout ${ready&&!busy?'':'disabled'}>${busy?'Opening checkout…':ready?stage?'Open test checkout':'Continue to ECPay ↗':status?'Checkout unavailable':'Checking availability…'}</button>
      <small class="wing-payment-hint" role="status">${busy?'Preparing your order.':ready?stage?'Test mode · no real charge.':'Payment takes place on ECPay.':status?'Online checkout is not available right now.':'Checking payment status.'}</small>
      ${credits>0?`<button type="button" class="panel-button wing-gift-action" data-open-gift>Open your canvas (${credits})</button>`:''}
     </section>
    </div>
    <footer class="y2k-taskbar"><span>WING STUDIO</span><span>One-time purchase</span></footer>
   </section>`;
   const qty=this.content.querySelector('[data-wing-order-quantity]'),custom=this.content.querySelector('[data-wing-order-amount]'),pay=this.content.querySelector('[data-wing-checkout]');
   const refresh=()=>{
    const n=Number(qty.value),min=n*amount;
    custom.min=String(min);custom.placeholder='NT$'+min;
    const total=custom.value===''?min:Number(custom.value);
    const valid=Number.isSafeInteger(n)&&n>=1&&n<=maxQuantity&&Number.isSafeInteger(total)&&total>=min&&total<=maxAmount&&!custom.validity.badInput;
    draft.quantity=n;draft.extra=custom.value;
    this.content.querySelector('[data-wing-order-summary]').textContent=n+' × Wing canvas';
    this.content.querySelector('[data-wing-order-total]').textContent=valid?'NT$'+total.toLocaleString('en-US'):'Invalid amount';
    custom.setCustomValidity(valid?'':'Enter a whole amount from NT$'+min+' to NT$'+maxAmount+'.');
    pay.disabled=!ready||busy||!valid;this.wingSupportSelection=valid?{quantity:n,amount:total}:null;
   };
   qty.addEventListener('change',()=>{if(custom.value!==''&&Number(custom.value)<Number(qty.value)*amount)custom.value='';refresh();});
   custom.addEventListener('input',refresh);refresh();
  }
  setWingPaymentStatus(value){
   this.wingPaymentStatus=value;
   if(this.panelName==='wing-shop')this.renderWingShop(this.world?.profile||{});
  }
  hydrateWingGalleryImages(){
   this.wingGalleryObserver?.disconnect();
   const images=[...this.content.querySelectorAll('img[data-wing-icon]')];
   const load=img=>{
    if(!img.isConnected||!img.dataset.wingIcon)return;
    const id=img.dataset.wingIcon;
    const item=itemById(id)||SWALLOWTAIL_WINGS.find(wing=>wing.id===id)||(this.world?.customWings||[]).find(wing=>wing.id===id);
    if(!item)return;
    delete img.dataset.wingIcon;
    try{
     const url=wingIcon(item);
     if(!url||!url.startsWith('data:image/'))throw Error('Empty wing artwork');
     img.onerror=()=>{
      img.onerror=null;
      const fallback=document.createElement('canvas');fallback.width=256;fallback.height=180;
      const ctx=fallback.getContext('2d');ctx.fillStyle=item.color||'#cacadd';ctx.fillRect(18,30,220,120);
      ctx.fillStyle='#262638';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
      ctx.fillText('WING ART PREVIEW',128,96);img.src=fallback.toDataURL('image/png');
     };
     img.src=url;
    }catch(error){console.error('Wing preview failed',id,error);img.alt=item.name+' (preview unavailable)';}
   };
   images.slice(0,16).forEach(load);
   if(typeof IntersectionObserver!=='undefined'){
    const observer=new IntersectionObserver(entries=>{
     for(const entry of entries)if(entry.isIntersecting){
      observer.unobserve(entry.target);load(entry.target);
     }
    },{root:null,rootMargin:'700px'});
    this.wingGalleryObserver=observer;
    images.slice(16).forEach(img=>observer.observe(img));
   }else images.slice(16).forEach(load);
  }
  renderWingManage(profile){
   if(!profile?.admin){this.content.textContent='GM only';return;}
   this.wingGalleryObserver?.disconnect();
   const all=this.world?.customWings||[];
   const active=all.filter(wing=>wing.retired!==true);
   const retired=all.filter(wing=>wing.retired===true);
   const total=active.reduce((n,wing)=>n+Number(wing.drawRatePct??1),0);
   this.content.innerHTML=`<section class="wing-manage-app">
    <div class="wing-manage-header"><strong>▣ WING MANAGER.EXE</strong><p>管理 GM 自製翅膀。中獎率為每次抽獎的絕對百分比；所有自訂翅膀合計不超過 100%。</p>
     <p>上架數量：${active.length}/24 · 自訂機率合計：${total.toFixed(3)}% · 基本圖鑑剩餘機率：${Math.max(0,100-total).toFixed(3)}%</p>
     <div class="wing-support-gm-tools"><button class="panel-button" type="button" data-open-wing-painter>新增翅膀</button><button class="panel-button" type="button" data-open-wing-shop>返回 SUPPORT 抽獎機</button></div></div>
    <div class="wing-manage-list">${active.map(item=>`
     <article class="wing-manage-row" data-managed-wing="${escape(item.id)}">
      <img alt="${escape(item.name)}" data-wing-icon="${escape(item.id)}" loading="lazy">
      <div class="wing-manage-meta"><strong>${escape(item.name)}</strong><small>${escape(WING_QUALITY_NAMES[wingRarity(item)])} · ${escape(item.id)}</small></div>
      <label>中獎率 % <input data-wing-rate type="number" min="0" max="100" step=".001" value="${Number(item.drawRatePct??1)}" aria-label="${escape(item.name)} 中獎率"></label>
      <button class="panel-button" type="button" data-wing-rate-save="${escape(item.id)}">儲存機率</button>
       <button class="panel-button" type="button" data-wing-edit="${escape(item.id)}">編輯後重新上架</button>
      <button class="panel-button wing-remove-button" type="button" data-wing-remove="${escape(item.id)}">刪除上架</button>
     </article>`).join('')||'<p>目前沒有上架的 GM 自製翅膀。</p>'}</div>
    ${retired.length?`<details class="wing-manage-retired"><summary>已下架翅膀（${retired.length}）</summary>
      <p>已下架翅膀不會再被抽到；過去已取得的玩家仍可使用。</p>
      ${retired.map(item=>`<div>${escape(item.name)} · 已下架</div>`).join('')}
     </details>`:''}
   </section>`;
   this.hydrateWingGalleryImages();
  }
  beginWingDraw(){
   if(this.gachaOverlay)return false;
   this.content.querySelector('.wing-gacha-machine')?.classList.add('is-spinning');
   const overlay=document.createElement('div');
   overlay.className='wing-gacha-overlay';
   overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
   overlay.innerHTML='<div class="gacha-animation"><div class="gacha-win98-bar">▣ CAPSULE.EXE <span>▁ □ ×</span></div><div class="gacha-spinner">↻</div><div class="gacha-pop-capsule">?</div><strong>DRAW IN PROGRESS...</strong><small>SERVER CHECK · PLEASE DO NOT CLOSE</small></div>';
   document.body.append(overlay);this.gachaOverlay=overlay;this.gachaStartedAt=performance.now();return true;
  }
  cancelWingDraw(){
   this.content.querySelector('.wing-gacha-machine')?.classList.remove('is-spinning');
   this.gachaOverlay?.remove();this.gachaOverlay=null;
  }
  showWingDraw(drawn){
   if(!drawn?.itemId)return;
   this.lastWingDraw=drawn;
   const item=itemById(drawn.itemId),epic=drawn.quality==='epic';
   if(!this.gachaOverlay)this.beginWingDraw();
   const overlay=this.gachaOverlay;
   const after=Math.max(0,1750-(performance.now()-(this.gachaStartedAt||0)));
   setTimeout(()=>{
    if(this.gachaOverlay!==overlay)return;
    const confetti=epic?Array.from({length:70},(_,i)=>`<i class="wing-confetti" style="--i:${i};--h:${(i*47)%360}deg;--x:${(i*73)%100}vw;--d:${(i%11)*.035}s"></i>`).join(''):'';
    const poppers=epic?'<span class="wing-party-popper wing-party-left"></span><span class="wing-party-popper wing-party-right"></span>':'';
    overlay.classList.toggle('wing-epic-win',epic);
    overlay.innerHTML=`<div class="gacha-animation gacha-result">${confetti}${poppers}
     <h3>${epic?'恭喜！PURPLE · EPIC！':'恭喜抽中翅膀'}</h3>
     <div class="gacha-result-image">${item?`<img src="${wingIcon(item)}" alt="${escape(item.name)}">`:''}</div>
     <strong>${escape(item?.name||drawn.itemId)}</strong>
     <small>${escape(WING_QUALITY_NAMES[drawn.quality]||drawn.quality)} · 已加入背包${Number.isFinite(drawn.drawsLeft)?' · 免費次數剩餘 '+drawn.drawsLeft:''}</small>
     <button type="button" class="panel-button" data-gacha-close>確定</button>
    </div>`;
    overlay.querySelector('[data-gacha-close]').onclick=()=>{
      this.cancelWingDraw();if(this.panelName==='wing-shop')this.renderPanel();
    };
    setTimeout(()=>{if(this.gachaOverlay===overlay){this.cancelWingDraw();if(this.panelName==='wing-shop')this.renderPanel();}},11000);
   },after);
  }
  renderBuild(profile){const ownBombs=(this.world?.customArtworks||[]).filter(a=>a.owner===this.self?.key);
    const list=`<div class="build-art-list">${ownBombs.map(a=>`<button class="build-art-row" data-own-artwork="${escape(a.id)}"><span><b>${escape(a.title)}</b><small>${escape(a.author||'')}</small></span><span>EDIT</span></button>`).join('')||'<small>No uploaded artworks.</small>'}</div>`;
    const upload=`<form data-form="art-bomb-upload"><label>作品名稱<input type="text" name="title" maxlength="100" required placeholder="作品名稱"></label><label>作者姓名<input type="text" name="author" maxlength="100" placeholder="作者姓名"></label><label class="build-inline">名稱底色<input type="color" name="labelBackground" value="#000000"></label><label>YOUR ARTWORK<input type="file" name="artwork" accept="${ART_ACCEPT}" multiple required></label><label>Initial size<input type="range" name="size" min="1" max="3" step=".1" value="1"></label><button class="panel-button" type="submit">UPLOAD → PLACE</button><small>8 MB · 4 placed works</small></form>`;
    const removable=(this.world?.structures||[]).filter(s=>s.owner===this.self?.key||profile.admin);
    const structures=`<label>IMAGE SKIN<input data-build-skin type="file" accept="image/png,image/jpeg,image/webp"></label><div class="build-structure-grid">${Object.entries(ECONOMY.buildCosts).map(([kind,cost])=>`<button data-build="${kind}" type="button"><b>${kind.toUpperCase()}</b><small>${cost} coins</small></button>`).join('')}</div><small>R ROTATE · E PLACE · ESC CANCEL</small><button class="panel-button" data-destroy-near>ATTACK NEAREST STRUCTURE</button>${removable.map(s=>`<div class="structure-entry"><span>${escape(s.kind)} · ${Math.ceil(s.hp)} HP</span><button data-remove-structure="${escape(s.id)}">REMOVE</button></div>`).join('')}`;
    this.content.innerHTML=`<nav class="build-tabs" aria-label="BUILD functions"><button data-build-tab="upload">UPLOAD</button><button data-build-tab="structures">BUILD</button><button data-build-tab="manage">MY ART (${ownBombs.length})</button></nav><section data-build-page="upload">${upload}</section><section data-build-page="structures">${structures}</section><section data-build-page="manage">${list}</section>`;
    this.applyBuildTab();
  }
  applyBuildTab(){for(const b of this.content.querySelectorAll('[data-build-tab]'))b.setAttribute('aria-pressed',String(b.dataset.buildTab===this.buildTab));for(const page of this.content.querySelectorAll('[data-build-page]'))page.hidden=page.dataset.buildPage!==this.buildTab;}
  renderSkyColor(){
   this.skyDraft=this.world?.environment?.skyBaseColor||'#101b36';
   this.content.innerHTML=`<div class="sky-color-tools"><input type="color" data-sky-color value="${escape(this.skyDraft)}" aria-label="星空底色"><div class="sky-swatches">${['#101b36','#260f39','#390d26','#06322e','#101010','#422107'].map(color=>`<button type="button" data-sky-swatch="${color}" style="background:${color}" aria-label="${color}"></button>`).join('')}</div><label>色相<input data-sky-hue type="range" min="0" max="359" value="220"></label><label>飽和度<input data-sky-sat type="range" min="0" max="100" value="54"></label><label>明度<input data-sky-light type="range" min="0" max="100" value="14"></label><div class="sky-color-actions"><button type="button" data-sky-save>儲存</button><button type="button" data-sky-back>返回 GM</button></div></div>`;
   const picker=this.content.querySelector('[data-sky-color]'),h=this.content.querySelector('[data-sky-hue]'),s=this.content.querySelector('[data-sky-sat]'),l=this.content.querySelector('[data-sky-light]');
   const preview=color=>{this.skyDraft=color;picker.value=color;this.emit('sky-color-preview',{color});};
   const syncSliders=color=>{const [r,g,b]=color.slice(1).match(/../g).map(x=>parseInt(x,16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,light=(max+min)/2;let hue=0;if(d)hue=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;h.value=Math.round(hue*60)%360;s.value=d?Math.round(100*d/(1-Math.abs(2*light-1))):0;l.value=Math.round(light*100);};
   const fromSliders=()=>{const hue=Number(h.value)/60,light=Number(l.value)/100,c=(1-Math.abs(2*light-1))*Number(s.value)/100,x=c*(1-Math.abs(hue%2-1)),m=light-c/2,channels=hue<1?[c,x,0]:hue<2?[x,c,0]:hue<3?[0,c,x]:hue<4?[0,x,c]:hue<5?[x,0,c]:[c,0,x];preview('#'+channels.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join(''));};
   syncSliders(this.skyDraft);for(const range of [h,s,l])range.addEventListener('input',fromSliders);picker.addEventListener('input',()=>{syncSliders(picker.value);preview(picker.value);});for(const b of this.content.querySelectorAll('[data-sky-swatch]'))b.onclick=()=>{syncSliders(b.dataset.skySwatch);preview(b.dataset.skySwatch);};
  }
  renderSocial(profile){this.content.innerHTML=`<h3>WRITE / PLANT</h3>${this.self?.role==='spectator'?'<p>觀眾直接在中央 WRITE 樹留下留言；不需角色飛升儀式。</p>':''}<form data-form="plant"><textarea class="panel-input" name="text" maxlength="500" rows="4" placeholder="Leave a message in the garden"></textarea>${drawingForm}<button class="panel-button">PLANT MESSAGE</button></form>`;attachDrawing(this.content);}
  renderPlantList(){const plants=[...(this.world?.plants||[])].reverse().slice(0,100);this.content.innerHTML=`<h3>留言之樹 · ${this.world?.plants?.length||0} 則記錄</h3><p>點擊任一留言可閱讀內容及回覆。</p>${plants.map(p=>`<button class="panel-button plant-list-entry" data-open-plant="${escape(p.id)}"><b>${escape(p.author)}</b> · ${escape(p.text||'媒體留言').slice(0,140)}</button>`).join('')||'<p>尚無留言。請使用 WRITE 種下第一則記錄。</p>'}`;}
  renderPlant(){const plant=this.selectedPlant;if(!plant)return this.closePanel();const parent=plant.parentId&&(this.world?.plants||[]).find(entry=>entry.id===plant.parentId);this.content.innerHTML=`<article class="plant-message"><small>${new Date(plant.createdAt).toLocaleString()}</small><h3>${escape(plant.author)}</h3><p>${escape(plant.text)}</p>${mediaMarkup(plant.media,window.TEMPLE_CONFIG.backendUrl)}${parent?`<small>Reply to ${escape(parent.author)}：${escape(parent.text).slice(0,80)}</small>`:''}</article><h3>REPLY BRANCH</h3><form data-form="plant-reply"><textarea class="panel-input" name="text" maxlength="500" rows="4" placeholder="Grow a reply branch from this plant"></textarea><button class="panel-button">PLANT REPLY</button></form>`;}
  renderEditor(){const saved=JSON.parse(localStorage.getItem('temple-editor-settings')||'{}');this.content.innerHTML=`<p><b>Shift + Y</b> 開啟編輯設定，<b>Shift + O</b> 編輯圓盤位置與尺寸；編輯時按住滑鼠中鍵拖曳可旋轉視角。</p><form data-form="editor"><label>解析度倍率上限<input class="panel-input" name="pixelRatio" type="number" min="0.6" max="2" step="0.05" value="${saved.pixelRatio||1.35}"></label><label>霧氣濃度<input class="panel-input" name="fog" type="number" min="0" max="0.04" step="0.0001" value="${saved.fog??.0008}"></label><label>作品漂浮幅度<input class="panel-input" name="artFloat" type="number" min="0" max="0.6" step="0.01" value="${saved.artFloat??.17}"></label><button class="panel-button">儲存編輯結果</button></form><button class="panel-button" data-export-layout>下載 temple-layout.json</button><p>${PLATFORMS.length} 件預設作品，配置由伺服器保存。</p>`;}
  async panelClick(event){const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-open-sky-color')){this.openPanel('sky-color');return;}
    if(button.hasAttribute('data-sky-save')){this.emit('sky-color-save',{color:this.skyDraft});return;}
    if(button.hasAttribute('data-sky-back')){this.openPanel('editor');return;}
    if(button.hasAttribute('data-gm-delete-artworks')){if(!this.self?.profile?.admin)return;const ids=[...this.content.querySelectorAll('[data-delete-artwork]:checked')].map(n=>n.value);if(!ids.length)return this.toast('請勾選作品');if(confirm('刪除選取的 '+ids.length+' 件作品？此操作會同步至所有玩家。'))this.emit('gm-remove-artworks',{ids});return;}
    if(button.dataset.buildTab){this.buildTab=button.dataset.buildTab;this.applyBuildTab();return;}
    if(button.dataset.ownArtwork){this.emit('own-artwork-select',{id:button.dataset.ownArtwork});return;}
    if(button.hasAttribute('data-open-shop-prices')){if(!this.self?.profile?.admin)return;this.openPanel('shop-prices');return;}
    if(button.hasAttribute('data-close-shop-detail')){this.shopSelectedKey=null;this.renderShop(this.world.profile);return;}
    if(button.dataset.shopSelect){this.shopSelectedKey=button.dataset.shopSelect;this.renderShop(this.world.profile);return;}
    if(button.dataset.gmTuningSave||button.dataset.gmTuningReset){
     if(!this.world?.profile?.admin)return;
     const reset=!!button.dataset.gmTuningReset,values={};
     if(!reset)for(const input of button.closest('.gm-equipment-tuning').querySelectorAll('[data-gm-tuning-field]')){
      if(!input.value.trim()||!input.checkValidity())return this.toast('請輸入有效數值 · '+input.dataset.gmTuningField);
      if(Number(input.value)!==Number(input.dataset.currentValue))values[input.dataset.gmTuningField]=Number(input.value);
     }
     if(!reset&&!Object.keys(values).length)return this.toast('數值未變更');button.blur();this.emit('server-action',{action:'gm-equipment-tuning',itemId:button.dataset.gmTuningSave||button.dataset.gmTuningReset,values:reset?null:values,...(button.dataset.shopTier?{qualityTier:Number(button.dataset.shopTier)}:{})});return;
    }
    if(button.dataset.gmPriceSave||button.dataset.gmPriceReset){if(!this.world?.profile?.admin)return;const reset=!!button.dataset.gmPriceReset,field=button.closest('.shop-price-editor')?.querySelector('[data-gm-price-input]'),price=reset?null:Number(field?.value);if(!reset&&(!field?.value.trim()||!Number.isSafeInteger(price)||price<1||price>100000000))return this.toast('PRICE 1–100,000,000');button.blur();this.emit('server-action',{action:'gm-shop-price',itemId:button.dataset.gmPriceSave||button.dataset.gmPriceReset,price,...(button.dataset.shopTier?{qualityTier:Number(button.dataset.shopTier)}:{})});return;}
    if(button.dataset.gmPlatformTool&&this.self?.profile?.admin){
       this.emit('gm-platform-tool',{mode:button.dataset.gmPlatformTool,
        kind:button.dataset.gmPlatformKind||'disc'});return;
     }
     if(button.dataset.gmArtworkSelect&&this.self?.profile?.admin){
       this.emit('gm-artwork-select',{id:button.dataset.gmArtworkSelect,repair:false});return;
     }
     if(button.dataset.gmArtworkRepair&&this.self?.profile?.admin){
       this.emit('gm-artwork-select',{id:button.dataset.gmArtworkRepair,repair:true});return;
     }
     if(button.dataset.openPlant){const plant=(this.world?.plants||[]).find(p=>p.id===button.dataset.openPlant);if(plant)this.showPlant(plant);return;}if(button.hasAttribute('data-open-wing-shop')){this.openPanel('wing-shop');return;}
    if(button.hasAttribute('data-open-wing-painter')){this.openPanel('wing-painter');return;}
    if(button.hasAttribute('data-open-gift')){this.openPanel('wing-personal-painter');return;}
    if(button.hasAttribute('data-wing-checkout')){if(this.wingSupportSelection)this.emit('wing-payment-checkout',{...this.wingSupportSelection});return;}
    if(button.hasAttribute('data-open-wing-manage')){this.openPanel('wing-manage');return;}
    if(button.hasAttribute('data-wing-edit')){
      if(!this.self?.profile?.admin)return;
      const wing=(this.world?.customWings||[]).find(item=>item.id===button.dataset.wingEdit&&item.retired!==true);
      if(!wing)return this.toast('找不到可以修改的翅膀');
      this.wingDraft=structuredClone(wing);this.openPanel('wing-painter');return;
     }
     if(button.hasAttribute('data-start-wing-stage')){
      if(!this.self?.profile?.admin)return;
      this.emit('wing-payment-stage-checkout');return;
     }
     if(button.hasAttribute('data-wing-rate-save')){
     if(!this.self?.profile?.admin)return;
     const row=button.closest('.wing-manage-row'),field=row?.querySelector('[data-wing-rate]');
     const drawRatePct=Number(field?.value),wingId=button.dataset.wingRateSave;
     if(!field||!field.value.trim()||!Number.isFinite(drawRatePct)||drawRatePct<0||drawRatePct>100||
        Math.abs(drawRatePct*1000-Math.round(drawRatePct*1000))>1e-7){
      this.toast('中獎率必須是 0–100%，最多 3 位小數');return;
     }
     this.emit('server-action',{action:'gm-wing-set-rate',wingId,drawRatePct});return;
    }
    if(button.hasAttribute('data-wing-remove')){
     if(!this.self?.profile?.admin)return;
     const wingId=button.dataset.wingRemove;
     const wing=(this.world?.customWings||[]).find(item=>item.id===wingId&&item.retired!==true);
     if(!wing)return;
     if(!window.confirm('確定要將「'+wing.name+'」從抽獎池刪除？已取得的玩家仍可裝備。'))return;
     this.emit('server-action',{action:'gm-wing-remove',wingId});return;
    }
    if(button.hasAttribute('data-draw-wing')){if(this.beginWingDraw())this.emit('server-action',{action:this.self?.profile?.admin?'gm-wing-draw':'wing-draw'});return;}
    if(button.dataset.bagTab){this.bagTab=button.dataset.bagTab;this.renderPanel();return;}if(button.dataset.shopTab){this.shopTab=button.dataset.shopTab==='weapons'?(this.shopWeaponTab||'near'):button.dataset.shopTab;if(['near','mid','far','mystery'].includes(this.shopTab))this.shopWeaponTab=this.shopTab;this.shopSelectedKey=null;this.renderPanel();return;}try{if(button.dataset.buy){
     const quantity=Number(button.closest('.item')?.querySelector('[data-shop-quantity]')?.value??1);
     if(!Number.isSafeInteger(quantity)||quantity<1||quantity>99)return this.toast('QUANTITY 1–99');
     button.blur();
     if(this.shopPurchasePending)return;
     this.emit('server-action',{action:'buy',itemId:button.dataset.buy,quantity,
      ...(button.dataset.shopTier?{qualityTier:Number(button.dataset.shopTier)}:{})});
    }if(button.dataset.equip)this.emit('server-action',{action:'equip',itemId:button.dataset.equip,...(button.hasAttribute('data-equip-index')?{inventoryIndex:Number(button.dataset.equipIndex)}:{})});if(button.dataset.sell)this.emit('server-action',{action:'sell',itemId:button.dataset.sell,...(button.dataset.sellUid?{uid:button.dataset.sellUid}:{})});if(button.dataset.build){this.buildKind=button.dataset.build;$('build-kind').textContent=this.buildKind.toUpperCase();$('build-mode').hidden=false;this.closePanel();this.emit('build-start',{kind:this.buildKind,file:this.content.querySelector('[data-build-skin]')?.files[0]});}if(button.dataset.role)this.emit('role-change',button.dataset.role);if(button.hasAttribute('data-follow'))this.emit('spectator-follow',button.dataset.follow);if(button.hasAttribute('data-destroy-near'))this.emit('destroy-near');if(button.dataset.removeStructure)this.emit('server-action',{action:'remove-structure',structureId:button.dataset.removeStructure});if(button.hasAttribute('data-save-code'))this.emit('save-code');if(button.hasAttribute('data-copy-save-code')){const value=this.saveCode||this.self?.saveCode;if(value){if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else{this.content.querySelector('#save-code-output')?.select();document.execCommand('copy');}this.toast('已複製存檔代碼');}}if(button.hasAttribute('data-export-layout'))this.exportLayout();}catch(error){this.toast(error.message);}}
  async panelSubmit(event){event.preventDefault();const form=new FormData(event.target),kind=event.target.dataset.form;if(kind==='art-bomb-upload'){const files=[...event.target.querySelector('[name=artwork]').files],title=String(form.get('title')||'').trim();if(files.length&&title)this.emit('art-bomb-upload',{files,title,size:Number(form.get('size')),author:String(form.get('author')||'').trim(),labelBackground:String(form.get('labelBackground')||'#000000')});return;}if(kind==='art-bomb-resize'){this.emit('art-bomb-resize',{id:String(form.get('id')),size:Number(form.get('size'))});return;}if(kind==='art-bomb-appearance'){const appearance={depth:+form.get('depth'),brightness:+form.get('brightness'),contrast:+form.get('contrast'),saturation:+form.get('saturation'),blackPoint:+form.get('blackPoint'),tint:String(form.get('tint')),labelBackground:String(form.get('labelBackground')||'#000000'),labelColor:String(form.get('labelColor')||'#ffffff'),labelFontSize:Number(form.get('labelFontSize')||44),labelWidth:Number(form.get('labelWidth')||3.5),labelHeight:Number(form.get('labelHeight')||.492)};this.emit('art-bomb-appearance',{id:String(form.get('id')),expectedRevision:Number(form.get('revision')),appearance});return;}if(kind==='gm-platform'){this.emit('create-platform',{position:['x','y','z'].map(k=>Number(form.get(k))),radius:Number(form.get('radius'))});return;}if(kind==='upload-artwork'){const files=[...event.target.querySelector('input[type=file]').files],title=String(form.get('title')||'').trim();if(files.length&&title)this.emit('upload-artwork',{files,title,author:String(form.get('author')||'').trim(),labelBackground:String(form.get('labelBackground')||'#000000')});return;}if(kind==='fusion')this.emit('server-action',{action:'fuse',sourceId:form.get('source'),targetId:form.get('target'),requestId:crypto.randomUUID()});if(kind==='chat'){const text=String(form.get('text')||'').trim();if(text)this.emit('chat',text);event.target.reset();}if(kind==='plant'||kind==='plant-reply'){const text=String(form.get('text')||'').trim();let file=form.get('media');if(!file?.size)file=null;const drawing=event.target.querySelector('[data-drawing][data-used]');if(drawing)file=await new Promise(resolve=>drawing.toBlob(resolve,'image/webp',.8));if(text||file)this.emit('plant',{text,file,parentId:kind==='plant-reply'?this.selectedPlant?.id:null});}if(kind==='editor'){const settings={pixelRatio:+form.get('pixelRatio'),fog:+form.get('fog'),artFloat:+form.get('artFloat')};localStorage.setItem('temple-editor-settings',JSON.stringify(settings));this.emit('editor-settings',settings);this.toast('已儲存編輯結果');}}
  clearChat(){
    this.chat=[];const log=$('chat-messages');if(log)log.replaceChildren();
    this.selectedPlant=null;
    if(this.panelName==='social')this.renderSocial(this.world?.profile);
    if(['plant','plant-list'].includes(this.panelName))this.closePanel();
  }
  addChat(message){const row=document.createElement('div');row.textContent=`${message.name}: ${message.text}`;const log=$('chat-messages');log.append(row);while(log.children.length>40)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;this.chat.push(message);if(this.chat.length>100)this.chat.shift();if(this.panelName==='social'){const log=this.content.querySelector('.chat-log');if(log){log.querySelector('small')?.remove();const line=document.createElement('div');line.className='chat-line';line.textContent=`${new Date(message.time).toLocaleTimeString()} ${message.name}: ${message.text}`;log.append(line);while(log.children.length>30)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;}}}
  emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
  clearBuildMode(){this.buildKind='';$('build-mode').hidden=true;}
  showPlant(plant){this.selectedPlant=plant;this.openPanel('plant');}
  showPlantList(){this.openPanel('plant-list');}
  exportLayout(){const settings=JSON.parse(localStorage.getItem('temple-editor-settings')||'{}'),blob=new Blob([JSON.stringify({version:1,settings,platforms:PLATFORMS},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='temple-layout.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
}

function option(item){return `<option value="${item.id}">${escape(item.name)}</option>`;}
function itemCard(item,action){const rarity=RARITIES.find(entry=>entry.id===item.rarity)||RARITIES[0],stats=item.slot==='weapon'?`PvP ${+(pvpShotDamage(item,attackStats(item,0),weaponQuality(item))*(item.gmDamageRatio??1)).toFixed(2)} / HIT · ${attackStats(item,0).range}m · CD ${item.cooldown}ms${item.id==='black-cat'?' · SCOPE ONLY':` · CHARGE ${item.chargeMs}ms · ${weaponManaLabel(item.manaQuote||weaponManaQuote(null,item))}`}`:item.slot==='consumable'?item.category+' · RECOVER '+Math.round((item.manaFraction||item.healFraction)*100)+(item.manaFraction?'% MAX MP':'% MAX HP')+' · CD '+(item.cooldownMs/1000)+'s':item.description||item.slot.toUpperCase();return `<article class="item" draggable="true" data-bag-item="${item.id}" style="border-color:${rarity.color}88"><h3>${escape(item.name)}</h3><div class="shop-buy-controls">${action}</div>${previewMarkup(item)}<small class="rarity">${escape(rarity.name)} · T${item.tier||1}</small><small>${escape(stats)}</small><p class="equipment-description">${escape(explainEquipment(item))}</p>${item.slot==='weapon'?'<small class="weapon-enchantment-hint">Fixed shop stats. Random 3–15% affixes are exclusive to ground loot.</small>':''}</article>`;}
