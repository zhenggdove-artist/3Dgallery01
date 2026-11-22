// Download ONLY the exact MIT-licensed 00GameDevs Energy Sword Wave.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='https://00gamedevs.com';
const response=await fetch(origin+'/ai/catalog.v2.json');
if(!response.ok)throw Error('Official VFX catalogue unavailable '+response.status);
const catalog=await response.json();
const effect=catalog.assets?.find(a=>a.id==='energy-sword-wave'&&a.kind==='effect');
if(!effect)throw Error('Official energy-sword-wave asset not found');
if(effect.license!=='MIT'||effect.integration?.type!=='scene-object'||!effect.download?.url||!effect.download?.sha256)
 throw Error('Energy Sword Wave has no approved MIT scene-object export');
const url=new URL(effect.download.url,origin);
if(url.origin!==origin)throw Error('Unexpected source origin '+url);
const fetched=await fetch(url);
if(!fetched.ok)throw Error('Official source fetch '+fetched.status);
const bytes=Buffer.from(await fetched.arrayBuffer());
const sha256=createHash('sha256').update(bytes).digest('hex');
if(sha256!==effect.download.sha256)throw Error('Official SHA256 mismatch');
if(!bytes.toString('utf8').includes('The MIT License'))throw Error('Missing copyright notice');
await mkdir('vendor/00gamedevs/source',{recursive:true});
await writeFile('vendor/00gamedevs/source/energy-sword-wave.js',bytes);
await writeFile('vendor/00gamedevs/energy-sword-wave-manifest.json',JSON.stringify({
 id:effect.id,license:effect.license,sha256,url:url.href,byteLength:bytes.length,
 defaultOptions:effect.defaultOptions,integration:effect.integration,contentVersion:catalog.contentVersion
},null,2)+'\n');
console.log('Official native Energy Sword Wave saved, SHA256 '+sha256);
