import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,applyAction} from '../src/shared/temple-rules.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('player and GM upload require artist-provided artwork titles',()=>{
 const ui=source('src/ui.js'),main=source('src/main.js');
 assert.ok(ui.includes('<form data-form="art-bomb-upload"><label>作品名稱<input type="text" name="title" maxlength="100" required'));
 assert.ok(ui.includes('data-form="upload-artwork"')&&ui.includes('<label>作品名稱<input name="title" type="text" maxlength="100" required'));
 assert.ok(ui.includes("this.emit('art-bomb-upload',{files,title,size"));
 assert.ok(main.includes('title:title.trim().slice(0,100)'));
 assert.ok(main.includes('title:event.detail.title.trim().slice(0,100)'));
});
test('player and GM artwork titles persist in authoritative world',()=>{
 const world=createInitialWorld(1000),actor={key:'artist',name:'Artist',role:'fighter',position:[75,0,0],color:'#ffffff',admin:false},title='我的作品 · Rain & 螢火';
 const result=applyAction(world,actor,{action:'publish-art-bomb',artwork:{title,position:[77,1.5,0]},size:1,verifiedArtMedia:{id:'verified-asset',type:'image/png'}},{now:2000});
 assert.equal(result.error,undefined,result.error);assert.equal(result.artwork?.title,title);assert.equal(world.customArtworks[0].title,title);
 const gm={...actor,key:'gm',admin:true};
 const upload=applyAction(world,gm,{action:'add-artwork',artwork:{title:'GM — 展覽名稱',position:[77,2,2]},verifiedArtMedia:{id:'gm-asset',type:'image/png'}},{now:3000});
 assert.equal(upload.error,undefined,upload.error);assert.equal(upload.artwork?.title,'GM — 展覽名稱');
});
test('in-world art title plates and timed chat speech are wired',()=>{
 const art=source('src/artwork-surface.js'),ui=source('src/ui.js'),main=source('src/main.js'),css=source('fidelity-ui.css');
 assert.ok(art.includes('addArtworkTitlePlate(root,record.title,initialAppearance?.labelBackground,initialAppearance)'));
 assert.ok(art.includes("fillStyle=backdrop")&&art.includes('fillStyle=color')&&art.includes("background='#000000'"));
 assert.ok(ui.includes("addEventListener('compositionend'")&&ui.includes("addEventListener('keydown'"));
 assert.ok(main.includes('speechBubbles')&&main.includes('performance.now()+3000'));
 assert.ok(css.includes('--chat-height:118px'));
});
