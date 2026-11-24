import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('only the pickup and throw interactions use the compact hint classes',()=>{
 const ui=read('src/ui.js');
 assert.match(ui,/near\?\.type==='artwork'\)text='A · TAKE ARTWORK'/);
 assert.match(ui,/prompt\.classList\.toggle\('artwork-pickup-hint',text==='A · TAKE ARTWORK'\)/);
 assert.match(ui,/prompt\.classList\.toggle\('artwork-throw-hint',text==='HOLD A · CHARGE THROW'\)/);
 assert.match(ui,/prompt\.classList\.toggle\('visible',!!text\)/);
});

test('compact pickup hint is smaller and 50% opaque when shown',()=>{
 const css=read('fidelity-ui.css');
 const compact=css.match(/#prompt\.artwork-pickup-hint,#prompt\.artwork-throw-hint\s*\{([^}]+)\}/)?.[1];
 const shown=css.match(/#prompt\.artwork-pickup-hint\.visible,#prompt\.artwork-throw-hint\.visible\s*\{([^}]+)\}/)?.[1];
 assert.ok(compact,'shared artwork-only CSS selector exists');
 assert.match(compact,/translate\(-50%,clamp\(28px,7vh,60px\)\)/);
 assert.match(compact,/scale\(\.7\)/);
 assert.match(shown||'',/opacity:\s*\.5/);
 assert.doesNotMatch(css,/#prompt\.visible\s*\{\s*opacity:\s*\.5/);
});

test('release token is bumped to avoid stale Safari UI modules',()=>{
 const html=read('index.html');
 assert.match(html,/const release = '[^']+-r\d+'/);
 assert.doesNotMatch(html,/20261124-giraffe-corridor-avatar-label-r96/);
});
