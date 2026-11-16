// Download original MIT modules; verify each published digest before installation.
// Mechanically deduplicate the identical runtime, retaining source provenance.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='https://00gamedevs.com';
// Catalog ID -> user-selected 00GameDevs listing number. No imitations or substitutes.
export const numberedIds={
  8:'arc-ray',20:'energy-vortex',26:'frost-wheel',33:'tidal-surge',
  38:'magma-fissure',43:'revival-bloom',47:'dimensional-rend',48:'black-hole',
  53:'darkchain-detonation',68:'rolling-fireburst',70:'ice-lance-study',
  73:'anime-flame-shield'
};
const ids=[...new Set(['azure-sweep','weapon-smear','plasma-bolt','ice-shard','arcane-missile',
 'pulse-beam','charged-beam','arc-ray','energy-burst','shockwave','ice-shatter',
 'flame-surge','tidal-surge','thorn-crown','spiral-gale','astral-convergence',
 'magic-barrier','burning-ground',...Object.values(numberedIds)])];
const catalogReply=await fetch(origin+'/ai/catalog.v2.json');
if(!catalogReply.ok)throw Error('Official 00GameDevs catalog unavailable: '+catalogReply.status);
const catalog=await catalogReply.json();
if(catalog.schemaVersion!==2)throw Error('Unsupported catalog');
const sources=await Promise.all(ids.map(async id=>{const asset=catalog.assets.find(a=>a.kind==='effect'&&a.id===id);if(asset?.license!=='MIT'||asset.integration.type!=='scene-object')throw Error('Unsupported asset '+id);const url=new URL(asset.download.url,origin);
if(url.origin!==origin)throw Error('Unexpected external asset host for '+id);
const response=await fetch(url);if(!response.ok)throw Error('Original download unavailable '+id+': '+response.status);
const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==asset.download.sha256)throw Error('Checksum mismatch '+id);return {asset,code:bytes.toString('utf8')};}));
const dir='vendor/00gamedevs';await mkdir(dir,{recursive:true});
let common;const meta=[];
for(const {asset,code}of sources){
 const begin=code.indexOf('import * as THREE'),end=code.indexOf('\nconst preset =');
 if(begin<0||end<0)throw Error('Unexpected module layout '+asset.id);
 const runtime=code.slice(begin,end);
 if(common&&runtime!==common)throw Error('Runtime differs '+asset.id);
 common=runtime;
 const notice=code.slice(0,code.indexOf('*/')+2);
 await writeFile(dir+'/'+asset.id+'.js',notice+'\nimport {createEffect} from "./runtime.js";\n'+code.slice(end));
 meta.push({id:asset.id,number:Object.entries(numberedIds).find(([,v])=>v===asset.id)?.[0]||null,url:new URL(asset.download.url,origin).href,sha256:asset.download.sha256,license:asset.license,integration:asset.integration,defaults:asset.defaultOptions});
}
await writeFile(dir+'/runtime.js',sources[0].code.slice(0,sources[0].code.indexOf('*/')+2)+'\n'+common+'\nexport {createEffect};\n');
await writeFile(dir+'/manifest.json',JSON.stringify({origin,contentVersion:catalog.contentVersion,sourceThree:'0.187.0',packaging:'identical runtime factored once; presets unchanged',assets:meta},null,2)+'\n');
console.log('Verified and installed '+ids.length+' exact MIT effects; '+Object.keys(numberedIds).length+' user-selected numbered originals, one shared runtime.');
