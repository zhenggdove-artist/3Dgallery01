import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CITY_LOTS,CITY_BUILDING_COUNT,cityLots,cityBlocked,
 cityGroundHeight,cityRoofHeight
} from '../src/shared/city-layout.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('housing has tight, connected clusters rather than uniform spacing',()=>{
 assert.equal(CITY_LOTS.length,CITY_BUILDING_COUNT);
 assert.deepEqual(cityLots(),CITY_LOTS,'client and server must generate deterministic lots');
 let adjacent=0,compact=0,streets=0;
 for(let band=0;band<=6;band++){
  const ring=CITY_LOTS.filter(lot=>lot.band===band);
  assert.ok(ring.length>=48);
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   const edgeGap=Math.hypot(a.x-b.x,a.z-b.z)-(a.width+b.width)/2;
   if(a.cluster===b.cluster){
    adjacent++;
    if(edgeGap<.6)compact++;
   }else if(edgeGap>5){
    streets++;
   }
  }
 }
 assert.ok(adjacent>270,'most houses should be in contiguous groups');
 assert.ok(compact>250,'many house sidewalls should nearly meet');
 assert.ok(streets>=35,'some gaps should remain as irregular streets');
 assert.ok(CITY_LOTS.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.z)&&Number.isFinite(l.yaw)));
});

test('irregular houses preserve the existing shared collision and roof physics',()=>{
 for(const lot of CITY_LOTS){
  assert.equal(cityBlocked(lot.x,lot.z,0,{}),true,lot.id);
  const top=cityRoofHeight(lot,0);
  assert.equal(cityGroundHeight(lot.x,lot.z,top,{}),top,lot.id);
  assert.equal(cityBlocked(lot.x,lot.z,top,{}),false,lot.id);
 }
});

test('Win98 login is square and beveled while Google/GM selectors remain intact',()=>{
 const html=source('index.html');
 const css=source('fidelity-ui.css');
 const login=html.slice(html.indexOf('<main id="entry"'),html.indexOf('<section id="hud"'));
 assert.match(login,/temple-win98-titlebar/);
 assert.match(login,/temple-win98-window-controls/);
 assert.match(login,/data-google-login/);
 assert.match(login,/id="entry-form" hidden/);
 assert.match(login,/不會讀取 Gmail/);
 assert.match(html,/id="gm-title"[^>]*>GGTEMPLE<\/strong>/);
 assert.doesNotMatch(html,/id="gm-menu"/);
 assert.match(css,/#entry\s*\{[\s\S]*?background:#008080!important/);
 assert.match(css,/#entry \.temple-entry-card\{[\s\S]*?border-radius:0/);
 assert.match(css,/#entry \.temple-win98-titlebar\{/);
 assert.match(css,/#entry #entry-form\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(css,/background:radial-gradient\(ellipse at 50% 10%,#fff8fb/);
});
