import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PAINT is the next visible function-menu item after BUILD, before WRITE',()=>{
 const html=source('index.html'),menu=html.slice(html.indexOf('<nav id="dock"'),html.indexOf('</nav>'));
 const build=menu.indexOf('data-panel="build"'),paint=menu.indexOf('id="paint-button"'),write=menu.indexOf('data-panel="social"');
 assert.ok(build>=0&&build<paint&&paint<write,'PAINT must be directly between BUILD and WRITE');
 const css=source('sketch-hud.css');
 assert.match(css,/#dock #paint-button\{display:none\}/);
 assert.match(css,/#hud\.functions-open #dock #paint-button\{display:block/);
 assert.match(css,/#dock #paint-button\{--menu-row:4\}/);
 assert.match(css,/#dock \[data-panel=social\]\{--menu-row:5\}/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/#hud\.functions-open #dock #paint-button\{top:calc\(110px/);
});

test('paint palette is a narrow right-side overlay above iOS joystick and combat',()=>{
 const css=source('wall-paint.css');
 assert.match(css,/#hud #paint-toolbar\{[\s\S]*?right:max\(10px/);
 assert.match(css,/#hud #paint-toolbar\{[\s\S]*?width:96px/);
 assert.match(css,/@media\(max-width:720px\),\(pointer:coarse\)\{/);
 assert.match(css, /width:76px/);
 assert.match(css,/#paint-toolbar\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(css,/#hud #paint-toolbar\{[\s\S]*?left:50%/);
});

test('opening PAINT closes functions menu and leaves joystick and jump enabled',()=>{
 const painter=source('src/city-wall-painter.js');
 assert.match(painter,/classList\.remove\('functions-open'\)/);
 assert.match(painter,/setAttribute\('aria-expanded','false'\)/);
 assert.match(painter,/player\.setEnabled\(!this\.ui\.panelName\)/);
 assert.doesNotMatch(painter,/player\.setEnabled\(!active&&/);
 assert.match(painter,/this\.brush\?\.addEventListener\('click'/);
 assert.match(painter,/this\.eraser\?\.addEventListener\('click'/);
});
