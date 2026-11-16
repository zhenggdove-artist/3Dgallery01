// Preserve the exact 00GameDevs downloaded JavaScript. Never redraw, reimplement
// or approximate a numbered effect. Fail closed on catalog/sha/license mismatch.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';

const origin='https://00gamedevs.com';
const numberedIds={
  8:'arc-ray',20:'energy-vortex',26:'frost-wheel',33:'tidal-surge',
  38:'magma-fissure',43:'revival-bloom',47:'dimensional-rend',48:'black-hole',
  53:'darkchain-detonation',68:'rolling-fireburst',70:'ice-lance-study',
  73:'anime-flame-shield'
};
const catalogResponse=await fetch(origin+'/ai/catalog.v2.json');
if(!catalogResponse.ok)throw Error('Official catalog unavailable: '+catalogResponse.status);
const catalog=await catalogResponse.json();
if(catalog.schemaVersion!==2)throw Error('Unsupported official catalog schema');
const dir='vendor/00gamedevs/source';
await mkdir(dir,{recursive:true});
const assets=[];
for(const [num,id] of Object.entries(numberedIds)){
 const a=catalog.assets.find(v=>v.id===id&&v.kind==='effect');
 if(!a||a.license!=='MIT'||a.integration?.type!=='scene-object'||!a.download?.url||!a.download?.sha256)
  throw Error('No verified original scene-object source in catalog for #'+num+': '+id);
 const url=new URL(a.download.url,origin);
 if(url.origin!==origin)throw Error('Invalid source origin: '+url.href);
 const response=await fetch(url);
 if(!response.ok)throw Error('Original source download failed for #'+num+': '+response.status);
 const buffer=Buffer.from(await response.arrayBuffer());
 const sha256=createHash('sha256').update(buffer).digest('hex');
 if(sha256!==a.download.sha256)throw Error('Original source SHA-256 mismatch for #'+num+': '+id);
 const code=buffer.toString('utf8');
 if(!code.includes('00GameDevs')||!code.includes('The MIT License'))
  throw Error('Source license header missing for #'+num+': '+id);
 // Store the byte-identical official download including its own shader logic,
 // presets, THREE import and license. Some effects cannot share one runtime.
 await writeFile(dir+'/'+id+'.js',buffer);
 assets.push({number:Number(num),id,url:url.href,sha256,byteLength:buffer.length,license:a.license,
  integration:a.integration,defaultOptions:a.defaultOptions});
 console.log('Verified official effect #'+num+' '+id+' '+sha256);
}
await writeFile('vendor/00gamedevs/numbered-manifest.json',JSON.stringify({
 origin,contentVersion:catalog.contentVersion,downloadedFrom:'official AI catalog v2',
 packaging:'byte-identical original JavaScript, no imitation or generated particles',
 assets
},null,2)+'\n');
console.log('Validated '+assets.length+' of '+Object.keys(numberedIds).length+' exact originals.');