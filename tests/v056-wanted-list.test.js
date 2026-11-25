import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wantedProfile,wantedPage,wantedDestination,countWantedDeath,wantedArtworks,wantedSettings} from '../src/shared/wanted-list.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Wanted profile validates links, names, crop and preserves a single avatar',()=>{
 const previous=wantedProfile({name:'Artist',website:'https://example.com',quote:'Hello',avatar:'one',crop:{x:25,y:75},useName:true},null,100);
 const edited=wantedProfile({name:'Artist 2',website:'https://example.com',quote:'New',crop:{x:-9,y:140}},previous,200);
 assert.equal(edited.avatar,'one');assert.equal(edited.createdAt,100);assert.deepEqual(edited.crop,{x:0,y:100});assert.equal(edited.useName,false);
 for(const website of ['javascript:alert(1)','https://a:b@example.com','not-a-url'])assert.throws(()=>wantedProfile({name:'A',website},null,0));
 assert.throws(()=>wantedProfile({name:'<x>'},null,0));
});
test('Wanted pagination shows 12 public artists without exposing player inventory',()=>{
 const profiles={};for(let i=0;i<26;i++){const key='p'+i;profiles[key]={key,level:2,wantedKills:5,wantedDeaths:4,inventory:['secret'],wanted:{...wantedProfile({name:'Artist '+i},null,i+1),hidden:i===25}};}
 const world={profiles,customArtworks:[{owner:'p0'}]};
 const a=wantedPage(world,0),b=wantedPage(world,1),c=wantedPage(world,2);
 assert.equal(a.total,25);assert.equal(a.entries.length,12);assert.equal(b.entries.length,12);assert.equal(c.entries.length,1);assert.equal(a.entries[0].hasArtwork,true);assert.equal(a.entries[0].inventory,undefined);assert.equal(a.entries[0].kills,5);
});
test('PvP defeats are counted once by the death path and self kills are excluded',()=>{
 const a={key:'a'},b={key:'b'};countWantedDeath(b,a);countWantedDeath(a,a);countWantedDeath(b,null);
 assert.equal(a.wantedKills,1);assert.equal(a.wantedDeaths,1);assert.equal(b.wantedDeaths,2);
 assert.ok(read('src/shared/temple-rules.js').includes('countWantedDeath(target,sourceProfile)'));
});
test('artwork jump accepts only author-owned, available art and uses server layout',()=>{
 const w={customArtworks:[{id:'a',owner:'author',position:[65,2,0]}],artworks:{a:{holder:'other'}},artworkLayout:{a:{position:[65,2,0]}},cityDamage:{}};
 assert.equal(wantedDestination(w,'other'),null);assert.equal(wantedDestination(w,'author'),null);
 delete w.artworks.a.holder;const result=wantedDestination(w,'author');assert.ok(result);assert.equal(result.id,'a');assert.equal(result.position[1],0);assert.equal(Math.hypot(result.position[0]-65,result.position[2]),4);
});
test('entry awaits uploaded art and texture upload before exposing HUD; paper doll code is untouched',()=>{
 const main=read('src/main.js');const start=main.indexOf("enterButton.textContent='Loading gallery"),end=main.indexOf('ui.enter(data)',start);
 assert.ok(start>=0&&end>start);const gate=main.slice(start,end);assert.ok(gate.includes('await arena.loadCustomArtworks'));assert.ok(gate.includes('renderer.initTexture(texture)'));assert.ok(gate.includes('await renderer.compileAsync'));
 const worker=read('cloudflare/wanted-api.js');assert.ok(worker.includes("if(!isGM)throw Error('GM only')"));assert.ok(worker.includes('SELECT id FROM wanted_media WHERE id=? AND owner=?'));
});

test('V057 explicit artist credit includes original exhibits and overrides uploader identity',()=>{
 const world={profiles:{gm:{key:'gm',admin:true,wanted:{name:'Ely'}},artist:{key:'artist',wanted:{name:'Artist A'}}},customArtworks:[{id:'a',owner:'gm',author:' Artist A ',position:[65,2,0]},{id:'b',owner:'artist',author:'Other',position:[75,2,0]}],artworkLayout:{'platform-01':{author:'ELY',position:[-12,0,-12]},'platform-02':{author:'Artist A',position:[40,4,0]}},artworks:{},cityDamage:{}};
 assert.equal(wantedArtworks(world,'gm')[0].id,'platform-01');assert.equal(wantedArtworks(world,'artist')[0].id,'platform-02');assert.ok(wantedArtworks(world,'artist').some(a=>a.id==='a'));assert.ok(!wantedArtworks(world,'artist').some(a=>a.id==='b'));
 assert.equal(wantedDestination(world,'gm',100).id,'platform-01');assert.equal(wantedDestination(world,'artist',100).id,'platform-02');
 world.artworks['platform-02']={availableAt:200,throwEvent:{}};assert.equal(wantedDestination(world,'artist',100).id,'a');world.artworks['platform-02'].availableAt=0;assert.equal(wantedDestination(world,'artist',100).id,'platform-02');
 assert.ok(wantedPage(world).entries.every(a=>a.hasArtwork));
});
test('V057 button style defaults and legacy saves are compatible',()=>{
 assert.deepEqual(wantedSettings({}),{label:'Wanted List',background:null,color:'#422943',fontSize:13});assert.equal(wantedSettings({wantedSettings:{label:'Artists',color:'#ff0022',fontSize:20}}).fontSize,20);
 assert.ok(read('index.html').includes('id="wanted-button"><span>Wanted List</span>'));assert.ok(read('wanted-list.css').includes('repeat(2,minmax(0,1fr))'));assert.ok(read('src/wanted-list.js').includes('previewCount-previewPage*12'));assert.ok(read('src/main.js').includes('controller.yaw=destination.rotation+Math.PI'));
});
