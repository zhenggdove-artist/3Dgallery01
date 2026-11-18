import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {registerCustomWings,itemById} from '../src/shared/catalog.js';
import {normalizePaintedWing} from '../src/shared/custom-wings.js';
import {drawGmWing,WING_QUALITY_WEIGHTS} from '../src/shared/wing-shop.js';
import {SWALLOWTAIL_WINGS} from '../src/reletter/wing-catalog.js';
const now=10_000_000,actor={key:'gm',name:'Ely',color:'#abcdef',role:'fighter',position:[0,0,10]};
const draft={name:'Hand-painted Monarch',tier:4,slot:'wings',family:'wings',
 color:'#d5b995',ability:'swift',scaleX:1,scaleY:1,
 impulse:11,gravity:.54,flapMs:300,
 outline:[[.1,.4],[.3,.1],[.9,.1],[.8,.8]],strokes:[
 {tool:'brush',material:'ink',color:'#282828',size:12,opacity:1,mirrorX:true,mirrorY:false,
 points:[[.2,.4],[.5,.3],[.8,.6]]}]};
test('GM can publish a validated wing: catalog, persisted room and original inventory each update',()=>{
 const w=createInitialWorld(now),gm=ensureProfile(w,'gm','Ely','#abcdef',now,true);
 const before=gm.inventory.length;
 const response=applyAction(w,actor,{action:'gm-wing-publish',wing:draft},{now});
 assert.equal(response.error,undefined);
 assert.equal(w.customWings.length,1);
 const art=w.customWings[0];
 assert.match(art.id,/^gm-wing-/);assert.equal(itemById(art.id)?.name,draft.name);
 assert.equal(gm.inventory.length,before+1);
 assert.equal(gm.inventory.filter(i=>i===art.id).length,1);
 assert.equal(gm.itemOrigins[art.id],'gm-created');
 assert.equal(worldView(w,'gm',now).customWings[0].name,draft.name);
 assert.equal(worldView(w,'gm',now,false).customWings,undefined);
 const restored=migrateWorld(structuredClone(w),now+1);
 registerCustomWings(restored.customWings);
 assert.equal(itemById(art.id).ability,'swift');
});
test('fake GM cannot publish a wing even when passing admin=true',()=>{
 const w=createInitialWorld(now);
 ensureProfile(w,'notgm','Stranger','#abcdef',now,false);
 const response=applyAction(w,{key:'notgm',name:'Stranger',admin:true,color:'#abcdef',role:'fighter',position:[0,0,10]},
  {action:'gm-wing-publish',wing:draft},{now});
 assert.equal(response.error,'GM only');
 assert.equal(w.customWings.length,0);
});
test('invalid art is rejected without minting equipment',()=>{
 assert.throws(()=>normalizePaintedWing({...draft,tier:7},'id'),/quality/);
 assert.throws(()=>normalizePaintedWing({...draft,strokes:[{...draft.strokes[0],points:[[300,3]]}]},'id'),/coordinate/);
 assert.throws(()=>normalizePaintedWing({...draft,name:'<script>'},'id'),/name/);
});
test('exact five-percent Epic band, independent of inventory',()=>{
 const all=Array.from({length:10000},(_,i)=>i/10000);
 let epics=0;
 for(const r of all){
  const result=drawGmWing({admin:true,inventory:[]},()=>r);
  if(result.quality==='epic')epics++;
 }
 assert.equal(epics,500);
 assert.deepEqual(Object.values(WING_QUALITY_WEIGHTS),[45,30,18,5,2]);
 assert.equal(SWALLOWTAIL_WINGS.filter(w=>w.tier===4).length,5);
 const owned=SWALLOWTAIL_WINGS.map(w=>w.id);
 const filled=drawGmWing({admin:true,inventory:owned},()=>.945);
 assert.equal(filled.quality,'epic');
});
test('full UI, graphics and OAuth modules are wired to their entry points',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const index=read('index.html'),ui=read('src/ui.js'),network=read('src/network.js'),
  worker=read('cloudflare/worker.js'),client=read('src/main.js'),
  atlas=read('src/reletter/epic-specimens.js'),painter=read('src/gm-wing-painter.js');
 assert.match(index,/data-login-provider="google"/);
 assert.match(index,/data-login-provider="apple"/);
 assert.match(index,/data-login-provider="facebook"/);
 assert.match(network,/beginOAuth\(provider\)/);
 assert.match(network,/oauthTicket/);
 assert.match(worker,/oauthTicket\(this\.sql/);
 assert.match(worker,/path==='\/api\/oauth\/start'/);
 assert.match(worker,/path==='\/api\/oauth\/callback'/);
 assert.match(worker,/path==='\/api\/oauth\/profile'/);
 assert.match(worker,/path==='\/api\/oauth\/providers'/);
 assert.match(worker,/worldView\(world,meta\.profileKey,now,false\)/);
 assert.match(worker,/authMode/);
 assert.match(ui,/mountWingPainter\(this\)/);
 assert.match(ui,/wing-epic-win/);
 assert.match(ui,/data-gacha-close/);
 assert.match(client,/ui\.addEventListener\('oauth-login'/);
 assert.match(atlas,/epicSpecimenCanvas/);
 assert.match(painter,/data-wing-mirror-x/);
});
