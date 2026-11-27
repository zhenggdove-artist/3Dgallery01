import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const base=process.env.PAGES_TEST_URL||'http://127.0.0.1:8000';
const {entries}=JSON.parse(await readFile(new URL('./.build/manifest.json',import.meta.url),'utf8'));
const url=p=>base+'/'+p.split('/').map(encodeURIComponent).join('/');
const hash=async body=>{const h=createHash('sha256');for await(const chunk of body)h.update(chunk);return h.digest('hex');};
for(const e of entries){
 const r=await fetch(url(e.path));assert.equal(r.status,200,e.path);assert.equal(await hash(r.body),e.sha256,e.path);
 if(e.storage==='r2'){
  const head=await fetch(url(e.path),{method:'HEAD'});assert.equal(Number(head.headers.get('Content-Length')),e.size);
  const partial=await fetch(url(e.path),{headers:{Range:'bytes=0-15'}});assert.equal(partial.status,206,e.path);assert.equal((await partial.arrayBuffer()).byteLength,16);
 }
}
for(const p of ['cloudflare/worker.js','server/dev-server.js','tests/backend-smoke.mjs','docs/temple/deployment.md','progress.md','package.json','wrangler.jsonc','.git/config','_worker.js','manifest.json','frontend-migration/build.mjs']){
 const r=await fetch(url(p),{redirect:'manual'});assert.equal(r.status,404,'Unexpected public file: '+p);
}
console.log('Verified all '+entries.length+' assets by SHA-256 and excluded repository-only files.');
