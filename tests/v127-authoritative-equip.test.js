import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentStatRows,levelAttributeScale,playerStats} from '../src/shared/player-stats.js';
import {createInitialWorld,ensureProfile,worldProfileView} from '../src/shared/temple-rules.js';
const row=(profile,label='ATK')=>equipmentStatRows(profile).find(r=>r.label===label);
test('old server level 100 cannot create phantom negative equipment bonuses',()=>{
 const p={level:100,stats:{attack:1,speed:1,jump:1,defense:1,maxHp:496,maxMana:496}};
 assert.deepEqual(row(p),{label:'ATK',total:100,base:100,level:0,gear:0});
 for(const k of ['SPD','JUMP','DEF'])assert.equal(row(p,k).gear,0);
 assert.equal(row({...p,stats:{...p.stats,attack:1.3}}).gear,30);
 assert.equal(row({level:100}).total,'—');
});
test('new server level multiplier and equipment contribution exactly reconcile',()=>{
 const s=levelAttributeScale(100),p={level:100,stats:{levelScale:s,attack:s,speed:s,jump:s,defense:1/s,maxHp:496,maxMana:496}};
 assert.deepEqual(row(p),{label:'ATK',total:149.7,base:100,level:49.7,gear:0});
 const boosted=row({...p,stats:{...p.stats,attack:s*1.2}});
 assert.equal(boosted.gear,30);assert.equal(boosted.total,179.7);
 assert.ok(row({...p,stats:{...p.stats,attack:s*.8}}).gear<0);
});
test('level 100 private view uses server combat stats and preserves equipment',()=>{
 const now=100000000,w=createInitialWorld(now),p=ensureProfile(w,'a','A','#123456',now);
 const before=playerStats(w,p,now),equipment=JSON.stringify(p.equipment);p.level=100;
 const view=worldProfileView(w,p.key,now),scale=levelAttributeScale(100);
 assert.equal(view.stats.attack,before.attack*scale);
 assert.equal(view.stats.levelScale,scale);assert.equal(JSON.stringify(view.equipment),equipment);
 const atk=row(view);assert.equal(atk.level,49.7);assert.ok(Math.abs(atk.gear-(before.attack-1)*scale*100)<.11);
});
