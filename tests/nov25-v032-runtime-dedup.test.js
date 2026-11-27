import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TempleNetwork} from '../src/network.js';
import * as T from 'three';
import {setHealthBar} from '../src/health-bars.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('concurrent world recovery GETs share one read and never cross session boundaries',async()=>{
 const network=new TempleNetwork({backendUrl:'https://example.invalid'});
 let calls=0;const resolve=[];network.request=()=>{calls++;return new Promise(r=>resolve.push(r));};
 network.token='one';const a=network.world(),b=network.world();assert.equal(a,b);assert.equal(calls,1);
 network.token='two';const c=network.world();assert.notEqual(c,a);assert.equal(calls,2);
 resolve[0]({world:{revision:1}});await a;assert.equal(network.world(),c);
 resolve[1]({world:{revision:2}});await c;const d=network.world();assert.equal(calls,3);resolve[2]({world:{revision:3}});await d;
});
test('health bar still updates every changed ratio and height',()=>{
 const root=new T.Group();setHealthBar(root,75,100);const bar=root.userData.healthBar;assert.equal(bar.children[1].scale.x,1.46*.75);
 setHealthBar(root,75,100);assert.equal(root.userData.healthBar,bar);
 setHealthBar(root,20,100,3);assert.equal(bar.position.y,3);assert.equal(bar.children[1].scale.x,1.46*.2);
 setHealthBar(root,0,100,3);assert.equal(bar.visible,false);
});
test('inactive fishing is no longer ticked; organic growth remains and uses the identical distance ordering',()=>{
 const code=read('src/adventure-view.js');assert.doesNotMatch(code,/this\.original\.(sync|update|beforeAnimation)\(/);assert.match(code,/\.sort\(\(a,b\)=>a\.distance-b\.distance\)\.slice\(0,24\)/);assert.match(code,/Math\.sin\(time\*1\.1\+ph\)/);
});
test('artwork definitions and appearance are not invalidated by unrelated HP/world revisions',()=>{
 const code=read('src/arena-view.js');assert.match(code,/this\.artworkRenderCustom!==custom/);assert.doesNotMatch(code,/prior\.world!==this\.artworkRenderRevision/);assert.match(code,/prior\.appearance!==layout\.appearance/);assert.match(code,/prior\.draft!==d\.editTitleDraft/);
});
test('pickup dedup preserves per-target retry cadence, coin priority, radius and motion socket cadence',()=>{
 const code=read('src/auto-pickup.js');assert.match(code,/pending\.add\(key\)/);assert.match(code,/pending\.delete\(key\)/);assert.match(code,/retry\.set\(key,this\.clock\(\)\+300\)/);assert.match(code,/if\(coin\)return this\.request/);assert.match(code,/>=2\.2\*\*2/);assert.match(read('src/main.js'),/pickups\.poll\(world,localRoot\.position/);assert.match(read('src/network.js'),/now-this\.lastStateAt<90/);
});
