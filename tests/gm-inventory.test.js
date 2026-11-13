import test from 'node:test';import assert from 'node:assert/strict';
import {createInitialWorld,createProfile,ensureProfile} from '../src/shared/temple-rules.js';
import {ITEMS} from '../src/shared/catalog.js';
test('GM gets all item IDs on creation and existing-profile login; ordinary players do not',()=>{
 const world=createInitialWorld();world.profiles.gm=createProfile('gm','Ely','#bde8dc',0,false);
 const gm=ensureProfile(world,'gm','Ely','#bde8dc',1,true);assert.ok(ITEMS.every(i=>gm.inventory.includes(i.id)));
 assert.ok(ITEMS.every(i=>createProfile('new','Ely','#bde8dc',0,true).inventory.includes(i.id)));
 assert.ok(createProfile('user','User','#bde8dc').inventory.length<ITEMS.length);
});
