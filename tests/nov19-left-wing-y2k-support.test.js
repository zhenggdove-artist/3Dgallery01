import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wingTextureScaleX} from '../src/reletter/swallowtail-art.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('GM hand-painted canvas is mapped to actual left side; right is mirrored',()=>{
 const custom={design:'painted-wing'};
 const original={design:'swallowtail'};
 assert.equal(wingTextureScaleX(-1,custom),1,'left wing must show original GM drawing');
 assert.equal(wingTextureScaleX(1,custom),-1,'right wing must mirror original GM drawing');
 assert.equal(wingTextureScaleX(-1,original),-1,'do not change old Papilio left wing');
 assert.equal(wingTextureScaleX(1,original),1,'do not change old Papilio right wing');
 assert.throws(()=>wingTextureScaleX(0,custom),RangeError);
 const art=read('src/reletter/swallowtail-art.js');
 assert.match(art,/face\.scale\.x=wingTextureScaleX\(side,item\)/);
 assert.match(art,/wingSide=side<0\?'left':'right'/);
 const painter=read('src/gm-wing-painter.js');
 assert.match(painter,/LEFT WING · 左翅原圖/);
 assert.match(painter,/右翅由系統自動左右鏡像/);
});

test('public SUPPORT never includes GM design/management controls or GM-facing descriptions',()=>{
 const ui=read('src/ui.js');
 const start=ui.indexOf('  renderWingShop(profile){');
 const end=ui.indexOf('  hydrateWingGalleryImages(){',start);
 assert.ok(start>=0&&end>start);
 const support=ui.slice(start,end);
 assert.doesNotMatch(support,/data-open-wing-painter|data-open-wing-manage|data-gm-action/);
 assert.doesNotMatch(support,/GM TEST MODE|GM 特製|GM 畫|GM 管理|GM 自製/);
 assert.match(support,/data-wing-checkout/);
 assert.match(support,/wingDesignCredits/);
 assert.doesNotMatch(support,/wing-gacha-machine|data-draw-wing/);
 assert.match(support,/y2k-shell-header/);
 assert.match(support,/wing-payment-preview/);
 assert.match(support,/y2k-taskbar/);
 const editor=ui.slice(ui.indexOf('renderPanel(){'),ui.indexOf('  requestGmPresence(){'));
 assert.match(editor,/gm-wing-workspace/);
 assert.match(editor,/data-gm-action="wing-painter"/);
 assert.match(editor,/data-gm-action="wing-manage"/);
 assert.match(ui,/if\(\['gm','wing-manage'\]\.includes\(name\)/);
 assert.match(ui,/wingDesignCredits>0/);
});

test('Y2K support shows guarded ECPay entitlement and does not invent paid success',()=>{
 const css=read('wing-atelier.css'),html=read('index.html'),ui=read('src/ui.js');
 assert.match(css,/\.y2k-shell-header/);
 assert.match(css,/\.y2k-machine-halo/);
 assert.match(css,/\.y2k-display-banner/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(ui,/data-wing-checkout/);
 assert.match(ui,/drawRatePct/);
 assert.match(html,/20261119-lowered-staff-far-reticle-r11/);
 const section=ui.slice(ui.indexOf('  renderWingShop(profile){'),ui.indexOf('  hydrateWingGalleryImages(){'));
 assert.match(section,/PAYMENT UNAVAILABLE/);
 assert.match(section,/checkoutEnabled/,'backend status determines whether charging is enabled');
});
