import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHOP_ITEMS,SHOP_WEAPON_GRADES,shopWeaponGroups,itemById,attackStats} from '../src/shared/catalog.js';
import {SNIPER_SHOULDER_RETICLE_DIAMETER_PX,SNIPER_SHOULDER_FOV_DEG,
 shoulderSniperSpread,pvpShotDamage} from '../src/shared/combat-balance.js';
import {fusionSniperEchoDamage,sniperMaterialStat} from '../src/shared/fusion-balance.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {fusionRecordAt} from '../src/shared/fusion-instances.js';
import {groupInventoryStacks} from '../src/shared/inventory-stacks.js';

const now=90_000_000;
const user={key:'five-quality-fusion',name:'Art',color:'#ffffff',role:'fighter',position:[75,0,0]};
test('one shop card per native family, five selectable colors and native weapon IDs',()=>{
 assert.deepEqual(SHOP_WEAPON_GRADES.map(g=>g.label),['White','Green','Blue','Gold','Purple']);
 assert.deepEqual(SHOP_WEAPON_GRADES.map(g=>g.rarity),['common','uncommon','rare','relic','epic']);
 const groups=shopWeaponGroups(SHOP_ITEMS),byKey=new Map(groups.map(g=>[g.key,g]));
 assert.equal(new Set(groups.map(g=>g.key)).size,groups.length);
 for(const key of ['weapon:tide','weapon:whip','weapon:saber','weapon:pan','weapon:planter','weapon:palm']){
  const v=byKey.get(key).variants;
  assert.equal(v.length,5);
  assert.deepEqual(v.map(x=>x.shopTier),[1,2,3,4,5]);
  assert.deepEqual(v.map(x=>x.id),Array.from({length:5},(_,i)=>key.slice(7)+'-'+(i+1)));
  assert.ok(v.every((x,i)=>x.rarity===SHOP_WEAPON_GRADES[i].rarity));
 }
 for(const key of ['weapon:black-cat','weapon:telephone','weapon:jellybrella']){
  const v=byKey.get(key).variants;
  assert.deepEqual(v.map(x=>x.id),Array(5).fill(key.slice(7)));
  assert.ok(v.every((x,i)=>i===0||x.price>v[i-1].price));
 }
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(ui,/shopWeaponGroups\(SHOP_ITEMS\)/);
 assert.doesNotMatch(ui,/· T\$\{v\.tier\}/);
 assert.match(ui,/data-shop-variant/);
});
test('a purchase of native gold or purple uses a real tier4/tier5 canonical item',()=>{
 const w=createInitialWorld(now),p=ensureProfile(w,user.key,user.name,user.color,now);
 p.wallet=300_000;
 for(const [id,tier] of [['tide-4',4],['tide-5',5],['pan-1',1]]){
  const result=applyAction(w,user,{action:'buy',itemId:id,qualityTier:tier},{now:now+tier,rng:()=>.5});
  assert.equal(result.error,undefined,id);
  assert.equal(result.purchased.qualityTier,tier);
  const owned=p.inventoryInstances.filter(row=>row.itemId===id);
  assert.equal(owned.at(-1).shopTier,tier);
 }
});
test('shoulder shot server RNG is contained by visible 132px circle for every tested aim angle',()=>{
 assert.equal(SNIPER_SHOULDER_RETICLE_DIAMETER_PX,132);
 const fovTan=Math.tan(SNIPER_SHOULDER_FOV_DEG*Math.PI/360);
 const dirs=[[0,0,1],[.5,.36,.78],[0,-.45,1],[-.8,.35,-.3]];
 let seed=1;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(const h of [320,420,720,1024,1600,2160])for(const vec of dirs)for(let i=0;i<160;i++){
  const d=vec.map(x=>x/Math.hypot(...vec)),out=shoulderSniperSpread(d,h,rng);
  assert.ok(Math.abs(Math.hypot(...out)-1)<1e-8);
  const hx=Math.hypot(d[0],d[2]),right=[d[2]/hx,0,-d[0]/hx];
  const up=[d[1]*right[2],d[2]*right[0]-d[0]*right[2],-d[1]*right[0]];
  const along=out.reduce((n,v,j)=>n+v*d[j],0);
  const rx=out.reduce((n,v,j)=>n+v*right[j],0);
  const ry=out.reduce((n,v,j)=>n+v*up[j],0);
  const screenRadiusPx=Math.hypot(rx,ry)/along*h/(2*fovTan);
  assert.ok(screenRadiusPx<=66+1e-7,h+'px viewport produced '+screenRadiusPx+'px drift');
 }
 const css=readFileSync(new URL('../fidelity-ui.css',import.meta.url),'utf8');
 assert.match(css,/width:132px;height:132px;top:calc\(50% - 30px\)/);
});
test('Black Cat catalog cannot generate ultimate damage even with charge input',()=>{
 const sniper=itemById('black-cat'),normal=attackStats(sniper,0);
 assert.equal(pvpShotDamage(sniper,normal,{tier:1}),81);
 assert.deepEqual(attackStats(sniper,1),normal);
 assert.equal(sniper.chargeMs,0);
 assert.ok(sniperMaterialStat(sniper,'damage')<sniper.damage);
});
test('Black Cat as primary cannot activate inherited ultimate effects',()=>{
 const w=createInitialWorld(now+10_000),p=ensureProfile(w,user.key,user.name,user.color,now+10_000);
 p.inventory.push('black-cat');p.equipment.weapon='black-cat';
 p.fusion['black-cat']={layer:2,effects:['ember-3','frost-2']};
 const charge=applyAction(w,user,{action:'attack',phase:'charge',scoped:true},{now:now+11_000,rng:()=>.5});
 assert.match(charge.error,/normal attacks only/);
 const fired=applyAction(w,user,{action:'attack',direction:[0,0,1],charge:0,scoped:true},{now:now+15_000,rng:()=>.5});
 assert.equal(fired.error,undefined);
 assert.equal(fired.attackEvent.fusionEchoes.length,0);
 assert.equal(fired.attackEvent.fusionEffects.length,0);
 assert.ok(!w.persistentAttacks.some(fx=>fx.echo));
});

test('fusing one folded target leaves every other physical UID untouched, even after JSON reload',()=>{
 const w=createInitialWorld(now+200),p=ensureProfile(w,user.key,user.name,user.color,now+200);
 p.inventory.push('ember-1','ember-1','ember-1');
 ensureProfile(w,user.key,user.name,user.color,now+201);
 const stack=p.inventoryInstances.flatMap((row,index)=>row.itemId==='ember-1'?[{uid:row.uid,index}]:[]);
 assert.equal(stack.length,3);
 const before=p.inventory.filter(id=>id==='ember-1').length;
 const result=applyAction(w,user,{action:'fuse',sourceId:'ember-1',targetId:'ember-1',
  sourceIndex:stack[0].index,targetIndex:stack[1].index,
  sourceInstanceUid:stack[0].uid,targetInstanceUid:stack[1].uid,
  requestId:'folded-main-target-12345'}, {now:now+800,rng:()=>0});
 assert.equal(result.error,undefined);
 assert.equal(result.fusion.success,true);
 assert.equal(p.inventory.filter(id=>id==='ember-1').length,before-1);
 assert.ok(!p.inventoryInstances.some(row=>row.uid===stack[0].uid));
 const cloned=structuredClone(JSON.parse(JSON.stringify(w)));
 const reloaded=ensureProfile(cloned,user.key,user.name,user.color,now+900);
 const upgradedIndex=reloaded.inventoryInstances.findIndex(row=>row.uid===stack[1].uid);
 const untouchedIndex=reloaded.inventoryInstances.findIndex(row=>row.uid===stack[2].uid);
 assert.ok(upgradedIndex>=0&&untouchedIndex>=0);
 assert.equal(fusionRecordAt(reloaded,upgradedIndex).layer,1);
 assert.equal(fusionRecordAt(reloaded,untouchedIndex).layer||0,0);
 const rows=reloaded.inventoryInstances.flatMap((row,index)=>row.itemId==='ember-1'?
  [{item:itemById(row.itemId),index}]:[]);
 const grouped=groupInventoryStacks(rows,(_item,index)=>fusionRecordAt(reloaded,index));
 assert.equal(grouped.length,2,'fused copy and virgin stack must have distinct records');
 assert.equal(grouped.reduce((n,g)=>n+g.count,0),2);
});
