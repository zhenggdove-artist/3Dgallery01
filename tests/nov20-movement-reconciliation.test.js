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
