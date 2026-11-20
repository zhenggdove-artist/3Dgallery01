import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GOLDFISH_SCHOOL_COUNT,GOLDFISH_T1_DAMAGE_PER_FISH,
 GOLDFISH_T1_TOTAL_MAX,goldfishDirectHitBudget} from '../src/shared/goldfish-school.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('T1 school of thirty independent fish can never directly exceed 90 damage per enemy',()=>{
 assert.equal(GOLDFISH_SCHOOL_COUNT,30);
 assert.equal(GOLDFISH_T1_DAMAGE_PER_FISH,3);
 assert.equal(GOLDFISH_T1_TOTAL_MAX,90);
 assert.ok(goldfishDirectHitBudget(1)<100);
 assert.equal(goldfishDirectHitBudget(1,true),18);
 const server=source('src/shared/temple-rules.js');
 assert.match(server,/const remaining=Math.max\(0,totalBudget-\(fx\.damageSpent\[key\]\|\|0\)\)/);
 assert.match(server,/const raw=Math.min\(direct,remaining\/Math.max\(\.001,amplification\)\)/);
 assert.match(server,/fx\.fishConsumed\.push\(i\)/);
});
test('SHOP and BAG render only complete previews; no old glyph or Promise image URLs',()=>{
 const shop=source('src/ui.js'),bag=source('src/bag-view.js'),preview=source('src/item-preview.js');
 assert.match(shop,/\$\{previewMarkup\(item\)\}/);
 assert.match(shop,/void hydrateItemPreviews\(this\.content\)/);
 assert.doesNotMatch(shop,/icons\.set\(item\.id/);
 assert.match(bag,/\$\{previewMarkup\(item\)\}/);
 assert.doesNotMatch(bag,/fallbackItemIcon|requestAnimationFrame\(drawNext\)/);
 assert.match(preview,/const finished=new Map\(\),pending=new Map\(\)/);
 assert.match(preview,/await preloadImage\(url\)/);
 assert.doesNotMatch(preview,/import \{itemIcon\}|Promise\.resolve\(itemIcon/);
 const main=source('src/main.js');
 assert.match(main,/await warmItemPreviews\(ITEMS/);
});
test('all particle silhouettes compile while loading and share range-adjustable pooled geometry',()=>{
 const particles=source('src/weapon-particle-effects.js');
 assert.match(particles,/uBakedReach/);
 assert.match(particles,/const key=\[recipe,count\]/);
 assert.match(particles,/renderer\.compileAsync\(stage,camera\)/);
 assert.match(particles,/new Set\(\[\.\.\.Object\.values\(PARTICLE_RECIPES\)/);
 const vfx=source('src/weapon-vfx.js'),fish=source('src/weapon-signature-effects.js');
 assert.match(vfx,/frequentlyLayered/);
 assert.match(fish,/bodyGeo\.setAttribute\('color'/);
 assert.match(fish,/new THREE\.InstancedMesh/);
 assert.match(fish,/instances\.setColorAt/);
});
