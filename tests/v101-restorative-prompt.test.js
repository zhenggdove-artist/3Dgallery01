import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,worldView} from '../src/shared/temple-rules.js';
import {ITEMS} from '../src/shared/catalog.js';
import {operationPromptLayout,promptPlacement,validPromptLayout} from '../src/shared/operation-prompt.js';
const T=97_000_000,actor={key:'v101',name:'V101',color:'#abcdef',role:'fighter',position:[75,0,0]};
function fixture(){const w=createInitialWorld(T),p=ensureProfile(w,actor.key,actor.name,actor.color,T);return {w,p,act:(body,now=T+1000)=>applyAction(w,actor,body,{now,actors:[actor],rng:()=>.5})};}
test('every restorative item at full or nearly full resource emits its nominal amount and never overfills',()=>{
 for(const item of ITEMS.filter(i=>i.slot==='consumable'&&(i.healFraction>0||i.manaFraction>0)))for(const missing of [0,1,75]){
  const {w,p,act}=fixture();p.inventory.push(item.id);p.quickSlots[0]=item.id;
  const mana=item.manaFraction>0,field=mana?'mana':'hp',cap=mana?'maxMana':'maxHp';p[field]=Math.max(1,p[cap]-missing);if(mana)p.manaAt=T+1000;
  const before=p[field],nominal=Math.ceil(p[cap]*(mana?item.manaFraction:item.healFraction));
  const r=act({action:'use-consumable',slot:0});assert.equal(r.error,undefined,item.id);
  const e=w.damageEvents.at(-1);assert.equal(e.amount,nominal);assert.equal(e.kind,mana?'mana-heal':'heal');assert.equal(e.restorative,true);
  assert.equal(p[field],Math.min(p[cap],before+nominal));assert.equal(r.remaining,0);if(!missing)assert.equal(r.notice,undefined);
 }
});
test('full-health ground hearts keep the normal receipt and show nominal green HP',()=>{const {w,p,act}=fixture();w.groundDrops.push({id:'heart',kind:'heart',amount:25,position:actor.position,expiresAt:T+10000});const r=act({action:'pickup-drop',dropId:'heart'});assert.equal(r.error,undefined);assert.equal(r.notice,undefined);assert.equal(p.hp,p.maxHp);assert.equal(w.damageEvents.at(-1).amount,25);assert.equal(w.damageEvents.at(-1).restorative,true);assert.ok(w.pickupReceipts.some(x=>x.id==='heart'));});
test('GM only, validated settings persist across devices, and ordinary players receive the same layout',()=>{const {w,act}=fixture(),gm={...actor,key:'gm',admin:true};ensureProfile(w,gm.key,'GM',gm.color,T,true);const layout={x:.1,gap:.15,scale:1.2,opacity:.45},body={action:'gm-operation-prompt-layout',device:'all',layout};assert.equal(act(body).error,'GM only');assert.equal(applyAction(w,gm,{...body,layout:{...layout,opacity:2}},{now:T+1000}).error,'Invalid operation prompt layout');assert.deepEqual(applyAction(w,gm,body,{now:T+1000}).artworkPromptPositions,{mobile:layout,desktop:layout});assert.deepEqual(worldView(w,actor.key,T+1000).artworkPromptPositions,{mobile:layout,desktop:layout});assert.ok(validPromptLayout(layout));assert.deepEqual(operationPromptLayout({x:.1,gap:.2}),{x:.1,gap:.2,scale:.7,opacity:.5});});
test('responsive prompt stacks stay above A and inside the viewport',()=>{for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1920,1080]])for(const scale of [.4,.7,1.8])for(const gap of [0,.2,.6])for(const x of [-.4,0,.4]){const a={left:width-150,top:height-90,width:64,height:64},boxes=[{width:310,height:55},{width:170,height:33},{width:260,height:40}],res=promptPlacement(a,{width,height},{x,gap,scale,opacity:.5},boxes);res.forEach((p,i)=>{const b=boxes[i];assert.ok(p.x-b.width*p.scale/2>=0&&p.x+b.width*p.scale/2<=width);assert.ok(p.y<=a.top-8+1e-7&&p.y-b.height*p.scale>=-1e-7);if(i)assert.ok(p.y<=res[i-1].y-boxes[i-1].height*res[i-1].scale-4+1e-7);});}});
test('mana warning has a separate timer and fixed opacity, never included in GM prompt stack',()=>{const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');assert.match(read('src/ui.js'),/const notice=\$\('mana-notice'\)/);assert.match(read('fidelity-ui.css'),/#mana-notice\.visible\{opacity:\.3\}/);assert.match(read('src/operation-prompt-layout.js'),/\[prompt,toast,purchase\]\.filter/);assert.match(read('src/reletter/damage-numbers.js'),/\+MP .*\+HP /);});
