import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHOP_ITEMS,itemById,isMysteryWeapon} from '../src/shared/catalog.js';
import {weaponRangeClass} from '../src/reletter/odd-weapons.js';
import {PLATFORMS} from '../src/shared/arena.js';
import {applyAction,createInitialWorld,ensureProfile} from '../src/shared/temple-rules.js';

test('sniper, prism and lightning weapons appear in FAR, not MID or Mystery',()=>{
  for(const id of ['black-cat',...Array.from({length:5},(_,i)=>'prism-'+(i+1)),...Array.from({length:5},(_,i)=>'storm-'+(i+1))]){
    const item=itemById(id);
    assert.ok(item,id);
    assert.equal(item.slot,'weapon',id);
    assert.equal(weaponRangeClass(item),'far',id);
    assert.equal(isMysteryWeapon(item),false,id);
    assert.equal(item.mysteryWeapon,false,id);
    assert.ok(SHOP_ITEMS.some(entry=>entry.id===id),id);
  }
  assert.equal(weaponRangeClass(itemById('frost-5')),'mid','unrelated staves retain MID classification');
  assert.ok(itemById('black-cat').price>1000,'shop reclassification does not discount the sniper');
});

test('Giraffe Boomerang costs 19,999 coins server-side and retains Mystery classification',()=>{
  const giraffe=itemById('giraffe'),now=42_000,world=createInitialWorld(now);
  assert.equal(giraffe.price,19999);
  assert.equal(giraffe.sell,4999);
  assert.equal(giraffe.mysteryWeapon,true);
  const profile=ensureProfile(world,'player','Player','#abcdef',now);
  profile.wallet=19998;
  const actor={key:'player',name:'Player',color:'#abcdef',role:'fighter',position:[0,0,0]};
  assert.equal(applyAction(world,actor,{action:'buy',itemId:'giraffe'},{now}).error,'Not enough coins');
  profile.wallet=19999;
  assert.equal(applyAction(world,actor,{action:'buy',itemId:'giraffe'},{now:now+1}).error,undefined);
  assert.equal(profile.wallet,0);
});

test('artwork pickup respects its GM saved display location and small motion latency',()=>{
  const now=53_000,world=createInitialWorld(now),id=PLATFORMS[0].id;
  world.artworkLayout[id]={position:[18,5,15],rotation:[0,0,0],scale:[1,1,1],revision:3};
  const actor=(key,position)=>({key,name:key,color:'#abcdef',role:'fighter',position});
  assert.equal(applyAction(world,actor('far',[24,5,15]),{action:'pickup-artwork',platformId:id},{now}).error,'Move closer to the artwork');
  const pickup=applyAction(world,actor('near',[22.8,5,15]),{action:'pickup-artwork',platformId:id},{now});
  assert.equal(pickup.error,undefined);
  assert.equal(world.artworks[id].holder,'near');
  assert.equal(applyAction(world,actor('another',[18,5,15]),{action:'pickup-artwork',platformId:id},{now}).error,'Artwork is unavailable');
});

test('artwork interaction takes priority over decorations and exposes server errors',()=>{
  const arena=readFileSync(new URL('../src/arena-view.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(arena,/return artworks\.sort\(\(a,b\)=>a\.distance-b\.distance\)\[0\]/);
  assert.match(arena,/Math\.abs\(\(position\[1\]\|\|0\)-artPosition\[1\]\)<=8/);
  assert.match(main,/action==='pickup-artwork'\|\|!/);
});
