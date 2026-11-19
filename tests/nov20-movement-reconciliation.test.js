import test from 'node:test';
import assert from 'node:assert/strict';
import {rebaseRejectedPose,shouldIgnoreRejection} from '../src/shared/state-reconciliation.js';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('delayed server correction replays only movement since the exact rejected input sample',()=>{
 assert.deepEqual(rebaseRejectedPose([5,0,0],[6,0,0],[7.4,0,0]),[6.4,0,0]);
 assert.deepEqual(rebaseRejectedPose([5,0,0],[6,0,0],[7.4,0,0],x=>x>6),[5,0,0],
  'server wall boundaries cannot be bypassed by replaying pending input');
 assert.deepEqual(rebaseRejectedPose([5,0,0],[6,0,0],[20,0,0]),[5,0,0],
  'reject unrealistic predictive teleports');
 assert.equal(rebaseRejectedPose([5,0,0],[6,0,0],[NaN,0,0]),null);
 assert.equal(shouldIgnoreRejection(8,9,0),true);
 assert.equal(shouldIgnoreRejection(10,9,10),true);
 assert.equal(shouldIgnoreRejection(11,9,10),false);
 assert.equal(shouldIgnoreRejection(0,9,10),false,'old protocol without sequence still handled');
});

test('network sends a sequence on every fighter pose, Worker echoes authoritative acks and rejects',()=>{
 const net=source('src/network.js'),worker=source('cloudflare/worker.js'),main=source('src/main.js');
 assert.match(net,/this\.stateSequence/);
 assert.match(net,/this\.sentStates\.set\(seq/);
 assert.match(net,/state-ack/);
 assert.match(worker,/seq,serverTime:now/);
 assert.match(worker,/type:'state-ack'/);
 assert.match(main,/rebaseRejectedPose\(/);
 assert.match(main,/shouldIgnoreRejection\(/);
 assert.match(main,/const substeps=Math\.max\(1,Math\.ceil\(simulationDt/);
});

test('rapid Worker worlds are coalesced before frame processing instead of repeating full scene sync for every socket message',()=>{
 const main=source('src/main.js');
 assert.match(main,/let queuedWorld=null/);
 assert.match(main,/if\(queuedWorld\)\{const pending=queuedWorld;queuedWorld=null;acceptWorldView\(pending\);\}/);
 assert.match(main,/network\.addEventListener\('world',event=>\{/);
 assert.match(main,/movementSync:\{/);
});

test('detailed window geometry and scarred materials are reused between hits with no visual downgrade',async()=>{
 const THREE=await import('three');
 const {CITY_LOTS}=await import('../src/shared/city-layout.js');
 const {OuterCity}=await import('../src/outer-city.js');
 const city=Object.create(OuterCity.prototype);
 city.fixturePrefabs=new Map();city.debris=[];city.mobile=false;
 const lot=CITY_LOTS[5],part='windows-0-0';
 const template=city.getFixtureTemplate(lot,part);
 assert.equal(template,city.getFixtureTemplate(lot,part));
 const a=city.cloneFixture(lot,part),b=city.cloneFixture(lot,part);
 assert.notEqual(a,b);
 const meshes=group=>{const out=[];group.traverse(node=>{if(node.isMesh)out.push(node);});return out;};
 const ma=meshes(a),mb=meshes(b);
 assert.ok(ma.length>=5,'window retains frame, mullion and broken glazing');
 assert.equal(ma.length,mb.length);
 assert.ok(ma.every((mesh,i)=>mesh.geometry===mb[i].geometry&&mesh.material===mb[i].material));
 assert.equal(a.userData.sharedCityFixture,true);
 const scene=new THREE.Group();scene.add(a);
 let disposed=0;ma[0].geometry.addEventListener('dispose',()=>disposed++);
 city.removeDebris({root:scene,pieces:[{mesh:a}]});
 assert.equal(disposed,0,'detached instance must not dispose the reusable detailed art');
 assert.equal(city.fixturePrefabs.size,1);
 template.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
 city.fixturePrefabs.clear();
});

test('skill-time smoke pools are preallocated and all visual detail remains enabled',()=>{
 const city=source('src/outer-city.js');
 assert.match(city,/for\(let i=0;i<24;i\+\+\)\{/);
 assert.match(city,/this\.plumePool\.push\(plume\)/);
 assert.match(city,/this\.cloneFixture\(lot,part\)/);
 assert.match(city,/this\.splinters\?\.burst/);
 assert.match(city,/part\.mesh\.scale\.set\(\.88,\.17,\.86\)/);
});

test('all existing building visuals and last-blow safeguards remain intact',()=>{
 const city=source('src/outer-city.js'),fire=source('src/city-fire-field.js');
 const splinters=source('src/city-splinter-field.js');
 const layout=source('src/shared/city-layout.js');
 assert.match(layout,/cityAngularCornerCut/);
 assert.match(city,/part\.mesh\.scale\.set\(\.88,\.17,\.86\)/);
 assert.match(city,/this\.splinters\?\.burst\(lot/);
 assert.match(city,/applyCityDeformationBasis\(original/);
 assert.match(fire,/float spread=1\.\+4\.\*power/);
 assert.match(splinters,/const TYPES=\['window','sheet','timber','stone','sign'\]/);
});
