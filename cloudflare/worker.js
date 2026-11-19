import {initializeArtMedia,uploadArtMedia,getArtMedia} from './art-media.js';
import {initializeWingOrders,wingPaymentStatus,wingCheckoutApi,wingOrderStatus,wingNotifyApi} from './ecpay-wing-payments.js';
import {verifyFirebaseIdToken,firebaseWebConfig,firebaseProfileKey,isFirebaseGm} from './firebase-auth.js';
import {recoverArtworks} from '../src/shared/artwork-recovery.js';
import {resetPlayerArtworks} from '../src/shared/art-bomb.js';
import {DurableObject} from 'cloudflare:workers';
import {applyAction,createInitialWorld,ensureProfile,migrateWorld,publicProfile,releasePlayerWorldState,tickWorld,validateState,validColor,validName,worldView,MAX_FIGHTERS,MAX_SPECTATORS} from '../src/shared/temple-rules.js';
import {PLAYER_SPAWNS} from '../src/shared/arena.js';
import {playerStats} from '../src/shared/player-stats.js';

const MUSIC_CHUNK_BYTES=512*1024,MAX_GM_MUSIC_BYTES=7_500_000;
const ROOM_ID='temple-main-v1',SESSION_MS=24*60*60*1000,SAVE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FIGHTER_SEATS=Array.from({length:MAX_FIGHTERS},(_,i)=>i);
const SPECTATOR_SEATS=Array.from({length:MAX_SPECTATORS},(_,i)=>MAX_FIGHTERS+i);

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/health')return withCors(request,json({ok:true,service:'Temple',room:ROOM_ID,database:'durable-object-sqlite',realtime:'websocket',apiVersion:3,features:{artMediaUpload:true,artBombPlace:true,gmReset:true}}),env);
    if(url.pathname.startsWith('/api/wing-pay/'))return env.TEMPLE_ROOM.getByName(ROOM_ID).fetch(request);
    if(url.pathname.startsWith('/api/'))return env.TEMPLE_ROOM.getByName(ROOM_ID).fetch(request);
    return env.ASSETS.fetch(request);
  }
};

export class TempleRoom extends DurableObject{
  constructor(ctx,env){
    super(ctx,env);this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;this.closed=new Set();this.lastTick=0;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS world_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, profile_key TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, role TEXT NOT NULL, seat INTEGER NOT NULL, expires INTEGER NOT NULL, state TEXT, save_code TEXT, last_code_at INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS save_codes (code TEXT PRIMARY KEY, profile_key TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_used INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, profile_key TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, time INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS presence_events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL, event TEXT NOT NULL, time INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS request_receipts (session_id TEXT NOT NULL, request_id TEXT NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(session_id,request_id));
      CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS plant_media (id TEXT PRIMARY KEY, owner TEXT NOT NULL, type TEXT NOT NULL, data BLOB NOT NULL, created_at INTEGER NOT NULL);
       CREATE TABLE IF NOT EXISTS gm_music_meta (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, bytes INTEGER NOT NULL, chunks INTEGER NOT NULL);
       CREATE TABLE IF NOT EXISTS gm_music_chunks (version INTEGER NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY(version,part));
    `);
    initializeArtMedia(this.sql);
     initializeWingOrders(this.sql);
    if(!this.sql.exec('SELECT id FROM world_state WHERE id=1').toArray().length)this.sql.exec('INSERT INTO world_state VALUES(1,?)',JSON.stringify(createInitialWorld()));
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }

  world(){return migrateWorld(JSON.parse(this.sql.exec('SELECT payload FROM world_state WHERE id=1').toArray()[0]?.payload||'{}'));}
  save(world){this.sql.exec('INSERT OR REPLACE INTO world_state VALUES(1,?)',JSON.stringify(world));}
  session(token){if(!token)return null;return this.sql.exec('SELECT * FROM sessions WHERE id=? AND expires>?',token,Date.now()).toArray()[0]||null;}
  token(request,url){return request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]||url.searchParams.get('token')||'';}
  sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===1&&!this.closed.has(ws));}
  allowed(request){return originAllowed(request,this.env);}

  async fetch(request){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='OPTIONS')return withCors(request,new Response(null,{status:204}),this.env);
    if(!this.allowed(request))return withCors(request,json({error:'Origin is not allowed'},403),this.env);
    try{
      if(path==='/api/wing-pay/notify')return withCors(request,await wingNotifyApi(this,request),this.env);
      if(path==='/api/firebase/config'&&request.method==='GET')
       return withCors(request,json(firebaseWebConfig(this.env)),this.env);
      if(path==='/api/firebase/profile'&&request.method==='POST'){
       let account;try{
        account=await verifyFirebaseIdToken(this.token(request,url),this.env);
       }catch(error){return withCors(request,json({error:'Google 登入驗證失敗：'+error.message},401),this.env);}
       const profile=this.world().profiles[firebaseProfileKey(account)];
       return withCors(request,json({
        existing:!!profile,profile:profile?{name:profile.name,color:profile.color}:null
       }),this.env);
      }
      if(path==='/health')return withCors(request,json({ok:true,service:'TempleRoom',database:'sqlite',players:this.roster().length,apiVersion:3,features:{artMediaUpload:true,artBombPlace:true,gmReset:true}}),this.env);
      if(path==='/api/join'&&request.method==='POST')return withCors(request,await this.join(request),this.env);
       if(path==='/api/gm/music'&&['GET','HEAD'].includes(request.method))return withCors(request,this.gmMusicResponse(request,url),this.env);
      if(path.startsWith('/api/art-media/')&&request.method==='GET')return withCors(request,getArtMedia(this.sql,path.slice(15),request),this.env);
      if(path.startsWith('/api/media/')&&request.method==='GET'){
        const media=this.sql.exec('SELECT type,data FROM plant_media WHERE id=?',path.slice(11)).toArray()[0];
        return withCors(request,media?new Response(media.data,{headers:{'Content-Type':media.type,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=31536000,immutable'}}):json({error:'Media missing'},404),this.env);
      }
      const token=this.token(request,url),session=this.session(token);if(!session)return withCors(request,json({error:'Session expired'},401),this.env);
      if(path==='/api/wing-pay/status'&&request.method==='GET'){
       const profile=this.world().profiles[session.profile_key];
       return withCors(request,json(wingPaymentStatus(this.env,!!profile?.admin)),this.env);
      }
      if(path==='/api/wing-pay/checkout'&&request.method==='POST')return withCors(request,await wingCheckoutApi(this,request,session),this.env);
      if(path==='/api/wing-pay/order'&&request.method==='GET')return withCors(request,wingOrderStatus(this,request,session),this.env);
      if(path==='/api/art-media'&&request.method==='POST')return withCors(request,await uploadArtMedia(request,session,this),this.env);
      if(path==='/api/socket')return this.connect(request,session,token);
      if(path==='/api/media'&&request.method==='POST')return withCors(request,await this.uploadMedia(request,session),this.env);
       if(path==='/api/gm/music'&&request.method==='POST')return withCors(request,await this.uploadGmMusic(request,session),this.env);
      if(path==='/api/world'&&request.method==='GET')return withCors(request,json({world:worldView(this.world(),session.profile_key),players:this.roster(),self:this.self(session)}),this.env);
      if(path==='/api/gm/presence'&&request.method==='GET')return withCors(request,this.gmPresence(session),this.env);
      if(path==='/api/action'&&request.method==='POST')return withCors(request,await this.action(request,session),this.env);
      if(path==='/api/role'&&request.method==='POST')return withCors(request,await this.changeRole(request,session),this.env);
      if(path==='/api/save-code'&&request.method==='POST')return withCors(request,await this.saveCode(session),this.env);
      if(path==='/api/chat'&&request.method==='GET')return withCors(request,json(this.sql.exec('SELECT id,name,text,time FROM chat_messages ORDER BY time DESC LIMIT 100').toArray().reverse()),this.env);
      if(path==='/api/chat'&&request.method==='POST')return withCors(request,await this.chat(request,session),this.env);
      if(path==='/api/disconnect'&&request.method==='POST'){this.disconnectSession(session.id);return withCors(request,json({ok:true}),this.env);}
      return withCors(request,json({error:'API not found'},404),this.env);
    }catch(error){console.error('TempleRoom',error?.stack||error);return withCors(request,json({error:'Request failed'},500),this.env);}
  }

  async join(request){
    const clientKey=request.headers.get('CF-Connecting-IP')||
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()||'local';
    const firebaseEnabled=!!this.env.FIREBASE_PROJECT_ID;
    const localHost=/^(localhost|127\.0\.0\.1)$/.test(new URL(request.url).hostname);
    if(!firebaseEnabled&&!localHost)
      return json({error:'Firebase Google 登入尚未設定，暫停公開登入'},503);
    if(!this.consumeRate('join:'+clientKey,firebaseEnabled?40:240,60_000))
      return json({error:'Too many join attempts'},429);
    const body=await readBody(request,8_000);
    let identity=null;
    if(firebaseEnabled){
      try{identity=await verifyFirebaseIdToken(this.token(request,new URL(request.url)),this.env);}
      catch(error){return json({error:'必須透過 Firebase Google 帳號登入：'+error.message},401);}
    }
    // Guest entry is restricted to localhost only while Firebase has not been
    // configured, so CI/local WebGL smoke tests keep working. Public entry
    // always requires a verified Firebase Google identity.
    const memory=identity?'':String(body.memoryCode||body.saveCode||'').trim();
    const admin=identity?isFirebaseGm(identity,this.env):
      body.name==='Ely'&&memory.length>0&&
      constantTime(memory,String(this.env.TEMPLE_ADMIN_KEY||''));
    const saveCode=identity||admin?'':normalizeCode(memory);
    if(!identity&&saveCode==='INVALID')return json({error:'Invalid legacy save code'},400);
    const saved=saveCode?this.sql.exec('SELECT * FROM save_codes WHERE code=?',saveCode).toArray()[0]:null;
    if(saveCode&&!saved){
      if(!this.consumeRate('save:'+clientKey,8,60_000))
        return json({error:'Too many save-code attempts'},429);
      return json({error:'Save code not found'},404);
    }
    const profileKey=identity?firebaseProfileKey(identity):
      saved?.profile_key||'guest:'+crypto.randomUUID();
    const world=this.world();
    let existing=world.profiles?.[profileKey];
    // Preserve the original GM inventory/works/progression when the securely
    // configured Firebase GM UID logs in for the first time. Keep source copy.
    if(identity&&admin&&!existing?.admin){
      const oldEntry=Object.entries(world.profiles||{}).find(([key,p])=>
        key!==profileKey&&p?.admin===true&&p?.name==='Ely');
      if(oldEntry){
        world.profiles[profileKey]={...structuredClone(oldEntry[1]),key:profileKey,admin:true};
        existing=world.profiles[profileKey];
      }
    }
    const name=admin?'Ely':existing?.name||body.name;
    const color=existing?.color||body.color;
    if(!validName(name)||!validColor(color))
      return json({error:'首次登入請先設定角色名稱和顏色'},400);
    if(!admin&&name.trim().toLowerCase()==='ely')
      return json({error:'This name is reserved for the GM'},403);
    this.prune();
    const now=Date.now(),occupied=this.sql.exec(
      'SELECT role,seat FROM sessions WHERE expires>? ORDER BY seat',now).toArray();
    const fighterSeats=new Set(occupied.filter(r=>r.role==='fighter').map(r=>r.seat));
    const spectatorSeats=new Set(occupied.filter(r=>r.role==='spectator').map(r=>r.seat));
    let role='fighter',seat=FIGHTER_SEATS.find(i=>!fighterSeats.has(i));
    if(seat===undefined){role='spectator';seat=SPECTATOR_SEATS.find(i=>!spectatorSeats.has(i));}
    if(seat===undefined)return json({error:'Temple is full (4 fighters + 100 spectators)'},409);
    const id=crypto.randomUUID(),expires=now+SESSION_MS;
    const profile=ensureProfile(world,profileKey,existing?null:name,
      existing?null:color,now,admin);
    if(admin)profile.name='Ely';
    for(const row of this.sql.exec('SELECT id FROM sessions WHERE profile_key=?',profileKey).toArray())
      this.disconnectSession(row.id,false);
    this.ctx.storage.transactionSync(()=>{
      this.save(world);
      this.sql.exec(
       'INSERT INTO sessions(id,profile_key,name,color,role,seat,expires,state,save_code,last_code_at) VALUES(?,?,?,?,?,?,?,?,?,0)',
       id,profileKey,profile.name,profile.color,role,seat,expires,null,saveCode||null);
      if(saved)this.sql.exec('UPDATE save_codes SET last_used=? WHERE code=?',now,saveCode);
    });
    this.recordPresence({name:profile.name,role},'online',now);
    // Spawn the real uncle / flower rigs before the first world response.
    // Waiting for a later socket tick can leave a freshly joined arena empty.
    if(role==='fighter'){
      tickWorld(world,{now,activeFighters:1,actors:[]});this.save(world);
    }
    this.broadcastRoster();await this.armAlarm();
    return json({
      ok:true,token:id,role,seat,saveCode:saveCode||null,
      authMode:identity?'firebase':'legacy',
      self:this.self(this.session(id)),world:worldView(world,profileKey),players:this.roster()
    });
  }

  connect(request,session,token){
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
    for(const ws of this.ctx.getWebSockets(session.id)){this.closed.add(ws);try{ws.close(1000,'Reconnected');}catch{}}
    const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server,[session.id]);server.serializeAttachment({sessionId:session.id,profileKey:session.profile_key,role:session.role,seat:session.seat,lastStateAt:0});
    server.send(JSON.stringify({type:'welcome',data:{self:this.self(session),players:this.roster(),world:worldView(this.world(),session.profile_key)}}));this.broadcastRoster();this.armAlarm();
    return new Response(null,{status:101,webSocket:client});
  }

  async changeRole(request,session){
    const body=await readBody(request,2_000),target=body.role;if(!['fighter','spectator'].includes(target))return json({error:'Choose fighter or spectator'},400);if(target===session.role)return json({ok:true,role:session.role,seat:session.seat,self:this.self(session),players:this.roster()});
    const occupied=this.sql.exec('SELECT role,seat FROM sessions WHERE expires>? AND id<>?',Date.now(),session.id).toArray(),seats=target==='fighter'?FIGHTER_SEATS:SPECTATOR_SEATS,used=new Set(occupied.filter(row=>row.role===target).map(row=>row.seat)),seat=seats.find(value=>!used.has(value));if(seat===undefined)return json({error:target==='fighter'?'All fighter seats are occupied':'All spectator seats are occupied'},409);
    this.sql.exec('UPDATE sessions SET role=?,seat=?,state=NULL,expires=? WHERE id=?',target,seat,Date.now()+SESSION_MS,session.id);for(const ws of this.ctx.getWebSockets(session.id)){const meta=ws.deserializeAttachment()||{};ws.serializeAttachment({...meta,role:target,seat});}
    const updated=this.session(session.id);this.broadcastRoster();return json({ok:true,role:target,seat,self:this.self(updated),players:this.roster(),world:worldView(this.world(),updated.profile_key)});
  }

  async webSocketMessage(ws,message){
    const meta=ws.deserializeAttachment();if(!meta||this.closed.has(ws))return;const session=this.session(meta.sessionId);if(!session){this.closed.add(ws);ws.close(4001,'Session expired');return;}
    let event;try{event=JSON.parse(String(message));}catch{return;}if(event.type!=='state')return;
    // Spectators move their free camera locally; only four fighters send
    // authoritative pose streams. Do not fan out up to 100 viewer cameras.
    if(session.role!=='fighter')return;
    const now=Date.now();if(now-meta.lastStateAt<70)return;const previous=session.state?JSON.parse(session.state):null,world=this.world(),profile=world.profiles[session.profile_key],mobility=profile?{stats:playerStats(world,profile,now),channeling:!!profile.channelWeapon,effects:profile.effects,hitReaction:profile.hitReaction,impulse:profile.impulse,lastRespawnAt:profile.lastRespawnAt,lastWriteLanding:profile.lastWriteLanding,lastWriteLandingAt:profile.lastWriteLandingAt,cityDamage:world.cityDamage}:null,result=validateState(previous,event.data,now-meta.lastStateAt,session.role,PLAYER_SPAWNS[session.seat],profile?.writeJourney,now,mobility);
    const seq=Number.isSafeInteger(event.data?.seq)&&event.data.seq>0?event.data.seq:0;
    if(result.error){
      // Reject the specific input sample, not an unspecified older pose:
      // delayed responses otherwise snap a player back every few strides.
      ws.send(JSON.stringify({type:'state-rejected',data:{error:result.error,state:result.state||previous||null,seq,serverTime:now}}));
      return;
    }
    meta.lastStateAt=now;ws.serializeAttachment(meta);this.sql.exec('UPDATE sessions SET state=?,expires=? WHERE id=?',JSON.stringify(result.state),now+SESSION_MS,session.id);
    // Send a lightweight acknowledgement directly to this fighter. The
    // normal state broadcast still excludes its sender, as before.
    if(seq)ws.send(JSON.stringify({type:'state-ack',data:{seq,serverTime:now,
      corrected:Array.isArray(result.state?.position)&&Array.isArray(event.data?.position)&&
      Math.hypot(...result.state.position.map((v,i)=>v-event.data.position[i]))>.18,
      position:result.state.position}}));
    this.broadcast('state',{id:session.id,key:session.profile_key,name:session.name,color:session.color,role:session.role,seat:session.seat,state:result.state},ws);await this.tick(true);
  }
  webSocketClose(ws){this.releaseClosedSocket(ws);this.broadcastRoster();}
  webSocketError(ws){this.releaseClosedSocket(ws);try{ws.close(1011,'Socket error');}catch{}this.broadcastRoster();}

  releaseClosedSocket(ws){
    const meta=ws.deserializeAttachment();this.closed.add(ws);if(!meta?.sessionId)return;
    const replacement=this.ctx.getWebSockets(meta.sessionId).some(other=>other!==ws&&other.readyState===1&&!this.closed.has(other));
    if(!replacement)this.sql.exec('UPDATE sessions SET expires=MIN(expires,?) WHERE id=?',Date.now()+45_000,meta.sessionId);
  }

  async action(request,session){
    const body=await readBody(request,320_000),requestId=String(body.requestId||'');if(!/^[A-Za-z0-9:_-]{8,100}$/.test(requestId))return json({error:'Valid requestId required'},400);
    const receipt=this.sql.exec('SELECT response FROM request_receipts WHERE session_id=? AND request_id=?',session.id,requestId).toArray()[0];if(receipt)return json(JSON.parse(receipt.response));
     if(body.action==='paint-building'&&!this.consumeRate('paint:'+session.profile_key,180,60_000))return json({error:'Painting rate limit reached'},429);
    const state=session.state?JSON.parse(session.state):null;if(!state?.position)return json({error:'Connect and enter the Temple first'},409);
    const world=this.world(),actor={key:session.profile_key,name:session.name,color:session.color,role:session.role,admin:!!world.profiles[session.profile_key]?.admin,position:state.position},actors=this.actors();
    delete body.verifiedArtMedia;if(body.action==='add-artwork'||body.action==='publish-art-bomb'){const media=this.sql.exec('SELECT id,type,owner FROM art_media WHERE id=?',String(body.artwork?.mediaId||'')).toArray()[0];if(!media||media.owner!==session.profile_key||body.action==='add-artwork'&&!actor.admin||body.action==='publish-art-bomb'&&session.role!=='fighter')return json({error:'Upload your own validated artwork with the required role first'},403);body.verifiedArtMedia={id:media.id,type:media.type};}
    if(body.media||body.surface){const mediaId=body.media?.id||body.surface,media=this.sql.exec('SELECT id,type,owner FROM plant_media WHERE id=?',mediaId).toArray()[0];if(!media||media.owner!==session.profile_key||body.surface&&!media.type.startsWith('image/'))return json({error:'Upload your own media first'},400);if(body.media)body.media={id:media.id,type:media.type};}
    const previousRespawnAt=world.profiles[session.profile_key]?.lastRespawnAt||0;
    const result=applyAction(world,actor,body,{now:Date.now(),actors,seatIndex:session.seat});if(result.error)return json({error:result.error},400);
    // Handle explicit or login-time revivals during an HTTP action too.
    const newProfile=world.profiles[session.profile_key];
    const didRespawn=(newProfile?.lastRespawnAt||0)>previousRespawnAt;
    if(didRespawn){
     const next={position:[...newProfile.respawnPosition],rotation:0,animation:'idle',visible:true};
     this.sql.exec('UPDATE sessions SET state=? WHERE id=?',JSON.stringify(next),session.id);
    }
    const response={ok:true,...result,world:worldView(world,session.profile_key,Date.now(),['gm-wing-publish','gm-wing-update','gm-wing-remove','gm-wing-set-rate','redeem-wing-design'].includes(body.action))};
    this.ctx.storage.transactionSync(()=>{
      this.save(world);
      if(body.action==='reset-player-artworks'&&Array.isArray(result.removedArtworkMediaIds)){
        for(const mediaId of result.removedArtworkMediaIds){
          this.sql.exec('DELETE FROM art_media_chunks WHERE id=?',mediaId);
          this.sql.exec('DELETE FROM art_media WHERE id=?',mediaId);
        }
      }
      this.sql.exec('INSERT INTO request_receipts VALUES(?,?,?,?)',session.id,requestId,JSON.stringify(response),Date.now());
      this.sql.exec('DELETE FROM request_receipts WHERE created_at<?',Date.now()-86_400_000);
    });
    if(result.resetMessages){
      this.sql.exec('DELETE FROM chat_messages');
      // Reset must remove prior messages from *every* connected client's UI.
      this.broadcast('chat-reset',{time:Date.now()});
    }
    if(result.publishedWingId||result.unpublishedWingId||result.updatedWingId||result.personalWingId)
      this.broadcast('wing-catalog',{wings:world.customWings||[]});
    this.broadcastWorld(world);if(didRespawn)this.broadcastRoster();if(result.throwEvent)this.broadcast('artwork-throw',result.throwEvent);if(result.attackEvent)this.broadcast('attack',result.attackEvent);if(result.channelStopped)this.broadcast('channel-stop',result.channelStopped);for(const hit of result.structureHits||(result.structureHit?[result.structureHit]:[]))this.broadcast('structure-hit',hit);for(const broken of result.structureDestroyedEvents||(result.structureDestroyed?[result.structureDestroyed]:[]))this.broadcast('structure-destroyed',broken);await this.armAlarm();return json(response);
  }

  async saveCode(session){
    const now=Date.now();if(session.save_code)return json({ok:true,code:session.save_code});if(now-session.last_code_at<60_000)return json({error:'Wait before requesting another code'},429);
    let code;for(let attempt=0;attempt<64;attempt++){code=randomCode();if(!this.sql.exec('SELECT code FROM save_codes WHERE code=?',code).toArray().length)break;code=null;}if(!code)return json({error:'Could not allocate a save code'},503);
    this.ctx.storage.transactionSync(()=>{this.sql.exec('INSERT INTO save_codes VALUES(?,?,?,?)',code,session.profile_key,now,now);this.sql.exec('UPDATE sessions SET save_code=?,last_code_at=? WHERE id=?',code,now,session.id);});return json({ok:true,code});
  }

  gmMusicResponse(request,url){
    const meta=this.sql.exec('SELECT version,bytes,chunks FROM gm_music_meta WHERE id=1').toArray()[0];
    if(!meta)return json({error:'GM soundtrack has not been uploaded'},404);
    const size=Number(meta.bytes),range=request.headers.get('Range');
    let start=0,end=size-1,status=200;
    if(range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if(!match||(!match[1]&&!match[2]))
        return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
      if(!match[1]){const suffix=Number(match[2]);start=Math.max(0,size-suffix);}
      else {start=Number(match[1]);if(match[2])end=Math.min(size-1,Number(match[2]));}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)
        return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
      status=206;
    }
    const headers=new Headers({'Content-Type':'audio/mpeg','Accept-Ranges':'bytes',
      'Content-Length':String(end-start+1),'X-Content-Type-Options':'nosniff',
      'Cache-Control':url.searchParams.get('v')===String(meta.version)?
        'public,max-age=31536000,immutable':'no-store'});
    if(status===206)headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
    if(request.method==='HEAD')return new Response(null,{status,headers});
    const out=new Uint8Array(end-start+1),first=Math.floor(start/MUSIC_CHUNK_BYTES),last=Math.floor(end/MUSIC_CHUNK_BYTES);
    const records=this.sql.exec(
      'SELECT part,data FROM gm_music_chunks WHERE version=? AND part>=? AND part<=? ORDER BY part',
      meta.version,first,last).toArray();
    if(records.length!==last-first+1)return json({error:'Soundtrack storage incomplete'},503);
    for(const record of records){
      const data=record.data instanceof Uint8Array?record.data:new Uint8Array(record.data),base=record.part*MUSIC_CHUNK_BYTES;
      const a=Math.max(start,base),b=Math.min(end+1,base+data.length);
      out.set(data.subarray(a-base,b-base),a-start);
    }
    return new Response(out,{status,headers});
  }
  async uploadGmMusic(request,session){
    const world=this.world();
    if(!world.profiles?.[session.profile_key]?.admin)return json({error:'GM only'},403);
    if(!this.consumeRate('gm-music:'+session.profile_key,3,60_000))
      return json({error:'Upload limit reached'},429);
    const mime=(request.headers.get('Content-Type')||'').split(';')[0].toLowerCase();
    if(!['audio/mpeg','audio/mp3','application/octet-stream'].includes(mime))
      return json({error:'Only MP3 files are supported'},415);
    const reader=request.body?.getReader();if(!reader)return json({error:'Empty upload'},400);
    const chunks=[];let bytes=0;
    for(;;){const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;if(bytes>MAX_GM_MUSIC_BYTES){
        await reader.cancel();return json({error:'MP3 file exceeds 7.5 MB'},413);
      }chunks.push(value);
    }
    if(bytes<1024)return json({error:'MP3 file is empty or too small'},400);
    const music=new Uint8Array(bytes);let offset=0;
    for(const chunk of chunks){music.set(chunk,offset);offset+=chunk.length;}
    if(!(music[0]===73&&music[1]===68&&music[2]===51)&&
       !(music[0]===255&&(music[1]&224)===224))
      return json({error:'File is not an MP3 stream'},415);
    const before=this.sql.exec('SELECT version FROM gm_music_meta WHERE id=1').toArray()[0];
    const version=Math.max(Date.now(),Number(before?.version||0)+1);
    const partCount=Math.ceil(bytes/MUSIC_CHUNK_BYTES);
    this.ctx.storage.transactionSync(()=>{
      for(let part=0;part<partCount;part++)
        this.sql.exec('INSERT INTO gm_music_chunks(version,part,data) VALUES(?,?,?)',
          version,part,music.slice(part*MUSIC_CHUNK_BYTES,(part+1)*MUSIC_CHUNK_BYTES));
      this.sql.exec('INSERT OR REPLACE INTO gm_music_meta(id,version,bytes,chunks) VALUES(1,?,?,?)',
        version,bytes,partCount);
      this.sql.exec('DELETE FROM gm_music_chunks WHERE version<>?',version);
    });
    world.musicVersion=version;world.revision=(world.revision||0)+1;
    this.save(world);this.broadcastWorld(world);
    return json({ok:true,version,bytes});
  }
  async uploadMedia(request,session){
    if(session.role!=='fighter')return json({error:'Spectators cannot upload'},403);
    if(!this.consumeRate('media:'+session.profile_key,12,60_000))return json({error:'Upload limit reached'},429);
    const type=(request.headers.get('Content-Type')||'').split(';')[0];
    if(!['image/png','image/jpeg','image/webp','audio/mpeg','audio/ogg','audio/webm','video/webm','video/mp4'].includes(type))return json({error:'Unsupported media type'},400);
    const reader=request.body?.getReader(),chunks=[];let length=0;
    if(!reader)return json({error:'Empty upload'},400);
    for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>1_500_000){await reader.cancel();return json({error:'Maximum file size is 1.5 MB'},413);}chunks.push(value);}
    if(!length)return json({error:'Empty upload'},400);
    const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    const id=crypto.randomUUID();this.sql.exec('INSERT INTO plant_media VALUES(?,?,?,?,?)',id,session.profile_key,type,data,Date.now());return json({id,type});
  }

  consumeRate(key,limit,windowMs){
    const now=Date.now(),row=this.sql.exec('SELECT window_start,attempts FROM rate_limits WHERE key=?',key).toArray()[0];if(!row||now-row.window_start>=windowMs){this.sql.exec('INSERT OR REPLACE INTO rate_limits VALUES(?,?,1)',key,now);return true;}if(row.attempts>=limit)return false;this.sql.exec('UPDATE rate_limits SET attempts=attempts+1 WHERE key=?',key);return true;
  }

  async chat(request,session){
    const body=await readBody(request,4_000),text=String(body.text||'').trim();if(!text||text.length>500)return json({error:'Message must contain 1–500 characters'},400);
    // GM commands run on the server and are not stored or broadcast as chat messages.
    if(text==='/recovery'){
      const world=this.world(),result=recoverArtworks(world,world.profiles?.[session.profile_key]?.admin===true);
      if(result.error)return json({error:result.error},403);
      if(result.recovered){this.save(world);this.broadcastWorld(world);}
      return json(result);
    }
    if(/^\/reset$/i.test(text)){
      const world=this.world(),result=resetPlayerArtworks(world,world.profiles?.[session.profile_key]?.admin===true);
      if(result.error)return json({error:result.error},403);
      if(result.removedArtworks){
        this.ctx.storage.transactionSync(()=>{
          this.save(world);
          for(const mediaId of result.removedArtworkMediaIds||[]){
            this.sql.exec('DELETE FROM art_media_chunks WHERE id=?',mediaId);
            this.sql.exec('DELETE FROM art_media WHERE id=?',mediaId);
          }
        });
        this.broadcastWorld(world);
      }
      return json({ok:true,notice:result.notice,removedArtworks:result.removedArtworks});
    }
    if(/^\/(?:reset\s+(?:building|message)|clean\s+graffic|clean\s+graffiti)$/i.test(text)){
      const gm=this.world().profiles?.[session.profile_key]?.admin===true;
      if(!gm)return json({error:'GM only'},403);
      const world=this.world(),which=/^\/clean\s+(?:graffic|graffiti)$/i.test(text)?'clean-graffiti':/building$/i.test(text)?'reset-buildings':'reset-messages';
      const actor={key:session.profile_key,name:session.name,color:session.color,
       role:session.role,admin:true,position:JSON.parse(session.state||'{}').position||[0,0,0]};
      const result=applyAction(world,actor,{action:which},{now:Date.now(),actors:[]});
      if(result.error)return json({error:result.error},403);
      this.ctx.storage.transactionSync(()=>{
       this.save(world);
       if(result.resetMessages)this.sql.exec('DELETE FROM chat_messages');
      });
      if(result.resetMessages)this.broadcast('chat-reset',{time:Date.now()});
      this.broadcastWorld(world);return json({ok:true,...result});
    }
    const recent=this.sql.exec('SELECT time FROM chat_messages WHERE profile_key=? ORDER BY time DESC LIMIT 1',session.profile_key).toArray()[0];if(recent&&Date.now()-recent.time<500)return json({error:'Please wait before sending again'},429);
    const message={id:crypto.randomUUID(),profileKey:session.profile_key,name:session.name,text,time:Date.now()};this.sql.exec('INSERT INTO chat_messages VALUES(?,?,?,?,?)',message.id,message.profileKey,message.name,message.text,message.time);this.sql.exec('DELETE FROM chat_messages WHERE time<?',Date.now()-30*86_400_000);this.broadcast('chat',message);return json({ok:true,message});
  }

  recordPresence(session,event,time=Date.now()){
    this.sql.exec('INSERT INTO presence_events(name,role,event,time) VALUES(?,?,?,?)',session.name,session.role,event,time);
    this.sql.exec('DELETE FROM presence_events WHERE time<? OR id NOT IN (SELECT id FROM presence_events ORDER BY id DESC LIMIT 2000)',time-90*86_400_000);
  }
  gmPresence(session){
    // Authentication must be enforced on the server, not only by hiding the S button.
    if(this.world().profiles?.[session.profile_key]?.admin!==true)return json({error:'GM only'},403);
    this.prune();
    const events=this.sql.exec('SELECT name,role,event,time FROM presence_events ORDER BY id DESC LIMIT 200').toArray();
    const online=this.roster().map(({name,role})=>({name,role}));
    return json({ok:true,online,events});
  }
  roster(){this.prune();const world=this.world();return this.sql.exec('SELECT id,profile_key,name,color,role,seat,state FROM sessions WHERE expires>? ORDER BY seat',Date.now()).toArray().map(row=>({id:row.id,key:row.profile_key,name:row.name,color:row.color,role:row.role,seat:row.seat,state:row.state?JSON.parse(row.state):null,profile:world.profiles[row.profile_key]?publicProfile(world.profiles[row.profile_key]):null}));}
  actors(){return this.roster().filter(player=>player.state?.position).map(player=>({...player,position:player.state.position}));}
  self(session){const world=this.world(),profile=world.profiles[session.profile_key];return {id:session.id,key:session.profile_key,name:session.name,color:session.color,role:session.role,seat:session.seat,saveCode:session.save_code||null,profile:profile?publicProfile(profile):null};}
  prune(){const now=Date.now();for(const row of this.sql.exec('SELECT id FROM sessions WHERE expires<=?',now).toArray())this.disconnectSession(row.id,false);this.sql.exec('DELETE FROM rate_limits WHERE window_start<?',now-3_600_000);}
  disconnectSession(id,broadcast=true){const row=this.sql.exec('SELECT profile_key,name,role FROM sessions WHERE id=?',id).toArray()[0];for(const ws of this.ctx.getWebSockets(id)){this.closed.add(ws);try{ws.close(1000,'Disconnected');}catch{}}this.sql.exec('DELETE FROM sessions WHERE id=?',id);if(row){this.recordPresence(row,'offline');const world=this.world();if(releasePlayerWorldState(world,row.profile_key,Date.now())){this.save(world);this.broadcastWorld(world);}}if(broadcast)this.broadcastRoster();}
  broadcast(type,data,except){const text=JSON.stringify({type,data});for(const ws of this.sockets())if(ws!==except)try{ws.send(text);}catch{this.closed.add(ws);}}
  broadcastRoster(){this.lastRosterAt=Date.now();this.broadcast('players',this.roster());}
  broadcastWorld(world=this.world()){
    const now=Date.now(),updateViewers=now-(this.lastSpectatorWorldAt||0)>=350;
    for(const ws of this.sockets()){
      const meta=ws.deserializeAttachment();
      if(!meta||(meta.role==='spectator'&&!updateViewers))continue;
      try{ws.send(JSON.stringify({type:'world',data:worldView(world,meta.profileKey,now,false)}));}
      catch{this.closed.add(ws);}
    }
    if(updateViewers)this.lastSpectatorWorldAt=now;
    // Fighter HP/name bars need timely updates, but not 104 copies of the
    // full roster on every 70ms weapon-effect tick.
    if(now-(this.lastRosterAt||0)>=800)this.broadcastRoster();
  }
  async tick(fromState=false){
   const now=Date.now(),world=this.world(),movingEffects=(world.persistentAttacks||[]).length>0;
   if(fromState&&now-this.lastTick<(movingEffects?70:500))return;
   this.lastTick=now;
   const actors=this.actors();
   const previousRespawns=new Map(actors.map(actor=>[actor.key,world.profiles[actor.key]?.lastRespawnAt||0]));
   if(tickWorld(world,{now,activeFighters:actors.filter(a=>a.role==='fighter').length,actors})){
    // Artwork impacts are created by the authoritative time-stepped flight,
    // never by the initial throw action. Deliver shakes/collapse only now.
    const artworkVisualEvents=world.pendingArtworkVisualEvents?.splice(0)||[];
    // Do not leave remote replicas or the authoritative actor at the old
    // death location. Move every newly revived fighter into the WRITE hub.
    let respawned=false;
    for(const actor of actors){
     const profile=world.profiles[actor.key];
     if(actor.role!=='fighter'||!profile?.lastRespawnAt||
        profile.lastRespawnAt<=(previousRespawns.get(actor.key)||0))continue;
     const position=profile.respawnPosition||PLAYER_SPAWNS[actor.seat%PLAYER_SPAWNS.length];
     const state={position:[...position],rotation:0,animation:'idle',visible:true};
     this.sql.exec('UPDATE sessions SET state=? WHERE id=?',JSON.stringify(state),actor.id);
     this.broadcast('state',{id:actor.id,key:actor.key,name:actor.name,color:actor.color,
      role:actor.role,seat:actor.seat,state});
     respawned=true;
    }
    this.save(world);this.broadcastWorld(world);
    for(const impact of artworkVisualEvents)
      if(impact?.kind==='structure-hit'||impact?.kind==='structure-destroyed')
       this.broadcast(impact.kind,impact.event);
    if(respawned)this.broadcastRoster();
   }
   await this.armAlarm();
  }
  async alarm(){this.prune();await this.tick();}
  async armAlarm(){if(this.roster().length)await this.ctx.storage.setAlarm(Date.now()+1_000);}
}

function json(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});}
async function readBody(request,limit){const text=await request.text();if(text.length>limit)throw Error('Body too large');try{return JSON.parse(text||'{}');}catch{throw Error('Invalid JSON');}}
function normalizeCode(value){const code=String(value||'').trim().toUpperCase();return code?/^[A-Z2-9]{4}$/.test(code)?code:'INVALID':'';}
function randomCode(){let result='';const bytes=crypto.getRandomValues(new Uint8Array(4));for(const value of bytes)result+=SAVE_ALPHABET[value%SAVE_ALPHABET.length];return result;}
function constantTime(a,b){if(!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function originAllowed(request,env){const origin=request.headers.get('Origin');if(!origin)return true;const configured=String(env.TEMPLE_ALLOWED_ORIGINS||'https://zhenggdove-artist.github.io,http://localhost:8000,http://127.0.0.1:8000,http://127.0.0.1:4173').split(',').map(s=>s.trim());return configured.some(allowed=>origin===allowed||origin.startsWith(allowed+'/')||allowed.endsWith('*')&&origin.startsWith(allowed.slice(0,-1)));}
function withCors(request,response,env){const origin=request.headers.get('Origin');if(origin&&originAllowed(request,env)){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');response.headers.set('Access-Control-Max-Age','86400');}return response;}
