import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {patchBagNode,reconcileBagGrid} from '../src/bag-dom.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
class Element{
 constructor(name,attrs={},children=[]){this.nodeName=name;this.nodeType=1;this.namespaceURI='html';this.attrs={...attrs};this.childNodes=[];for(const child of children)this.append(child);}
 get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
 get children(){return this.childNodes;}get firstElementChild(){return this.children[0]||null;}
 get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
 getAttribute(k){return this.attrs[k]??null;}hasAttribute(k){return Object.hasOwn(this.attrs,k);}
 setAttribute(k,v){this.attrs[k]=v;this.writes=(this.writes||0)+1;}removeAttribute(k){delete this.attrs[k];this.writes=(this.writes||0)+1;}
 isEqualNode(n){return this.nodeName===n.nodeName&&JSON.stringify(this.attrs)===JSON.stringify(n.attrs)&&this.children.length===n.children.length&&this.children.every((c,i)=>c.isEqualNode(n.children[i]));}
 append(n){this.insertBefore(n,null);}insertBefore(n,ref){if(n===ref)return;n.remove();const i=ref?this.children.indexOf(ref):this.children.length;assert.ok(i>=0);this.children.splice(i,0,n);n.parent=this;this.moves=(this.moves||0)+1;}
 remove(){if(this.parent){const p=this.parent;p.children.splice(p.children.indexOf(this),1);this.parent=null;}}
 replaceWith(n){const p=this.parent;p.insertBefore(n,this);this.remove();}
}
const cell=(key,eq=false)=>new Element('BUTTON',{'data-bag-key':key,class:eq?'bag-cell equipped':'bag-cell'},[new Element('IMG',{'data-preview':key,src:'blob:'+key})]);
test('equip-only BAG update preserves every cell and image, including recovered images',()=>{
 const a=cell('a',true),b=cell('b'),empty=new Element('DIV'),grid=new Element('DIV',{},[a,b,empty]);
 const img=a.children[0];img.attrs['data-preview-recovery']='1';const moves=grid.moves;
 reconcileBagGrid(grid,new Element('TEMPLATE',{},[cell('a'),cell('b',true),new Element('DIV')]));
 assert.equal(grid.children[0],a);assert.equal(grid.children[1],b);assert.equal(grid.children[2],empty);assert.equal(grid.moves,moves);assert.equal(a.children[0],img);assert.equal(img.writes,undefined);assert.equal(a.attrs.class,'bag-cell');assert.equal(b.attrs.class,'bag-cell equipped');
 reconcileBagGrid(grid,new Element('TEMPLATE',{},[cell('b',true),cell('c'),new Element('DIV')]));
 assert.equal(grid.children[0],b);assert.equal(grid.children[2],empty);assert.equal(a.parent,null);
});
test('EQUIP column patch preserves unchanged image and never touches live canvas',()=>{
 const a=cell('a'),b=cell('b'),column=new Element('DIV',{},[a,b]),image=b.children[0],canvas=new Element('CANVAS',{width:'180'}),layout=new Element('DIV',{},[column,canvas]);
 patchBagNode(column,new Element('DIV',{},[cell('c'),cell('b')]));
 assert.equal(layout.children[1],canvas);assert.equal(column.children[1].children[0],image);assert.equal(image.writes,undefined);
 patchBagNode(canvas,new Element('CANVAS',{width:'1'}));assert.equal(canvas.attrs.width,'180');
});
test('BAG action acknowledgement is deduplicated without modifying paper doll renderer',()=>{
 const bag=read('src/bag-view.js'),ui=read('src/ui.js'),main=read('src/main.js');
 assert.ok(bag.includes('reconcileBagGrid(keepGrid,fresh.content)'));assert.ok(bag.includes('patchBagNode(column,next)'));
 assert.ok(bag.includes('fresh.replaceWith(ui.bagPortraitCanvas)'));
 assert.ok(ui.includes('refreshBagAfterAction()'));assert.ok(ui.includes('this.panelSignature!==inventoryPanelSignature(this.world?.profile)'));
 assert.ok(main.includes("if(ui.panelName==='bag')ui.refreshBagAfterAction();else ui.renderPanel()"));
});
