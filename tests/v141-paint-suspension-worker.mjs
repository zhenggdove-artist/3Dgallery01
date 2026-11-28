import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {SPACE_PAINT_ACTIONS} from '../src/shared/space-paint.js';
const entry=fileURLToPath(new URL('../cloudflare/worker.js',import.meta.url));
const fixture={spacePaint:[{id:'legacy-stroke-1',ownerKey:'old',color:'#ffffff',size:.2,thickness:.3,normal:[0,0,1],points:[[0,10,0]]}],spacePaintSurface:{'legacy-stroke-1':[{color:'#123456'}]},spacePaintRevision:8,spacePaintSurfaceRevision:12,wallPaintRevision:17};
const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',target:'es2022',external:['cloudflare:workers'],logLevel:'error',plugins:[{name:'v141-existing-data',setup(b){b.onLoad({filter:/[/\\]worker\.js$/},args=>{
 const original=readFileSync(args.path,'utf8'),anchor='JSON.stringify(createInitialWorld())';assert.equal(original.split(anchor).length,2);
 return {contents:original.replace(anchor,'JSON.stringify({...createInitialWorld(),...'+JSON.stringify(fixture)+'})'),loader:'js',resolveDir:dirname(args.path)};
 });}}]});
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'v141-purge-fixture',modules:[{type:'ESModule',path:'worker.mjs',contents:bundle.outputFiles[0].text}],compatibilityDate:'2026-10-13',bindings:{TEMPLE_ADMIN_KEY:'local-fixture-only',SPACE_PAINT_SUSPENDED:'true'},durableObjects:{TEMPLE_ROOM:{className:'TempleRoom',useSQLite:true}}}],host:'127.0.0.1',port:0}));
try{
 const base=await mf.ready;
 const call=async(path,body,token)=>{const response=await fetch(new URL(path,base),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});return {status:response.status,data:await response.json()};};
 const check=async()=>{const {status,data}=await call('/api/space-paint-status');assert.equal(status,200,JSON.stringify(data));assert.equal(data.suspended,true);for(const key of ['strokes','surfaces','archiveRows','checkpoints','checkpointParts'])assert.equal(data[key],0,key);assert.equal(data.geometryRevision,9);assert.equal(data.surfaceRevision,13);};
 await check();
 const {status,data:join}=await call('/api/join',{name:'FixtureGM',color:'#43b59a',memoryCode:'local-fixture-only'});assert.equal(status,200,JSON.stringify(join));assert.equal(join.self.profile.admin,true);assert.equal(join.self.profile.spacePaintEnabled,false);assert.equal(join.world.profile.spacePaintEnabled,false);assert.equal(join.world.environment.spacePaintSuspended,true);assert.deepEqual(join.world.spacePaint,[]);assert.deepEqual(join.world.spacePaintSurface,{});assert.equal(join.world.wallPaintRevision,17);
 for(const action of SPACE_PAINT_ACTIONS){const {status,data}=await call('/api/action',{action,requestId:crypto.randomUUID(),targetKey:join.self.key,enabled:true},join.token);assert.equal(status,403,action+': '+JSON.stringify(data));}
 await check();
 console.log('V141 isolated production-style purge verified: existing paint removed, all six write actions rejected, GM disabled, 2D revision retained.');
}finally{await mf.dispose();}
