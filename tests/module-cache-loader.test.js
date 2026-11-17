import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function bootImportMap(now){
 assert.ok(source,'index.html must have an inline module-version bootstrap');
 const writes=[];
 runInNewContext(source,{Date:{now:()=>now},Math,JSON,document:{write:s=>writes.push(s)}});
 assert.equal(writes.length,1,'import map must be synchronously emitted before module evaluation');
 const result=writes[0].match(/^<script type="importmap">([\s\S]+)<\/script>$/);
 assert.ok(result,'generated importmap script must be well formed');
 return JSON.parse(result[1]).imports;
}

test('every first-party JS module resolves to the same cache-busted release',()=>{
 const a=bootImportMap(100000),b=bootImportMap(116000);
 const sources=readdirSync(new URL('../src/',import.meta.url),{recursive:true})
  .filter(file=>file.endsWith('.js'))
  .map(file=>'src/'+file.replaceAll('\\','/'));
 assert.ok(sources.length>100);
 assert.equal(Object.keys(a).length,sources.length+2);
 assert.equal(a.three,'./vendor/three/build/three.module.js');
 for(const file of sources){
  const key='./'+file;
  assert.ok(a[key],file+' missing from module manifest: Safari can load mixed releases');
  assert.equal(a[key].split('?')[0],key);
  assert.equal(a[key].split('?')[1],a['./src/main.js'].split('?')[1]);
  assert.equal(a[key],b[key],'module URLs must stay stable across page reloads: 15-second rotation breaks cellular cache');
 }
 assert.match(html,/import\("\.\/src\/main\.js"\)\.catch/,'dynamic module import must expose Safari errors');
 assert.match(html,/window\.templeLoadTimings/,'boot watchdog needed for pre-boot errors');
});
