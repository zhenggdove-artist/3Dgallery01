import {normalizeZalgo,normalizeWantedLabel,validWantedLabel,normalizeWantedAlign} from '../src/shared/wanted-style.js';
import {wantedPage,wantedProfile,wantedDestination,wantedSettings,normalizeWantedBackgroundCrop,normalizeWantedZoom,normalizeWantedFlash} from '../src/shared/wanted-list.js';
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store, private'}});
const CHUNK=512*1024,MAX=5*1024*1024;
const types=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif','image/bmp']);
export function initializeWanted(sql){
 sql.exec('CREATE TABLE IF NOT EXISTS wanted_media(id TEXT PRIMARY KEY,owner TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL)');
 sql.exec('CREATE TABLE IF NOT EXISTS wanted_chunks(id TEXT NOT NULL,part INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(id,part))');
}
function magic(type,b){
 const s=(i,n)=>String.fromCharCode(...b.slice(i,i+n));
 return type==='image/png'?b[0]===137&&s(1,3)==='PNG':type==='image/jpeg'?b[0]===255&&b[1]===216:type==='image/gif'?['GIF87a','GIF89a'].includes(s(0,6)):type==='image/webp'?s(0,4)==='RIFF'&&s(8,4)==='WEBP':type==='image/avif'?s(4,4)==='ftyp'&&['avif','avis'].includes(s(8,4)):type==='image/bmp'?s(0,2)==='BM':false;
}
export function wantedMedia(sql,id){
 const m=sql.exec('SELECT type,size FROM wanted_media WHERE id=?',id).toArray()[0];if(!m)return json({error:'Image not found'},404);
 const stream=new ReadableStream({start(c){for(const row of sql.exec('SELECT data FROM wanted_chunks WHERE id=? ORDER BY part',id))c.enqueue(new Uint8Array(row.data));c.close();}});
 return new Response(stream,{headers:{'Content-Type':m.type,'Content-Length':String(m.size),'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'}});
}
function removeMedia(sql,id){if(!id)return;sql.exec('DELETE FROM wanted_chunks WHERE id=?',id);sql.exec('DELETE FROM wanted_media WHERE id=?',id);}
export async function wantedApi(room,request,session,url){
 const world=room.world(),profile=world.profiles[session.profile_key],admin=profile?.admin===true,sql=room.sql,now=Date.now();
 if(!profile)return json({error:'Profile missing'},404);
 if(request.method==='GET'){
  const data=wantedPage(world,url.searchParams.get('page'),url.searchParams.get('seed'));return json({...data,self:profile.wanted||null,...(admin?{hidden:Object.values(world.profiles).filter(p=>p.wanted?.hidden).map(p=>({key:p.key,name:p.wanted.name}))}: {})});
 }
 if(!room.consumeRate('wanted:'+session.profile_key,24,60000))return json({error:'Too many requests'},429);
 if(url.pathname==='/api/wanted/media'){
  const type=(request.headers.get('Content-Type')||'').split(';')[0];if(!types.has(type))return json({error:'Unsupported image format'},400);
  const reader=request.body?.getReader();if(!reader)return json({error:'Empty image'},400);let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();return json({error:'Image exceeds 5 MB'},413);}chunks.push(value);}
  const b=new Uint8Array(size);let at=0;for(const chunk of chunks){b.set(chunk,at);at+=chunk.length;}
  if(size<12||!magic(type,b))return json({error:'Invalid image bytes'},400);
  // One unpublished image per profile. Published avatar and GM background remain.
  const current=room.readWorld(),currentProfile=current.profiles[session.profile_key];
  const keep=new Set([currentProfile?.wanted?.avatar,admin?current.wantedSettings?.background:null]);
  room.ctx.storage.transactionSync(()=>{for(const row of sql.exec('SELECT id FROM wanted_media WHERE owner=?',profile.key).toArray())if(!keep.has(row.id))removeMedia(sql,row.id);});
  const id=crypto.randomUUID();room.ctx.storage.transactionSync(()=>{sql.exec('INSERT INTO wanted_media VALUES(?,?,?,?,?)',id,profile.key,type,size,now);for(let i=0;i<size;i+=CHUNK)sql.exec('INSERT INTO wanted_chunks VALUES(?,?,?)',id,i/CHUNK,b.slice(i,i+CHUNK));});
  return json({id});
 }
 let body;try{if(Number(request.headers.get('Content-Length'))>4000)throw Error();const raw=await request.text();if(raw.length>4000)throw Error();body=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
 // Re-read after asynchronous body handling; don't overwrite newer gameplay.
 const live=room.world(),p=live.profiles[session.profile_key],isGM=p.admin===true;
 const owns=id=>!id||sql.exec('SELECT id FROM wanted_media WHERE id=? AND owner=?',id,p.key).toArray().length>0;
 let oldMedia=null,rename=false,destination=null;
 try{
  if(body.action==='save'){
   if(!owns(body.avatar))throw Error('Upload your own avatar');
   const old=p.wanted,next=wantedProfile(body,old,now);
   if(!isGM&&next.useName&&next.name.toLowerCase()==='ely')throw Error('Reserved name');
   if(next.useName){p.wantedOriginalName??=p.name;p.name=next.name;rename=true;}
   else if(old?.useName&&p.wantedOriginalName){p.name=p.wantedOriginalName;delete p.wantedOriginalName;rename=true;}
   oldMedia=old?.avatar!==next.avatar?old?.avatar:null;p.wanted=next;
  }else if(body.action==='settings'){
   if(!isGM)throw Error('GM only');const label=normalizeWantedLabel(body.label);if(!validWantedLabel(label)||(body.background!==live.wantedSettings?.background&&!owns(body.background)))throw Error('Invalid button settings');
   const old=wantedSettings(live),color=body.color??old.color,fontSize=body.fontSize??old.fontSize;if(!/^#[0-9a-f]{6}$/i.test(color)||!Number.isInteger(fontSize)||fontSize<8||fontSize>30)throw Error('Invalid text color or size (8–30 px)');const background=body.background??old.background;const backgroundCrop=normalizeWantedBackgroundCrop(background?(body.backgroundCrop??(background===old.background?old.backgroundCrop:null)):null);const backgroundZoom=normalizeWantedZoom(background?(body.backgroundZoom??(background===old.background?old.backgroundZoom:1)):1),flash=normalizeWantedFlash(body.flash??old.flash);const align=normalizeWantedAlign(body.align??old.align),zalgo=normalizeZalgo(body.zalgo??old.zalgo);live.wantedSettings={label,background,color,fontSize,backgroundCrop,backgroundZoom,flash,align,zalgo,revision:old.revision+1};oldMedia=old.background!==live.wantedSettings.background?old.background:null;
  }else if(body.action==='moderate'){
   if(!isGM)throw Error('GM only');const target=live.profiles[String(body.key||'')];if(!target?.wanted)throw Error('Artist not found');target.wanted.hidden=body.hidden!==false;
  }else if(body.action==='jump'){
   if(!live.profiles[String(body.key||'')]?.wanted||live.profiles[String(body.key||'')].wanted.hidden)throw Error('Artist not listed');
   if(session.role==='fighter'&&(p.hp<=0||p.deadUntil>now||p.channelWeapon||p.writeJourney||p.effects?.freeze?.until>now||p.effects?.root?.until>now||p.vortexSpin?.until>now||Object.values(live.artworks||{}).some(a=>a.holder===p.key)))throw Error('Cannot jump while dead, casting, immobilized or carrying artwork');
   if(now-(p.wantedJumpAt||0)<5000)throw Error('Wait 5 seconds between jumps');
   destination=wantedDestination(live,String(body.key),now,Math.random,p.wantedLastArtwork);if(!destination)throw Error('No available artwork for this artist');
   p.wantedJumpAt=now;p.wantedLastArtwork=destination.id;
   if(session.role==='fighter'){
    // Update the authoritative pose before acknowledging the navigation.
    const state={position:destination.position,rotation:destination.rotation,animation:'idle',visible:true};
    sql.exec('UPDATE sessions SET state=? WHERE id=?',JSON.stringify(state),session.id);
    for(const ws of room.ctx.getWebSockets(session.id)){const meta=ws.deserializeAttachment();if(meta){meta.wantedJumpUntil=now+2500;meta.wantedJumpPosition=destination.position;ws.serializeAttachment(meta);}}
   }
  }else throw Error('Unknown action');
 }catch(e){return json({error:e.message},400);}
 live.revision=(live.revision||0)+1;
 room.ctx.storage.transactionSync(()=>{room.save(live);if(rename)sql.exec('UPDATE sessions SET name=? WHERE profile_key=?',p.name,p.key);if(oldMedia&&oldMedia!==p.wanted?.avatar&&oldMedia!==live.wantedSettings?.background)removeMedia(sql,oldMedia);});
 room.broadcastWorld(live);if(body.action==='settings')room.broadcast('wanted-settings',wantedSettings(live));if(rename||destination)room.broadcastRoster();
 return json({ok:true,self:p.wanted||null,name:p.name,settings:wantedSettings(live),destination});
}
