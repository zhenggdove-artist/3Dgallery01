import {renderOriginalBag} from './bag-view.js';
import {weaponRangeClass} from './reletter/odd-weapons.js';
import {ART_ACCEPT} from './artwork-upload.js';
import {bindBagDrag} from './bag-drag.js';
import {PLATFORMS} from './shared/arena.js';
import {playerArtworkAppearanceMarkup} from './art-editor-panel.js';
import {ECONOMY,RARITIES,SHOP_ITEMS,EQUIPPABLE_SLOTS,ITEMS,itemById,attackStats} from './shared/catalog.js';
import {SOUND_PROFILES} from './game-audio.js';
import {pvpShotDamage} from './shared/combat-balance.js';
import {weaponQuality} from './shared/weapon-abilities.js';
import {itemPreview as itemIcon} from './item-preview.js';
import {drawingForm,attachDrawing,mediaMarkup} from './media-ui.js';
import {SWALLOWTAIL_WINGS} from './reletter/wing-catalog.js';
import {wingIcon} from './reletter/garden-art.js';
import {wingRarity,WING_QUALITY_NAMES,WING_QUALITY_COLORS} from './shared/wing-shop.js';
import {mountWingPainter} from './gm-wing-painter.js';
import {bindChatLayout} from './chat-layout.js';

const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export class TempleUI extends EventTarget{
  constructor(){
    super();this.world=null;this.players=[];this.self=null;this.panelName='';this.toastTimer=0;this.near=null;this.chat=[];this.buildKind='';this.selectedPlant=null;this.saveCode='';this.platformDeleteMode=false;this.gmPresenceData=null;this.gmPresenceError='';this.gmPresenceLoading=false;this.lastWingDraw=null;this.wingPaymentStatus=null;this.firebaseIdToken='';this.authMode='firebase';
    this.entry=$('entry');this.form=$('entry-form');this.hud=$('hud');this.panel=$('panel');this.content=$('panel-content');
    bindBagDrag(this);bindChatLayout();addEventListener('resize',()=>this.scheduleRosterLayout());
    this.bind();$('gm-help').onclick=()=>this.openPanel('help');$('gm-menu').onclick=()=>this.openPanel('gm');this.content.addEventListener('dragstart',e=>{const cell=e.target.closest('[data-bag-item]');if(cell&&this.panelName==='bag'&&cell.dataset.inventoryIndex!==undefined){
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
    const sendChat=()=>{if(composing)return;const value=chatInput.value.trim();if(!value)return;chatInput.value='';imeEnter=false;chatInput.blur();this.emit('chat',value);};
    chatInput.addEventListener('compositionstart',()=>{composing=true;});
    chatInput.addEventListener('compositionend',()=>{composing=false;if(imeEnter){imeEnter=false;setTimeout(()=>{if(!composing)sendChat();},0);}});
    chatInput.addEventListener('keydown',event=>{if(event.key!=='Enter')return;if(composing||event.isComposing||event.keyCode===229){imeEnter=true;return;}event.preventDefault();sendChat();});
    chatInput.addEventListener('keyup',event=>{if(event.key==='Enter'&&imeEnter&&!composing){imeEnter=false;sendChat();}});
    $('chat-form').onsubmit=event=>{event.preventDefault();if(!composing&&!imeEnter)sendChat();};
  }
  bind(){
    document.addEventListener('contextmenu',event=>{if(event.target.closest?.('#game,#hud')&&!event.target.closest('input,textarea'))event.preventDefault();});
    this.entry.addEventListener('click',event=>{
      const button=event.target.closest('[data-google-login]');
      if(!button||button.disabled)return;
      // Re-clicking must open Google account selection, even after the
      // previous selection returned a usable Firebase token.
      // Keep native user activation intact for iOS Safari's Google popup.
      // Guard rapid duplicate taps with a flag rather than disabling the
      // clicked element while the browser is opening its auth window.
      if(this.googleLoginBusy)return;
      this.googleLoginBusy=true;
      this.firebaseIdToken='';
      this.form.hidden=true;
      $('entry-error').textContent='';
      $('account-login-status').textContent='正在開啟 Google 帳號選擇視窗…';
      this.emit('firebase-login');
    });
    this.form.addEventListener('submit',event=>{
      event.preventDefault();$('entry-error').textContent='';
      if(!this.firebaseIdToken)return this.joinError('請先選擇 Google 帳號。');
      this.emit('join',{name:$('player-name').value.trim(),color:$('clothing-color').value,
        firebaseIdToken:this.firebaseIdToken,backendUrl:window.TEMPLE_CONFIG.backendUrl});
    });
    const charge=$('attack-button');let attackPointer=null;charge.onpointerdown=event=>{event.preventDefault();if(attackPointer!==null)return;attackPointer=event.pointerId;charge.setPointerCapture(event.pointerId);this.emit('attack-start');};const endAttack=(event,cancel=false)=>{if(event.pointerId!==attackPointer)return;attackPointer=null;this.emit(cancel?'attack-cancel':'attack-release');};charge.onpointerup=e=>endAttack(e);charge.onpointercancel=charge.onlostpointercapture=e=>endAttack(e,true);const jump=document.querySelector('[data-action=jump]');jump.onpointerdown=e=>{e.preventDefault();jump.setPointerCapture(e.pointerId);this.emit('jump');};jump.onclick=e=>{if(e.detail===0)this.emit('jump');e.stopPropagation();};
    addEventListener('keydown',event=>{if(this.self&&!this.panelName&&event.code==='KeyQ'&&!event.repeat&&!/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)){event.preventDefault();this.emit('attack-start');}});
    addEventListener('keyup',event=>{if(event.code==='KeyQ')this.emit('attack-release');});addEventListener('blur',()=>this.emit('attack-cancel'));
    $('panel-close').onclick=()=>this.closePanel();document.getElementById('dock').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.panel)this.openPanel(button.dataset.panel);else if(button.id==='wing-gift-button')this.openPanel('wing-painter');else if(button.dataset.action)this.emit(button.dataset.action);});
    $('build-confirm').onclick=()=>this.emit('build-confirm');$('build-rotate').onclick=()=>this.emit('build-rotate');$('build-cancel').onclick=()=>this.emit('build-cancel');
    this.content.addEventListener('click',event=>this.panelClick(event));this.content.addEventListener('submit',event=>this.panelSubmit(event));
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
  const chance=event.target.closest('[data-gm-fusion-chance]');
  if(chance){this.emit('gm-fusion-chance',{percent:Number(chance.value)});return;}
  const invincible=event.target.closest('[data-gm-invincible]');
  if(invincible)this.emit('gm-invincible',{enabled:invincible.checked});
 });
     this.content.addEventListener('click',event=>{const action=event.target.closest('[data-gm-action]')?.dataset.gmAction;if(!action||!this.self?.profile?.admin)return;if(action==='refresh')this.requestGmPresence();else if(action==='editor')this.openPanel('editor');else if(action==='help')this.openPanel('help');else if(action==='wing-painter')this.openPanel('wing-painter');else if(action==='wing-manage')this.openPanel('wing-manage');
      else if(action==='reset-buildings')this.emit('server-action',{action:'reset-buildings'});
      else if(action==='reset-messages'&&window.confirm('確定要永久清空所有留言樹記錄與聊天室訊息？'))this.emit('server-action',{action:'reset-messages'});});
    this.content.addEventListener('click',event=>{const b=event.target.closest('button');if(b?.dataset.unequip)this.emit('server-action',{action:'unequip',slot:b.dataset.unequip});if(b?.dataset.use)this.emit('use-item',b.dataset.use);});
    this.content.addEventListener('click',event=>{const b=event.target.closest('[data-original]');if(!b)return;this.emit('original-action',{action:b.dataset.original,id:b.dataset.id,hole:b.dataset.hole,item:b.dataset.item,pond:b.dataset.pond});});
    addEventListener('keydown',event=>{if(event.code==='Escape'&&this.panelName){event.preventDefault();this.closePanel();return;}if(/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName))return;const code=event.code;if(this.buildKind){if(code==='KeyE'){event.preventDefault();this.emit('build-confirm');}if(code==='KeyR')this.emit('build-rotate');if(code==='Escape')this.emit('build-cancel');return;}if(code==='Tab'&&this.self?.role==='spectator'){event.preventDefault();this.emit('spectator-cycle');return;}if(code==='KeyJ')this.emit('attack');if(code==='KeyB')this.openPanel('bag');if(code==='KeyI')this.openPanel('shop');if(code==='KeyV')this.openPanel('build');if(code==='KeyC')this.openPanel('social');if(code==='Escape')this.closePanel();if(code==='KeyY'&&event.shiftKey){event.preventDefault();this.openPanel('editor');}});
  }
  setLoading(progress,label){$('loading-fill').style.width=`${Math.round(progress*100)}%`;$('loading-detail').textContent=label;$('loading-percent').textContent=`${Math.round(progress*100)}%`;}
  ready(){document.body.classList.add('ready');document.body.classList.remove('booting');}
  setFirebaseLoginStatus(enabled,message=''){
    this.googleLoginBusy=false;
    const button=this.entry.querySelector('[data-google-login]');
    if(button)button.disabled=!enabled;
    $('account-login-status').textContent=message||(
      enabled?'請選擇 Google 帳號以載入或建立角色。':
      'Google 登入暫時無法使用，請稍後重試。'
    );
  }
  selectFirebaseAccount(token,profile=null){
    this.googleLoginBusy=false;
    this.entry.querySelector('[data-google-login]').disabled=false;
    this.firebaseIdToken=token;
    const existing=!!profile;
    this.entryExistingProfile=existing;
    $('account-login-status').textContent=existing?
      '帳號驗證完成。確認角色後即可進入遊戲。':
      '帳號驗證完成。建立角色後即可進入遊戲。';
    $('entry-profile-heading').textContent=existing?'確認遊戲角色':'建立遊戲角色';
    $('player-name').value=existing?String(profile.name||''):'';
    $('clothing-color').value=existing&&/^#[0-9a-fA-F]{6}$/.test(profile.color||'')?profile.color:'#43b59a';
    $('enter-button').textContent=existing?'進入遊戲':'建立角色並進入';
    this.form.hidden=false;
    $('player-name').required=true;
    if(!existing)$('player-name').focus();
  }
  joinBusy(value){$('enter-button').disabled=value;$('enter-button').textContent=value?'正在連線…':this.entryExistingProfile?'進入遊戲':'建立角色並進入';}
  joinError(message){$('entry-error').textContent=message;this.joinBusy(false);}
  enter(data){document.activeElement?.blur();this.self=data.self;this.authMode=data.authMode||'firebase';this.world=data.world;this.players=data.players||[];this.joinedAt=Date.now();this.entry.hidden=true;this.firebaseIdToken='';this.hud.hidden=false;document.body.classList.toggle('spectator',data.role==='spectator');$('hud-name').textContent=data.self.name;$('hud-role').textContent=data.role.toUpperCase()+(data.self.profile?.admin?' · GM':'');$('gm-help').hidden=!data.self.profile?.admin;$('gm-menu').hidden=!data.self.profile?.admin;$('wing-shop-button').hidden=false;this.refreshHUD();this.joinBusy(false);}
  setSelf(self){this.self={...this.self,...self};$('hud-name').textContent=this.self.name;$('hud-role').textContent=String(this.self.role||'fighter').toUpperCase()+(this.self.profile?.admin?' · GM':'');document.body.classList.toggle('spectator',this.self.role==='spectator');$('gm-help').hidden=!this.self.profile?.admin;$('gm-menu').hidden=!this.self.profile?.admin;$('wing-shop-button').hidden=false;this.refreshHUD();if(this.panelName)this.renderPanel();}
  setPlayers(players){this.players=players||[];this.refreshHUD();}
  setWorld(world){this.world=world;this.refreshHUD();if(['bag','shop','wing-shop'].includes(this.panelName)&&this.panelSignature!==JSON.stringify([world.profile.inventory,world.profile.equipment,world.profile.wallet,world.profile.fusion,world.profile.wingDesignCredits])&&!(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)&&this.content.contains(document.activeElement)))this.renderPanel();}
  refreshHUD(){const profile=this.world?.profile||this.self?.profile;if(profile){$('wallet').textContent=`${profile.wallet}`;$('hp').max=profile.maxHp||100;$('hp').value=profile.hp||0;$('hp-label').textContent=Math.ceil(profile.hp||0)+'/'+profile.maxHp;$('player-level').textContent='LV. '+(profile.level||1);$('weapon').textContent=(itemById(profile.equipment?.weapon)?.name||'UNARMED').toUpperCase();}const fighters=this.players.filter(p=>p.role==='fighter').length,spectators=this.players.length-fighters;$('online').textContent=`${fighters}/4 · ${spectators}/100`;this.renderRoster();
    const gift=$('wing-gift-button');
    if(gift)gift.hidden=!(Number(profile?.wingDesignCredits)||0);
    const monster=this.world?.monster,visible=false;$('monster-hud').hidden=!visible;if(visible){$('monster-name').textContent=`${String(monster.variant).toUpperCase()} · GENERATION ${monster.generation}`;$('monster-hp').max=monster.maxHp;$('monster-hp').value=monster.hp;}}
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
  setNear(near,holding=false){this.near=near;const prompt=$('prompt');let text='';const touch=matchMedia('(pointer:coarse)').matches;if(this.platformDeleteMode)text='GM DELETE · CLICK A DISC → BLUE · DELETE · ESC';else if(this.buildKind)text=touch?'A · PLACE':'E · PLACE  R · ROTATE  ESC · CANCEL';else if(holding)text='HOLD A · CHARGE THROW';else if(near?.type==='coin'||near?.type==='drop')text='';else if(near?.type==='artwork')text='A · TAKE ARTWORK';else if(near?.type==='plant')text='';else if(near?.type==='structure')text='ATTACK · DAMAGE STRUCTURE';prompt.textContent=text;prompt.classList.toggle('visible',!!text);}
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
  openPanel(name,fromJourney=false){if(!this.self)return;if(['gm','wing-manage'].includes(name)&&!this.self.profile?.admin)return;
    if(name==='wing-painter'&&!this.self.profile?.admin&&!(this.world?.profile?.wingDesignCredits>0))return;if(name==='social'&&!fromJourney){this.emit('write-start');return;}this.hud.classList.remove('functions-open');$('function-toggle').setAttribute('aria-expanded','false');this.panelName=name;document.body.classList.add('panel-open');document.body.classList.toggle('panel-wing-painter',name==='wing-painter');document.body.classList.toggle('panel-wing-shop',['wing-shop','wing-manage'].includes(name));this.panel.hidden=false;this.renderPanel();this.emit('panel',{open:true,name});
    if(name==='wing-shop')this.emit('wing-payment-status-request');
    if(name==='gm')this.requestGmPresence();}
  closePanel(){if(this.panel.hidden)return;this.panel.hidden=true;document.body.classList.remove('panel-open','panel-wing-painter','panel-wing-shop');this.wingGalleryObserver?.disconnect();this.panelName='';this.emit('panel',{open:false});}
  renderPanel(){this.panelSignature=JSON.stringify([this.world?.profile?.inventory,this.world?.profile?.equipment,this.world?.profile?.wallet,this.world?.profile?.fusion,this.world?.profile?.wingDesignCredits]);const profile=this.world?.profile;if(!profile)return;const titles={bag:'BAG / FUSION',shop:'TEMPLE SHOP','wing-shop':'SUPPORT · CUSTOM WINGS',build:'BUILD',social:'WRITE',plant:'MESSAGE PLANT','plant-list':'留言之樹',editor:'GM 編輯器',gm:'GM 控制中心','wing-painter':'翅膀繪圖工作室','wing-manage':'GM · 翅膀上架管理',save:'SAVE / MEMORY CODE'};$('panel-title').textContent=titles[this.panelName]||'TEMPLE';
    if(this.panelName==='gm'){this.renderGm();return;}
     if(this.panelName==='wing-painter'){mountWingPainter(this);return;}
    if(this.panelName==='help'){this.content.innerHTML='<h3>GM 編輯快捷鍵</h3><p>點擊作品選取。<br>Shift + Y：設定／匯出／上傳／新增圓盤<br>Shift + T：縮放（四角等比、中點單軸）<br>Shift + R：三軸旋轉<br>Shift + G：三軸移動<br>Shift + D：圓盤刪除模式（點選變藍、DELETE 刪除、ESC 離開）<br>跟隨 GM：讓作品隨玩家移動<br>儲存：發布預設位置與尺寸<br>ESC：取消尚未儲存修改</p><h3>GM 指令</h3><p><code>/reset building</code>：復原全部破損房屋<br><code>/reset message</code>：永久清空中央留言與聊天室<br><code>/reset</code>：清空玩家上傳作品<br><code>/recovery</code>：還原藝術品</p>';return;}if(this.panelName==='save')this.renderSave();if(this.panelName==='bag')this.renderBag(profile);if(this.panelName==='shop')this.renderShop(profile);if(this.panelName==='wing-shop')this.renderWingShop(profile);if(this.panelName==='wing-manage')this.renderWingManage(profile);if(this.panelName==='build')this.renderBuild(profile);if(this.panelName==='social')this.renderSocial(profile);if(this.panelName==='plant')this.renderPlant();if(this.panelName==='plant-list')this.renderPlantList();if(this.panelName==='editor'){this.renderEditor();if(this.self.profile?.admin)this.content.insertAdjacentHTML('beforeend',`<section class="gm-wing-workspace"><h3>GM 翅膀編輯工作區</h3><p>繪製、上架、設定中獎率及下架管理。</p><div class="gm-tools"><button type="button" data-gm-action="wing-painter">畫翅膀／上架</button><button type="button" data-gm-action="wing-manage">已上架翅膀／機率／下架</button></div></section><hr><h3>建立漂浮圓盤</h3><form data-form="gm-platform">${['x','y','z'].map(k=>`<label>${k.toUpperCase()}<input name="${k}" type="number" value="${k==='y'?2:0}" step=".1" required></label>`).join('')}<label>半徑<input name="radius" type="number" value="2.5" min=".6" max="8" step=".1" required></label><button>建立並儲存圓盤</button></form><hr><h3>上傳藝術品</h3><form data-form="upload-artwork"><p>PNG／JPEG／WebP、MP4／WebM、GLB／glTF／FBX。模型貼圖與 BIN 檔請一起選取。轉換後上限 32 MB、50 萬三角面、200 個網格；保留圖片透明度，模型會打包成完整 GLB。</p><label>作品名稱<input name="title" type="text" maxlength="100" required placeholder="輸入作品名稱"></label><input name="artwork" type="file" accept="${ART_ACCEPT}" multiple required><button class="panel-button" data-upload-submit>驗證並發布</button><p data-upload-status role="status"></p></form>`);}
  }
  requestGmPresence(){
    if(!this.self?.profile?.admin)return;
    this.gmPresenceError='';this.gmPresenceLoading=true;
    if(this.panelName==='gm')this.renderGm();
    this.emit('gm-presence-request');
  }
  setGmPresence(data){
    if(!this.self?.profile?.admin)return;
    this.gmPresenceData={online:Array.isArray(data?.online)?data.online:[],events:Array.isArray(data?.events)?data.events:[]};
    this.gmPresenceLoading=false;this.gmPresenceError='';
    if(this.panelName==='gm')this.renderGm();
  }
  setGmPresenceError(message){
    this.gmPresenceLoading=false;this.gmPresenceError=String(message||'無法讀取上下線紀錄');
    if(this.panelName==='gm')this.renderGm();
  }
  renderGm(){
    if(!this.self?.profile?.admin){this.content.textContent='GM only';return;}
    const data=this.gmPresenceData,online=data?.online||this.players||[],events=data?.events||[];
    const date=time=>{const ms=Number(time);return Number.isFinite(ms)?new Date(ms).toLocaleString('zh-TW',{hour12:false}):'—';};
    const volumes=this.world?.audioSettings||{};
    const slider=(key,label)=>{const value=Math.max(0,Math.min(2,Number(volumes[key]??1)));return `<label style="display:grid;grid-template-columns:minmax(90px,1fr) minmax(80px,2fr) 3em;align-items:center;gap:10px;padding:3px 0"><span>${escape(label)}</span><input data-gm-volume="${escape(key)}" type="range" min="0" max="2" step=".05" value="${value}" aria-label="${escape(label)}"><output>${Math.round(value*100)}%</output></label>`;};
    const soundControls=['master','music',...Object.keys(SOUND_PROFILES)].map(key=>slider(key,key==='master'?'總音量':key==='music'?'背景音樂':key)).join('');
    const weaponControls=ITEMS.filter(item=>item.slot==='weapon').map(item=>slider('weapon-'+item.id,item.name||item.id)).join('');
    this.content.innerHTML=`<section class="gm-admin">
      <h3>GM 功能</h3><div class="gm-tools">
        <button type="button" data-gm-action="editor">作品與圓盤編輯</button>
        <button type="button" data-gm-action="help">編輯快捷鍵</button>
        <button type="button" data-gm-action="wing-painter">畫翅膀／上架翅膀</button>
        <button type="button" data-gm-action="wing-manage">翅膀上架管理／刪除／中獎率</button>
        <button type="button" data-gm-action="reset-buildings">/reset building · 復原所有房屋</button>
        <button type="button" data-gm-action="reset-messages">/reset message · 清空留言</button>
        <button type="button" data-gm-action="refresh">${this.gmPresenceLoading?'讀取中…':'重新整理紀錄'}</button>
      </div>
      <p><strong>GM 指令：</strong><code>/reset building</code> 復原房屋 · <code>/reset message</code> 清空留言 · <code>/reset</code> 清空玩家作品 · <code>/recovery</code> 還原藝術品</p>
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
  renderShop(profile){const tab=this.shopTab||'near',tabs={near:'Near',mid:'Mid',far:'Far',mystery:'Mystery Weapons',shield:'Shields',head:'Headwear',outfit:'Outfits',wings:'Wings',owned:'Owned'};const items=(tab==='owned'?(profile.inventory||[]).map(itemById).filter(Boolean):SHOP_ITEMS).filter(i=>tab==='owned'||(tab==='mystery'&&i.mysteryWeapon)||(['near','mid','far'].includes(tab)&&i.slot==='weapon'&&!i.mysteryWeapon&&weaponRangeClass(i)===tab)||i.slot===tab);this.content.innerHTML=`<div class="armory-balance"><span>Equipment · collections</span><b>${profile.admin?'∞':profile.wallet} coins</b></div><nav class="shop-tabs">${Object.entries(tabs).map(([id,label])=>`<button data-shop-tab="${id}" aria-pressed="${tab===id}">${label}</button>`).join('')}</nav><div class="shop-items">${items.map(item=>{const owned=profile.inventory.includes(item.id),equipped=profile.equipment[item.slot]===item.id;return itemCard(item,`<button data-${owned?'equip':'buy'}="${item.id}" ${equipped||!owned&&!profile.admin&&profile.wallet<item.price?'disabled':''}>${equipped?'EQUIPPED':owned?'EQUIP':`BUY · ${item.price.toLocaleString('en-US')}`}</button>`);}).join('')||'<p>Your collection starts here. Earn coins by exploring the arena.</p>'}</div>`;}

  // SUPPORT sells one authoring entitlement, not chance-based capsules.
  // The merchant/checkout status is provided by the authenticated Worker.
  renderWingShop(profile){
   const credits=Math.max(0,Number(profile.wingDesignCredits)||0);
   const status=this.wingPaymentStatus;
   const ready=status?.checkoutEnabled===true;
   this.content.innerHTML=`<section class="wing-shop-panel wing-support-app wing-design-support">
    <div class="y2k-shell-header"><div class="y2k-shell-brand"><span class="y2k-shell-diamond">◇</span><div><strong>GGTEMPLE</strong><small>SUPPORT</small></div></div><div class="y2k-shell-lights"><span>ONLINE ●</span></div></div>
    <div class="wing-support-controls">
     <header class="wing-shop-hero">
      <small>GGTEMPLE · SUPPORT</small>
      <h3>THANK YOU FOR YOUR SUPPORT</h3>
      <p>Support GGTEMPLE with NT$30 to unlock one wing canvas and create your own pair of wings.</p>
     </header>
     <section class="wing-payment-preview">
      <button type="button" class="panel-button wing-support-pay" data-wing-checkout ${ready?'':'disabled'}>${ready?'SUPPORT · NT$30':status?'PAYMENT UNAVAILABLE':'CHECKING PAYMENT…'}</button>
      ${ready?'<small class="wing-payment-hint">Secure checkout powered by ECPay.</small>':'<small class="wing-payment-hint">Payments are currently unavailable.</small>'}
      ${credits>0?`<button type="button" class="panel-button wing-gift-action" data-open-gift>DRAW YOUR WINGS · ${credits} ${credits===1?'CANVAS':'CANVASES'} READY</button>`:''}
     </section>
    </div>
    <footer class="y2k-taskbar"><span class="y2k-start-button">▣ Start</span><span>GGTEMPLE · SUPPORT</span></footer>
   </section>`;
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
  renderBuild(profile){const ownBombs=(this.world?.customArtworks||[]).filter(a=>a.bomb&&a.owner===this.self?.key);
    const bombs=`<section class="item"><h3>UPLOAD YOUR ARTWORK BOMB</h3><p>PNG / WebP / JPEG, MP4 / WebM, GLB / glTF / FBX. Player uploads limited to 8 MB and four placed works. The artwork becomes a throwable weapon after PLACE. Direct hits deal a random 30–100% of the target's maximum health before defenses.</p><form data-form="art-bomb-upload"><label>作品名稱<input type="text" name="title" maxlength="100" required placeholder="輸入作品名稱"></label><label>YOUR ARTWORK<input type="file" name="artwork" accept="${ART_ACCEPT}" multiple required></label><label>ARTWORK SIZE (1–3×)<input type="number" name="size" value="1" min="1" max="3" step=".1" required></label><button class="panel-button" type="submit">UPLOAD → PLACE</button></form></section>${ownBombs.map(a=>{const scale=this.world?.artworkLayout?.[a.id]?.scale?.[0]||1;return `<form class="item" data-form="art-bomb-resize"><b>${escape(a.title)}</b><input type="hidden" name="id" value="${escape(a.id)}"><label>SIZE<input name="size" type="number" min="1" max="3" step=".1" value="${scale}" required></label><button class="panel-button" type="submit">SAVE SIZE</button></form>`;}).join('')}${ownBombs.map(a=>playerArtworkAppearanceMarkup(a,this.world?.artworkLayout?.[a.id],escape)).join('')}`;
    const removable=(this.world?.structures||[]).filter(s=>s.owner===this.self?.key||profile.admin);
    this.content.innerHTML=bombs+`<p>Choose a structure. <b>R</b> rotates, <b>E</b> places, <b>Esc</b> cancels. Red previews indicate invalid placement. Cost is checked by the server.</p><label>IMAGE SKIN<input data-build-skin type="file" accept="image/png,image/jpeg,image/webp"></label><div class="item-grid">${Object.entries(ECONOMY.buildCosts).map(([kind,cost])=>`<article class="item"><small>STRUCTURE</small><h3>${kind.toUpperCase()}</h3><p>${cost} coins${profile.wallet<cost&&!profile.admin?' · INSUFFICIENT COINS':''}</p><button data-build="${kind}">PLACE PREVIEW</button></article>`).join('')}</div><button class="panel-button" data-destroy-near>ATTACK NEAREST STRUCTURE</button><section class="item"><h3>REMOVE CONSTRUCTED OBJECTS</h3>${removable.length?removable.map(s=>`<div class="structure-entry"><span>${escape(s.kind)} · ${Math.ceil(s.hp)} HP</span><button class="panel-button" data-remove-structure="${escape(s.id)}">REMOVE / BREAK</button></div>`).join(''):'<p>No personally constructed objects.</p>'}</section>`;}
  renderSocial(profile){this.content.innerHTML=`<h3>WRITE / PLANT</h3><form data-form="plant"><textarea class="panel-input" name="text" maxlength="500" rows="4" placeholder="Leave a message in the garden"></textarea>${drawingForm}<button class="panel-button">PLANT MESSAGE</button></form>`;attachDrawing(this.content);}
  renderPlantList(){const plants=[...(this.world?.plants||[])].reverse().slice(0,100);this.content.innerHTML=`<h3>留言之樹 · ${this.world?.plants?.length||0} 則記錄</h3><p>點擊任一留言可閱讀內容及回覆。</p>${plants.map(p=>`<button class="panel-button plant-list-entry" data-open-plant="${escape(p.id)}"><b>${escape(p.author)}</b> · ${escape(p.text||'媒體留言').slice(0,140)}</button>`).join('')||'<p>尚無留言。請使用 WRITE 種下第一則記錄。</p>'}`;}
  renderPlant(){const plant=this.selectedPlant;if(!plant)return this.closePanel();const parent=plant.parentId&&(this.world?.plants||[]).find(entry=>entry.id===plant.parentId);this.content.innerHTML=`<article class="plant-message"><small>${new Date(plant.createdAt).toLocaleString()}</small><h3>${escape(plant.author)}</h3><p>${escape(plant.text)}</p>${mediaMarkup(plant.media,window.TEMPLE_CONFIG.backendUrl)}${parent?`<small>Reply to ${escape(parent.author)}：${escape(parent.text).slice(0,80)}</small>`:''}</article><h3>REPLY BRANCH</h3><form data-form="plant-reply"><textarea class="panel-input" name="text" maxlength="500" rows="4" placeholder="Grow a reply branch from this plant"></textarea><button class="panel-button">PLANT REPLY</button></form>`;}
  renderEditor(){const saved=JSON.parse(localStorage.getItem('temple-editor-settings')||'{}');this.content.innerHTML=`<p><b>Shift + Y</b> 開啟編輯設定，可儲存或匯出 GitHub Pages 配置。</p><form data-form="editor"><label>解析度倍率上限<input class="panel-input" name="pixelRatio" type="number" min="0.6" max="2" step="0.05" value="${saved.pixelRatio||1.35}"></label><label>霧氣濃度<input class="panel-input" name="fog" type="number" min="0" max="0.04" step="0.0001" value="${saved.fog??.0008}"></label><label>作品漂浮幅度<input class="panel-input" name="artFloat" type="number" min="0" max="0.6" step="0.01" value="${saved.artFloat??.17}"></label><button class="panel-button">儲存編輯結果</button></form><button class="panel-button" data-export-layout>下載 temple-layout.json</button><p>${PLATFORMS.length} 件預設作品，配置由伺服器保存。</p>`;}
  async panelClick(event){const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.openPlant){const plant=(this.world?.plants||[]).find(p=>p.id===button.dataset.openPlant);if(plant)this.showPlant(plant);return;}if(button.hasAttribute('data-open-wing-shop')){this.openPanel('wing-shop');return;}
    if(button.hasAttribute('data-open-wing-painter')){this.openPanel('wing-painter');return;}
    if(button.hasAttribute('data-open-gift')){this.openPanel('wing-painter');return;}
    if(button.hasAttribute('data-wing-checkout')){this.emit('wing-payment-checkout');return;}
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
    if(button.dataset.bagTab){this.bagTab=button.dataset.bagTab;this.renderPanel();return;}if(button.dataset.shopTab){this.shopTab=button.dataset.shopTab;this.renderPanel();return;}try{if(button.dataset.buy)this.emit('server-action',{action:'buy',itemId:button.dataset.buy});if(button.dataset.equip)this.emit('server-action',{action:'equip',itemId:button.dataset.equip});if(button.dataset.sell)this.emit('server-action',{action:'sell',itemId:button.dataset.sell});if(button.dataset.build){this.buildKind=button.dataset.build;$('build-kind').textContent=this.buildKind.toUpperCase();$('build-mode').hidden=false;this.closePanel();this.emit('build-start',{kind:this.buildKind,file:this.content.querySelector('[data-build-skin]')?.files[0]});}if(button.dataset.role)this.emit('role-change',button.dataset.role);if(button.hasAttribute('data-follow'))this.emit('spectator-follow',button.dataset.follow);if(button.hasAttribute('data-destroy-near'))this.emit('destroy-near');if(button.dataset.removeStructure)this.emit('server-action',{action:'remove-structure',structureId:button.dataset.removeStructure});if(button.hasAttribute('data-save-code'))this.emit('save-code');if(button.hasAttribute('data-copy-save-code')){const value=this.saveCode||this.self?.saveCode;if(value){if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else{this.content.querySelector('#save-code-output')?.select();document.execCommand('copy');}this.toast('已複製存檔代碼');}}if(button.hasAttribute('data-export-layout'))this.exportLayout();}catch(error){this.toast(error.message);}}
  async panelSubmit(event){event.preventDefault();const form=new FormData(event.target),kind=event.target.dataset.form;if(kind==='art-bomb-upload'){const files=[...event.target.querySelector('[name=artwork]').files],title=String(form.get('title')||'').trim();if(files.length&&title)this.emit('art-bomb-upload',{files,title,size:Number(form.get('size'))});return;}if(kind==='art-bomb-resize'){this.emit('art-bomb-resize',{id:String(form.get('id')),size:Number(form.get('size'))});return;}if(kind==='art-bomb-appearance'){const appearance={depth:+form.get('depth'),brightness:+form.get('brightness'),contrast:+form.get('contrast'),saturation:+form.get('saturation'),blackPoint:+form.get('blackPoint'),tint:String(form.get('tint'))};this.emit('art-bomb-appearance',{id:String(form.get('id')),expectedRevision:Number(form.get('revision')),appearance});return;}if(kind==='gm-platform'){this.emit('create-platform',{position:['x','y','z'].map(k=>Number(form.get(k))),radius:Number(form.get('radius'))});return;}if(kind==='upload-artwork'){const files=[...event.target.querySelector('input[type=file]').files],title=String(form.get('title')||'').trim();if(files.length&&title)this.emit('upload-artwork',{files,title});return;}if(kind==='fusion')this.emit('server-action',{action:'fuse',sourceId:form.get('source'),targetId:form.get('target'),requestId:crypto.randomUUID()});if(kind==='chat'){const text=String(form.get('text')||'').trim();if(text)this.emit('chat',text);event.target.reset();}if(kind==='plant'||kind==='plant-reply'){const text=String(form.get('text')||'').trim();let file=form.get('media');if(!file?.size)file=null;const drawing=event.target.querySelector('[data-drawing][data-used]');if(drawing)file=await new Promise(resolve=>drawing.toBlob(resolve,'image/webp',.8));if(text||file)this.emit('plant',{text,file,parentId:kind==='plant-reply'?this.selectedPlant?.id:null});}if(kind==='editor'){const settings={pixelRatio:+form.get('pixelRatio'),fog:+form.get('fog'),artFloat:+form.get('artFloat')};localStorage.setItem('temple-editor-settings',JSON.stringify(settings));this.emit('editor-settings',settings);this.toast('已儲存編輯結果');}}
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
const icons=new Map();
function itemCard(item,action){if(!icons.has(item.id))icons.set(item.id,item.slot==='wings'?wingIcon(item):itemIcon(item));const rarity=RARITIES.find(entry=>entry.id===item.rarity)||RARITIES[0],stats=item.slot==='weapon'?`PvP ${pvpShotDamage(item,attackStats(item,0),weaponQuality(item))} / HIT · ${attackStats(item,0).range}m · CD ${item.cooldown}ms · CHARGE ${item.chargeMs}ms`:item.description||item.slot.toUpperCase();return `<article class="item" draggable="true" data-bag-item="${item.id}" style="border-color:${rarity.color}88"><img src="${icons.get(item.id)}" alt="" loading="lazy"><small class="rarity">${escape(rarity.name)} · T${item.tier||1}</small><h3>${escape(item.name)}</h3><small>${escape(stats)}</small>${action}</article>`;}
