import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('unread bulb uses a yellow CSS pulse, with reduced-motion fallback',()=>{
 const css=read('fidelity-ui.css'),html=read('index.html');
 assert.match(html,/id="gallery-guide" class="guide-unread"/);
 assert.match(css,/#gallery-guide\.guide-unread\{[\s\S]*?animation:gallery-guide-yellow-pulse/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\s*#gallery-guide\.guide-unread\{animation:none/);
});
test('guide attention is persisted separately for each player and stops on rendering the guide',()=>{
 const ui=read('src/ui.js');
 assert.match(ui,/temple-gallery-guide-read-v1:'\+String\(this\.self\?\.key/);
 assert.match(ui,/localStorage\.setItem\(key,'1'\)/);
 assert.match(ui,/classList\.remove\('guide-unread'\)/);
 assert.match(ui,/this\.self=data\.self;this\.refreshGalleryGuideAttention\(\)/);
 assert.match(ui,/Ａ鍵：攻擊／長按蓄氣／拿起／投擲物品<\/p>`;this\.markGalleryGuideRead\(\)/);
 assert.ok(ui.includes('贊助GGdove NT$30'));
 assert.ok(ui.includes('其他人的作品盜賣'));
});
