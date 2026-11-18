// Preserve the exact 00GameDevs downloaded JavaScript. Never redraw, reimplement
// or approximate a numbered effect. Fail closed on catalog/sha/license mismatch.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';

const origin='https://00gamedevs.com';
const numberedIds={
  8:'arc-ray',20:'energy-vortex',26:'frost-wheel',29:'radiant-beam',31:'thorn-crown',33:'tidal-surge',
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

 // Spell indicators #58/#59 are also installed byte-for-byte from the official
 // catalogue. They are not weapon attacks; maintain their own manifest.
const warningIds={58:'spell-indicator-sector',59:'spell-indicator-rectangle'};
const warnings=[];
for(const [num,id] of Object.entries(warningIds)){
 const a=catalog.assets.find(v=>v.id===id&&v.kind==='effect');
 if(!a||a.license!=='MIT'||a.integration?.type!=='scene-object'||!a.download?.url||!a.download?.sha256)
  throw Error('Missing original indicator #'+num+': '+id);
 const url=new URL(a.download.url,origin);
 if(url.origin!==origin)throw Error('Unexpected warning source: '+url.href);
 const response=await fetch(url);
 if(!response.ok)throw Error('Original warning download failed: '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==a.download.sha256)throw Error('Wrong original indicator checksum #'+num);
 const code=bytes.toString('utf8');
 if(!code.includes('00GameDevs')||!code.includes('The MIT License'))throw Error('Missing original warning license #'+num);
 await writeFile(dir+'/'+id+'.js',bytes);
 warnings.push({number:Number(num),id,url:url.href,sha256,byteLength:bytes.length,license:a.license,
   integration:a.integration,defaultOptions:a.defaultOptions});
 console.log('Verified original warning #'+num+' '+id+' '+sha256);
}
await writeFile('vendor/00gamedevs/warning-manifest.json',JSON.stringify({
 origin,contentVersion:catalog.contentVersion,downloadedFrom:'official AI catalog v2',
 packaging:'byte-identical original JavaScript, no imitation',assets:warnings
},null,2)+'\n');
console.log('Validated '+assets.length+' of '+Object.keys(numberedIds).length+' exact originals.');

// Also vendor the exact ground-freeze-study scene object requested for monster frost.
// Keep it in a separate manifest: its catalogue number is not assumed.
{
 const id='ground-freeze-study';
 const a=catalog.assets.find(v=>v.id===id&&v.kind==='effect');
 if(!a||a.license!=='MIT'||a.integration?.type!=='scene-object'||!a.download?.url||!a.download?.sha256)
  throw Error('Official ground-freeze-study source is not available for verified vendoring');
 const url=new URL(a.download.url,origin);
 if(url.origin!==origin)throw Error('Unexpected monster freeze source origin: '+url.href);
 const response=await fetch(url);
 if(!response.ok)throw Error('Official monster freeze source download failed: '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==a.download.sha256)throw Error('Official monster freeze checksum mismatch');
 const code=bytes.toString('utf8');
 if(!code.includes('00GameDevs')||!code.includes('The MIT License'))
  throw Error('Official monster freeze license header missing');
 await writeFile(dir+'/'+id+'.js',bytes);
 await writeFile('vendor/00gamedevs/monster-manifest.json',JSON.stringify({
  origin,contentVersion:catalog.contentVersion,
  downloadedFrom:'official AI catalog v2',
  packaging:'byte-identical original JavaScript, no imitation',
  assets:[{id,url:url.href,sha256,byteLength:bytes.length,license:a.license,
   integration:a.integration,defaultOptions:a.defaultOptions}]
 },null,2)+'\n');
 console.log('Verified original monster effect '+id+' '+sha256);
}


// Use the byte-identical official ground-healing effect for flower-crown
// channeling, independently of the existing #43 projectile bloom.
{
 const id='verdant-restoration';
 const a=catalog.assets.find(v=>v.id===id&&v.kind==='effect');
 if(!a||a.license!=='MIT'||a.integration?.type!=='scene-object'||!a.download?.url||!a.download?.sha256)
  throw Error('Official verdant-restoration scene-object is unavailable');
 const url=new URL(a.download.url,origin);
 if(url.origin!==origin)throw Error('Unexpected verdant-restoration origin: '+url.href);
 const response=await fetch(url);
 if(!response.ok)throw Error('Official verdant-restoration download failed: '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer()),sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==a.download.sha256)throw Error('Official verdant-restoration checksum mismatch');
 const code=bytes.toString('utf8');
 if(!code.includes('00GameDevs')||!code.includes('The MIT License'))
  throw Error('Original verdant-restoration MIT license header missing');
 await writeFile(dir+'/'+id+'.js',bytes);
 await writeFile('vendor/00gamedevs/restoration-manifest.json',JSON.stringify({
  origin,contentVersion:catalog.contentVersion,downloadedFrom:'official AI catalog v2',
  packaging:'byte-identical original JavaScript, no imitation',
  assets:[{id,url:url.href,sha256,byteLength:bytes.length,license:a.license,
   integration:a.integration,defaultOptions:a.defaultOptions}]
 },null,2)+'\n');
 console.log('Verified original restoration effect '+id+' '+sha256);
}
