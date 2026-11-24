import test from 'node:test';
import assert from 'node:assert/strict';
import {setArtworkLayout} from '../src/shared/temple-rules.js';
import {APPEARANCE_DEFAULTS} from '../src/shared/artwork-library.js';
import {editorPanelMarkup} from '../src/art-editor-panel.js';
const actor={key:'owner',role:'fighter'},profile={admin:false,hp:100,deadUntil:0};
const setup=()=>({customArtworks:[{id:'bomb-test',position:[0,2,0],owner:'owner',bomb:true,title:'Art'}],artworks:{'bomb-test':{holder:null,availableAt:0}},artworkLayout:{'bomb-test':{position:[0,2,0],rotation:[0,0,0],scale:[1,1,1],appearance:APPEARANCE_DEFAULTS,revision:1}},revision:1});
const request=()=>({platformId:'bomb-test',expectedRevision:1,layout:{position:[2,3,4],rotation:[0,.2,0],scale:[2,1.5,1],appearance:{...APPEARANCE_DEFAULTS,labelOffsetX:1,labelFontSize:60},title:'New title',author:'Artist'}});
test('creator can edit title author nonuniform dimensions and label position with shared server action',()=>{
 const w=setup(),result=setArtworkLayout(w,profile,request(),100,actor);
 assert.equal(result.error,undefined);assert.equal(result.artworkLayout.author,'Artist');assert.equal(w.customArtworks[0].author,'Artist');assert.deepEqual(result.artworkLayout.scale,[2,1.5,1]);assert.equal(result.artworkLayout.appearance.labelOffsetX,1);
 assert.ok(setArtworkLayout(w,profile,request(),100,actor).error);
});
test('other players, spectators, dead owners and owner of locked artwork cannot modify layout',()=>{
 for(const [who,pr] of [[{...actor,key:'other'},profile],[{...actor,role:'spectator'},profile],[actor,{...profile,hp:0}]]){
  const w=setup();assert.ok(setArtworkLayout(w,pr,request(),100,who).error);assert.equal(w.artworkLayout['bomb-test'].revision,1);
 }
 const w=setup();w.artworks['bomb-test'].holder='other';assert.ok(setArtworkLayout(w,profile,request(),100,actor).error);
});
test('player shares GM markup but without numeric XYZ fields',()=>{
 const markup=editorPanelMarkup(APPEARANCE_DEFAULTS,3,false,'Art','Artist',true);
 assert.match(markup,/data-art-author/);assert.match(markup,/data-action="move"/);assert.doesNotMatch(markup,/data-axis=/);assert.match(markup,/data-action="label-resize"/);
});
