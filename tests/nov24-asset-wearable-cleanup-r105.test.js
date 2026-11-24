import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ITEMS,SHOP_ITEMS,itemById,shopWeaponGroups,shopOutfitCollection,RETIRED_HEADGEAR,groundDropRoll,monsterDropRoll} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
const now=120000000;
test('six duplicate head designs are retired from sale while saved gear and fusion UIDs remain intact',()=>{
 const w=createInitialWorld(now),actor={key:'wearable',name:'Wearable',color:'#ffffff',role:'fighter',position:[75,0,0]};
 const p=ensureProfile(w,actor.key,actor.name,actor.color,now,false);
 p.wallet=100000;
 for(const [old,canonical] of Object.entries(RETIRED_HEADGEAR)){
  assert.equal(itemById(old).slot,'head');
  assert.ok(SHOP_ITEMS.some(i=>i.id===canonical));
  assert.ok(!SHOP_ITEMS.some(i=>i.id===old));
  p.inventory.push(old);
  assert.equal(applyAction(w,actor,{action:'buy',itemId:old},{now:now+1}).error,'Item is not sold');
 }
 const id=p.inventoryInstances.find(r=>r.itemId==='hat-jelly').uid;
 p.fusionByInstance[id]={layer:2,attempts:2,templeStats:{defense:.1}};
 ensureProfile(w,actor.key,actor.name,actor.color,now+2,false);
 assert.equal(p.inventoryInstances.find(r=>r.itemId==='hat-jelly').uid,id);
 assert.equal(p.fusionByInstance[id].layer,2);
 const gm=ensureProfile(w,'gm','GM','#ffffff',now,true);
 assert.ok(!gm.inventory.some(id=>Object.hasOwn(RETIRED_HEADGEAR,id)));
 for(let i=0;i<1000;i++){
  const rng=()=>i/1000;
  for(const drop of [groundDropRoll(rng),monsterDropRoll(rng)])assert.ok(!Object.hasOwn(RETIRED_HEADGEAR,drop.itemId));
 }
});
test('ten outfit collections each expose five individual styles and eleven creature outfits stay separate',()=>{
 const groups=shopWeaponGroups(SHOP_ITEMS).filter(g=>g.base.slot==='outfit');
 assert.equal(groups.filter(g=>!g.base.r113Wearable).length,28);
 assert.equal(groups.filter(g=>g.base.r113Wearable).length,8);
 for(const g of groups.filter(g=>shopOutfitCollection(g.base))){
  assert.deepEqual(g.variants.map(v=>v.tier),[1,2,3,4,5]);
  assert.equal(new Set(g.variants.map(v=>v.id)).size,5);
  assert.ok(g.variants.every(v=>v.price===itemById(v.id).price&&!v.shopTier));
 }
 assert.equal(groups.filter(g=>g.base.creature&&!g.base.r106Wearable&&!g.base.r113Wearable&&g.variants.length===1).length,11);
 const w=createInitialWorld(now),actor={key:'outfit',name:'Outfit',color:'#ffffff',role:'fighter',position:[75,0,0]};
 const p=ensureProfile(w,actor.key,actor.name,actor.color,now,false);p.wallet=50000;
 const item=itemById('outfit-pajamas-5');
 assert.equal(applyAction(w,actor,{action:'buy',itemId:item.id,quantity:2},{now:now+1}).purchased.total,item.price*2);
 assert.ok(p.inventory.filter(id=>id===item.id).length===2);
});
test('retired headgear image directory is absent; live outfit artwork and music fallback stay present',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 assert.ok(!existsSync(join(root,'art','headgear')));
 for(const item of ITEMS.filter(i=>i.slot==='outfit'&&!i.creature))assert.ok(existsSync(join(root,'art','outfits',item.id+'.webp')),item.id);
 assert.ok(existsSync(join(root,'sound','backgroundmusic.MP3')));
 const scan=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory())scan(path);
  else if(/\.(js|css|html|json)$/.test(path))assert.doesNotMatch(readFileSync(path,'utf8'),/art\/headgear\//,path);
 }};
 scan(join(root,'src'));
 const world=readFileSync(join(root,'src','reletter','world-visuals.js'),'utf8');
 assert.match(world,/item.slot==='head'/);
 assert.match(world,/createHeadgear\(THREE,item\)/);
});
