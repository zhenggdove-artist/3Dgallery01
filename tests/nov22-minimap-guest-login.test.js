import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Minimap} from '../src/minimap.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

class FakeSvgElement{
 constructor(tag){this.tagName=tag;this.attrs=new Map();this.children=[];this.parent=null;}
 setAttribute(name,value){this.attrs.set(name,String(value));}
 getAttribute(name){return this.attrs.get(name);}
 append(...nodes){
  for(const node of nodes){
   if(node.parent)node.parent.children=node.parent.children.filter(child=>child!==node);
   node.parent=this;this.children.push(node);
  }
 }
 remove(){
  if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);
  this.parent=null;
 }
}
test('minimap shows a heading triangle, distinct colored players, red enemies and purple collector',()=>{
 const elements=new Map([
  ['minimap',new FakeSvgElement('svg')],
  ['map-static',new FakeSvgElement('g')],
  ['map-dynamic',new FakeSvgElement('g')]
 ]);
 const previous=globalThis.document;
 globalThis.document={
  getElementById:id=>elements.get(id),
  createElementNS:(_ns,tag)=>new FakeSvgElement(tag)
 };
 try{
  const mini=new Minimap();
  const roots=new Map([
   ['me',{visible:true,position:{x:25,y:0,z:40},rotation:{y:Math.PI/2}}],
   ['p2',{visible:true,position:{x:30,y:0,z:42},rotation:{y:0}}],
   ['p3',{visible:true,position:{x:33,y:0,z:45},rotation:{y:0}}]
  ]);
  mini.update(1,roots,'me',{active:true,position:[20,0,20]},
   [{active:true,id:'old-man',position:[17,0,12]}],{active:true,position:[40,0,38]});
  assert.equal(elements.get('minimap').getAttribute('viewBox'),'-41 -26 132 132');
  assert.equal(mini.nodes.get('self').tagName,'path');
  assert.equal(mini.nodes.get('self').getAttribute('data-map-kind'),'self');
  assert.equal(mini.nodes.get('self').getAttribute('transform'),'translate(25 40) rotate(-90)');
  assert.equal(mini.nodes.get('player:p2').tagName,'circle');
  assert.notEqual(mini.nodes.get('player:p2').getAttribute('fill'),
   mini.nodes.get('player:p3').getAttribute('fill'));
  assert.equal(mini.nodes.get('boss').getAttribute('fill'),'#ed3048');
  assert.equal(mini.nodes.get('monster:old-man').getAttribute('fill'),'#ed3048');
  assert.equal(mini.nodes.get('collector').getAttribute('fill'),'#ac39e8');
  assert.equal(elements.get('map-dynamic').children.at(-1),mini.nodes.get('self'));
  // Disappeared NPCs must be removed, not left as stale markers.
  mini.update(2,roots,'me',{active:false},[],{active:false});
  assert.ok(!mini.nodes.has('boss')&&!mini.nodes.has('collector')&&!mini.nodes.has('monster:old-man'));
  assert.ok(mini.nodes.has('self'));
 }finally{globalThis.document=previous;}
});

test('guest entry is explicit and never downgrades a failed Google login',()=>{
 const html=source('index.html'),ui=source('src/ui.js'),
  network=source('src/network.js'),worker=source('cloudflare/worker.js'),
  main=source('src/main.js');
 assert.match(html,/id="guest-form"/);
 assert.match(html,/id="guest-name"[^>]+maxlength="24"/);
 assert.match(html,/id="guest-color"/);
 assert.match(html,/id="guest-enter"/);
 assert.match(html,/Google 登入用於儲存及恢復角色進度/);
 assert.match(ui,/\$\('guest-form'\)\.addEventListener\('submit'/);
 assert.match(ui,/mode:'guest'/);
 assert.match(network,/mode==='guest'\?\{mode:'guest'\}/);
 assert.match(worker,/const guestRequested=body\.mode==='guest'/);
 assert.match(worker,/if\(presentedToken\)\{/);
 assert.match(worker,/if\(guestRequested&&!identity&&!this\.consumeRate/);
 assert.match(worker,/!firebaseEnabled&&body\.name==='Ely'/);
 assert.match(worker,/authMode:identity\?'firebase':firebaseEnabled\?'guest':'legacy'/);
 assert.match(main,/world\?\.collector\)/);
});
