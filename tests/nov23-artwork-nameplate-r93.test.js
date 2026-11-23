import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addArtworkTitlePlate,applyArtworkAppearance} from '../src/artwork-surface.js';
import {ArtworkEditor} from '../src/artwork-editor.js';
import {editorPanelMarkup,playerArtworkAppearanceMarkup} from '../src/art-editor-panel.js';
import {APPEARANCE_DEFAULTS,validateAppearance} from '../src/shared/artwork-library.js';
import {createInitialWorld,applyMyArtworkLabelStyle} from '../src/shared/temple-rules.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('nameplate style validates both colours, font range, sizes and offsets',()=>{
 const accepted=validateAppearance({...APPEARANCE_DEFAULTS,labelColor:'#ee8800',labelFontSize:76,
  labelWidth:4.7,labelHeight:.8,labelOffsetX:1,labelOffsetY:-2});
 assert.equal(accepted?.labelFontSize,76);
 assert.equal(accepted.labelColor,'#ee8800');
 assert.equal(validateAppearance({...accepted,labelFontSize:121}),null);
 assert.equal(validateAppearance({...accepted,labelColor:'red'}),null);
 assert.equal(validateAppearance({...accepted,labelWidth:100}),null);
 assert.equal(validateAppearance({...accepted,labelOffsetX:100}),null);
});

test('nameplate resizing leaves independently drawn typography centered and unscaled',()=>{
 const originalDocument=globalThis.document;
 try{
  globalThis.document={createElement:()=>({
   width:0,height:0,getContext:()=>({
    font:'',fillStyle:'',textAlign:'',textBaseline:'',
    fillRect(){},fillText(){},measureText:v=>({width:v.length*21})
   })
  })};
  const root=new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(3,2,1),new THREE.MeshBasicMaterial()));
  root.userData={record:{title:'A long enough name',mediaId:'media-one'}};
  const first=addArtworkTitlePlate(root,'A long enough name','#000000',{
   labelWidth:3.5,labelHeight:.492,labelFontSize:44,labelColor:'#ffffff'
  });
  assert.equal(first.isSprite,true);
  assert.equal(root.children.filter(n=>n.isSprite).length,1);
  const text=first.userData.textSprite;
  assert.ok(text?.isSprite);
  assert.equal(text.position.x,0);
  assert.equal(text.position.y,0);
  const initialTextWorldWidth=text.scale.x*first.scale.x;
  const firstY=first.position.y;
  const second=addArtworkTitlePlate(root,'A long enough name','#c0ffee',{
   labelWidth:6.5,labelHeight:1.6,labelFontSize:44,labelColor:'#ff00ff'
  });
  assert.equal(second.scale.x,6.5);
  assert.equal(second.scale.y,1.6);
  assert.equal(second.userData.textSprite.position.x,0);
  assert.equal(second.userData.textSprite.position.y,0);
  assert.ok(Math.abs(second.scale.x*second.userData.textSprite.scale.x-initialTextWorldWidth)<1e-8);
  assert.ok(second.position.y<firstY,'top edge remains anchored below the artwork');
  assert.equal(root.children.filter(n=>n.isSprite).length,1,'old GPU label removed');
  assert.equal(addArtworkTitlePlate(root,'A long enough name','#c0ffee',{
   labelWidth:6.5,labelHeight:1.6,labelFontSize:44,labelColor:'#ff00ff'
  }),second,'unchanged render avoids reallocation');
  applyArtworkAppearance(root,{...APPEARANCE_DEFAULTS,labelColor:'#11ee33'});
  assert.equal(root.userData.titlePlateSignature.includes('#11ee33'),true);
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});

test('GM artwork panel and player-owned editor expose all nameplate colour/font inputs',()=>{
 const gm=editorPanelMarkup(APPEARANCE_DEFAULTS,3,true,'Artwork');
 const player=playerArtworkAppearanceMarkup({id:'owner-1',title:'Mine'},null,x=>x);
 for(const token of ['data-action="label-resize"','data-appearance="labelFontSize"',
  'data-appearance="labelColor"','data-appearance="labelWidth"',
  'data-appearance="labelHeight"','data-action="apply-own-labels"'])assert.ok(gm.includes(token),token);
 for(const token of ['name="labelFontSize"','name="labelColor"',
  'name="labelWidth"','name="labelHeight"','data-apply-my-label-style'])assert.ok(player.includes(token),token);
 const editor=read('src/artwork-editor.js');
 assert.match(editor,/labelHandles\.addEventListener\('pointerdown'/);
 assert.match(editor,/handleCoordinates\.map/);
 assert.match(editor,/this\.updateLabelHandles\(\)/);
 assert.match(editor,/applyArtworkAppearance\(this\.selected,this\.appearance\)/);
 const main=read('src/main.js'),ui=read('src/ui.js');
 assert.match(ui,/art-bomb-appearance-preview/);
 assert.match(main,/previewAppearance=\{\.\.\.appearance\}/);
 assert.match(main,/delete root\.userData\.previewAppearance/);
 assert.match(ui,/apply-my-label-style/);
});

test('bulk label changes affect precisely the authenticated uploader, not other players or original gallery',()=>{
 const world=createInitialWorld(1000);
 world.customArtworks=[
  {id:'mine-1',owner:'owner-one',title:'Mine 1',mediaId:'m1',mime:'image/png'},
  {id:'mine-2',owner:'owner-one',title:'Mine 2',mediaId:'m2',mime:'image/png'},
  {id:'other-1',owner:'other-user',title:'Other',mediaId:'m3',mime:'image/png'}
 ];
 for(const a of world.customArtworks)
  world.artworkLayout[a.id]={position:[0,1,0],rotation:[0,0,0],scale:[1,1,1],
   appearance:{...APPEARANCE_DEFAULTS,labelBackground:'#111111'},revision:1,updatedAt:1000};
 const original=world.artworkLayout['platform-01'];
 const beforeOther=structuredClone(world.artworkLayout['other-1']);
 const style={labelBackground:'#123456',labelColor:'#eeddcc',labelFontSize:73,
  labelWidth:7,labelHeight:1.5};
 const ok=applyMyArtworkLabelStyle(world,{key:'owner-one',admin:false},{style},3000);
 assert.equal(ok.error,undefined,ok.error);
 assert.equal(ok.updatedCount,2);
 assert.deepEqual(ok.appliedIds,['mine-1','mine-2']);
 for(const id of ['mine-1','mine-2']){
  assert.equal(world.artworkLayout[id].appearance.labelColor,'#eeddcc');
  assert.equal(world.artworkLayout[id].appearance.labelBackground,'#123456');
  assert.equal(world.artworkLayout[id].appearance.labelFontSize,73);
  assert.equal(world.artworkLayout[id].revision,2);
 }
 assert.deepEqual(world.artworkLayout['other-1'],beforeOther);
 assert.equal(world.artworkLayout['platform-01'],original);
 const admin=applyMyArtworkLabelStyle(world,{key:'owner-one',admin:true},{
  style:{...style,labelColor:'#0055cc'}},4000);
 assert.equal(admin.updatedCount,2,'GM status still does not widen ownership');
 assert.equal(world.artworkLayout['other-1'].appearance.labelColor,'#ffffff');
 assert.match(applyMyArtworkLabelStyle(world,{key:'stranger'},{
  style},5000).error,/have not uploaded/);
 assert.match(applyMyArtworkLabelStyle(world,{key:'owner-one'},{
  style:{...style,labelFontSize:999}},5000).error,/Invalid nameplate/);
 assert.equal(world.artworkLayout['mine-1'].revision,3,'invalid update leaves revisions unchanged');
});

test('corner drag remains uniform and edge midpoint drag changes only one dimension',()=>{
 const originalDocument=globalThis.document;
 try{
  globalThis.document={createElement:()=>({
   width:0,height:0,getContext:()=>({
    font:'',fillStyle:'',textAlign:'',textBaseline:'',
    fillRect(){},fillText(){},measureText:v=>({width:v.length*21})
   })
  })};
  const root=new THREE.Group();root.userData={record:{title:'Framed',mediaId:'media'}};
  root.add(new THREE.Mesh(new THREE.BoxGeometry(2,2,1),new THREE.MeshBasicMaterial()));
  const state={
   selected:root,appearance:{...APPEARANCE_DEFAULTS},
   panel:{querySelector:()=>null},
   status:()=>{},updateLabelHandles:()=>{},dirty:false
  };
  const rect={width:300,height:100,right:new THREE.Vector3(1,0,0),
   up:new THREE.Vector3(0,1,0),rootScale:new THREE.Vector3(1,1,1),
   rootQuaternion:new THREE.Quaternion()};
  state.labelDrag={pointer:42,index:0,x:100,y:100,rect,style:{...state.appearance}};
  const move=(x,y)=>ArtworkEditor.prototype.resizeLabel.call(state,{
   pointerId:42,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}
  });
  move(70,70);
  assert.ok(Math.abs(state.appearance.labelWidth/3.5-1.2)<1e-9);
  assert.ok(Math.abs(state.appearance.labelHeight/.492-1.2)<1e-9);
  const textScale=root.userData.titlePlate.scale.x*
   root.userData.titlePlate.userData.textSprite.scale.x;
  const newWidth=state.appearance.labelWidth,newHeight=state.appearance.labelHeight;
  state.labelDrag={pointer:42,index:3,x:100,y:100,rect,
   style:{...state.appearance}};
  move(150,100);
  assert.ok(state.appearance.labelWidth>newWidth,'right midpoint stretches width');
  assert.equal(state.appearance.labelHeight,newHeight,'right midpoint does not alter height');
  assert.ok(Math.abs(
   root.userData.titlePlate.scale.x*
   root.userData.titlePlate.userData.textSprite.scale.x-textScale)<1e-9,
   'lettering stays centered and unscaled across all backdrop transformations');
  assert.equal(root.userData.titlePlate.userData.textSprite.position.x,0);
  assert.equal(root.userData.titlePlate.userData.textSprite.position.y,0);
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
