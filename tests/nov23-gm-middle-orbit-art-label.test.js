import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {PlayerController} from '../src/player-controller.js';
import {editorPanelMarkup,playerArtworkAppearanceMarkup} from '../src/art-editor-panel.js';
import {addArtworkTitlePlate} from '../src/artwork-surface.js';
import {APPEARANCE_DEFAULTS,validateAppearance} from '../src/shared/artwork-library.js';
import {createInitialWorld,setArtworkLayout} from '../src/shared/temple-rules.js';
import {updateArtBombAppearance} from '../src/shared/art-bomb.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const at=4_500_000;
const label=(color='#000000')=>({...APPEARANCE_DEFAULTS,labelBackground:color});
function customWorld(){
 const world=createInitialWorld(at),id='art-manual-upload-1';
 world.customArtworks=[{id,title:'Untitled',mediaId:'media-1',type:'image',mime:'image/png',
  position:[15,2,10],owner:'gm-key',version:1}];
 world.artworks[id]={availableAt:0,holder:null,throwEvent:null};
 world.artworkLayout[id]={position:[15,2,10],rotation:[0,0,0],scale:[1,1,1],
  appearance:label(),revision:1,updatedAt:at};
 return {world,id};
}
test('Shift+O toggles GM disc edit while Shift+D remains available',()=>{
 const editor=read('src/platform-delete-editor.js'),help=read('src/ui.js');
 assert.match(editor,/\['KeyO','KeyD'\]\.includes\(e\.code\)/);
 assert.match(editor,/if\(this\.active\)this\.cancel\(\);else this\.begin\('edit'\)/);
 assert.match(help,/Shift \+ O：圓盤/);
});
test('middle-button drag keeps camera orbit active even when GM artwork transform locks movement',()=>{
 const oldW=globalThis.innerWidth,oldH=globalThis.innerHeight;
 try{
  globalThis.innerWidth=1000;globalThis.innerHeight=500;
  let called=null;
  const controller={yaw:0,pitch:0,updateCamera:(dt,forced)=>{called={dt,forced};}};
  PlayerController.prototype.orbitEditCamera.call(controller,100,50);
  assert.ok(Math.abs(controller.yaw+.4)<1e-8);
  assert.ok(Math.abs(controller.pitch-.2)<1e-8);
  assert.deepEqual(called,{dt:1,forced:true});
 }finally{
  if(oldW===undefined)delete globalThis.innerWidth;else globalThis.innerWidth=oldW;
  if(oldH===undefined)delete globalThis.innerHeight;else globalThis.innerHeight=oldH;
 }
 const main=read('src/main.js'),paint=read('src/city-wall-painter.js');
 assert.match(main,/e\.button!==1\|\|!canEditMiddleOrbit\(\)/);
 assert.match(main,/canvas\.setPointerCapture\(e\.pointerId\)/);
 assert.match(main,/controller\?\.orbitEditCamera\(dx,dy\)/);
 assert.match(main,/wallPainter\.active\|\|ui\.panelName==='build'/);
 assert.match(main,/platformDelete\.active\|\|artEditor\.selected/);
 assert.match(paint,/if\(event\.button!==0&&event\.pointerType==='mouse'\)return;/);
});
test('all saved and new uploaded art label backgrounds default to black and validate as CSS hex',()=>{
 assert.equal(APPEARANCE_DEFAULTS.labelBackground,'#000000');
 assert.equal(validateAppearance({}).labelBackground,'#000000');
 assert.equal(validateAppearance({labelBackground:'#5cabee'}).labelBackground,'#5cabee');
 assert.equal(validateAppearance({labelBackground:'not-a-color'}),null);
 assert.equal(validateAppearance({labelBackground:'#ff00'}),null);
});
test('GM can persist edited upload title and title backdrop in one revision-safe save',()=>{
 const {world,id}=customWorld(),layout=world.artworkLayout[id];
 const action={platformId:id,expectedRevision:1,layout:{
  ...layout,title:'The New \u0026 Strange Name',appearance:label('#234bcd')
 }};
 const response=setArtworkLayout(world,{admin:true},action,at+1000);
 assert.equal(response.error,undefined);
 assert.equal(response.artworkLayout.title,'The New & Strange Name');
 assert.equal(response.artworkLayout.appearance.labelBackground,'#234bcd');
 assert.equal(world.customArtworks[0].title,'The New & Strange Name');
 assert.equal(world.artworkLayout[id].revision,2);
 const conflict=setArtworkLayout(world,{admin:true},action,at+2000);
 assert.match(conflict.error,/Layout changed/);
 const invalid=setArtworkLayout(world,{admin:true},{
  ...action,expectedRevision:2,layout:{...action.layout,title:'  '}
 },at+2000);
 assert.match(invalid.error,/name/i);
 assert.equal(world.artworkLayout[id].revision,2);
});
test('player may change own label color but cannot modify another creator artwork',()=>{
 const {world,id}=customWorld();
 world.customArtworks[0].bomb=true;world.customArtworks[0].owner='artist-key';
 const request={id,expectedRevision:1,appearance:label('#ca324a')};
 const denied=updateArtBombAppearance(world,{key:'stranger',admin:false},request,at+200);
 assert.match(denied.error,/creator/);
 const saved=updateArtBombAppearance(world,{key:'artist-key',admin:false},request,at+250);
 assert.equal(saved.error,undefined);
 assert.equal(world.artworkLayout[id].appearance.labelBackground,'#ca324a');
 assert.equal(world.artworkLayout[id].revision,2);
 const invalid=updateArtBombAppearance(world,{key:'artist-key',admin:false},
  {...request,expectedRevision:2,appearance:label('#zzeedd')},at+300);
 assert.match(invalid.error,/Invalid/);
 assert.equal(world.artworkLayout[id].revision,2);
});
test('GM edit and player upload/appearance expose title and color picker; untrusted title is escaped',()=>{
 const gm=editorPanelMarkup(label(),3,false,'<Artwork & title>');
 const player=playerArtworkAppearanceMarkup({id:'bomb-1',title:'Test'},null,x=>String(x));
 const ui=read('src/ui.js'),main=read('src/main.js'),surface=read('src/artwork-surface.js');
 assert.match(gm,/data-art-title/);
 assert.match(gm,/value="&lt;Artwork &amp; title&gt;"/);
 assert.match(gm,/data-appearance="labelBackground"/);
 assert.match(player,/name="labelBackground"/);
 assert.match(ui,/name="labelBackground" type="color" value="#000000"/);
 assert.match(ui,/name="labelBackground" value="#000000"/);
 assert.match(main,/appearance:\{labelBackground:event\.detail\.labelBackground/);
 assert.match(main,/appearance:\{labelBackground:buildPlacement\.artwork\?\.labelBackground/);
 assert.match(surface,/addArtworkTitlePlate\(root,root\.userData\.editTitleDraft\?\?root\.userData\.record\.title,appearance\.labelBackground\)/);
});
test('title plate recolors in place without touching the 3D artwork or retaining its old GPU texture',()=>{
 const oldDoc=globalThis.document,paint=[];
 try{
  globalThis.document={createElement:()=>({
   width:0,height:0,
   getContext:()=>({font:'',fillStyle:'',textAlign:'',textBaseline:'',
    measureText:text=>({width:text.length*21}),
    fillRect(){paint.push(this.fillStyle);},fillText(){}})
  })};
  const root=new THREE.Group(),model=new THREE.Mesh(new THREE.BoxGeometry(2,2,1),new THREE.MeshBasicMaterial());
  root.add(model);root.userData={record:{title:'Old title',mediaId:'media-1'}};
  const first=addArtworkTitlePlate(root,'Old title','#000000');
  assert.ok(first?.isSprite);
  assert.equal(addArtworkTitlePlate(root,'Old title','#000000'),first);
  const second=addArtworkTitlePlate(root,'New title','#123abc');
  assert.ok(second?.isSprite);
  assert.notEqual(second,first);
  assert.equal(second.name,'Artwork title: New title');
  assert.equal(paint.at(-1),'#123abc');
  assert.equal(root.children.filter(o=>o.isSprite).length,1);
  assert.equal(root.children[0],model);
  const height=second.position.y;
  root.position.set(12,14,9);
  const third=addArtworkTitlePlate(root,'New title','#ef7721');
  assert.equal(third.position.y,height,'recolor must retain local layout below artwork');
  root.traverse(o=>{
   o.geometry?.dispose?.();o.material?.map?.dispose?.();o.material?.dispose?.();
  });
 }finally{if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;}
});
