import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,createProfile,ensureProfile} from '../src/shared/temple-rules.js';
import {STARTER_LOADOUT,itemById} from '../src/shared/catalog.js';

test('new fighter profiles start with the green Starlight saber in inventory and equipment',()=>{
  assert.equal(STARTER_LOADOUT.weapon,'saber-2');
  assert.equal(itemById('saber-2')?.name,'Dawn Starlight');
  const profile=createProfile('new','Player','#abcdef');
  assert.deepEqual(profile.inventory,['saber-2']);
  assert.equal(profile.equipment.weapon,'saber-2');
  const world=createInitialWorld();world.profiles.new=profile;
  assert.equal(ensureProfile(world,'new','Player','#abcdef').equipment.weapon,'saber-2');
});

test('legacy profiles retain White Cat starter ownership while preserving equipped gear',()=>{
  const world=createInitialWorld();
  world.profiles.old=createProfile('old','Veteran','#abcdef');
  delete world.profiles.old.starterWeaponId;
  world.profiles.old.inventory=['clam'];
  world.profiles.old.equipment.weapon='clam';
  const profile=ensureProfile(world,'old','Veteran','#abcdef');
  assert.equal(profile.equipment.weapon,'clam');
  assert.ok(profile.inventory.includes('white-cat'));
});

test('GM title panel and server-side history restriction are wired',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
  assert.match(html,/id="gm-title"[^>]*>GGTEMPLE<\/strong>/);
  assert.doesNotMatch(html,/id="gm-menu"/);
  assert.match(ui,/gmTitle\.addEventListener\('click',openGmTitle\)/);
  assert.match(ui,/if\(this\.self\?\.profile\?\.admin&&!this\.self\.gmSpectatorPreview\)this\.openPanel\('gm'\)/);
  assert.match(ui,/enabled=!!this\.self\?\.profile\?\.admin&&!this\.self\.gmSpectatorPreview/);
  assert.match(ui,/gm-presence-request/);
  assert.match(worker,/path==='\/api\/gm\/presence'&&request\.method==='GET'/);
  assert.match(worker,/session\.profile_key\]\?\.admin!==true\)return json\(\{error:'GM only'\},403\)/);
  assert.match(worker,/CREATE TABLE IF NOT EXISTS presence_events/);
  assert.match(worker,/this\.recordPresence\(\{name:profile\.name,role\},'online',now\)/);
  assert.match(worker,/this\.recordPresence\(row,'offline'\)/);
});
