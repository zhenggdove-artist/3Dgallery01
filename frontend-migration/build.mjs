import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile,lstat,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'frontend-migration/.build');
const site=resolve(out,'pages');
const limit=25*1024*1024;
const dirs=new Set(['src','vendor','assets','art','models','processed_images','Painting','sound','temple-assets']);
const roots=new Set(['index.html','temple-config.js','styles.css','fidelity-ui.css','gun.css','reletter-theme.css','sketch-hud.css','wall-paint.css','wanted-list.css','wing-atelier.css','Ground049B_1K-JPG_Color.jpg','SinTower.glb','artwork-delivery.json','asset_manifest_full.json','state.min.json','temple-layout.json','temple-artwork-layout.json']);
const hash=async file=>{const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');};
const files=execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:16*1024*1024}).toString('utf8').split('\0').filter(Boolean);
const included=files.filter(f=>(roots.has(f)||dirs.has(f.split('/')[0]))&&!f.split('/').some(p=>p.startsWith('.'))&&!/\.map$/i.test(f));
for(const f of roots)if(!included.includes(f))throw Error('Missing expected asset: '+f);
await rm(out,{recursive:true,force:true});
await mkdir(site,{recursive:true});
const entries=[],large={};
for(const f of included){
  const source=resolve(root,f);
  const info=await lstat(source);
  if(!info.isFile())throw Error('Non-regular tracked asset: '+f);
  const sha256=await hash(source);
  const big=info.size>limit;
  if(big&&!['.glb','.bin'].includes(extname(f).toLowerCase()))throw Error('Review new oversized asset before deploy: '+f);
  const dest=resolve(out,big?'large':'pages',f);
  await mkdir(dirname(dest),{recursive:true});
  await copyFile(source,dest);
  if(await hash(dest)!==sha256)throw Error('Byte parity failed: '+f);
  const entry={path:f,size:info.size,sha256,storage:big?'r2':'pages'};
  if(big){entry.key='sha256/'+sha256;large['/'+f]={key:entry.key,size:entry.size,type:extname(f)==='.glb'?'model/gltf-binary':'application/octet-stream'};}
  entries.push(entry);
}
if(!Object.keys(large).length||Object.keys(large).length>100)throw Error('Review R2 route list before deploy');
const html=await readFile(resolve(site,'index.html'),'utf8');
const moduleList=html.match(/const modules = (\[[^\n]+\]);/);
if(!moduleList)throw Error('Review import-map format before deploy');
for(const path of JSON.parse(moduleList[1]))if(!included.includes(path))throw Error('Missing import-map module '+path);
const handler=await readFile(new URL('./large-assets.mjs',import.meta.url),'utf8');
await writeFile(resolve(site,'_worker.js'),'const LARGE = '+JSON.stringify(large)+';\n'+handler+'\nexport default {fetch(request,env){return serveLarge(request,env,LARGE);}};\n');
await writeFile(resolve(site,'_routes.json'),JSON.stringify({version:1,include:Object.keys(large),exclude:[]},null,2));
await writeFile(resolve(site,'404.html'),'<!doctype html><meta charset="utf-8"><title>Not found</title>Not found');
await writeFile(resolve(out,'manifest.json'),JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),entries},null,2));
console.log(JSON.stringify({total:entries.length,static:entries.filter(e=>e.storage==='pages').length,large:entries.filter(e=>e.storage==='r2')},null,2));
