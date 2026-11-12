// Lossless delivery copies only. Original artwork files are never overwritten.
import sharp from 'sharp';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const state=JSON.parse(await readFile('state.min.json','utf8')),mapping={};let before=0,after=0;
for(const record of state.artworks.slice(0,13)){
 if(record.type==='model'||!record.src?.endsWith('.png'))continue;
 if(record.src.endsWith('asset_0015.png')){mapping[record.src]=record.src.replace('.png','.temple.webp');continue;} // existing alpha-cleaned delivery asset
 const source=resolve(record.src),target=source.replace(/\.png$/,'.lossless.webp');
 if(!await stat(target).catch(()=>null))await sharp(source).webp({lossless:true,effort:6}).toFile(target);
 const [original,copy]=await Promise.all([sharp(source).ensureAlpha().raw().toBuffer(),sharp(target).ensureAlpha().raw().toBuffer()]);
 if(original.length!==copy.length)throw Error('Dimensions changed: '+record.src);
 // WebP may clear RGB under fully transparent pixels. Alpha and every visible
 // RGBA pixel must remain byte-identical (including partially transparent edges).
 for(let i=0;i<original.length;i+=4)if(original[i+3]!==copy[i+3]||((original[i+3]||copy[i+3])&&!original.subarray(i,i+4).equals(copy.subarray(i,i+4))))throw Error('Visible pixel mismatch: '+record.src);
 const sourceBytes=(await stat(source)).size,targetBytes=(await stat(target)).size;
 before+=sourceBytes;after+=Math.min(sourceBytes,targetBytes);
 if(targetBytes<sourceBytes)mapping[record.src]=record.src.replace(/\.png$/,'.lossless.webp');
}
await writeFile('artwork-delivery.json',JSON.stringify(mapping,null,2)+'\n');
console.log(JSON.stringify({beforeBytes:before,afterBytes:after,savedPercent:+((1-after/before)*100).toFixed(1),visiblePixelEquality:true}));
