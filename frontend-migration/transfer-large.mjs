// Explicit local or remote transfer. No default remote target, no deletes.
// Verify downloaded bytes before allowing a Pages deployment.
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'frontend-migration/.build');
const [mode,bucket,persist]=process.argv.slice(2);
if(!['--local','--remote'].includes(mode)||!bucket||!/^ggtemple-client-[a-z0-9-]+$/.test(bucket)||(mode==='--local'&&!persist))throw Error('Usage: transfer-large.mjs --local|--remote ggtemple-client-BUCKET [local state path]');
const entries=JSON.parse(await readFile(resolve(out,'manifest.json'),'utf8')).entries.filter(e=>e.storage==='r2');
const seen=new Set();
const temp=await mkdtemp(resolve(tmpdir(),'ggtemple-r2-'));
const hash=async file=>{const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');};
const wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
const opts=mode==='--local'?['--local','--persist-to',resolve(persist)]:['--remote'];
const run=args=>execFileSync(process.execPath,[wrangler,...args],{cwd:root,stdio:'inherit'});
try{
 for(const e of entries){
  if(seen.has(e.key))continue;
  seen.add(e.key);
  const source=resolve(out,'large',e.path);
  if(await hash(source)!==e.sha256)throw Error('Input changed '+e.path);
  run(['r2','object','put',bucket+'/'+e.key,'--file',source,...opts]);
  const target=resolve(temp,e.sha256);
  run(['r2','object','get',bucket+'/'+e.key,'--file',target,...opts]);
  if(await hash(target)!==e.sha256)throw Error('R2 download byte mismatch '+e.path);
 }
}finally{await rm(temp,{recursive:true,force:true});}
console.log('Verified '+seen.size+' unique oversized objects.');
