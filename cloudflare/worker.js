import {DurableObject} from 'cloudflare:workers';
import {applyAction,createInitialWorld,ensureProfile,migrateWorld,publicProfile,releasePlayerWorldState,tickWorld,validateState,validColor,validName,worldView} from '../src/shared/temple-rules.js';
import {PLAYER_SPAWNS} from '../src/shared/arena.js';

const ROOM_ID='temple-main-v1',SESSION_MS=24*60*60*1000,SAVE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/health')return withCors(request,json({ok:true,service:'Temple',room:ROOM_ID,database:'durable-object-sqlite',realtime:'websocket'}),env);
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
      CREATE TABLE IF NOT EXISTS request_receipts (session_id TEXT NOT NULL, request_id TEXT NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(session_id,request_id));
      CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL);
    `);
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
      if(path==='/health')return withCors(request,json({ok:true,service:'TempleRoom',database:'sqlite',players:this.roster().length}),this.env);
      if(path==='/api/join'&&request.method==='POST')return withCors(request,await this.join(request),this.env);
      const token=this.token(request,url),session=this.session(token);if(!session)return withCors(request,json({error:'Session expired'},401),this.env);
      if(path==='/api/socket')return this.connect(request,session,token);
      if(path==='/api/world'&&request.method==='GET')return withCors(request,json({world:worldView(this.world(),session.profile_key),players:this.roster(),self:this.self(session)}),this.env);
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
    const clientKey=request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()||'local';if(!this.consumeRate(`join:${clientKey}`,30,60_000))return json({error:'Too many join attempts'},429);
    const body=await readBody(request,8_000);if(!validName(body.name)||!validColor(body.color))return json({error:'Choose a name and color'},400);
    this.prune();const now=Date.now(),saveCode=normalizeCode(body.saveCode),saved=saveCode?this.sql.exec('SELECT * FROM save_codes WHERE code=?',saveCode).toArray()[0]:null;
    if(saveCode&&!saved){if(!this.consumeRate(`save:${clientKey}`,8,60_000))return json({error:'Too many save-code attempts'},429);return json({error:'Save code not found'},404);}
    const admin=typeof body.adminKey==='string'&&body.adminKey.length>0&&constantTime(body.adminKey,String(this.env.TEMPLE_ADMIN_KEY||''));
    const profileKey=saved?.profile_key||`guest:${crypto.randomUUID()}`;
    // One live identity at a time. Rejoining releases the previous seat and socket.
    for(const row of this.sql.exec('SELECT id FROM sessions WHERE profile_key=?',profileKey).toArray())this.disconnectSession(row.id);
    const occupied=this.sql.exec('SELECT role,seat FROM sessions WHERE expires>? ORDER BY seat',now).toArray(),fighterSeats=new Set(occupied.filter(r=>r.role==='fighter').map(r=>r.seat)),spectatorSeats=new Set(occupied.filter(r=>r.role==='spectator').map(r=>r.seat));
    let role='fighter',seat=[0,1,2,3].find(i=>!fighterSeats.has(i));if(seat===undefined){role='spectator';seat=[4,5].find(i=>!spectatorSeats.has(i));}
    if(seat===undefined)return json({error:'Temple is full (4 fighters + 2 spectators)'},409);
    const id=crypto.randomUUID(),expires=now+SESSION_MS,world=this.world(),profile=ensureProfile(world,profileKey,saved?null:admin?'Ely':body.name,saved?null:body.color,now,admin);if(admin)profile.name='Ely';this.save(world);
    this.sql.exec('INSERT INTO sessions(id,profile_key,name,color,role,seat,expires,state,save_code,last_code_at) VALUES(?,?,?,?,?,?,?,?,?,0)',id,profileKey,profile.name,profile.color,role,seat,expires,null,saveCode||null);
    if(saved)this.sql.exec('UPDATE save_codes SET last_used=? WHERE code=?',now,saveCode);
    this.broadcastRoster();await this.armAlarm();return json({ok:true,token:id,role,seat,saveCode:saveCode||null,self:this.self(this.session(id)),world:worldView(world,profileKey),players:this.roster()});
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
    const occupied=this.sql.exec('SELECT role,seat FROM sessions WHERE expires>? AND id<>?',Date.now(),session.id).toArray(),seats=target==='fighter'?[0,1,2,3]:[4,5],used=new Set(occupied.filter(row=>row.role===target).map(row=>row.seat)),seat=seats.find(value=>!used.has(value));if(seat===undefined)return json({error:target==='fighter'?'All fighter seats are occupied':'All spectator seats are occupied'},409);
    this.sql.exec('UPDATE sessions SET role=?,seat=?,state=NULL,expires=? WHERE id=?',target,seat,Date.now()+SESSION_MS,session.id);for(const ws of this.ctx.getWebSockets(session.id)){const meta=ws.deserializeAttachment()||{};ws.serializeAttachment({...meta,role:target,seat});}
    const updated=this.session(session.id);this.broadcastRoster();return json({ok:true,role:target,seat,self:this.self(updated),players:this.roster(),world:worldView(this.world(),updated.profile_key)});
  }

  async webSocketMessage(ws,message){
    const meta=ws.deserializeAttachment();if(!meta||this.closed.has(ws))return;const session=this.session(meta.sessionId);if(!session){this.closed.add(ws);ws.close(4001,'Session expired');return;}
    let event;try{event=JSON.parse(String(message));}catch{return;}if(event.type!=='state')return;
    const now=Date.now();if(now-meta.lastStateAt<70)return;const previous=session.state?JSON.parse(session.state):null,result=validateState(previous,event.data,now-meta.lastStateAt,session.role,PLAYER_SPAWNS[session.seat]);if(result.error){ws.send(JSON.stringify({type:'state-rejected',data:{error:result.error}}));return;}
    meta.lastStateAt=now;ws.serializeAttachment(meta);this.sql.exec('UPDATE sessions SET state=?,expires=? WHERE id=?',JSON.stringify(result.state),now+SESSION_MS,session.id);
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
    const body=await readBody(request,20_000),requestId=String(body.requestId||'');if(!/^[A-Za-z0-9:_-]{8,100}$/.test(requestId))return json({error:'Valid requestId required'},400);
    const receipt=this.sql.exec('SELECT response FROM request_receipts WHERE session_id=? AND request_id=?',session.id,requestId).toArray()[0];if(receipt)return json(JSON.parse(receipt.response));
    const state=session.state?JSON.parse(session.state):null;if(!state?.position)return json({error:'Connect and enter the Temple first'},409);
    const world=this.world(),actor={key:session.profile_key,name:session.name,color:session.color,role:session.role,admin:!!world.profiles[session.profile_key]?.admin,position:state.position},actors=this.actors();
    const result=applyAction(world,actor,body,{now:Date.now(),actors,seatIndex:session.seat});if(result.error)return json({error:result.error},400);
    const response={ok:true,...result,world:worldView(world,session.profile_key)};
    this.ctx.storage.transactionSync(()=>{this.save(world);this.sql.exec('INSERT INTO request_receipts VALUES(?,?,?,?)',session.id,requestId,JSON.stringify(response),Date.now());this.sql.exec('DELETE FROM request_receipts WHERE created_at<?',Date.now()-86_400_000);});
    this.broadcastWorld(world);if(result.throwEvent)this.broadcast('artwork-throw',result.throwEvent);if(result.attackEvent)this.broadcast('attack',result.attackEvent);if(result.structureDestroyed)this.broadcast('structure-destroyed',result.structureDestroyed);await this.armAlarm();return json(response);
  }

  async saveCode(session){
    const now=Date.now();if(session.save_code)return json({ok:true,code:session.save_code});if(now-session.last_code_at<60_000)return json({error:'Wait before requesting another code'},429);
    let code;for(let attempt=0;attempt<64;attempt++){code=randomCode();if(!this.sql.exec('SELECT code FROM save_codes WHERE code=?',code).toArray().length)break;code=null;}if(!code)return json({error:'Could not allocate a save code'},503);
    this.ctx.storage.transactionSync(()=>{this.sql.exec('INSERT INTO save_codes VALUES(?,?,?,?)',code,session.profile_key,now,now);this.sql.exec('UPDATE sessions SET save_code=?,last_code_at=? WHERE id=?',code,now,session.id);});return json({ok:true,code});
  }

  consumeRate(key,limit,windowMs){
    const now=Date.now(),row=this.sql.exec('SELECT window_start,attempts FROM rate_limits WHERE key=?',key).toArray()[0];if(!row||now-row.window_start>=windowMs){this.sql.exec('INSERT OR REPLACE INTO rate_limits VALUES(?,?,1)',key,now);return true;}if(row.attempts>=limit)return false;this.sql.exec('UPDATE rate_limits SET attempts=attempts+1 WHERE key=?',key);return true;
  }

  async chat(request,session){
    const body=await readBody(request,4_000),text=String(body.text||'').trim();if(!text||text.length>500)return json({error:'Message must contain 1–500 characters'},400);
    const recent=this.sql.exec('SELECT time FROM chat_messages WHERE profile_key=? ORDER BY time DESC LIMIT 1',session.profile_key).toArray()[0];if(recent&&Date.now()-recent.time<500)return json({error:'Please wait before sending again'},429);
    const message={id:crypto.randomUUID(),profileKey:session.profile_key,name:session.name,text,time:Date.now()};this.sql.exec('INSERT INTO chat_messages VALUES(?,?,?,?,?)',message.id,message.profileKey,message.name,message.text,message.time);this.sql.exec('DELETE FROM chat_messages WHERE time<?',Date.now()-30*86_400_000);this.broadcast('chat',message);return json({ok:true,message});
  }

  roster(){this.prune();const world=this.world();return this.sql.exec('SELECT id,profile_key,name,color,role,seat,state FROM sessions WHERE expires>? ORDER BY seat',Date.now()).toArray().map(row=>({id:row.id,key:row.profile_key,name:row.name,color:row.color,role:row.role,seat:row.seat,state:row.state?JSON.parse(row.state):null,profile:world.profiles[row.profile_key]?publicProfile(world.profiles[row.profile_key]):null}));}
  actors(){return this.roster().filter(player=>player.state?.position).map(player=>({...player,position:player.state.position}));}
  self(session){const world=this.world(),profile=world.profiles[session.profile_key];return {id:session.id,key:session.profile_key,name:session.name,color:session.color,role:session.role,seat:session.seat,saveCode:session.save_code||null,profile:profile?publicProfile(profile):null};}
  prune(){const now=Date.now();for(const row of this.sql.exec('SELECT id FROM sessions WHERE expires<=?',now).toArray())this.disconnectSession(row.id,false);this.sql.exec('DELETE FROM rate_limits WHERE window_start<?',now-3_600_000);}
  disconnectSession(id,broadcast=true){const row=this.sql.exec('SELECT profile_key FROM sessions WHERE id=?',id).toArray()[0];for(const ws of this.ctx.getWebSockets(id)){this.closed.add(ws);try{ws.close(1000,'Disconnected');}catch{}}this.sql.exec('DELETE FROM sessions WHERE id=?',id);if(row){const world=this.world();if(releasePlayerWorldState(world,row.profile_key,Date.now())){this.save(world);this.broadcastWorld(world);}}if(broadcast)this.broadcastRoster();}
  broadcast(type,data,except){const text=JSON.stringify({type,data});for(const ws of this.sockets())if(ws!==except)try{ws.send(text);}catch{this.closed.add(ws);}}
  broadcastRoster(){this.broadcast('players',this.roster());}
  broadcastWorld(world=this.world()){for(const ws of this.sockets()){const meta=ws.deserializeAttachment();if(meta)try{ws.send(JSON.stringify({type:'world',data:worldView(world,meta.profileKey)}));}catch{this.closed.add(ws);}}this.broadcastRoster();}
  async tick(fromState=false){const now=Date.now();if(fromState&&now-this.lastTick<500)return;this.lastTick=now;const actors=this.actors(),world=this.world();if(tickWorld(world,{now,activeFighters:actors.filter(a=>a.role==='fighter').length,actors})){this.save(world);this.broadcastWorld(world);}await this.armAlarm();}
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
