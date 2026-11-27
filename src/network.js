import {applyWorldPatch,mergeWingCatalog} from './shared/world-patch.js';
import {CITY_LAYOUT_SIGNATURE} from './shared/city-layout.js';
import {SHOP_CATALOG_REVISION} from './shared/catalog.js';
import {isRealtimeAction} from './shared/realtime-actions.js';

export function requestStaffChannelStop(startAcknowledged,pendingStart,sendStop){
 void sendStop();
 // A late channel-start can land after the first stop. Retry only while its
 // acknowledgement is still outstanding, not for an already active beam.
 if(!startAcknowledged)return Promise.resolve(pendingStart).then(result=>{
  if(result?.channeling)return sendStop();
 });
}

export class TempleNetwork extends EventTarget{
  constructor(config=window.TEMPLE_CONFIG){
    super();this.config=config;this.base=String(config.backendUrl||'').replace(/\/$/,'');this.token='';this.socket=null;this.joinData=null;this.reconnectTimer=0;this.reconnectAttempt=0;this.closedByUser=false;this.lastStateAt=0;
    this.stateSequence=0;this.lastAcceptedSequence=0;this.lastCorrectedSequence=0;this.lastAuthorityAt=0;
    this.spawnConfirmed=false;
    this.sentStates=new Map();this.rejectionCounts={};this.motionDiagnostics=[];this.actionTimings=[];this.combatPending=new Map();this.combatSocketActions=false;this.fastActionsV087=false;this.fastCastV089=false;this.contactFastV093=false;
  }
  setBackend(url){this.base=String(url||'').trim().replace(/\/$/,'');localStorage.setItem('temple-backend-url',this.base);}
  ensureConfigured(){if(!/^https?:\/\//.test(this.base)||this.base.includes('REPLACE_WITH_ACCOUNT'))throw new Error('Temple backend URL has not been deployed yet');}
  // The Firebase JWT is used ONLY on the HTTPS join request. WebSocket and
  // gameplay continue to use the short random Temple session token.
  async join({name,color='#43b59a',firebaseIdToken='',mode='firebase'}) {
    this.ensureConfigured();
    const health=await this.request('/health',{auth:false,timeoutMs:6000});
    this.paintOwnershipV115=health?.features?.paintOwnershipV115===true;
    if(health?.service==='Temple'&&(health.features?.wearableCatalog!==SHOP_CATALOG_REVISION||health.cityLayoutSignature!==CITY_LAYOUT_SIGNATURE))throw Error('Temple server is updating. Client/server city and shop versions must match.');
    if(mode==='guest'&&firebaseIdToken)throw Error('Cannot use guest mode after Google authentication');
    const data=await this.request('/api/join',{
      method:'POST',body:{name,color,...(mode==='guest'?{mode:'guest'}:{})},auth:false,identityToken:firebaseIdToken,timeoutMs:20_000
    });
    this.token=data.token;this.joinData=data;this.closedByUser=false;this.spawnConfirmed=false;
    sessionStorage.setItem('temple-session-token',this.token);
    // Gameplay entry never blocks on websocket establishment.
    void this.connect().catch(error=>console.warn('Realtime socket pending',error));
    return data;
  }
  async firebaseConfig(){
    this.ensureConfigured();
    return this.request('/api/firebase/config',{auth:false});
  }
  async firebaseProfile(firebaseIdToken){
    this.ensureConfigured();
    return this.request('/api/firebase/profile',{
      method:'POST',body:{},auth:false,identityToken:firebaseIdToken
    });
  }
  async connect(){
    if(!this.token)throw new Error('Join Temple first');if(this.socket){this.rejectCombatSocket(this.socket);this.socket.onclose=null;this.socket.close();}
    this.compactCombat=false;this.combatSocketActions=false;this.fastActionsV087=false;this.fastCastV089=false;this.contactFastV093=false;
    const url=new URL(this.base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/api/socket';url.searchParams.set('token',this.token);url.searchParams.set('patch','2');url.searchParams.set('surfaceDelta','1');
    await new Promise((resolve,reject)=>{const socket=new WebSocket(url);this.socket=socket;const timer=setTimeout(()=>{socket.close();reject(new Error('Realtime connection timed out'));},10_000);socket.onopen=()=>{clearTimeout(timer);this.reconnectAttempt=0;this.dispatch('connection',{connected:true});resolve();};socket.onerror=()=>{clearTimeout(timer);reject(new Error('Realtime connection failed'));};socket.onmessage=event=>{if(socket!==this.socket||event.data==='pong')return;try{const message=JSON.parse(event.data);
      if(message.type==='combat-result'){this.resolveCombatSocket(socket,message.data);return;}
      if(message.type==='state-ack')this.acknowledgeState(message.data);
      if(message.type==='state-rejected')this.rejectedState(message.data);
      if(message.type==='welcome'){this.wireWorld=message.data.world;this.compactCombat=message.data.compactCombat===true;this.combatSocketActions=message.data.combatSocketActions===true;this.fastActionsV087=message.data.fastActionsV087===true;this.fastCastV089=message.data.fastCastV089===true;this.contactFastV093=message.data.contactFastV093===true;}
      if(message.type==='world'){const wings=mergeWingCatalog(this.wireWorld?.customWings||[],message.data.customWings||[]);this.wireWorld={...message.data,customWings:wings};message.data=this.wireWorld;}
      if(message.type==='wing-catalog'&&this.wireWorld){this.wireWorld={...this.wireWorld,customWings:mergeWingCatalog(this.wireWorld.customWings||[],message.data?.wings||[])};}
      if(message.type==='world-patch'){
       const next=applyWorldPatch(this.wireWorld,message.data);
       if(next){this.wireWorld=next;this.dispatch('world',next);}
       else if(socket===this.socket&&message.data.revision>(this.wireWorld?.revision??-1))socket.close(4002,'World baseline changed');
       return;
      }
      this.dispatch(message.type,message.data);
     }catch(error){console.warn('Temple socket message',error);}};socket.onclose=event=>{this.rejectCombatSocket(socket);clearTimeout(timer);this.dispatch('connection',{connected:false,code:event.code});if(!this.closedByUser)this.scheduleReconnect();};});
  }
  scheduleReconnect(){clearTimeout(this.reconnectTimer);const delay=Math.min(12_000,600*2**this.reconnectAttempt++);this.reconnectTimer=setTimeout(()=>this.connect().catch(()=>this.scheduleReconnect()),delay);}
  sendState(state){
    const now=performance.now();
    if(now-this.lastStateAt<90||this.socket?.readyState!==WebSocket.OPEN)return;
    const seq=++this.stateSequence;
    this.lastStateAt=now;
    this.sentStates.set(seq,{position:[...state.position],sentAt:now});
    // The history is bounded and records the exact state the Worker saw,
    // allowing delayed rejection replies to be rebased rather than snapping
    // the local player back to a previous animation frame.
    while(this.sentStates.size>64)this.sentStates.delete(this.sentStates.keys().next().value);
    this.socket.send(JSON.stringify({type:'state',data:{...state,seq}}));
  }
  acknowledgeState(data){
    const seq=Number(data?.seq)||0;
    if(!seq)return;
    // Match an authoritative correction to the submitted sample, not the current frame.
    if(data&&this.sentStates.has(seq))data.submitted=[...this.sentStates.get(seq).position];
    if(data?.corrected)this.noteMotionError({kind:'corrected-ack',seq,serverTime:data.serverTime,
      distance:Array.isArray(data.position)&&Array.isArray(data.submitted)?
       Math.hypot(...data.position.map((v,i)=>v-data.submitted[i])):null});
    this.lastAcceptedSequence=Math.max(this.lastAcceptedSequence,seq);
    this.lastAuthorityAt=performance.now();
    for(const key of this.sentStates.keys())if(key<=seq)this.sentStates.delete(key);
  }
  noteMotionError(entry){
    this.motionDiagnostics.push({...entry,receivedAt:Date.now()});
    if(this.motionDiagnostics.length>12)this.motionDiagnostics.shift();
  }
  rejectedState(data){
    const sample=this.sentStates.get(Number(data?.seq)||0);
    this.noteMotionError({kind:'rejected',seq:Number(data?.seq)||0,
      error:String(data?.error||'Unknown'),serverTime:data?.serverTime,
      distance:sample&&Array.isArray(data?.state?.position)?
       Math.hypot(...sample.position.map((v,i)=>v-data.state.position[i])):null});
    const label=String(data?.error||'Unknown');
    this.rejectionCounts[label]=(this.rejectionCounts[label]||0)+1;
  }
  combatSocketRequest(socket,body){
   return new Promise((resolve,reject)=>{
    const id=body.requestId;
    const timer=setTimeout(()=>{this.combatPending.delete(id);reject(Error('Attack acknowledgement timed out'));},8000);
    this.combatPending.set(id,{socket,resolve,reject,timer});
    try{socket.send(JSON.stringify({type:'combat-action',data:body}));}
    catch(error){clearTimeout(timer);this.combatPending.delete(id);reject(Error('Cannot send attack to the Temple server'));}
   });
  }
  resolveCombatSocket(socket,message){
   const pending=this.combatPending.get(message?.requestId);
   if(!pending||pending.socket!==socket)return;
   clearTimeout(pending.timer);this.combatPending.delete(message.requestId);
   if(message.status>=200&&message.status<300)pending.resolve(message.result);
   else pending.reject(Error(message.result?.error||'Temple server '+message.status));
  }
  rejectCombatSocket(socket){
   for(const [id,pending] of this.combatPending){if(pending.socket!==socket)continue;clearTimeout(pending.timer);this.combatPending.delete(id);pending.reject(Error('Combat connection interrupted'));}
  }
  spacePaintRaster(id){
   this.rasterRequests??=new Map();this.rasterQueue??=[];this.rasterActive??=0;
   const existing=this.rasterRequests.get(id);if(existing)return existing;
   const task=new Promise((resolve,reject)=>this.rasterQueue.push({id,resolve,reject,base:this.base,token:this.token}));
   this.rasterRequests.set(id,task);this.drainSpacePaintRasters();return task;
  }
  drainSpacePaintRasters(){
   while(this.rasterActive<4&&this.rasterQueue.length){
    const job=this.rasterQueue.shift();this.rasterActive++;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    fetch(job.base+'/api/space-paint-raster/'+encodeURIComponent(job.id),{headers:{Authorization:'Bearer '+job.token},signal:controller.signal})
     .then(response=>{if(!response.ok)throw Error('3D surface checkpoint unavailable');return response.arrayBuffer();})
     .then(bytes=>job.resolve(new Uint8Array(bytes)),job.reject).finally(()=>{clearTimeout(timeout);this.rasterRequests.delete(job.id);this.rasterActive--;this.drainSpacePaintRasters();});
   }
  }
  async action(action,data={},options={}){
   if(!this.paintOwnershipV115&&(['gm-erase-3d','gm-edit-3d','paint-space-surface'].includes(action)||(['paint-building','paint-disc'].includes(action)&&data.stroke?.tool==='eraser')))throw Error('Paint ownership update is not active on this server. Reconnect after update.');
   const compactCombat=action==='attack'&&this.compactCombat&&this.socket?.readyState===WebSocket.OPEN;
   const started=performance.now();
   const fastAction=this.fastActionsV087&&isRealtimeAction(action)&&this.socket?.readyState===WebSocket.OPEN;
   const body={action,requestId:crypto.randomUUID(),...data,...(compactCombat?{compactCombat:true}:{}),...(fastAction?{fastActionV087:true}:{})};
   // V035 used the independent HTTP mutation path for combat. Keep motion,
   // inventory and pickup traffic on the realtime socket; do not queue attacks behind them.
   const socket=!options.preferHttp&&(fastAction||(compactCombat&&this.combatSocketActions))?this.socket:null;
   // Do not replay a transmitted attack after a timeout or disconnect. The
   // server may already have committed it. A new input can use HTTP until
   // the negotiated realtime transport is ready again.
   const result=await (socket?this.combatSocketRequest(socket,body):this.request('/api/action',{
    method:'POST',body,
    timeoutMs:['gm-wing-publish','gm-wing-update','redeem-wing-design'].includes(action)?30000:0
   }));
   this.actionTimings.push({action,phase:data.phase||null,transport:socket?'ws':'http',elapsedMs:Math.round(performance.now()-started),at:Date.now()});
   if(this.actionTimings.length>64)this.actionTimings.shift();
   if(result.worldRevision>(this.wireWorld?.revision??-1)){
    // Stream interruptions must not strand a completed action. This is a
    // presentation recovery only; do not alter the socket's patch baseline.
    this.pendingCombatRevision=Math.max(result.worldRevision,this.pendingCombatRevision||0);
    if(!this.combatSyncTimer)this.combatSyncTimer=setTimeout(()=>{
     this.combatSyncTimer=0;
     const revision=this.pendingCombatRevision;this.pendingCombatRevision=0;
     if(!this.closedByUser&&revision>(this.wireWorld?.revision??-1))
      void this.world().then(data=>this.dispatch('world',data.world)).catch(()=>{});
    },850);
   }
   return result;
  }
  async chat(text){return this.request('/api/chat',{method:'POST',body:{text}});}
  async gmChatHistory(cursor){const params=new URLSearchParams();if(cursor){params.set('beforeTime',String(cursor.time));params.set('beforeId',cursor.id);}return this.request('/api/gm/chat'+(cursor?'?'+params:''));}
  async createSaveCode(){return this.request('/api/save-code',{method:'POST',body:{}});}
  async gmPresence(){return this.request('/api/gm/presence');}
  async changeRole(role){const body=typeof role==='string'?{role}:role;return this.request('/api/role',{method:'POST',body});}
  world(){
   // Recovery can be requested by several actions while one HTTP snapshot
   // is already in flight. Share only the read, scoped to the current session.
   const key=this.base+'|'+this.token;
   if(this.worldRead?.key===key)return this.worldRead.promise;
   const read={key,promise:null};
   read.promise=this.request('/api/world').finally(()=>{if(this.worldRead===read)this.worldRead=null;});
   this.worldRead=read;return read.promise;
  }
  async request(path,{method='GET',body,auth=true,identityToken='',timeoutMs=0}={}){
    const headers={'Content-Type':'application/json'};if(identityToken)headers.Authorization=`Bearer ${identityToken}`;else if(auth&&this.token)headers.Authorization=`Bearer ${this.token}`;
    const controller=timeoutMs>0?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    let response;
    try{response=await fetch(this.base+path,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),...((path==='/health'||path.startsWith('/api/wanted'))?{cache:'no-store'}:{}),
      ...(controller?{signal:controller.signal}:{})
    });}
    catch(error){
      if(error?.name==='AbortError')throw new Error(path==='/api/join'?'Sign-in timed out. Retry your connection.':'伺服器上架回覆逾時；請確認上架清單後重試');
      throw new Error('Cannot reach the Temple server');
    }finally{if(timer!==null)clearTimeout(timer);}
    let data={};try{data=await response.json();}catch{}if(!response.ok)throw new Error(data.error||`Temple server ${response.status}`);return data;
  }
  dispatch(type,data){this.dispatchEvent(new CustomEvent(type,{detail:data}));}
  close(){
    this.closedByUser=true;this.worldRead=null;clearTimeout(this.reconnectTimer);clearTimeout(this.combatSyncTimer);this.combatSyncTimer=0;this.pendingCombatRevision=0;if(this.socket)this.rejectCombatSocket(this.socket);if(this.socket?.readyState<2)this.socket.close(1000,'Leaving Temple');this.socket=null;
    if(!this.token||!this.base)return;const url=`${this.base}/api/disconnect?token=${encodeURIComponent(this.token)}`;
    if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob(['{}'],{type:'text/plain;charset=UTF-8'}));return;}
    fetch(url,{method:'POST',body:'{}',keepalive:true}).catch(()=>{});
  }
}
