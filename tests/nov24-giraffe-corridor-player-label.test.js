import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';
import {chargedArea,spellFootprint,scaleUltimateFootprint,insideSpellFootprint} from '../src/shared/charge-area.js';
import {updateArtworkTitleVisibility} from '../src/artwork-surface.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('charged giraffe boomerang previews its entire outbound/return corridor, not an AoE circle',()=>{
 const item=itemById('giraffe'),quality=weaponQuality(item);
 const stats=attackStats(item,1);
 stats.range=+(stats.range*quality.range).toFixed(2);
 stats.radius=forwardCastRadius(item,quality,stats.radius,false);
 scaleUltimateFootprint(stats,item,quality);
 // Keep this test aligned with the server-owned travelling giraffe hitbox.
 stats.range=+(item.chargedRange*quality.range).toFixed(2);
 stats.radius=Math.max(stats.radius,5.9*quality.visual);
 const origin=[10,1,20],direction=[0,0,1];
 const area=chargedArea(item,origin,direction,stats);
 const footprint=spellFootprint(item,origin,direction,stats,area);
 assert.equal(footprint.shape,'rectangle');
 assert.equal(footprint.length,stats.range);
 assert.equal(footprint.width,2*stats.radius);
 assert.equal(footprint.position[0],origin[0]);
 assert.ok(Math.abs(footprint.position[2]-(origin[2]+stats.range/2))<1e-6);
 assert.equal(insideSpellFootprint(footprint,[10,0,20+stats.range*.8]),true);
 assert.equal(insideSpellFootprint(footprint,[10,0,20+stats.range+1]),false);
 assert.equal(insideSpellFootprint(footprint,[10+stats.radius+1,0,20+stats.range*.5]),false);
 // An ordinary melee swing must not acquire the charged warning corridor.
 const normal=attackStats(item,0);
 assert.equal(spellFootprint(item,origin,direction,normal,null).shape,'circle');
});

test('artwork labels respond to avatar-to-art distance, including editing without an avatar',()=>{
 const root=new THREE.Group();
 root.position.set(12,0,0);
 const plate=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,opacity:1}));
 root.add(plate);
 root.userData.titlePlate=plate;
 root.userData.appearance={labelRevealDistance:8};
 const avatar=new THREE.Vector3(12,0,3);
 const cameraZoomedOut=new THREE.Vector3(12,45,100);
 assert.equal(updateArtworkTitleVisibility(root,avatar),1);
 assert.equal(plate.material.opacity,1);
 // Camera is deliberately far away; it is not the source for the label test.
 assert.ok(cameraZoomedOut.distanceTo(root.position)>80);
 assert.equal(updateArtworkTitleVisibility(root,avatar),1);
 assert.equal(updateArtworkTitleVisibility(root,new THREE.Vector3(12,0,100)),0);
 assert.equal(plate.material.opacity,0);
 assert.equal(updateArtworkTitleVisibility(root,undefined),0);
 root.userData.editing=true;
 assert.equal(updateArtworkTitleVisibility(root,undefined),1);
});

test('runtime passes the local player into label visibility and preserves giraffe server dimensions',()=>{
 const arena=source('src/arena-view.js');
 const main=source('src/main.js');
 const warning=source('src/charge-target-preview.js');
 const rules=source('src/shared/temple-rules.js');
 assert.match(main,/arena\.update\(dt,time,camera,roots,localRoot\)/);
 assert.match(arena,/updateArtworkTitleVisibility\(root,viewerRoot\?\.position\)/);
 assert.doesNotMatch(arena,/updateArtworkTitleVisibility\(root,camera\.position\)/);
 assert.match(warning,/\(equipped\.baseId\|\|equipped\.id\)==='giraffe'&&stats\.ultimate/);
 assert.match(warning,/stats\.range=\+\(equipped\.chargedRange\*quality\.range\)/);
 assert.match(warning,/5\.9\*quality\.visual/);
 assert.match(rules,/\(weapon\.baseId\|\|weapon\.id\)==='giraffe'&&stats\.ultimate/);
 assert.match(rules,/stats\.radius=Math\.max\(stats\.radius,5\.9\*quality\.visual\)/);
});
