import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {registerCustomWings,itemById} from '../src/shared/catalog.js';
import {normalizePaintedWing} from '../src/shared/custom-wings.js';

import {SWALLOWTAIL_WINGS} from '../src/engine/wing-catalog.js';
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
test('only fourteen user-requested material wings remain in public catalog',()=>{
 assert.equal(SWALLOWTAIL_WINGS.length,14);
 assert.equal(SWALLOWTAIL_WINGS.filter(w=>w.tier===4).length,5);
 assert.equal(SWALLOWTAIL_WINGS.filter(w=>w.tier===3).length,5);
 assert.equal(SWALLOWTAIL_WINGS.filter(w=>w.tier===5).length,4);
 const world=createInitialWorld(now);
 const gm=ensureProfile(world,'gm','GM','#abcdef',now,true);
 const denied=applyAction(world,actor,{action:'gm-wing-draw'},{now});
 assert.match(denied.error,/removed/);
 assert.equal(gm.wingDesignCredits,0);
});
test('Google-only Firebase entry and verified server route integration',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const index=read('index.html'),ui=read('src/ui.js'),network=read('src/network.js'),
  worker=read('cloudflare/worker.js'),client=read('src/main.js'),
  verifier=read('cloudflare/firebase-auth.js'),firebase=read('src/firebase-login.js'),
  atlas=read('src/engine/epic-specimens.js'),painter=read('src/gm-wing-painter.js');
 assert.match(index,/data-google-login/);
 assert.doesNotMatch(index,/data-login-provider="apple"/);
 assert.doesNotMatch(index,/data-login-provider="facebook"/);
 assert.doesNotMatch(index,/data-legacy-login/);
 assert.match(network,/firebaseIdToken/);
 assert.match(network,/firebaseProfile/);
 assert.match(worker,/verifyFirebaseIdToken/);
 assert.match(worker,/path==='\/api\/firebase\/config'/);
 assert.match(worker,/path==='\/api\/firebase\/profile'/);
 assert.match(worker,/authMode:identity\?'firebase'/);
 assert.match(verifier,/securetoken\.google\.com/);
 assert.match(verifier,/RSASSA-PKCS1-v1_5/);
 assert.match(verifier,/sign_in_provider!=='google.com'/);
 assert.match(firebase,/signInWithPopup/);
 assert.match(firebase,/existingGoogleToken/);
 assert.match(ui,/setFirebaseLoginStatus/);
 assert.match(ui,/mountWingPainter\(this,\{personal:this\.panelName==='wing-personal-painter',preview:this\.panelName==='wing-player-preview'\}\)/);
 assert.match(ui,/wing-epic-win/);
 assert.match(client,/ui\.addEventListener\('firebase-login'/);
 assert.match(atlas,/epicSpecimenCanvas/);
 assert.doesNotMatch(painter,/data-wing-mirror-[xy]/);
 assert.doesNotMatch(painter,/data-wing-(?:ratio|scale)/);
 assert.match(painter,/data-wing-zoom="reset"/);
 assert.match(painter,/data-wing-tool="scale"/);
 assert.match(painter,/data-wing-ability/);
});
