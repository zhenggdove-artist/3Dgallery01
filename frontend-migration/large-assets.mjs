// This Worker runs only for oversized, explicitly enumerated paths.
// No game/API/database access and no arbitrary bucket object lookup.
export async function serveLarge(request,env,manifest){
  let path;
  try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response(null,{status:400});}
  if(!Object.hasOwn(manifest,path))return env.ASSETS.fetch(request);
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  const asset=manifest[path],bucket=env.GGTEMPLE_LARGE_ASSETS;
  if(!bucket)return new Response('Asset storage unavailable',{status:503});
  const etag='"'+asset.key.split('/').at(-1)+'"';
  const headers=new Headers({'Content-Type':asset.type,'Accept-Ranges':'bytes','ETag':etag,'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'});
  const requested=request.headers.get('Range');
  const ifRange=request.headers.get('If-Range');
  let range;
  if(request.method==='GET'&&requested&&(!ifRange||ifRange===etag)){
    const m=/^bytes=(\d*)-(\d*)$/.exec(requested);
    // Multiple ranges can be ignored per HTTP; return the complete resource.
    if(m&&(m[1]||m[2])){
      const start=m[1]?Number(m[1]):Math.max(0,asset.size-Number(m[2]));
      const end=m[1]&&m[2]?Math.min(asset.size-1,Number(m[2])):asset.size-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=asset.size||end<start){
        headers.set('Content-Range','bytes */'+asset.size);
        return new Response(null,{status:416,headers});
      }
      range={offset:start,length:end-start+1};
      headers.set('Content-Range','bytes '+start+'-'+end+'/'+asset.size);
    }else if(!requested.includes(',')){
      headers.set('Content-Range','bytes */'+asset.size);
      return new Response(null,{status:416,headers});
    }
  }
  // Check storage even for HEAD/304: missing uploads must never look healthy.
  const conditional=request.headers.get('If-None-Match')?.split(',').map(s=>s.trim()).some(s=>s==='*'||s===etag||s==='W/'+etag);
  const metadataOnly=request.method==='HEAD'||conditional;
  const object=metadataOnly?await bucket.head(asset.key):await bucket.get(asset.key,range?{range}:undefined);
  if(!object||object.size!==asset.size)return new Response('Asset unavailable',{status:503});
  if(conditional){headers.delete('Content-Range');return new Response(null,{status:304,headers});}
  headers.set('Content-Length',String(range?range.length:asset.size));
  return new Response(metadataOnly?null:object.body,{status:range?206:200,headers});
}
