const MAX=32*1024*1024,CHUNK=512*1024;
export function initializeArtMedia(sql){sql.exec('CREATE TABLE IF NOT EXISTS art_media (id TEXT PRIMARY KEY, owner TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)');sql.exec('CREATE TABLE IF NOT EXISTS art_media_chunks (id TEXT NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY(id,part))');}
export async function uploadArtMedia(request,session,room){
 if(!room.world().profiles[session.profile_key]?.admin)return Response.json({error:'GM only'},{status:403});
 const type=(request.headers.get('Content-Type')||'').split(';')[0];if(!['image/png','image/jpeg','image/webp','video/mp4','video/webm','model/gltf-binary'].includes(type))return Response.json({error:'Unsupported artwork format'},{status:400});
 if(!room.consumeRate('art-upload:'+session.profile_key,8,60000))return Response.json({error:'Upload limit reached'},{status:429});
 const reader=request.body?.getReader(),chunks=[];let size=0;if(!reader)return Response.json({error:'Empty file'},{status:400});for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();return Response.json({error:'Artwork exceeds 32 MB'},{status:413});}chunks.push(value);}if(!size)return Response.json({error:'Empty file'},{status:400});
 if((room.sql.exec('SELECT COALESCE(SUM(size),0) AS total FROM art_media').toArray()[0].total||0)+size>256*1024*1024)return Response.json({error:'Gallery upload storage limit reached (256 MB)'},{status:413});
 const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
 if(type==='model/gltf-binary'){try{const view=new DataView(data.buffer);if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==size)throw Error();const length=view.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(data.subarray(20,20+length)));for(const r of [...doc.buffers||[],...doc.images||[]])if(r.uri&&!r.uri.startsWith('data:'))throw Error();}catch{return Response.json({error:'GLB must be valid and self-contained; external files are not accepted'},{status:400});}}
 const id=crypto.randomUUID();room.ctx.storage.transactionSync(()=>{room.sql.exec('INSERT INTO art_media VALUES(?,?,?,?,?)',id,session.profile_key,type,size,Date.now());for(let i=0;i<size;i+=CHUNK)room.sql.exec('INSERT INTO art_media_chunks VALUES(?,?,?)',id,i/CHUNK,data.slice(i,i+CHUNK));});return Response.json({id,type,size});
}
export function getArtMedia(sql,id,request){
 const meta=sql.exec('SELECT type,size FROM art_media WHERE id=?',id).toArray()[0];
 if(!meta)return Response.json({error:'Artwork file missing'},{status:404});
 let start=0,end=meta.size-1,status=200;const range=request?.headers.get('Range');
 const headers={'Content-Type':meta.type,'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${meta.size}`}});
  if(!match[1])start=Math.max(0,meta.size-Number(match[2]));
  else {start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  if(start>end||start>=meta.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${meta.size}`}});
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${meta.size}`;
 }
 headers['Content-Length']=String(end-start+1);
 const stream=new ReadableStream({start(controller){for(const row of sql.exec('SELECT part,data FROM art_media_chunks WHERE id=? AND part>=? AND part<=? ORDER BY part',id,Math.floor(start/CHUNK),Math.floor(end/CHUNK))){const bytes=new Uint8Array(row.data),base=row.part*CHUNK;controller.enqueue(bytes.subarray(Math.max(0,start-base),Math.min(bytes.length,end-base+1)));}controller.close();}});
 return new Response(stream,{status,headers});
}
