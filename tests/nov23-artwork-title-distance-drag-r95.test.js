import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {artworkAppearanceDefaults,validateAppearance} from '../src/shared/artwork-library.js';
import {createInitialWorld,setArtworkLayout} from '../src/shared/temple-rules.js';
import {PLATFORMS} from '../src/shared/arena.js';
import {ArtworkEditor,LABEL_LONG_PRESS_MS,labelLocalDeltaFromScreen} from '../src/artwork-editor.js';
import {editorPanelMarkup} from '../src/art-editor-panel.js';
import {addArtworkTitlePlate,titleOpacityByDistance,updateArtworkTitleVisibility} from '../src/artwork-surface.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

const fakeDocument=()=>({
 createElement:()=>({
  width:0,height:0,
  getContext:()=>({
   font:'',fillStyle:'',textAlign:'',textBaseline:'',
   measureText:text=>({width:text.length*20}),fillRect(){},fillText(){}
  })
 })
});
function withRoot(fn){
 const previous=globalThis.document;
 globalThis.document=fakeDocument();
 try{
  const root=new THREE.Group();
  root.userData={record:{mediaId:'image',title:'EXHIBIT'}};
  root.add(new THREE.Mesh(new THREE.BoxGeometry(3,2,.2),new THREE.MeshBasicMaterial()));
  addArtworkTitlePlate(root,'EXHIBIT','#000000',{labelRevealDistance:12});
  return fn(root);
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
}

test('proximity fade uses smoothstep near a GM-specified start distance',()=>{
 assert.equal(titleOpacityByDistance(30,12),0);
 assert.equal(titleOpacityByDistance(12,12),0);
 assert.ok(Math.abs(titleOpacityByDistance(10.5,12)-.5)<1e-7);
 assert.equal(titleOpacityByDistance(9,12),1);
 assert.equal(titleOpacityByDistance(6,12),1);
 assert.equal(titleOpacityByDistance(25,24),0);
 assert.equal(titleOpacityByDistance(21,24),1);
 assert.ok(titleOpacityByDistance(22.5,24)>0&&titleOpacityByDistance(22.5,24)<1);
});
test('both text and nameplate background fade together; GM editing forces visibility',()=>withRoot(root=>{
 root.userData.appearance={...artworkAppearanceDefaults(),labelRevealDistance:12};
 let alpha=updateArtworkTitleVisibility(root,new THREE.Vector3(0,0,30));
 assert.equal(alpha,0);
 assert.equal(root.userData.titlePlate.material.opacity,0);
 assert.equal(root.userData.titlePlate.userData.textSprite.material.opacity,0);
 alpha=updateArtworkTitleVisibility(root,new THREE.Vector3(0,0,10.5));
 assert.ok(Math.abs(alpha-.5)<1e-7);
 assert.equal(root.userData.titlePlate.userData.textSprite.material.opacity,alpha);
 root.userData.editing=true;
 assert.equal(updateArtworkTitleVisibility(root,new THREE.Vector3(0,0,40)),1);
 assert.equal(root.userData.titlePlate.material.opacity,1);
 assert.equal(root.userData.titlePlate.userData.textSprite.material.opacity,1);
}));
test('GM slider persists and server rejects unreasonable distances',()=>{
 const html=editorPanelMarkup(artworkAppearanceDefaults(),3,false,'Title');
 assert.match(html,/data-appearance="labelRevealDistance"/);
 assert.match(html,/data-label-distance-output/);
 assert.match(html,/data-action="label-center"/);
 assert.equal(validateAppearance({labelRevealDistance:3}).labelRevealDistance,3);
 assert.equal(validateAppearance({labelRevealDistance:80}).labelRevealDistance,80);
 assert.equal(validateAppearance({labelRevealDistance:2}),null);
 assert.equal(validateAppearance({labelRevealDistance:81}),null);
 const world=createInitialWorld(5000),id=PLATFORMS[0].id;
 const layout=world.artworkLayout?.[id]||{
  position:[...PLATFORMS[0].artPosition],rotation:[0,0,0],scale:[1,1,1]
 };
 const response=setArtworkLayout(world,{admin:true},{
  platformId:id,expectedRevision:layout.revision||0,
  layout:{...layout,appearance:{labelRevealDistance:24},title:'Test'}},6000);
 assert.equal(response.error,undefined,response.error);
 assert.equal(world.artworkLayout[id].appearance.labelRevealDistance,24);
 assert.equal(world.artworkLayout[id].appearance.labelBackground,'#000000');
});

test('screen-to-artwork coordinates account for inverse projected camera basis',()=>{
 assert.deepEqual(labelLocalDeltaFromScreen(80,60,
  {ax:160,ay:0,bx:0,by:-120}),{x:.5,y:-.5});
 const oblique=labelLocalDeltaFromScreen(20,-30,
  {ax:100,ay:-10,bx:20,by:-100});
 assert.ok(oblique.x>0);
 assert.ok(oblique.y>0);
 assert.equal(labelLocalDeltaFromScreen(10,20,
  {ax:1,ay:2,bx:2,by:4}),null,'edge-on geometry avoids invalid jumps');
});
test('mobile long-press moves only nameplate X/Y and never changes the art root or text centering',()=>withRoot(root=>{
 assert.equal(LABEL_LONG_PRESS_MS,600);
 const startRoot=root.position.clone(),plate=root.userData.titlePlate;
 const dragSurface={classList:{add(){},remove(){}}};
 const captured={};
 const target={
  closest:selector=>selector==='[data-label-drag-target]'?target:null,
  setPointerCapture:id=>captured.id=id,
  hasPointerCapture:id=>captured.id===id,
  releasePointerCapture:id=>{if(captured.id===id)captured.id=null;}
 };
 const panel={querySelector:()=>null};
 const editor={
  selected:root,mode:'label',
  appearance:{...artworkAppearanceDefaults()},
  labelDragSurface:dragSurface,labelMove:null,dirty:false,
  labelMoveBasis:()=>({ax:100,ay:0,bx:0,by:-100}),
  status(){},updateLabelHandles(){},camera:{position:new THREE.Vector3(0,0,9)}
 };
 // Borrow instance methods without needing WebGL or any real DOM.
 for(const key of ['beginLabelMove','dragLabelMove','endLabelMove','centerLabel'])
  editor[key]=function(...args){return ArtworkEditor.prototype[key].apply(editor,args)};
 const event=(x,y)=>({
  pointerId:14,button:0,clientX:x,clientY:y,target,
  preventDefault(){},stopPropagation(){}
 });
 editor.beginLabelMove(event(120,120));
 assert.ok(editor.labelMove,'press is pending');
 assert.equal(editor.labelMove.active,false);
 // Simulate the elapsed 600ms timer deterministically.
 editor.labelMove.active=true;
 editor.dragLabelMove(event(170,170));
 assert.equal(editor.appearance.labelOffsetX,.5);
 assert.equal(editor.appearance.labelOffsetY,-.5);
 assert.equal(root.userData.titlePlate.position.x,.5);
 assert.ok(root.position.equals(startRoot));
 assert.ok(editor.dirty);
 editor.endLabelMove(event(170,170));
 assert.equal(editor.labelMove,null);
 assert.equal(root.userData.titlePlate.userData.textSprite.position.x,0);
 assert.equal(root.userData.titlePlate.userData.textSprite.position.y,0);
 assert.equal(root.userData.titlePlate.material.opacity,1);
 editor.centerLabel();
 assert.equal(editor.appearance.labelOffsetX,0);
 assert.equal(editor.appearance.labelOffsetY,-.5,'horizontal centering keeps vertical adjustment');
 assert.ok(root.position.equals(startRoot));
}));
test('in-world label drag surface remains below 8 interactive corner/mid-edge handles',()=>{
 const editor=read('src/artwork-editor.js'),css=read('fidelity-ui.css');
 assert.match(editor,/data-label-drag-target/);
 assert.match(editor,/beginLabelMove\(e\)/);
 assert.match(editor,/dragLabelMove\(e\)/);
 assert.match(editor,/pending\.active=true/);
 assert.match(css,/#art-label-handles \.label-drag-target/);
 assert.match(css,/#art-label-handles \.label-handle/);
 assert.match(read('src/arena-view.js'),/updateArtworkTitleVisibility\(root,viewerRoot\?\.position\)/);
});
