import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createHeadgear,disposeHeadgear} from '../src/engine/headgear-model.js';
import {itemById} from '../src/shared/catalog.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('compact bag has two explicit rows and collapsible sale tools',()=>{
 const bag=read('src/bag-view.js'),ui=read('src/ui.js'),css=read('fidelity-ui.css');
 assert(bag.includes("const tabs=[[['all','Items']"));assert(bag.includes("],[['head','Headwear']"));
 assert(bag.includes('class="bag-toolbar"'));assert(bag.includes('id="bag-sale-toggle"'));assert(bag.includes('id="bag-sale-tools"'));assert(ui.includes("bag:'BAG'"));assert(css.includes('.bag-sale-tools[hidden]{display:none!important}'));
});
test('buy is pending immediately and confirmation precedes world reconciliation',()=>{
 const main=read('src/main.js'),ui=read('src/ui.js');
 assert(main.includes("ui.showPurchaseStatus('pending','PURCHASING…')"));
 const action=main.slice(main.indexOf('async function sendAction'));
 assert(action.indexOf('ui.purchaseNotice(')<action.indexOf('acceptWorldView(result.world)'));
 assert(ui.includes('},3500);'));assert(ui.includes("if(state==='pending')return;"));
});
test('Huang and Musk have separate dense sculpted meshes; Trump remains on original path',()=>{
 for(const [id,sculpt] of [['hat-huang-mask','huang-mask-r115'],['hat-musk-mask','musk-mask-r115'],['hat-trump-mask','trump-mask-r115']]){
  const root=createHeadgear(T,itemById(id));assert.equal(root.userData.portraitSculpt,sculpt);
  let max=0;root.traverse(o=>{if(o.isMesh)max=Math.max(max,o.geometry.getAttribute('position').count);});
  assert(max>(sculpt?10000:9000),id);disposeHeadgear(root);
 }
});
