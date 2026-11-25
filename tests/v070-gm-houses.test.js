
import test from 'node:test';import assert from 'node:assert/strict';import {GM_HOUSE_DEFAULT,validateGmHouse,gmHouseBlocked} from '../src/shared/arena.js';import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
test('GM house config is validated, rotated collision follows dimensions, and edits persist',()=>{
 const now=1e6,w=createInitialWorld(now),gm={key:'gm',name:'GM',color:'#ffffff',admin:true,role:'fighter',position:[75,0,0]},p={...gm,key:'p',name:'P',admin:false};
 ensureProfile(w,gm.key,gm.name,gm.color,now,true);ensureProfile(w,p.key,p.name,p.color,now,false);
 const draft={position:[80,0,0],rotation:Math.PI/2,house:{...GM_HOUSE_DEFAULT,width:12,depth:4}};
 assert.ok(validateGmHouse(draft));assert.equal(validateGmHouse({...draft,house:{...draft.house,floors:12}}),null);
 assert.equal(applyAction(w,p,{action:'gm-create-house',...draft},{now}).error,'GM only');
 const result=applyAction(w,gm,{action:'gm-create-house',...draft},{now});assert.ok(result.structureId);
 assert.ok(gmHouseBlocked(w.structures,80,5,1));assert.ok(!gmHouseBlocked(w.structures,85,0,1));
 const update=applyAction(w,gm,{action:'gm-update-house',structureId:result.structureId,...draft,position:[90,0,0],rotation:0},{now});assert.equal(update.structureId,result.structureId);
 assert.ok(!gmHouseBlocked(w.structures,80,0,1));assert.ok(gmHouseBlocked(w.structures,94,0,1));
 assert.ok(applyAction(w,gm,{action:'gm-delete-house',structureId:result.structureId},{now}).structureId);
});
